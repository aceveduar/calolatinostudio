/**
 * Apartados y encargos de la tienda.
 *  - Apartado (producto en existencia): pendiente → entregado. Aparta piezas mientras está pendiente.
 *  - Encargo (producto sobre pedido): pendiente (solicitado) → pedido (al proveedor) → llego → entregado.
 * Se pueden hacer desde el portal del alumno o en recepción; puede dejar anticipo y al entregar se cobra el resto.
 */
import { db } from '../db/db';
import { actualizar, crear, enTransaccion } from '../db/repo';
import type { EstadoPedido, ID, MetodoPago, Pedido, Producto } from '../db/types';
import { hoy } from './fechas';
import type { Movimiento } from './rapido';
import { venderProducto } from './tienda';

export const nombrePedido = (p: Pick<Pedido, 'opcion'>, producto: Pick<Producto, 'nombre'> | undefined) =>
  `${producto?.nombre ?? 'Producto'}${p.opcion ? ` (${p.opcion})` : ''}`;

export const ESTADO_PEDIDO: Record<EstadoPedido, string> = {
  pendiente: 'Por pedir',
  pedido: 'Pedido al proveedor',
  llego: 'Llegó',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** ¿Se puede entregar ya? Apartado en existencia pendiente, o encargo que ya llegó. */
export const listoParaEntregar = (p: Pick<Pedido, 'estado'>, producto: Pick<Producto, 'sobrePedido'> | undefined) =>
  p.estado === 'llego' || (p.estado === 'pendiente' && !producto?.sobrePedido);

export const totalPedido = (p: Pick<Pedido, 'precio' | 'cantidad'>) => p.precio * p.cantidad;
export const restaPorPagar = (p: Pick<Pedido, 'precio' | 'cantidad' | 'anticipo'>) => Math.max(0, totalPedido(p) - (p.anticipo ?? 0));

/** Piezas apartadas (pendientes de recoger) por producto en existencia. */
export function apartadas(pedidos: Pedido[]): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const p of pedidos) if (p.estado === 'pendiente' && !p.deletedAt) m.set(p.productoId, (m.get(p.productoId) ?? 0) + p.cantidad);
  return m;
}

/** Encargo hecho en recepción (con anticipo opcional). */
export async function crearEncargo(p: {
  alumnoId: ID;
  producto: Producto;
  opcion: string | null;
  nota: string;
  cantidad: number;
  anticipo: number;
  metodo: MetodoPago;
  usuarioId: ID;
  sedeId: ID | null;
}): Promise<Pedido> {
  if (p.cantidad < 1) throw new Error('Al menos una pieza');
  return enTransaccion(async () => {
    const pedido = await crear('pedidos', {
      alumnoId: p.alumnoId,
      productoId: p.producto.id,
      opcion: p.opcion,
      cantidad: p.cantidad,
      precio: p.producto.precio,
      estado: 'pendiente',
      pagoId: null,
      ...(p.nota.trim() ? { nota: p.nota.trim() } : {}),
    });
    if (p.anticipo > 0) await registrarAnticipo({ pedido, producto: p.producto, monto: p.anticipo, metodo: p.metodo, usuarioId: p.usuarioId, sedeId: p.sedeId });
    return (await db.pedidos.get(pedido.id))!;
  });
}

/** Anticipo: entra a caja hoy como venta de tienda (sin descontar piezas) y se resta al entregar. */
export async function registrarAnticipo(p: { pedido: Pedido; producto: Producto; monto: number; metodo: MetodoPago; usuarioId: ID; sedeId: ID | null }): Promise<void> {
  if (!(p.monto > 0)) throw new Error('El anticipo debe ser mayor a cero');
  if (p.monto > totalPedido(p.pedido)) throw new Error('El anticipo es más que el total');
  await enTransaccion(async () => {
    const pago = await crear('pagos', {
      ...(p.sedeId ? { sedeId: p.sedeId } : {}),
      alumnoId: p.pedido.alumnoId,
      planId: null,
      concepto: `Anticipo · ${nombrePedido(p.pedido, p.producto)}`,
      monto: p.monto,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      fecha: hoy(),
      anuladoAt: null,
      anuladoMotivo: null,
      anuladoPor: null,
    });
    await actualizar('pedidos', p.pedido.id, { anticipo: (p.pedido.anticipo ?? 0) + p.monto, anticipoPagoId: pago.id });
  });
}

