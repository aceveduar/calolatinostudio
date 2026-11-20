/**
 * Crear o cambiar el enlace del portal de un alumno (escribe en la base local). Va aparte de domain/portal.ts
 * para que el portal mismo (lo que abre el alumno) no cargue la base de datos de la academia.
 */
import { actualizar } from '../db/repo';
import type { Alumno, ID } from '../db/types';
import { generarTokenPortal } from './portal';

/**
 * El portal lo abre la nube: un enlace recién creado se sube en ese momento (sin esperar el respaldo
 * automático), para que funcione aunque se abra o se mande de inmediato. Sin red, sube al volver.
 */
const subirYa = () => void import('../sync/engine').then((m) => m.sincronizar()).catch(() => {});

/** Token del portal: lo crea la primera vez que se necesita. */
const enCurso = new Map<ID, Promise<string>>();
export function asegurarPortal(alumno: Pick<Alumno, 'id' | 'portal'>): Promise<string> {
  if (alumno.portal) return Promise.resolve(alumno.portal);
  // dos llamadas seguidas (p. ej. StrictMode) no deben crear dos enlaces distintos
  let p = enCurso.get(alumno.id);
  if (!p) {
    const token = generarTokenPortal();
    p = actualizar('alumnos', alumno.id, { portal: token })
      .then(() => {
        subirYa();
        return token;
      })
      .finally(() => enCurso.delete(alumno.id));
    enCurso.set(alumno.id, p);
  }
  return p;
}

/** Nuevo enlace; el anterior deja de funcionar. */
export async function regenerarPortal(alumnoId: ID): Promise<string> {
  const token = generarTokenPortal();
  await actualizar('alumnos', alumnoId, { portal: token });
  subirYa();
  return token;
}

