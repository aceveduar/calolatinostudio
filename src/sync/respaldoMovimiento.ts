import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../db/db';

export type RespaldoMovimiento = 'Guardado en este equipo' | 'Pendiente de sincronizar' | 'Respaldado';

export async function consultarRespaldo(ids: string[]) {
  const vinculada = await getMeta<boolean>('nubeVinculada');
  const pendientes = vinculada && ids.length ? await db.outbox.where('id').anyOf(ids).toArray() : [];
  return { vinculada, pendientes: new Set(pendientes.map((item) => item.id)) };
}

export function useRespaldoMovimientos(ids: (string | null)[]) {
  const clave = [...new Set(ids.filter((id) => id !== null))].sort().join(',');
  const respaldo = useLiveQuery(async () => ({
    clave,
    ...await consultarRespaldo(clave ? clave.split(',') : []),
  }), [clave]);

  return (...movimiento: (string | null)[]): RespaldoMovimiento | undefined => {
    if (respaldo?.clave !== clave || !movimiento.some(Boolean)) return undefined;
    if (!respaldo.vinculada) return 'Guardado en este equipo';
    return movimiento.some((id) => id && respaldo.pendientes.has(id)) ? 'Pendiente de sincronizar' : 'Respaldado';
  };
}
