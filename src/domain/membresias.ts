import { sirveEn } from './sedes';
import type { Asistencia, Clase, Fecha, ID, Membresia } from '../db/types';
import { diasEntre } from './fechas';

export interface EstadoMembresia {
  membresia: Membresia;
  vigente: boolean;
  usadas: number;
  /** null = ilimitadas */
  restantes: number | null;
  diasRestantes: number;
}

export function estadoMembresia(m: Membresia, asistencias: Asistencia[], dia: Fecha): EstadoMembresia {
  const usadas = asistencias.filter((a) => a.membresiaId === m.id && !a.anuladaAt && !a.deletedAt).length;
  const restantes = m.clasesTotal === null ? null : Math.max(0, m.clasesTotal - usadas);
  const enFechas = dia >= m.inicio && dia <= m.fin;
  const vigente = !m.anuladaAt && !m.deletedAt && enFechas && (restantes === null || restantes > 0);
  return { membresia: m, vigente, usadas, restantes, diasRestantes: diasEntre(dia, m.fin) };
}

/**
 * Elige qué membresía cubre una clase. Prioriza la que vence antes
 * y las de paquete (con clases contadas) para no desperdiciarlas.
 */
export function membresiaQueCubre(
  estados: EstadoMembresia[],
  clase: Pick<Clase, 'id' | 'disciplinaId' | 'sedeId'>,
): EstadoMembresia | null {
  const aplicables = estados.filter(
    (e) =>
      e.vigente &&
      (e.membresia.disciplinaId === null || e.membresia.disciplinaId === clase.disciplinaId) &&
      sirveEn(e.membresia.sedeId, clase.sedeId) &&
      // mensual por clase (1 o 2 grupos): solo las clases elegidas al pagar
      (!e.membresia.claseIds?.length || e.membresia.claseIds.includes(clase.id)),
  );
  aplicables.sort((a, b) => {
    if (a.membresia.fin !== b.membresia.fin) return a.membresia.fin < b.membresia.fin ? -1 : 1;
    return (a.restantes === null ? 1 : 0) - (b.restantes === null ? 1 : 0);
  });
  return aplicables[0] ?? null;
}

export type Semaforo = 'ok' | 'pronto' | 'sin';

/** Estado general del alumno para mostrar en listas. */
export function semaforoAlumno(estados: EstadoMembresia[]): { tono: Semaforo; texto: string } {
  const vig = estados.filter((e) => e.vigente).sort((a, b) => b.diasRestantes - a.diasRestantes);
  const mejor = vig[0];
  if (!mejor) return { tono: 'sin', texto: 'Sin plan' };
  const pocas = mejor.restantes !== null && mejor.restantes <= 1;
  if (mejor.diasRestantes <= 3 || pocas) {
    const t = mejor.restantes !== null ? `${mejor.restantes} clase${mejor.restantes === 1 ? '' : 's'}` : textoDias(mejor.diasRestantes);
    return { tono: 'pronto', texto: t };
  }
  return {
    tono: 'ok',
    texto: mejor.restantes !== null ? `${mejor.restantes} clases` : `${mejor.diasRestantes} días`,
  };
}

export function textoDias(d: number): string {
  if (d <= 0) return 'vence hoy';
  if (d === 1) return 'vence mañana';
  return `${d} días`;
}

export function agruparPorAlumno<T extends { alumnoId: ID | null }>(items: T[]): Map<ID, T[]> {
  const m = new Map<ID, T[]>();
  for (const it of items) {
    if (!it.alumnoId) continue;
    const arr = m.get(it.alumnoId);
    if (arr) arr.push(it);
    else m.set(it.alumnoId, [it]);
  }
  return m;
}
