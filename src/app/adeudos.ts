/** Lo que debe un alumno (fiado), en vivo. */
import { useLiveQuery } from 'dexie-react-hooks';
import { useClases, usePlanes } from './datos';
import { db } from '../db/db';
import { adeudosDe } from '../domain/adeudos';

/** Hook: clases que debe un alumno (fiado) y el total. */
export function useAdeudos(alumnoId: string) {
  const clases = useClases();
  const planes = usePlanes();
  const asis = useLiveQuery(() => db.asistencias.where('alumnoId').equals(alumnoId).toArray(), [alumnoId], []);
  const adeudos = adeudosDe(asis, clases, planes);
  return { adeudos, total: adeudos.reduce((s, a) => s + a.monto, 0), planes };
}
