/**
 * Alumnos archivados: los que dejaron de venir (sin entradas en ~6 meses y sin plan vigente) salen solos de la
 * lista, para que Monse vea solo a quien viene. Nunca se borran: el historial y los pagos quedan, aparecen al
 * buscarlos y vuelven solos a la lista en cuanto vuelven a entrar. No es lo mismo que "dar de baja" (a mano).
 */
import type { Alumno, ID } from '../db/types';

export function estaArchivado(a: Pick<Alumno, 'id' | 'activo' | 'createdAt'>, vinieron: Set<ID>, conPlan: boolean, ahoraMs: number, dias: number): boolean {
  if (!a.activo || conPlan || vinieron.has(a.id)) return false;
  // recién registrados (aún no vienen o apenas se inscribieron) no se archivan
  return ahoraMs - a.createdAt > dias * 86_400_000;
}
