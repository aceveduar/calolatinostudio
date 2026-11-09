/**
 * Casos de uso de recepción. La UI solo llama a estas funciones;
 * aquí viven las reglas de negocio y las escrituras atómicas.
 */
import { db } from '../db/db';
import { actualizar, crear, enTransaccion } from '../db/repo';
import type { Asistencia, Fecha, ID, Membresia, MetodoPago, Pago, Plan } from '../db/types';
import { hoy, sumarDias, sumarMeses } from './fechas';

export function calcularFin(plan: Plan, inicio: Fecha): Fecha {
  if (plan.tipo === 'mensual') return sumarDias(sumarMeses(inicio, 1), -1);
  if (plan.vigenciaDias) return sumarDias(inicio, plan.vigenciaDias - 1);
  return inicio;
}

export async function yaEntroHoy(alumnoId: ID, claseId: ID, fecha: Fecha = hoy()): Promise<boolean> {
  const n = await db.asistencias
    .where('[claseId+fecha]')
    .equals([claseId, fecha])
    .filter((a) => a.alumnoId === alumnoId && !a.anuladaAt && !a.deletedAt)
    .count();
  return n > 0;
}

export async function entrarConMembresia(p: {
  alumnoId: ID;
  claseId: ID;
  membresiaId: ID;
  usuarioId: ID;
}): Promise<Asistencia> {
  return crear('asistencias', {
    alumnoId: p.alumnoId,
    nombreVisitante: null,
    claseId: p.claseId,
    fecha: hoy(),
    membresiaId: p.membresiaId,
    pagoId: null,
    usuarioId: p.usuarioId,
    anuladaAt: null,
  });
}

/** Equivale a la tarjeta de $40: cobra y registra la entrada en un solo paso. */
export async function cobrarClaseSuelta(p: {
  alumnoId: ID | null;
  nombreVisitante?: string;
  claseId: ID;
  plan: Plan;
  monto?: number;
  metodo: MetodoPago;
  usuarioId: ID;
}): Promise<{ pago: Pago; asistencia: Asistencia }> {
  return enTransaccion(async () => {
    const pago = await crear('pagos', {
      alumnoId: p.alumnoId,
      planId: p.plan.id,
      concepto: p.plan.nombre,
      monto: p.monto ?? p.plan.precio,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      fecha: hoy(),
      anuladoAt: null,
      anuladoMotivo: null,
      anuladoPor: null,
    });
    const asistencia = await crear('asistencias', {
      alumnoId: p.alumnoId,
      nombreVisitante: p.alumnoId ? null : p.nombreVisitante?.trim() || 'Visitante',
      claseId: p.claseId,
      fecha: hoy(),
      membresiaId: null,
      pagoId: pago.id,
      usuarioId: p.usuarioId,
      anuladaAt: null,
    });
    return { pago, asistencia };
  });
}

/** Vende mensualidad o paquete. Si se indica clase, también registra la entrada de hoy. */
export async function venderPlan(p: {
  alumnoId: ID;
  plan: Plan;
  monto?: number;
  metodo: MetodoPago;
  inicio: Fecha;
  usuarioId: ID;
  entrarAClaseId?: ID;
}): Promise<{ pago: Pago; membresia: Membresia }> {
  return enTransaccion(async () => {
    const pago = await crear('pagos', {
      alumnoId: p.alumnoId,
      planId: p.plan.id,
      concepto: p.plan.nombre,
      monto: p.monto ?? p.plan.precio,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      fecha: hoy(),
      anuladoAt: null,
      anuladoMotivo: null,
      anuladoPor: null,
    });
    const membresia = await crear('membresias', {
      alumnoId: p.alumnoId,
      planId: p.plan.id,
      pagoId: pago.id,
      disciplinaId: p.plan.disciplinaId,
      inicio: p.inicio,
      fin: calcularFin(p.plan, p.inicio),
      clasesTotal: p.plan.tipo === 'mensual' ? null : p.plan.clases,
      anuladaAt: null,
    });
    if (p.entrarAClaseId && p.inicio <= hoy()) {
      await entrarConMembresia({
        alumnoId: p.alumnoId,
        claseId: p.entrarAClaseId,
        membresiaId: membresia.id,
        usuarioId: p.usuarioId,
      });
    }
    return { pago, membresia };
  });
}

/** Anula un cobro y todo lo que dependía de él. Queda registro de quién y por qué. */
export async function anularPago(pagoId: ID, motivo: string, usuarioId: ID): Promise<void> {
  await enTransaccion(async () => {
    const ahora = Date.now();
    await actualizar('pagos', pagoId, { anuladoAt: ahora, anuladoMotivo: motivo, anuladoPor: usuarioId });
    const asis = await db.asistencias.filter((a) => a.pagoId === pagoId && !a.anuladaAt).toArray();
    for (const a of asis) await actualizar('asistencias', a.id, { anuladaAt: ahora });
    const mems = await db.membresias.filter((m) => m.pagoId === pagoId && !m.anuladaAt).toArray();
    for (const m of mems) await actualizar('membresias', m.id, { anuladaAt: ahora });
  });
}

/** Solo para entradas cubiertas por membresía (sin dinero de por medio). */
export async function anularAsistencia(id: ID): Promise<void> {
  await actualizar('asistencias', id, { anuladaAt: Date.now() });
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('');
}
