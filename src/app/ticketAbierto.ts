/** Qué ticket de compra está abierto (la hoja vive en el Layout; la venta ya cerró su propia hoja). */
import { useSyncExternalStore } from 'react';
import type { DatosTicket } from './ticket';

export type TicketAbierto = { ticket: DatosTicket; telefono: string; mensaje: string } | null;
let actual: TicketAbierto = null;
const subs = new Set<() => void>();
const avisarCambio = () => subs.forEach((s) => s());

export function abrirTicket(p: NonNullable<TicketAbierto>) {
  actual = p;
  avisarCambio();
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
