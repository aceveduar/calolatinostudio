/**
 * Cobro rápido: un toque decide solo qué hacer, como cuando Monse recibe $40 y da la tarjeta.
 *  - ya entró hoy a esta clase → no hace nada
 *  - tiene plan que cubre la clase → entrada sin cobro
 *  - si no → cobra clase suelta en efectivo
 * Todo es reversible con `deshacer` (borrado lógico), así no hacen falta confirmaciones.
 */
import { db } from '../db/db';
import { actualizar, borrar, crear, enTransaccion } from '../db/repo';
import type { Clase, ID, MetodoPago, Plan } from '../db/types';
import { hoy } from './fechas';
import { estadoMembresia, membresiaQueCubre } from './membresias';
import { cobrarClaseSuelta, entrarConMembresia, generarCodigo, yaEntroHoy } from './operaciones';

export interface Movimiento {
  key: string;
  nombre: string;
  /** 0 si entró con su plan */
  monto: number;
  metodo: MetodoPago | null;
  pagoId: ID | null;
  asistenciaId: ID;
  /** alumno creado en este mismo cobro (se borra al deshacer) */
  alumnoCreadoId: ID | null;
}

export type Resultado = { tipo: 'ok'; mov: Movimiento } | { tipo: 'ya-entro' } | { tipo: 'sin-precio' };

export async function planSuelta(): Promise<Plan | undefined> {
  return db.planes.filter((p) => p.tipo === 'suelta' && p.activo && !p.deletedAt).first();
}

export async function entradaRapida(p: { alumnoId: ID; nombre: string; clase: Clase; usuarioId: ID; alumnoCreadoId?: ID }): Promise<Resultado> {
  if (await yaEntroHoy(p.alumnoId, p.clase.id)) return { tipo: 'ya-entro' };

  const mems = await db.membresias.where('alumnoId').equals(p.alumnoId).filter((m) => !m.anuladaAt && !m.deletedAt).toArray();
  const asis = await db.asistencias.where('alumnoId').equals(p.alumnoId).toArray();
  const cubre = membresiaQueCubre(mems.map((m) => estadoMembresia(m, asis, hoy())), p.clase);
  const base = { key: crypto.randomUUID(), nombre: p.nombre, alumnoCreadoId: p.alumnoCreadoId ?? null };

  if (cubre) {
    const a = await entrarConMembresia({ alumnoId: p.alumnoId, claseId: p.clase.id, membresiaId: cubre.membresia.id, usuarioId: p.usuarioId });
    return { tipo: 'ok', mov: { ...base, monto: 0, metodo: null, pagoId: null, asistenciaId: a.id } };
  }

  const suelta = await planSuelta();
  if (!suelta) return { tipo: 'sin-precio' };
  const r = await cobrarClaseSuelta({ alumnoId: p.alumnoId, claseId: p.clase.id, plan: suelta, metodo: 'efectivo', usuarioId: p.usuarioId });
  return { tipo: 'ok', mov: { ...base, monto: r.pago.monto, metodo: 'efectivo', pagoId: r.pago.id, asistenciaId: r.asistencia.id } };
}

/** La tarjeta de siempre: cobra sin pedir nombre. */
export async function entradaSinNombre(clase: Clase, usuarioId: ID): Promise<Resultado> {
  const suelta = await planSuelta();
  if (!suelta) return { tipo: 'sin-precio' };
  const r = await cobrarClaseSuelta({ alumnoId: null, claseId: clase.id, plan: suelta, metodo: 'efectivo', usuarioId });
  return {
    tipo: 'ok',
    mov: { key: crypto.randomUUID(), nombre: 'Sin nombre', monto: r.pago.monto, metodo: 'efectivo', pagoId: r.pago.id, asistenciaId: r.asistencia.id, alumnoCreadoId: null },
  };
}

/** Alumno nuevo en un solo toque: se registra solo con su nombre y paga. */
export async function nuevoYCobrar(nombre: string, clase: Clase, usuarioId: ID): Promise<Resultado> {
  return enTransaccion(async () => {
    const a = await crear('alumnos', { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: '', notas: '', codigo: generarCodigo(), activo: true });
    return entradaRapida({ alumnoId: a.id, nombre: a.nombre, clase, usuarioId, alumnoCreadoId: a.id });
  });
}

export async function deshacer(m: Movimiento): Promise<void> {
  await enTransaccion(async () => {
    await borrar('asistencias', m.asistenciaId);
    if (m.pagoId) await borrar('pagos', m.pagoId);
    if (m.alumnoCreadoId) await borrar('alumnos', m.alumnoCreadoId);
  });
}

export async function cambiarMetodo(movs: Movimiento[], metodo: MetodoPago): Promise<void> {
  await enTransaccion(async () => {
    for (const m of movs) if (m.pagoId) await actualizar('pagos', m.pagoId, { metodo });
  });
}

/** Billetes con los que probablemente pagaron: los más chicos que alcanzan el total. */
export function billetesSugeridos(total: number): number[] {
  const billetes = [2000, 5000, 10000, 20000, 50000, 100000];
  return billetes.filter((b) => b > total).slice(0, 4);
}
