/** Cálculos de reportes: funciones puras sobre los registros, sin UI. */
import type { Alumno, Asistencia, Clase, Fecha, ID, Membresia, Pago } from '../db/types';
import { diasEntre, sumarDias } from './fechas';

export interface Periodo {
  desde: Fecha;
  hasta: Fecha; // inclusive
}

export function periodos(dias: number, hoy: Fecha): { actual: Periodo; anterior: Periodo } {
  const actual = { desde: sumarDias(hoy, -(dias - 1)), hasta: hoy };
  return { actual, anterior: { desde: sumarDias(actual.desde, -dias), hasta: sumarDias(actual.desde, -1) } };
}

const dentro = (f: Fecha, p: Periodo) => f >= p.desde && f <= p.hasta;
const validoP = (p: Pago) => !p.anuladoAt && !p.deletedAt;
const validaA = (a: Asistencia) => !a.anuladaAt && !a.deletedAt;

export interface Indicadores {
  ingresos: number;
  asistencias: number;
  activos: number;
  nuevos: number;
}

/** `altas`: fecha de registro de cada alumno (los nuevos son los registrados en el periodo). */
export function indicadores(p: Periodo, pagos: Pago[], asis: Asistencia[], altas: Fecha[]): Indicadores {
  const a = asis.filter((x) => validaA(x) && dentro(x.fecha, p));
  const activos = new Set(a.flatMap((x) => (x.alumnoId ? [x.alumnoId] : [])));
  return {
    ingresos: pagos.filter((x) => validoP(x) && dentro(x.fecha, p)).reduce((s, x) => s + x.monto, 0),
    asistencias: a.length,
    activos: activos.size,
    nuevos: altas.filter((f) => dentro(f, p)).length,
  };
}

/** Variación relativa; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return (actual - anterior) / anterior;
}

export function ingresosPorDia(p: Periodo, pagos: Pago[]): { fecha: Fecha; monto: number }[] {
  const n = diasEntre(p.desde, p.hasta) + 1;
  const m = new Map<Fecha, number>();
  for (const x of pagos) if (validoP(x) && dentro(x.fecha, p)) m.set(x.fecha, (m.get(x.fecha) ?? 0) + x.monto);
  return Array.from({ length: n }, (_, i) => {
    const fecha = sumarDias(p.desde, i);
    return { fecha, monto: m.get(fecha) ?? 0 };
  });
}

export interface FilaClase {
  clase: Clase;
  sesiones: number;
  promedio: number;
  maximo: number;
  ingresos: number;
}

/** Por clase: sesiones dadas, alumnos promedio por sesión e ingresos por clase suelta. */
export function porClase(p: Periodo, clases: Clase[], asis: Asistencia[], pagos: Pago[]): FilaClase[] {
  const monto = new Map(pagos.filter(validoP).map((x) => [x.id, x.monto]));
  return clases
    .map((clase) => {
      const a = asis.filter((x) => validaA(x) && x.claseId === clase.id && dentro(x.fecha, p));
      const porSesion = new Map<Fecha, number>();
      for (const x of a) porSesion.set(x.fecha, (porSesion.get(x.fecha) ?? 0) + 1);
      const sesiones = porSesion.size;
      return {
        clase,
        sesiones,
        promedio: sesiones ? a.length / sesiones : 0,
        maximo: Math.max(0, ...porSesion.values()),
        ingresos: a.reduce((s, x) => s + (x.pagoId ? (monto.get(x.pagoId) ?? 0) : 0), 0),
      };
    })
    .filter((f) => f.sesiones > 0)
    .sort((a, b) => b.promedio - a.promedio);
}

/** Planes que vencen en los próximos `dias` y que el alumno no ha renovado. */
export function vencenPronto(mems: Membresia[], alumnos: Map<ID, Alumno>, hoy: Fecha, dias = 7): { alumno: Alumno; membresia: Membresia; enDias: number }[] {
  const vivas = mems.filter((m) => !m.anuladaAt && !m.deletedAt);
  return vivas
    .filter((m) => m.fin >= hoy && diasEntre(hoy, m.fin) <= dias)
    .filter((m) => !vivas.some((o) => o.alumnoId === m.alumnoId && o.id !== m.id && o.fin > m.fin)) // ya renovó
    .flatMap((m) => {
      const alumno = alumnos.get(m.alumnoId);
      return alumno?.activo && !alumno.deletedAt ? [{ alumno, membresia: m, enDias: diasEntre(hoy, m.fin) }] : [];
    })
    .sort((a, b) => a.enDias - b.enDias);
}

/** Venían seguido (≥3 veces en las 8 semanas previas) y llevan 14+ días sin venir. */
export function dejaronDeVenir(asis: Asistencia[], alumnos: Map<ID, Alumno>, hoy: Fecha): { alumno: Alumno; ultima: Fecha; veces: number }[] {
  const corte = sumarDias(hoy, -14);
  const inicio = sumarDias(corte, -56);
  const ultima = new Map<ID, Fecha>();
  const veces = new Map<ID, number>();
  for (const a of asis) {
    if (!a.alumnoId || !validaA(a)) continue;
    if ((ultima.get(a.alumnoId) ?? '') < a.fecha) ultima.set(a.alumnoId, a.fecha);
    if (a.fecha >= inicio && a.fecha < corte) veces.set(a.alumnoId, (veces.get(a.alumnoId) ?? 0) + 1);
  }
  return [...veces.entries()]
    .filter(([id, n]) => n >= 3 && (ultima.get(id) ?? '') < corte)
    .flatMap(([id, n]) => {
      const alumno = alumnos.get(id);
      return alumno?.activo && !alumno.deletedAt ? [{ alumno, ultima: ultima.get(id)!, veces: n }] : [];
    })
    .sort((a, b) => b.veces - a.veces);
}

export function waLink(telefono: string, texto: string): string | null {
  const d = telefono.replace(/\D/g, '');
  if (d.length < 10) return null;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}
