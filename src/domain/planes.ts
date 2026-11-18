/** Planes y formas de pago: textos para mostrarlos. */
import type { MetodoPago, Plan } from '../db/types';
import { esBeca } from './becas';

export const METODOS: { valor: MetodoPago; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
];

export function describirPlan(p: Plan): string {
  if (esBeca(p)) return `Clases ilimitadas por ${p.vigenciaDias} días, sin costo`;
  if (p.tipo === 'mensual') return p.grupos ? `${p.grupos === 1 ? 'Una clase' : `${p.grupos} clases`} por un mes` : 'Clases ilimitadas por un mes';
  if (p.tipo === 'paquete') return `${p.clases} clases · vigencia ${p.vigenciaDias} días`;
  return 'Una clase';
}
