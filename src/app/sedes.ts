/** Sedes: lista, nombre y la sede donde está trabajando ESTE equipo (se recuerda en el equipo, no se sincroniza). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db/db';
import type { Academia, ID, Sede } from '../db/types';

export const useSedes = () =>
  useLiveQuery(async () => (await db.sedes.filter((s) => !s.deletedAt && s.activo).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], [] as Sede[]);

export function nombreSede(sedeId: ID | null | undefined, sedes: Sede[], academia: Pick<Academia, 'sedePrincipal' | 'nombre'>): string {
  if (!sedeId) return academia.sedePrincipal?.trim() || 'Sede principal';
  return sedes.find((s) => s.id === sedeId)?.nombre ?? 'Sede';
}

/** Sede de este equipo: null = principal. Si la sede guardada ya no existe, vuelve a la principal. */
export function useSedeActual(): [ID | null, (id: ID | null) => Promise<void>] {
  const sedes = useSedes();
  const guardada = useLiveQuery(() => getMeta<ID | null>('sedeActual'), [], null);
  const actual = guardada && sedes.some((s) => s.id === guardada) ? guardada : null;
  return [actual, (id) => setMeta('sedeActual', id)];
}

export async function sedeActualGuardada(): Promise<ID | null> {
  const id = await getMeta<ID | null>('sedeActual');
  if (!id) return null;
  const s = await db.sedes.get(id);
  return s && !s.deletedAt && s.activo ? id : null;
}

/** Igualdad de sede tratando vacío/undefined como principal. */
export const mismaSede = (a: ID | null | undefined, b: ID | null | undefined) => (a ?? null) === (b ?? null);


export { PRINCIPAL } from '../domain/sedes';
