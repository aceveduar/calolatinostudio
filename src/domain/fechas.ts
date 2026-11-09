import type { Fecha } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function aFecha(d: Date): Fecha {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hoy(): Fecha {
  return aFecha(new Date());
}

export function deFecha(f: Fecha): Date {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumarDias(f: Fecha, dias: number): Fecha {
  const d = deFecha(f);
  d.setDate(d.getDate() + dias);
  return aFecha(d);
}

/** Suma meses de calendario; 31 ene + 1 mes = 28/29 feb. */
export function sumarMeses(f: Fecha, meses: number): Fecha {
  const d = deFecha(f);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return aFecha(d);
}

export function diasEntre(desde: Fecha, hasta: Fecha): number {
  return Math.round((deFecha(hasta).getTime() - deFecha(desde).getTime()) / 86_400_000);
}

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function fechaLarga(f: Fecha): string {
  return deFecha(f).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fechaCorta(f: Fecha): string {
  return deFecha(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export function horaDe(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

export function minutosDelDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function textoFechaHora(f: Fecha, ts: number): string {
  return `${fechaCorta(f)} · ${horaDe(ts)}`;
}
