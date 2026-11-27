/** Punto de venta: productos de la academia (aguas, snacks, artículos). */
import { db } from '../db/db';
import { crear, enTransaccion } from '../db/repo';
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

/** Lee el inventario vigente del equipo para el cobro directo, sin ocupar piezas apartadas. */
export async function venderEnMostrador(datos: Parameters<typeof venderProducto>[0]): Promise<Movimiento> {
  return enTransaccion(async () => {
    const producto = await db.productos.get(datos.producto.id);
    if (!producto?.activo || producto.deletedAt) throw new Error('Este producto ya no está disponible.');
    if (producto.inventario != null) {
      const [ventas, pedidos] = await Promise.all([
        db.pagos.where('productoId').equals(producto.id).toArray(),
        db.pedidos.where('estado').equals('pendiente').filter((p) => p.productoId === producto.id && !p.deletedAt).toArray(),
      ]);
      const reservado = pedidos.reduce((total, p) => total + p.cantidad, 0);
      if ((existencias(producto, ventas) ?? 0) - reservado < (datos.cantidad ?? 1)) {
        throw new Error(`${producto.nombre} está agotado o apartado.`);
      }
    }
    return venderProducto({ ...datos, producto });
  });
}

export async function venderProducto(p: { producto: Producto; cantidad?: number; monto?: number; metodo: MetodoPago; usuarioId: ID; alumnoId?: ID | null; sedeId?: ID | null }): Promise<Movimiento> {
  const cantidad = p.cantidad ?? 1;
  const pago = await crear('pagos', {
    ...conSede(p.sedeId),
    alumnoId: p.alumnoId ?? null,
    planId: null,
    productoId: p.producto.id,
    cantidad,
    // el costo se guarda en la venta: si después cambia, la ganancia de lo ya vendido no se mueve
    ...(p.producto.costo ? { costo: p.producto.costo * cantidad } : {}),
    concepto: p.producto.nombre,
    // monto distinto al precio × piezas: p. ej. al entregar un encargo con anticipo se cobra el resto
    monto: p.monto ?? p.producto.precio * cantidad,
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
