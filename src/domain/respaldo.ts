/**
 * Respaldo local (archivo .json): exportar e importar.
 * Importar NUNCA borra: mezcla registro por registro y gana la versión más reciente.
 * Así sirve para recuperar un teléfono perdido o volver atrás un error.
 */
import { db, getMeta, setMeta } from '../db/db';
import { SYNC_TABLES, type Academia, type ID, type SyncTable } from '../db/types';
import { notificarCambioLocal } from '../sync/bus';

export interface Respaldo {
  version: number;
  exportado: string;
  datos: Partial<Record<SyncTable, Record<string, unknown>[]>>;
}

export async function exportarRespaldo(): Promise<Blob> {
  const datos: Respaldo['datos'] = {};
  for (const t of SYNC_TABLES) datos[t] = await db.table(t).toArray();
  return new Blob([JSON.stringify({ version: 1, exportado: new Date().toISOString(), datos } satisfies Respaldo, null, 1)], { type: 'application/json' });
}

export async function leerRespaldo(archivo: File): Promise<{ respaldo: Respaldo; academia: Academia; registros: number }> {
  let respaldo: Respaldo;
  try {
    respaldo = JSON.parse(await archivo.text());
  } catch {
    throw new Error('El archivo no es un respaldo de Compás.');
  }
  const academias = respaldo?.datos?.academias as Academia[] | undefined;
  if (respaldo?.version !== 1 || !academias?.length) throw new Error('El archivo no es un respaldo de Compás.');
  if (academias.length > 1) throw new Error('El respaldo tiene más de una academia.');
  const registros = SYNC_TABLES.reduce((n, t) => n + (respaldo.datos[t]?.length ?? 0), 0);
  return { respaldo, academia: academias[0], registros };
}

/** Mezcla el respaldo con lo que hay en el teléfono. Devuelve cuántos registros cambiaron. */
export async function restaurarRespaldo(respaldo: Respaldo): Promise<number> {
  const academia = (respaldo.datos.academias as unknown as Academia[])[0];
  const actual = await getMeta<ID>('academiaId');
  if (actual && actual !== academia.id) {
    const a = await db.academias.get(actual);
    throw new Error(`Este respaldo es de "${academia.nombre}" y este teléfono tiene "${a?.nombre ?? 'otra academia'}".`);
  }
  const enNube = await getMeta<boolean>('nubeVinculada');
  let cambiados = 0;
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    const at = Date.now();
    for (const t of SYNC_TABLES) {
      let filas = (respaldo.datos[t] ?? []) as { id: ID; updatedAt: number; maestroId?: ID | null }[];
      if (!filas.length) continue;
      if (t === 'clases') filas = filas.map((c) => ({ ...c, maestroId: c.maestroId ?? null })); // respaldos de la v1
      const locales = (await db.table(t).bulkGet(filas.map((f) => f.id))) as ({ updatedAt: number } | undefined)[];
      const nuevas = filas.filter((f, i) => !locales[i] || f.updatedAt > locales[i]!.updatedAt);
      if (!nuevas.length) continue;
      await db.table(t).bulkPut(nuevas);
      if (enNube) await db.outbox.bulkAdd(nuevas.map((f) => ({ table: t, id: f.id, at })));
      cambiados += nuevas.length;
    }
    if (!actual) await setMeta('academiaId', academia.id);
  });
  notificarCambioLocal();
  return cambiados;
}
