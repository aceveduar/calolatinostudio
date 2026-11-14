/**
 * Cobro rápido: un toque decide solo qué hacer, como cuando Monse recibe $40 y da la tarjeta.
 *  - ya entró hoy a esta clase → no hace nada
 *  - tiene plan que cubre la clase → entrada sin cobro
 *  - si no → cobra clase suelta en efectivo
 * Todo es reversible con `deshacer` (borrado lógico), así no hacen falta confirmaciones.
 */
import { esBeca } from './becas';
import { db } from '../db/db';
import { actualizar, borrar, crear, enTransaccion } from '../db/repo';
import type { Clase, ID, MetodoPago, Plan } from '../db/types';
import { hoy } from './fechas';
import { sueltaPara } from './sedes';
import { estadoMembresia, membresiaQueCubre } from './membresias';
import { cobrarClaseSuelta, entrarConMembresia, generarCodigo, yaEntroHoy } from './operaciones';

export interface Movimiento {
  key: string;
  nombre: string;
  /** 0 si entró con su plan */
  monto: number;
  metodo: MetodoPago | null;
  pagoId: ID | null;
  /** null en ventas de tienda */
  asistenciaId: ID | null;
  /** venta de tienda */
  productoId?: ID;
  emoji?: string;
  /** entró con beca (se muestra "Beca" en lugar de "Plan") */
  beca?: boolean;
  /** alumno creado en este mismo cobro (se borra al deshacer) */
  alumnoCreadoId: ID | null;
}

export type Resultado = { tipo: 'ok'; mov: Movimiento } | { tipo: 'ya-entro' } | { tipo: 'sin-precio' };

/** Precio de clase suelta de la sede de esa clase (Estudio $60, Casa de Cultura $40…). */
export async function planSuelta(sedeId?: ID | null): Promise<Plan | undefined> {
  return sueltaPara(await db.planes.toArray(), sedeId);
}

export async function entradaRapida(p: { alumnoId: ID; nombre: string; clase: Clase; usuarioId: ID; alumnoCreadoId?: ID }): Promise<Resultado> {
  if (await yaEntroHoy(p.alumnoId, p.clase.id)) return { tipo: 'ya-entro' };

  const mems = await db.membresias.where('alumnoId').equals(p.alumnoId).filter((m) => !m.anuladaAt && !m.deletedAt).toArray();
  const asis = await db.asistencias.where('alumnoId').equals(p.alumnoId).toArray();
  const cubre = membresiaQueCubre(mems.map((m) => estadoMembresia(m, asis, hoy())), p.clase);
  const base = { key: crypto.randomUUID(), nombre: p.nombre, alumnoCreadoId: p.alumnoCreadoId ?? null };

  if (cubre) {
    const a = await entrarConMembresia({ alumnoId: p.alumnoId, claseId: p.clase.id, membresiaId: cubre.membresia.id, usuarioId: p.usuarioId });
    const beca = esBeca(await db.planes.get(cubre.membresia.planId));
    return { tipo: 'ok', mov: { ...base, monto: 0, metodo: null, pagoId: null, asistenciaId: a.id, ...(beca && { beca }) } };
  }

  const suelta = await planSuelta(p.clase.sedeId);
  if (!suelta) return { tipo: 'sin-precio' };
  const r = await cobrarClaseSuelta({ alumnoId: p.alumnoId, claseId: p.clase.id, plan: suelta, metodo: 'efectivo', usuarioId: p.usuarioId });
  return { tipo: 'ok', mov: { ...base, monto: r.pago.monto, metodo: 'efectivo', pagoId: r.pago.id, asistenciaId: r.asistencia.id } };
}

/** La tarjeta de siempre: cobra sin pedir nombre. */
export async function entradaSinNombre(clase: Clase, usuarioId: ID): Promise<Resultado> {
  const suelta = await planSuelta(clase.sedeId);
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
    if (m.asistenciaId) await borrar('asistencias', m.asistenciaId);
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
  // Para cuentas grandes: redondear hacia arriba a $100, $500 y $1,000
  const arriba = [10000, 50000, 100000].map((m) => Math.ceil((total + 1) / m) * m);
  return [...new Set([...billetes, ...arriba])].filter((b) => b > total).sort((a, b) => a - b).slice(0, 4);
}
