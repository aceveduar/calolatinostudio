/** Apartados de la tienda hechos por alumnos desde su portal: se entregan y cobran en recepción. */
import { db } from '../db/db';
import { actualizar, enTransaccion } from '../db/repo';
import type { ID, MetodoPago, Pedido, Producto } from '../db/types';
import type { Movimiento } from './rapido';
import { venderProducto } from './tienda';

export const nombrePedido = (p: Pick<Pedido, 'opcion'>, producto: Pick<Producto, 'nombre'> | undefined) =>
  `${producto?.nombre ?? 'Producto'}${p.opcion ? ` (${p.opcion})` : ''}`;

/** Piezas apartadas (pendientes de recoger) por producto. */
export function apartadas(pedidos: Pedido[]): Map<ID, number> {
  const m = new Map<ID, number>();
  for (const p of pedidos) if (p.estado === 'pendiente' && !p.deletedAt) m.set(p.productoId, (m.get(p.productoId) ?? 0) + p.cantidad);
  return m;
}

/**
 * Entregar y cobrar: registra la venta (al precio con que se apartó) a nombre del alumno y cierra el apartado.
 * Devuelve el movimiento para sumarlo a la cuenta abierta en Entrada.
 */
export async function entregarPedido(p: { pedido: Pedido; producto: Producto; metodo: MetodoPago; usuarioId: ID; sedeId: ID | null }): Promise<Movimiento> {
  return enTransaccion(async () => {
    const actual = await db.pedidos.get(p.pedido.id);
    if (!actual || actual.estado !== 'pendiente') throw new Error('Ese apartado ya se entregó o se canceló');
    const mov = await venderProducto({
      producto: { ...p.producto, nombre: nombrePedido(p.pedido, p.producto), precio: p.pedido.precio },
      cantidad: p.pedido.cantidad,
      metodo: p.metodo,
      usuarioId: p.usuarioId,
      alumnoId: p.pedido.alumnoId,
      sedeId: p.sedeId,
    });
    await actualizar('pedidos', p.pedido.id, { estado: 'entregado', pagoId: mov.pagoId });
    return mov;
  });
}

export function cancelarPedido(id: ID) {
  return actualizar('pedidos', id, { estado: 'cancelado' });
}

/** Al deshacer la venta de un apartado, vuelve a quedar pendiente. */
export async function reabrirPedidoDePago(pagoId: ID): Promise<void> {
  const p = await db.pedidos.filter((x) => x.pagoId === pagoId && x.estado === 'entregado').first();
  if (p) await actualizar('pedidos', p.id, { estado: 'pendiente', pagoId: null });
}
