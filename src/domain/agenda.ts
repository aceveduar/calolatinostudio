/**
 * Agenda del salón (sede principal): clases del estudio + rentas a maestros externos, sin empalmes.
 * Supuesto: el estudio tiene UN salón. Una renta no puede empalmarse con una clase del estudio ni con otra renta.
 * (Las clases entre sí no se validan aquí: eso lo decide la academia al armar su horario.)
 */
import { crear } from '../db/repo';
import type { Clase, Fecha, ID, MetodoPago, Pago, Renta } from '../db/types';
import { deFecha, diasEntre, hoy, minutosDelDia, sumarDias } from './fechas';
import { rangoMes, type Mes } from './gastos';

/** Horario en que se muestran los huecos libres. */
export const ABRE = 7 * 60;
export const CIERRA = 23 * 60;
export const TODO_EL_DIA = { horaInicio: '07:00', duracionMin: CIERRA - ABRE };

export const diaSemana = (f: Fecha) => deFecha(f).getDay();
const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

/** Clases que usan el salón del estudio (las de otras sedes no). */
export const clasesDelSalon = (clases: Clase[]) => clases.filter((c) => vivo(c) && c.activo && !c.sedeId);
export const rentasVigentes = (rentas: Renta[]) => rentas.filter((r) => vivo(r) && r.activo);

export function rentaOcupa(r: Pick<Renta, 'desde' | 'hasta' | 'dias'>, f: Fecha): boolean {
  return r.desde <= f && (r.hasta === null || f <= r.hasta) && r.dias.includes(diaSemana(f));
}

const finMin = (horaInicio: string, duracionMin: number) => minutosDelDia(horaInicio) + duracionMin;
export const horaTexto = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const rangoHora = (horaInicio: string, duracionMin: number) => `${horaInicio}–${horaTexto(finMin(horaInicio, duracionMin))}`;

export interface Bloque {
  inicio: number;
  fin: number;
  clase?: Clase;
  renta?: Renta;
}

export function bloquesDelDia(f: Fecha, clases: Clase[], rentas: Renta[]): Bloque[] {
  const d = diaSemana(f);
  return [
    ...clasesDelSalon(clases)
      .filter((c) => c.dias.includes(d))
      .map((c) => ({ inicio: minutosDelDia(c.horaInicio), fin: finMin(c.horaInicio, c.duracionMin), clase: c })),
    ...rentasVigentes(rentas)
      .filter((r) => rentaOcupa(r, f))
      .map((r) => ({ inicio: minutosDelDia(r.horaInicio), fin: finMin(r.horaInicio, r.duracionMin), renta: r })),
  ].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
}

/** Huecos libres (≥ 30 min) dentro del horario. */
export function huecos(bloques: Bloque[], abre = ABRE, cierra = CIERRA): [number, number][] {
  const libres: [number, number][] = [];
  let cursor = abre;
  for (const b of bloques) {
    if (b.inicio - cursor >= 30) libres.push([cursor, Math.min(b.inicio, cierra)]);
    cursor = Math.max(cursor, b.fin);
  }
  if (cierra - cursor >= 30) libres.push([cursor, cierra]);
  return libres.filter(([a, b]) => b > a);
}

/** Días de la semana que realmente caen entre dos fechas (si el rango es menor a una semana). */
function diasEnRango(desde: Fecha, hasta: Fecha | null): Set<number> {
  if (hasta === null || diasEntre(desde, hasta) >= 6) return new Set([0, 1, 2, 3, 4, 5, 6]);
  const s = new Set<number>();
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) s.add(diaSemana(f));
  return s;
}

export interface Empalme {
  clase?: Clase;
  renta?: Renta;
  /** días de la semana en que chocan */
  dias: number[];
}

/** Con qué choca una renta (nueva o editada). Vacío = el salón está libre. */
export function empalmes(c: Pick<Renta, 'dias' | 'horaInicio' | 'duracionMin' | 'desde' | 'hasta'> & { id?: ID }, clases: Clase[], rentas: Renta[]): Empalme[] {
  const ini = minutosDelDia(c.horaInicio);
  const fin = ini + c.duracionMin;
  const seTraslapa = (h: string, d: number) => {
    const i = minutosDelDia(h);
    return ini < i + d && i < fin;
  };
  const posibles = diasEnRango(c.desde, c.hasta);
  const choques: Empalme[] = [];
  for (const k of clasesDelSalon(clases)) {
    const dias = c.dias.filter((d) => k.dias.includes(d) && posibles.has(d));
    if (dias.length && seTraslapa(k.horaInicio, k.duracionMin)) choques.push({ clase: k, dias });
  }
  for (const r of rentasVigentes(rentas)) {
    if (r.id === c.id) continue;
    // rangos de fechas que se cruzan
    const desde = r.desde > c.desde ? r.desde : c.desde;
    const hasta = r.hasta === null ? c.hasta : c.hasta === null ? r.hasta : r.hasta < c.hasta ? r.hasta : c.hasta;
    if (hasta !== null && desde > hasta) continue;
    const enAmbos = diasEnRango(desde, hasta);
    const dias = c.dias.filter((d) => r.dias.includes(d) && enAmbos.has(d));
    if (dias.length && seTraslapa(r.horaInicio, r.duracionMin)) choques.push({ renta: r, dias });
  }
  return choques;
}

/** Rentas de una clase que se empalman con ella (para avisar al editar el horario de clases). */
export function rentasQueChocanConClase(k: Pick<Clase, 'dias' | 'horaInicio' | 'duracionMin' | 'sedeId'> & { id?: ID }, rentas: Renta[]): Renta[] {
  if (k.sedeId) return [];
  return empalmes({ ...k, desde: hoy(), hasta: null }, [], rentas)
    .map((e) => e.renta!)
    .filter(Boolean);
}

// ---------- cobros ----------

export interface CobroRenta {
  renta: Renta;
  pago: Pago | null;
}

/** Rentas que se cobran en ese mes (mensuales activas en el mes y eventos de ese mes) y si ya se pagaron. */
export function cobrosDelMes(rentas: Renta[], pagos: Pago[], mes: Mes): CobroRenta[] {
  const { desde, hasta } = rangoMes(mes);
  const pagados = pagos.filter((p) => vivo(p) && !p.anuladoAt && p.rentaId && p.periodo === mes);
  return rentas
    .filter((r) => vivo(r) && r.desde <= hasta && (r.hasta === null || r.hasta >= desde) && (r.activo || pagados.some((p) => p.rentaId === r.id)))
    .map((renta) => ({ renta, pago: pagados.find((p) => p.rentaId === renta.id) ?? null }))
    .sort((a, b) => Number(!!a.pago) - Number(!!b.pago) || a.renta.nombre.localeCompare(b.renta.nombre));
}

export function cobrarRenta(p: { renta: Renta; mes: Mes; monto: number; metodo: MetodoPago; usuarioId: ID }): Promise<Pago> {
  if (!(p.monto > 0)) throw new Error('El monto debe ser mayor a cero');
  return crear('pagos', {
    alumnoId: null,
    planId: null,
    rentaId: p.renta.id,
    periodo: p.mes,
    concepto: `Renta del salón · ${p.renta.nombre}`,
    monto: p.monto,
    metodo: p.metodo,
    usuarioId: p.usuarioId,
    fecha: hoy(),
    anuladoAt: null,
    anuladoMotivo: null,
    anuladoPor: null,
  });
}
