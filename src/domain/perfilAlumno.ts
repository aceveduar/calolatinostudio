/**
 * El alumno de un vistazo (para su ficha): desde cuándo viene, cada cuánto, su clase y su día de siempre,
 * y cuánto ha pagado en el último año. Puro: recibe sus entradas y pagos ya leídos.
 */
import type { Asistencia, Fecha, ID, Pago } from '../db/types';
import { deFecha, sumarDias } from './fechas';

export interface PerfilAlumno {
  /** su primera entrada (o cuando se dio de alta, si nunca ha venido) */
  desde: Fecha;
  /** veces al mes en los últimos 3 meses (0 si no ha venido) */
  porMes: number;
  /** la clase a la que más va y en qué día suele ir (0 = domingo) */
  clase: { id: ID; veces: number } | null;
  dia: number | null;
  /** lo pagado en los últimos 12 meses (sin anulados), en centavos */
  pagadoAnio: number;
}

const masComun = <T,>(xs: T[]): { valor: T; veces: number } | null => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  let mejor: { valor: T; veces: number } | null = null;
  for (const [valor, veces] of m) if (!mejor || veces > mejor.veces) mejor = { valor, veces };
  return mejor;
};

export function perfilAlumno(p: { asistencias: Asistencia[]; pagos: Pago[]; altaEn: number; hoy: Fecha }): PerfilAlumno {
  const entradas = p.asistencias.filter((a) => !a.anuladaAt && !a.deletedAt);
  const alta = new Date(p.altaEn);
  const fechaAlta = `${alta.getFullYear()}-${String(alta.getMonth() + 1).padStart(2, '0')}-${String(alta.getDate()).padStart(2, '0')}`;
  const primera = entradas.reduce<Fecha | null>((min, a) => (!min || a.fecha < min ? a.fecha : min), null);
  const hace90 = sumarDias(p.hoy, -90);
  const recientes = entradas.filter((a) => a.fecha >= hace90 && a.fecha <= p.hoy);
  const clase = masComun(entradas.map((a) => a.claseId));
  // el día que suele ir: de lo reciente (si cambió de horario, el actual), o de todo si no ha venido últimamente
  const dia = masComun((recientes.length ? recientes : entradas).map((a) => deFecha(a.fecha).getDay()));
  const hace365 = sumarDias(p.hoy, -365);
  return {
    // lo más antiguo: si se importó de Excel, su alta es reciente pero ya venía antes (o al revés)
    desde: primera && primera < fechaAlta ? primera : fechaAlta,
    porMes: Math.round((recientes.length / 3) * 2) / 2,
    clase: clase ? { id: clase.valor, veces: clase.veces } : null,
    dia: dia?.valor ?? null,
    pagadoAnio: p.pagos.filter((x) => !x.anuladoAt && !x.deletedAt && x.fecha > hace365 && x.fecha <= p.hoy).reduce((s, x) => s + x.monto, 0),
  };
}
