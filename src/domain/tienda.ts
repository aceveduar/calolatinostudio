/** Punto de venta: productos de la academia (aguas, snacks, artículos). */
import { db } from '../db/db';
import { crear } from '../db/repo';
import type { ID, MetodoPago, Pago, Producto } from '../db/types';
import { hoy } from './fechas';
import { conSede } from './sedes';
import type { Movimiento } from './rapido';

/** Piezas disponibles: las que había en `inventarioAt` menos lo vendido después. null = sin control. */
export function existencias(p: Producto, ventas: Pago[]): number | null {
  if (p.inventario === null || p.inventario === undefined) return null;
  const desde = p.inventarioAt ?? 0;
  const vendidas = ventas
    .filter((v) => v.productoId === p.id && !v.anuladoAt && !v.deletedAt && v.createdAt >= desde)
    .reduce((s, v) => s + (v.cantidad ?? 1), 0);
  return p.inventario - vendidas;
}

export type EstadoExistencia = 'libre' | 'ok' | 'pocas' | 'agotado';
export function estadoExistencia(p: Producto, disponibles: number | null): EstadoExistencia {
  if (disponibles === null) return 'libre';
  if (disponibles <= 0) return 'agotado';
  return disponibles <= p.alerta ? 'pocas' : 'ok';
}

/** Ventas de productos (todas las que tienen producto), para calcular existencias. */
export function ventasDeProductos(): Promise<Pago[]> {
  return db.pagos.where('productoId').above('').toArray();
}

export async function venderProducto(p: { producto: Producto; cantidad?: number; metodo: MetodoPago; usuarioId: ID; alumnoId?: ID | null; sedeId?: ID | null }): Promise<Movimiento> {
  const cantidad = p.cantidad ?? 1;
  const pago = await crear('pagos', {
    ...conSede(p.sedeId),
    alumnoId: p.alumnoId ?? null,
    planId: null,
    productoId: p.producto.id,
    cantidad,
    concepto: p.producto.nombre,
    monto: p.producto.precio * cantidad,
    metodo: p.metodo,
    usuarioId: p.usuarioId,
    fecha: hoy(),
    anuladoAt: null,
    anuladoMotivo: null,
    anuladoPor: null,
  });
  return {
    key: crypto.randomUUID(),
    nombre: p.producto.nombre,
    emoji: p.producto.emoji,
    productoId: p.producto.id,
    monto: pago.monto,
    metodo: p.metodo,
    pagoId: pago.id,
    asistenciaId: null,
    alumnoCreadoId: null,
  };
}

/** Producto activo con ese código de barras (o undefined). */
export async function productoPorCodigo(codigo: string): Promise<Producto | undefined> {
  const c = codigo.trim();
  if (!c) return undefined;
  return db.productos.where('codigo').equals(c).filter((p) => !p.deletedAt && p.activo).first();
}

/** Emojis sugeridos para que cada producto se reconozca de un vistazo en la cuadrícula. */
export const EMOJIS_PRODUCTO = ['💧', '🥤', '🧃', '⚡', '☕', '🍪', '🍫', '🍬', '🍭', '🥜', '🍌', '🥪', '👕', '🧢', '👟', '🩰', '🧦', '🎒', '🧴', '🎟️', '🛍️'];
