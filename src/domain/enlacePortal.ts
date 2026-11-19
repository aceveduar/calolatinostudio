/**
 * Crear o cambiar el enlace del portal de un alumno (escribe en la base local). Va aparte de domain/portal.ts
 * para que el portal mismo (lo que abre el alumno) no cargue la base de datos de la academia.
 */
import { actualizar } from '../db/repo';
import type { Alumno, ID } from '../db/types';
import { generarTokenPortal } from './portal';

/** Token del portal: lo crea la primera vez que se necesita. */
const enCurso = new Map<ID, Promise<string>>();
export function asegurarPortal(alumno: Pick<Alumno, 'id' | 'portal'>): Promise<string> {
  if (alumno.portal) return Promise.resolve(alumno.portal);
  // dos llamadas seguidas (p. ej. StrictMode) no deben crear dos enlaces distintos
  let p = enCurso.get(alumno.id);
  if (!p) {
    const token = generarTokenPortal();
    p = actualizar('alumnos', alumno.id, { portal: token })
      .then(() => token)
      .finally(() => enCurso.delete(alumno.id));
    enCurso.set(alumno.id, p);
  }
  return p;
}

/** Nuevo enlace; el anterior deja de funcionar. */
export async function regenerarPortal(alumnoId: ID): Promise<string> {
  const token = generarTokenPortal();
  await actualizar('alumnos', alumnoId, { portal: token });
  return token;
}

