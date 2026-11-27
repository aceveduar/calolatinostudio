/**
 * Testimonios que los alumnos escriben desde su portal. Llegan pendientes; la academia los publica
 * (se agregan a la página pública) o no. En la página solo aparece el nombre de pila y la inicial del
 * apellido ("Ana L."): nunca el nombre completo de un alumno.
 */
import { db } from '../db/db';
import { actualizar } from '../db/repo';
import type { Academia, Alumno, ContenidoPagina, ID, Testimonio } from '../db/types';
import { nombrePublico } from './nombres';

export { nombrePublico };

/** Cuántos testimonios muestra la página como máximo (los más nuevos primero). */
export const MAX_EN_PAGINA = 8;

/** Los que se pusieron de muestra mientras no había reales. */
export const esEjemplo = (t: { texto: string }) => /^ejemplo\s*:/i.test(t.texto.trim());

/** La página con el testimonio nuevo primero: sin repetidos, sin los de ejemplo y con un máximo. */
export function conTestimonio(pagina: ContenidoPagina | null | undefined, nuevo: NonNullable<ContenidoPagina['testimonios']>[number]): ContenidoPagina {
  const antes = (pagina?.testimonios ?? []).filter((x) => !esEjemplo(x) && x.texto.trim() !== nuevo.texto.trim() && (!nuevo.testimonioId || x.testimonioId !== nuevo.testimonioId));
  return { ...(pagina ?? {}), testimonios: [nuevo, ...antes].slice(0, MAX_EN_PAGINA) };
}

/** Lo que se publica de un alumno: su texto, "Ana L." y desde cuándo viene. */
export function paraPagina(t: Pick<Testimonio, 'texto'>, alumno: Pick<Alumno, 'nombre' | 'createdAt'>) {
  return { texto: t.texto.trim(), nombre: nombrePublico(alumno.nombre), detalle: `En la academia desde ${new Date(alumno.createdAt).getFullYear()}` };
}

/** Publicar: se agrega a la página pública y queda marcado como aprobado (todo junto o nada). */
export async function publicarTestimonio(t: Testimonio, usuarioId: ID): Promise<void> {
  await db.transaction('rw', [db.academias, db.testimonios, db.alumnos, db.outbox], async () => {
    const alumno = await db.alumnos.get(t.alumnoId);
    const academia = (await db.academias.get(t.academiaId)) as Academia | undefined;
    if (!alumno || !academia) throw new Error('No se encontró al alumno');
    const actual = await db.testimonios.get(t.id);
    if (actual?.estado !== 'pendiente' || actual.deletedAt) throw new Error('Este testimonio ya fue revisado.');
    await actualizar('academias', academia.id, { pagina: conTestimonio(academia.pagina, { ...paraPagina(actual, alumno), testimonioId: t.id }) });
    await actualizar('testimonios', t.id, { estado: 'aprobado', revisadoAt: Date.now(), revisadoPor: usuarioId });
  });
}

/** No publicar (se puede deshacer: vuelve a pendiente). */
export function noPublicar(t: Testimonio, usuarioId: ID) {
  return actualizar('testimonios', t.id, { estado: 'rechazado', revisadoAt: Date.now(), revisadoPor: usuarioId });
}

export function volverAPendiente(t: Testimonio) {
  return actualizar('testimonios', t.id, { estado: 'pendiente', revisadoAt: null, revisadoPor: null });
}

export async function retirarTestimonio(t: Testimonio, usuarioId: ID): Promise<void> {
  await db.transaction('rw', [db.academias, db.testimonios, db.alumnos, db.outbox], async () => {
    const actual = await db.testimonios.get(t.id);
    if (actual?.estado !== 'aprobado' || actual.deletedAt) throw new Error('El estado del testimonio ya cambió.');
    const academia = await db.academias.get(actual.academiaId);
    if (!academia) throw new Error('No se encontró la academia.');
    const alumno = await db.alumnos.get(actual.alumnoId);
    const anterior = academia.pagina?.testimonios ?? [];
    const tieneIdentificador = anterior.some((x) => x.testimonioId === actual.id);
    const testimonios = anterior.filter((x) => tieneIdentificador
      ? x.testimonioId !== actual.id
      : !!x.testimonioId || !alumno || x.nombre !== nombrePublico(alumno.nombre) || x.texto.trim() !== actual.texto.trim());
    if (testimonios.length !== anterior.length) {
      await actualizar('academias', academia.id, { pagina: { ...academia.pagina, testimonios } });
    }
    await noPublicar(actual, usuarioId);
  });
}
