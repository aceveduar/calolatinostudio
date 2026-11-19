import type { Asistencia, Pago } from '../db/types';

export interface ResumenCaja {
  efectivo: number;
  transferencia: number;
  tarjeta: number;
  total: number;
  /** ventas de la tienda (productos) */
  tienda: number;
  /** cobros de renta del salón */
  rentas: number;
  /** boletos de eventos (dinero aparte) */
  eventos: number;
  cobros: number;
  anulados: number;
  porConcepto: { concepto: string; cantidad: number; monto: number }[];
}

export function resumenCaja(pagos: Pago[]): ResumenCaja {
  const validos = pagos.filter((p) => !p.anuladoAt && !p.deletedAt);
  const suma = (m: Pago['metodo']) => validos.filter((p) => p.metodo === m).reduce((s, p) => s + p.monto, 0);
  const conceptos = new Map<string, { cantidad: number; monto: number }>();
  for (const p of validos) {
    const c = conceptos.get(p.concepto) ?? { cantidad: 0, monto: 0 };
    c.cantidad += p.cantidad ?? 1;
    c.monto += p.monto;
    conceptos.set(p.concepto, c);
  }
  const efectivo = suma('efectivo');
  const transferencia = suma('transferencia');
  const tarjeta = suma('tarjeta');
  return {
    efectivo,
    transferencia,
    tarjeta,
    total: efectivo + transferencia + tarjeta,
    tienda: validos.filter((p) => p.productoId).reduce((s, p) => s + p.monto, 0),
    rentas: validos.filter((p) => p.rentaId).reduce((s, p) => s + p.monto, 0),
    eventos: validos.filter((p) => p.eventoId).reduce((s, p) => s + p.monto, 0),
    cobros: validos.length,
    anulados: pagos.length - validos.length,
    porConcepto: [...conceptos.entries()]
      .map(([concepto, v]) => ({ concepto, ...v }))
      .sort((a, b) => b.monto - a.monto),
  };
}

export function asistenciasValidas(a: Asistencia[]): Asistencia[] {
  return a.filter((x) => !x.anuladaAt && !x.deletedAt);
}

/** Lo que debe haber en el cajón al cortar: la feria con que abrió + lo cobrado en efectivo − lo que se sacó. */
export function esperadoEnCaja(p: { fondo: number; efectivo: number; salidas: number }): number {
  return p.fondo + p.efectivo - p.salidas;
}

/** Billetes y monedas de México, en centavos (para contar la caja sin calculadora). */
export const DENOMINACIONES: { valor: number; tipo: 'billete' | 'moneda' }[] = [
  { valor: 100000, tipo: 'billete' },
  { valor: 50000, tipo: 'billete' },
  { valor: 20000, tipo: 'billete' },
  { valor: 10000, tipo: 'billete' },
  { valor: 5000, tipo: 'billete' },
  { valor: 2000, tipo: 'billete' },
  { valor: 2000, tipo: 'moneda' },
  { valor: 1000, tipo: 'moneda' },
  { valor: 500, tipo: 'moneda' },
  { valor: 200, tipo: 'moneda' },
  { valor: 100, tipo: 'moneda' },
  { valor: 50, tipo: 'moneda' },
];

export function sumaConteo(conteo: number[]): number {
  return DENOMINACIONES.reduce((t, d, i) => t + d.valor * (conteo[i] ?? 0), 0);
}
