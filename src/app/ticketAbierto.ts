/** Qué ticket de compra está abierto (la hoja vive en el Layout; la venta ya cerró su propia hoja). */
import { useSyncExternalStore } from 'react';
import type { Academia, Alumno, Membresia, Pago } from '../db/types';
import { dinero } from '../domain/dinero';
import { fechaCorta } from '../domain/fechas';
import { armarMensaje, plantilla } from '../domain/mensajes';
import type { DatosTicket } from './ticket';

export type TicketAbierto = { ticket: DatosTicket; telefono: string; mensaje: string } | null;
let actual: TicketAbierto = null;
const subs = new Set<() => void>();
const avisarCambio = () => subs.forEach((s) => s());

export function abrirTicket(p: NonNullable<TicketAbierto>) {
  actual = p;
  avisarCambio();
}
export function abrirTicketDePlan(academia: Academia, alumno: Alumno, pago: Pago, membresia: Membresia, atendio: string) {
  const inicio = fechaCorta(membresia.inicio);
  const vence = fechaCorta(membresia.fin);
  const vigencia = membresia.inicio === membresia.fin ? inicio : `${inicio} al ${vence}`;
  const cantidad = membresia.clasesTotal;
  abrirTicket({
    telefono: alumno.telefono,
    mensaje: armarMensaje(plantilla(academia, 'recibo'), {
      nombre: alumno.nombre.split(' ')[0],
      academia: academia.nombre,
      monto: dinero(pago.monto),
      plan: pago.concepto.toLowerCase(),
      vigencia,
      vence,
    }),
    ticket: {
      academia: academia.nombre,
      logo: academia.logo,
      color: academia.color,
      pagoId: pago.id,
      at: pago.createdAt,
      alumno: alumno.nombre,
      codigo: alumno.codigo,
      concepto: pago.concepto,
      vigencia,
      clases: cantidad === null ? 'Clases ilimitadas' : `${cantidad} ${cantidad === 1 ? 'clase' : 'clases'}`,
      metodo: pago.metodo,
      monto: pago.monto,
      atendio,
    },
  });
}
export function cerrarTicket() {
  actual = null;
  avisarCambio();
}
export function useTicketAbierto(): TicketAbierto {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => actual,
  );
}
