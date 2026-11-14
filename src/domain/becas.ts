/**
 * Becas: alumnos que entran sin pagar.
 * Una beca es un plan de $0 (se guarda como paquete de clases ilimitadas con vigencia), así funciona
 * con todo lo existente (entrada con QR, sedes, disciplinas) sin cambiar la base de datos.
 * Solo la dirección puede darlas; recepción solo ve que el alumno es becado.
 */
import type { Asistencia, Clase, Fecha, ID, Membresia, Plan } from '../db/types';
import { sueltaPara } from './sedes';

export const VIGENCIA_BECA = 180;

export function esBeca(plan: Pick<Plan, 'tipo' | 'precio'> | undefined | null): boolean {
  return !!plan && plan.tipo !== 'suelta' && plan.precio === 0;
}

export interface ResumenBecas {
  /** becados con beca vigente hoy */
  activas: { membresia: Membresia; asistencias: number }[];
  /** asistencias de becados en el periodo */
  asistencias: number;
  /** lo que habrían pagado esas asistencias como clase suelta */
  valor: number;
}

export function resumenBecas(p: {
  desde: Fecha;
  hasta: Fecha;
  hoy: Fecha;
  planes: Plan[];
  mems: Membresia[];
  asis: Asistencia[];
  clases: Clase[];
}): ResumenBecas {
  const planesBeca = new Set(p.planes.filter(esBeca).map((x) => x.id));
  const becas = p.mems.filter((m) => planesBeca.has(m.planId) && !m.anuladaAt && !m.deletedAt);
  const ids = new Set(becas.map((m) => m.id));
  const sedeDe = new Map(p.clases.map((c) => [c.id, c.sedeId ?? null]));
  const enPeriodo = p.asis.filter((a) => a.membresiaId && ids.has(a.membresiaId) && !a.anuladaAt && !a.deletedAt && a.fecha >= p.desde && a.fecha <= p.hasta);
  const porMem = new Map<ID, number>();
  let valor = 0;
  for (const a of enPeriodo) {
    porMem.set(a.membresiaId!, (porMem.get(a.membresiaId!) ?? 0) + 1);
    valor += sueltaPara(p.planes, sedeDe.get(a.claseId) ?? null)?.precio ?? 0;
  }
  const activas = becas
    .filter((m) => m.inicio <= p.hoy && m.fin >= p.hoy)
    // un renglón por alumno: la beca que termina más tarde
    .sort((a, b) => (a.fin < b.fin ? 1 : -1))
    .filter((m, i, arr) => arr.findIndex((o) => o.alumnoId === m.alumnoId) === i)
    .map((m) => ({ membresia: m, asistencias: becas.filter((o) => o.alumnoId === m.alumnoId).reduce((s, o) => s + (porMem.get(o.id) ?? 0), 0) }));
  return { activas, asistencias: enPeriodo.length, valor };
}