/**
 * Entregar y cobrar: registra la venta (al precio con que se encargó, menos el anticipo) a nombre del alumno
 * y cierra el pedido. Devuelve el movimiento para sumarlo a la cuenta abierta en Entrada.
 */
export async function entregarPedido(p: { pedido: Pedido; producto: Producto; metodo: MetodoPago; usuarioId: ID; sedeId: ID | null }): Promise<Movimiento> {
  return enTransaccion(async () => {
    const actual = await db.pedidos.get(p.pedido.id);
    if (!actual || !listoParaEntregar(actual, p.producto)) throw new Error('Ese pedido ya se entregó, se canceló o aún no llega');
    const resto = restaPorPagar(actual);
    const mov = await venderProducto({
      producto: { ...p.producto, nombre: `${nombrePedido(actual, p.producto)}${actual.anticipo ? ' · resto' : ''}`, precio: actual.precio },
      cantidad: actual.cantidad,
      monto: resto,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      alumnoId: actual.alumnoId,
      sedeId: p.sedeId,
    });
    await actualizar('pedidos', actual.id, { estado: 'entregado', pagoId: mov.pagoId });
    return mov;
  });
}

export function cambiarEstado(ids: ID[], estado: EstadoPedido) {
  return enTransaccion(async () => {
    for (const id of ids) await actualizar('pedidos', id, { estado });
  });
}

export function cancelarPedido(id: ID) {
  return actualizar('pedidos', id, { estado: 'cancelado' });
}

/** Al deshacer la venta de un pedido, vuelve a quedar por entregar (los encargos, como "llegó"). */
export async function reabrirPedidoDePago(pagoId: ID): Promise<void> {
  const p = await db.pedidos.filter((x) => x.pagoId === pagoId && x.estado === 'entregado').first();
  if (!p) return;
  const prod = await db.productos.get(p.productoId);
  await actualizar('pedidos', p.id, { estado: prod?.sobrePedido ? 'llego' : 'pendiente', pagoId: null });
}

export interface RenglonProveedor {
  producto: Producto | undefined;
  opcion: string | null;
  nota: string | null;
  cantidad: number;
  pedidos: Pedido[];
}

/** Lista para el proveedor: encargos por pedir, juntos por producto + talla + detalle. */
export function listaProveedor(pedidos: Pedido[], productos: Map<ID, Producto>): RenglonProveedor[] {
  const m = new Map<string, RenglonProveedor>();
  for (const p of pedidos) {
    const producto = productos.get(p.productoId);
    if (p.estado !== 'pendiente' || p.deletedAt || !producto?.sobrePedido) continue;
    const k = `${p.productoId}|${p.opcion ?? ''}|${(p.nota ?? '').trim().toLowerCase()}`;
    const r = m.get(k) ?? { producto, opcion: p.opcion, nota: p.nota?.trim() || null, cantidad: 0, pedidos: [] };
    r.cantidad += p.cantidad;
    r.pedidos.push(p);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => (a.producto?.nombre ?? '').localeCompare(b.producto?.nombre ?? '') || (a.opcion ?? '').localeCompare(b.opcion ?? '', 'es', { numeric: true }));
}

/** Texto para mandar al proveedor por WhatsApp o copiar. */
export function textoProveedor(lista: RenglonProveedor[], academia: string): string {
  const lineas = lista.map((r) => `• ${r.cantidad} × ${r.producto?.nombre ?? 'Producto'}${r.opcion ? ` talla ${r.opcion}` : ''}${r.nota ? ` — ${r.nota}` : ''}`);
  return `Pedido de ${academia}:\n${lineas.join('\n')}\n\nTotal: ${lista.reduce((s, r) => s + r.cantidad, 0)} piezas. ¡Gracias!`;
}
