/**
 * Pendientes del día para recepción y dirección: a quién escribirle y qué cobrar.
 * Funciones puras sobre los registros; la pantalla solo junta los datos y los muestra.
 *
 * Cada recordatorio enviado se anota en el alumno (`avisos`) para que desaparezca de la lista
 * en todos los equipos y nadie le escriba dos veces lo mismo.
 */
import { db } from '../db/db';
import { actualizar } from '../db/repo';
import type { Alumno, Asistencia, Clase, Fecha, ID, Membresia, Pago, Plan, Renta } from '../db/types';
import { adeudosDe, esAdeudo } from './adeudos';
import { cobrosDelMes, type CobroRenta } from './agenda';
import { mesDe, sumarMes, type Mes } from './gastos';
import { esBeca } from './becas';
import { aFecha, diasEntre, sumarDias } from './fechas';
import { dejaronDeVenir } from './reportes';

/** Un recordatorio de pago no se repite antes de estos días. */
export const DIAS_ENTRE_COBROS = 3;
/** Se avisa desde 3 días antes de que venza hasta una semana después (más es ruido). */
export const AVISAR_ANTES = 3;
export const AVISAR_DESPUES = 7;

export type ClaveAviso = `vence:${string}` | 'adeudo' | 'extrañamos';

export const avisadoEl = (a: Pick<Alumno, 'avisos'>, clave: ClaveAviso): number | null => a.avisos?.[clave] ?? null;

/** Anota que ya se le escribió. Limpia anotaciones de hace más de 4 meses para que no crezca. */
export function marcarAvisado(a: Pick<Alumno, 'id' | 'avisos'>, clave: ClaveAviso, ahora = Date.now()) {
  const limite = ahora - 120 * 86_400_000;
  const avisos = Object.fromEntries(Object.entries(a.avisos ?? {}).filter(([, t]) => t > limite));
  return actualizar('alumnos', a.id, { avisos: { ...avisos, [clave]: ahora } });
}

/** Deshacer "ya le avisé" (lee el alumno al momento, por si cambió). */
export async function quitarAviso(id: ID, clave: ClaveAviso): Promise<void> {
  const a = await db.alumnos.get(id);
  if (!a) return;
  const avisos = { ...(a.avisos ?? {}) };
  delete avisos[clave];
  await actualizar('alumnos', id, { avisos });
}

export interface PorRenovar {
  alumno: Alumno;
  membresia: Membresia;
  plan: Plan | undefined;
  /** negativo = ya venció hace N días */
  enDias: number;
}

/** Planes que vencen en los próximos 3 días o vencieron la última semana, sin renovar y sin avisar. */
export function porRenovar(p: { mems: Membresia[]; alumnos: Map<ID, Alumno>; planes: Plan[]; hoy: Fecha }): PorRenovar[] {
  const vivas = p.mems.filter((m) => !m.anuladaAt && !m.deletedAt);
  const ultimaPorAlumno = new Map<ID, Fecha>();
  for (const m of vivas) {
    if (m.fin > (ultimaPorAlumno.get(m.alumnoId) ?? '')) ultimaPorAlumno.set(m.alumnoId, m.fin);
  }
  const inicio = sumarDias(p.hoy, -AVISAR_DESPUES);
  const fin = sumarDias(p.hoy, AVISAR_ANTES);
  return vivas
    .filter((m) => m.fin >= inicio && m.fin <= fin)
    .filter((m) => !esBeca(p.planes.find((x) => x.id === m.planId)))
    // ya renovó: tiene otro plan que termina después
    .filter((m) => ultimaPorAlumno.get(m.alumnoId) === m.fin)
    .flatMap((m) => {
      const alumno = p.alumnos.get(m.alumnoId);
      if (!alumno?.activo || alumno.deletedAt || avisadoEl(alumno, `vence:${m.id}`)) return [];
      return [{ alumno, membresia: m, plan: p.planes.find((x) => x.id === m.planId), enDias: diasEntre(p.hoy, m.fin) }];
    })
    .sort((a, b) => a.enDias - b.enDias);
}

export interface Deudor {
  alumno: Alumno;
  clases: number;
  total: number;
}

/** Quien entró "fiado" y no ha pagado; se oculta unos días después de recordarle. */
export function deudores(p: { asistencias: Asistencia[]; alumnos: Map<ID, Alumno>; clases: Clase[]; planes: Plan[]; ahora?: number }): Deudor[] {
  const ahora = p.ahora ?? Date.now();
  const porAlumno = new Map<ID, Asistencia[]>();
  for (const a of p.asistencias) if (a.alumnoId && esAdeudo(a)) porAlumno.set(a.alumnoId, [...(porAlumno.get(a.alumnoId) ?? []), a]);
  return [...porAlumno.entries()]
    .flatMap(([id, asis]) => {
      const alumno = p.alumnos.get(id);
      if (!alumno || alumno.deletedAt) return [];
      const aviso = avisadoEl(alumno, 'adeudo');
      if (aviso && ahora - aviso < DIAS_ENTRE_COBROS * 86_400_000) return [];
      const ads = adeudosDe(asis, p.clases, p.planes);
      return [{ alumno, clases: ads.length, total: ads.reduce((s, x) => s + x.monto, 0) }];
    })
    .sort((a, b) => b.total - a.total);
}

/** Dejaron de venir y no se les ha escrito desde que dejaron de venir. */
export function porExtranar(p: { asistencias: Asistencia[]; alumnos: Map<ID, Alumno>; hoy: Fecha }) {
  return dejaronDeVenir(p.asistencias, p.alumnos, p.hoy).filter(({ alumno, ultima }) => {
    const aviso = avisadoEl(alumno, 'extrañamos');
    return !aviso || aFecha(new Date(aviso)) < ultima;
  });
}

export interface RentaPorCobrar extends CobroRenta {
  mes: Mes;
  /** del mes pasado: ya se debió cobrar */
  atrasada: boolean;
}

/**
 * Rentas del salón sin cobrar: las del mes pasado siempre; las de este mes si son de cuota fija,
 * eventos que ya pasaron, o por hora / por alumno ya al cierre del mes (antes la cuenta aún va creciendo).
 */
export function rentasPorCobrar(p: { rentas: Renta[]; pagos: Pago[]; asistencias: Asistencia[]; clases: Clase[]; hoy: Fecha }): RentaPorCobrar[] {
  const mes = mesDe(p.hoy);
  const anterior = sumarMes(mes, -1);
  const ctx = { asistencias: p.asistencias, clases: p.clases };
  const pendientes = (m: Mes) => cobrosDelMes(p.rentas, p.pagos, m, ctx).filter((c) => !c.pago && c.monto > 0);
  const cierre = Number(p.hoy.slice(8, 10)) >= 25;
  return [
    ...pendientes(anterior).map((c) => ({ ...c, mes: anterior, atrasada: true })),
    ...pendientes(mes)
      .filter((c) => (c.renta.tipo === 'evento' ? c.renta.desde <= p.hoy : !c.renta.cobro || c.renta.cobro === 'fijo' || cierre))
      .map((c) => ({ ...c, mes, atrasada: false })),
  ];
}
