/**
 * Cobro rápido: un toque decide solo qué hacer, como cuando Monse recibe $40 y da la tarjeta.
 *  - ya entró hoy a esta clase → no hace nada
 *  - tiene plan que cubre la clase → entrada sin cobro
 *  - si no → cobra clase suelta en efectivo
 * Todo es reversible con `deshacer` (borrado lógico), así no hacen falta confirmaciones.
 */
import { esBeca } from './becas';
import { reabrirPedidoDePago } from './pedidos';
import { db } from '../db/db';
import { actualizar, borrar, crear, enTransaccion } from '../db/repo';
import type { Clase, ID, MetodoPago, Plan } from '../db/types';
import { hoy } from './fechas';
import { sueltaDeClase, sueltaPara } from './sedes';
import { estadoMembresia, membresiaQueCubre, type EstadoMembresia } from './membresias';
import { sirveEn } from './sedes';
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
  /** entró con beca (se muestra "Beca" en lugar de "Plan") */
  beca?: boolean;
  /** alumno creado en este mismo cobro (se borra al deshacer) */
  alumnoCreadoId: ID | null;
  /** tiene plan pero paga esta clase: por qué ("su plan es solo para Lady Style 0") */
  aviso?: string;
  /** de quién es la entrada (para abrir sus opciones desde la cuenta) */
  alumnoId?: ID;
}

export type Resultado = { tipo: 'ok'; mov: Movimiento } | { tipo: 'ya-entro' } | { tipo: 'sin-precio' };

/** Precio de clase suelta de la sede de esa clase (Estudio $60, Casa de Cultura $40…). */
export async function planSuelta(sedeId?: ID | null): Promise<Plan | undefined> {
  return sueltaPara(await db.planes.toArray(), sedeId);
}

/**
 * Tiene plan pero esta clase se cobra: por qué, para decirlo en vez de solo "Cobrar $60" (que parecía un error).
 * Planes de clases fijas, de una disciplina o de otra sede no cubren cualquier clase; un paquete sin clases
 * tampoco, aunque siga en fecha. null = no tiene plan en fecha (cobrar es lo normal).
 */
export async function motivoSinPlan(estados: EstadoMembresia[], clase: Clase): Promise<string | null> {
  const dia = hoy();
  const enFecha = estados.filter((e) => !e.membresia.anuladaAt && !e.membresia.deletedAt && e.membresia.inicio <= dia && e.membresia.fin >= dia);
  if (!enFecha.length) return null;
  const vigentes = enFecha.filter((e) => e.vigente);
  if (!vigentes.length) return enFecha.some((e) => e.restantes === 0) ? 'a su paquete ya no le quedan clases' : null;
  const nombreDe = async (claseId: ID) => {
    const c = await db.clases.get(claseId);
    const d = c ? await db.disciplinas.get(c.disciplinaId) : undefined;
    return c ? [d?.nombre ?? 'Clase', c.nivel].filter(Boolean).join(' ') : 'otra clase';
  };
  const m = vigentes[0].membresia;
  if (m.claseIds?.length && !m.claseIds.includes(clase.id)) {
    const nombres = await Promise.all(m.claseIds.map(nombreDe));
    return `su plan es solo para ${nombres.join(' y ')}`;
  }
  if (m.disciplinaId && m.disciplinaId !== clase.disciplinaId) {
    const d = await db.disciplinas.get(m.disciplinaId);
    return `su plan es solo de ${d?.nombre ?? 'otra disciplina'}`;
  }
  if (!sirveEn(m.sedeId ?? null, clase.sedeId ?? null)) return 'su plan es de otra sede';
  return null;
}

export async function entradaRapida(p: { alumnoId: ID; nombre: string; clase: Clase; usuarioId: ID; alumnoCreadoId?: ID }): Promise<Resultado> {
  if (await yaEntroHoy(p.alumnoId, p.clase.id)) return { tipo: 'ya-entro' };

  const mems = await db.membresias.where('alumnoId').equals(p.alumnoId).filter((m) => !m.anuladaAt && !m.deletedAt).toArray();
  const asis = await db.asistencias.where('alumnoId').equals(p.alumnoId).toArray();
  const estados = mems.map((m) => estadoMembresia(m, asis, hoy()));
  const cubre = membresiaQueCubre(estados, p.clase);
  const base = { key: crypto.randomUUID(), nombre: p.nombre, alumnoCreadoId: p.alumnoCreadoId ?? null, alumnoId: p.alumnoId };

  if (cubre) {
    const a = await entrarConMembresia({ alumnoId: p.alumnoId, claseId: p.clase.id, membresiaId: cubre.membresia.id, usuarioId: p.usuarioId });
    const beca = esBeca(await db.planes.get(cubre.membresia.planId));
    return { tipo: 'ok', mov: { ...base, monto: 0, metodo: null, pagoId: null, asistenciaId: a.id, ...(beca && { beca }) } };
  }

  const suelta = sueltaDeClase(await db.planes.toArray(), p.clase);
  if (!suelta) return { tipo: 'sin-precio' };
  const aviso = await motivoSinPlan(estados, p.clase);
  const r = await cobrarClaseSuelta({ alumnoId: p.alumnoId, claseId: p.clase.id, plan: suelta, metodo: 'efectivo', usuarioId: p.usuarioId });
  return { tipo: 'ok', mov: { ...base, monto: r.pago.monto, metodo: 'efectivo', pagoId: r.pago.id, asistenciaId: r.asistencia.id, ...(aviso ? { aviso } : {}) } };
}

/** La tarjeta de siempre: cobra sin pedir nombre. */
export async function entradaSinNombre(clase: Clase, usuarioId: ID): Promise<Resultado> {
  const suelta = sueltaDeClase(await db.planes.toArray(), clase);
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
    if (!sueltaDeClase(await db.planes.toArray(), clase)) return { tipo: 'sin-precio' };
    const a = await crear('alumnos', { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: '', notas: '', codigo: generarCodigo(), activo: true });
    return entradaRapida({ alumnoId: a.id, nombre: a.nombre, clase, usuarioId, alumnoCreadoId: a.id });
  });
}

export async function deshacer(m: Movimiento): Promise<void> {
  await enTransaccion(async () => {
    if (m.asistenciaId) await borrar('asistencias', m.asistenciaId);
    if (m.pagoId) await borrar('pagos', m.pagoId);
    // si era la entrega de un apartado, vuelve a quedar por recoger
    if (m.pagoId && m.productoId) await reabrirPedidoDePago(m.pagoId);
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
