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

/** Campos que solo existen en el teléfono (índices calculados): no van en el respaldo. */
const SOLO_LOCALES = ['deuda'];
const POR_BLOQUE = 2000;

/**
 * El respaldo, comprimido (gzip) cuando el navegador puede: con miles de alumnos el JSON pesaba ~90 MB
 * (no se podía mandar por WhatsApp ni correo) y comprimido queda en unos MB.
 * Se arma por bloques para no tener toda la academia en memoria a la vez (celulares económicos).
 */
export async function exportarRespaldo(): Promise<{ archivo: Blob; extension: 'json' | 'json.gz' }> {
  const partes: string[] = [`{"version":1,"exportado":${JSON.stringify(new Date().toISOString())},"datos":{`];
  for (const [i, t] of SYNC_TABLES.entries()) {
    partes.push(`${i ? ',' : ''}${JSON.stringify(t)}:[`);
    let ultimo: ID | null = null;
    let primero = true;
    for (;;) {
      const bloque = (await (ultimo === null ? db.table(t).orderBy(':id') : db.table(t).where(':id').above(ultimo)).limit(POR_BLOQUE).toArray()) as Record<string, unknown>[];
      if (!bloque.length) break;
      for (const f of bloque) for (const k of SOLO_LOCALES) delete f[k];
      partes.push((primero ? '' : ',') + bloque.map((f) => JSON.stringify(f)).join(','));
      primero = false;
      ultimo = bloque[bloque.length - 1].id as ID;
      if (bloque.length < POR_BLOQUE) break;
    }
    partes.push(']');
  }
  partes.push('}}');
  const json = new Blob(partes, { type: 'application/json' });
  if (typeof CompressionStream === 'undefined') return { archivo: json, extension: 'json' };
  const gz = await new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  return { archivo: new Blob([gz], { type: 'application/gzip' }), extension: 'json.gz' };
}

/** Lee el archivo, comprimido o no (los respaldos anteriores no venían comprimidos). */
async function textoDe(archivo: File): Promise<string> {
  const inicio = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  const esGzip = inicio[0] === 0x1f && inicio[1] === 0x8b;
  if (!esGzip) return archivo.text();
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no puede abrir respaldos comprimidos. Usa Chrome, Edge o Safari actualizado.');
  return new Response(archivo.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

export async function leerRespaldo(archivo: File): Promise<{ respaldo: Respaldo; academia: Academia; registros: number }> {
  let respaldo: Respaldo;
  try {
    respaldo = JSON.parse(await textoDe(archivo));
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
