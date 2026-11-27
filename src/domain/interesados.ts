/** Interesados: gente que se inscribió en la página pública (o que recepción anotó) y aún no es alumno. */
import { actualizar, crear, enTransaccion } from '../db/repo';
import { db } from '../db/db';
import type { Alumno, Clase, ID, Interesado } from '../db/types';
import { DIAS_CORTOS } from './fechas';
import { generarCodigo } from './operaciones';

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "lunes y miércoles a las 20:00" */
export function horarioDe(c: Pick<Clase, 'dias' | 'horaInicio'>): string {
  const d = [1, 2, 3, 4, 5, 6, 0].filter((x) => c.dias.includes(x)).map((x) => DIAS_LARGOS[x]);
  const dias = d.length <= 1 ? (d[0] ?? '') : `${d.slice(0, -1).join(', ')} y ${d[d.length - 1]}`;
  return `${dias} a las ${c.horaInicio}`;
}
export const horarioCorto = (c: Pick<Clase, 'dias' | 'horaInicio'>) =>
  `${[1, 2, 3, 4, 5, 6, 0].filter((x) => c.dias.includes(x)).map((x) => DIAS_CORTOS[x]).join(' ')} ${c.horaInicio}`;

export function anotarInteresado(p: { nombre: string; telefono: string; claseId: ID | null; mensaje: string }): Promise<Interesado> {
  const tel = p.telefono.replace(/\D/g, '').slice(-10);
  if (p.nombre.trim().length < 2) throw new Error('Escribe el nombre');
  if (tel.length !== 10) throw new Error('El WhatsApp debe tener 10 dígitos');
  return crear('interesados', { nombre: p.nombre.trim(), telefono: tel, claseId: p.claseId, mensaje: p.mensaje.trim(), estado: 'nuevo', contactadoAt: null, alumnoId: null });
}

export function marcarContactado(id: ID) {
  return actualizar('interesados', id, { estado: 'contactado', contactadoAt: Date.now() });
}

export function descartar(id: ID) {
  return actualizar('interesados', id, { estado: 'descartado' });
}

/** Ya vino: se da de alta como alumno (con su teléfono) y deja de estar en la lista. */
export async function registrarComoAlumno(i: Interesado, contextoClase = ''): Promise<Alumno> {
  return enTransaccion(async () => {
    const actual = await db.interesados.get(i.id);
    if (!actual || actual.deletedAt || actual.estado === 'descartado') throw new Error('La solicitud ya no está disponible.');
    if (actual.alumnoId) {
      const existente = await db.alumnos.get(actual.alumnoId);
      if (existente && !existente.deletedAt) return existente;
      throw new Error('La ficha vinculada ya no está disponible.');
    }
    if (actual.estado === 'inscrito') throw new Error('La solicitud ya fue registrada.');
    const nota = actual.mensaje ? `“${actual.mensaje}”` : '';
    const notas = [contextoClase ? `Solicitó ${contextoClase}.` : '', nota].filter(Boolean).join(' ');
    const alumno = await crear('alumnos', { nombre: actual.nombre, telefono: actual.telefono, notas, codigo: generarCodigo(), activo: true });
    await actualizar('interesados', i.id, { estado: 'inscrito', alumnoId: alumno.id });
    return alumno;
  });
}
