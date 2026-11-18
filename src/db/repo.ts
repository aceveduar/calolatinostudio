import { db, getMeta } from './db';
import type { ID, SyncTable, TablaMap } from './types';
import { notificarCambioLocal } from '../sync/bus';

export const uuid = (): ID => crypto.randomUUID();

export async function academiaActualId(): Promise<ID> {
  const id = await getMeta<ID>('academiaId');
  if (!id) throw new Error('No hay academia configurada');
  return id;
}

type Nuevo<T> = Omit<T, 'id' | 'academiaId' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id?: ID;
};

/**
 * Única puerta de escritura para entidades sincronizables.
 * Guarda el registro y lo encola en el outbox en la misma transacción,
 * así nunca se pierde un cambio aunque se cierre la app o no haya red.
 * `campos`: qué cambió (lo pone `actualizar`). Así a la nube solo se suben esos campos y un teléfono
 * que estuvo sin red no pisa lo que otro cambió mientras tanto en el mismo registro.
 */
export async function guardar<K extends SyncTable>(tabla: K, registro: TablaMap[K], campos?: string[]): Promise<TablaMap[K]> {
  const conFecha = { ...registro, updatedAt: Date.now() } as TablaMap[K];
  await db.transaction('rw', db.table(tabla), db.outbox, async () => {
    await db.table(tabla).put(conFecha);
    await db.outbox.add({ table: tabla, id: conFecha.id, at: conFecha.updatedAt, ...(campos ? { campos } : {}) });
  });
  notificarCambioLocal();
  return conFecha;
}

export async function crear<K extends Exclude<SyncTable, 'academias'>>(
  tabla: K,
  datos: Nuevo<TablaMap[K]>,
): Promise<TablaMap[K]> {
  const ahora = Date.now();
  const registro = {
    ...datos,
    id: datos.id ?? uuid(),
    academiaId: await academiaActualId(),
    createdAt: ahora,
    updatedAt: ahora,
    deletedAt: null,
  } as unknown as TablaMap[K];
  return guardar(tabla, registro);
}

const igual = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

export async function actualizar<K extends SyncTable>(
  tabla: K,
  id: ID,
  cambios: Partial<TablaMap[K]>,
): Promise<TablaMap[K]> {
  // leer y escribir juntos: que una bajada de la nube no se cuele en medio
  return db.transaction('rw', db.table(tabla), db.outbox, async () => {
    const actual = (await db.table(tabla).get(id)) as TablaMap[K] | undefined;
    if (!actual) throw new Error(`${tabla}/${id} no existe`);
    const campos = Object.keys(cambios).filter((k) => !igual((actual as unknown as Record<string, unknown>)[k], (cambios as Record<string, unknown>)[k]));
    return guardar(tabla, { ...actual, ...cambios }, campos);
  });
}

/** Borrado lógico: se conserva para auditoría y para propagar la baja a otros dispositivos. */
export function borrar<K extends SyncTable>(tabla: K, id: ID) {
  return actualizar(tabla, id, { deletedAt: Date.now() } as Partial<TablaMap[K]>);
}

/** Varias escrituras atómicas (p. ej. pago + asistencia). */
export async function enTransaccion<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction(
    'rw',
    [db.pagos, db.asistencias, db.membresias, db.alumnos, db.planes, db.clases, db.pedidos, db.productos, db.eventos, db.boletos, db.rentas, db.gastos, db.interesados, db.outbox, db.meta],
    fn,
  );
}
