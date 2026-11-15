/**
 * Clases por curso: tienen fecha de inicio (y de fin) y solo aceptan alumnos nuevos
 * hasta unas semanas después de empezar. Así nadie se mete a medio curso de Salsa 0.
 * Sin curso = se puede entrar cuando sea (grupos abiertos, práctica, Lady Style…).
 */
import type { Clase, Fecha } from '../db/types';
import { fechaCorta, sumarDias } from './fechas';

export const SEMANAS_PARA_ENTRAR = 2;

export type EstadoCurso =
  | { tipo: 'abierta'; aceptaNuevos: true; texto: null }
  | { tipo: 'pronto' | 'iniciando'; aceptaNuevos: true; texto: string }
  | { tipo: 'en-curso' | 'por-definir'; aceptaNuevos: false; texto: string };

export function estadoCurso(curso: Clase['curso'], hoy: Fecha): EstadoCurso {
  if (!curso?.inicio) return { tipo: 'abierta', aceptaNuevos: true, texto: null };
  const limite = sumarDias(curso.inicio, (curso.semanas ?? SEMANAS_PARA_ENTRAR) * 7);
  if (hoy < curso.inicio) return { tipo: 'pronto', aceptaNuevos: true, texto: `Nuevo grupo: inicia el ${fechaCorta(curso.inicio)}` };
  if (curso.fin && hoy > curso.fin) return { tipo: 'por-definir', aceptaNuevos: false, texto: 'Próximo grupo por confirmar' };
  if (hoy <= limite) return { tipo: 'iniciando', aceptaNuevos: true, texto: `Empezó el ${fechaCorta(curso.inicio)} · aún puedes entrar` };
  return { tipo: 'en-curso', aceptaNuevos: false, texto: curso.fin ? `Grupo en curso hasta el ${fechaCorta(curso.fin)}` : 'Grupo en curso' };
}
