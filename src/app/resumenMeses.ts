/**
 * "Últimos 12 meses" de Reportes sin releer todo el año en cada visita.
 * Un mes cerrado casi nunca cambia: su resumen (ingresos y alumnos distintos, por sede) se calcula una vez
 * y se guarda en este teléfono. Si cambia un pago o una asistencia de ese mes (una corrección, una anulación,
 * algo que llegó de la nube), los ganchos de db.ts borran ese mes y se vuelve a calcular la próxima vez.
 * El mes en curso siempre se calcula al momento.
 */
import { db, getMeta, setMeta } from '../db/db';
import type { Clase } from '../db/types';
import { claveSede } from '../domain/sedes';
import { rangoMes } from '../domain/gastos';

export interface ResumenMes {
  /** ingresos por sede (claveSede) */
  ingresos: Record<string, number>;
  /** alumnos distintos por sede (claveSede) */
  alumnos: Record<string, number>;
  /** alumnos distintos en todas las sedes juntas (no es la suma: uno puede ir a dos sedes) */
  alumnosTodas: number;
}

export const claveResumen = (mes: string) => `resumenMes:${mes}`;

export async function calcularMes(mes: string, clases: Pick<Clase, 'id' | 'sedeId'>[]): Promise<ResumenMes> {
  const { desde, hasta } = rangoMes(mes);
  const sedeDeClase = new Map(clases.map((c) => [c.id, claveSede(c.sedeId)]));
  const [pagos, asis] = await Promise.all([db.pagos.where('fecha').between(desde, hasta, true, true).toArray(), db.asistencias.where('fecha').between(desde, hasta, true, true).toArray()]);
  const ingresos: Record<string, number> = {};
  for (const p of pagos) if (!p.anuladoAt && !p.deletedAt) ingresos[claveSede(p.sedeId)] = (ingresos[claveSede(p.sedeId)] ?? 0) + p.monto;
  const porSede = new Map<string, Set<string>>();
  const todas = new Set<string>();
  for (const a of asis) {
    if (!a.alumnoId || a.anuladaAt || a.deletedAt) continue;
    const s = sedeDeClase.get(a.claseId) ?? claveSede(null);
    (porSede.get(s) ?? porSede.set(s, new Set()).get(s)!).add(a.alumnoId);
    todas.add(a.alumnoId);
  }
  return { ingresos, alumnos: Object.fromEntries([...porSede].map(([k, v]) => [k, v.size])), alumnosTodas: todas.size };
}

/** El resumen de un mes: guardado si está cerrado y no cambió; si no, calculado (y guardado si ya cerró). */
export async function resumenMes(mes: string, mesActual: string, clases: Pick<Clase, 'id' | 'sedeId'>[]): Promise<ResumenMes> {
  if (mes < mesActual) {
    const guardado = await getMeta<ResumenMes>(claveResumen(mes));
    if (guardado) return guardado;
  }
  const r = await calcularMes(mes, clases);
  if (mes < mesActual) await setMeta(claveResumen(mes), r);
  return r;
}
