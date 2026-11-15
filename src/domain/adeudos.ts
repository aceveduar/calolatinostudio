/**
 * La libreta de Monse en digital: fiado (entra y paga después), adeudos, recargo por atraso
 * en mensualidades y la lista del grupo por mes (quién vino, cómo pagó, quién debe).
 */
import { db } from '../db/db';
import { actualizar, crear, enTransaccion } from '../db/repo';
import type { Asistencia, Clase, Fecha, ID, Membresia, MetodoPago, Plan } from '../db/types';
import { deFecha, diasEntre, hoy, sumarDias } from './fechas';
import { conSede, sueltaDeClase } from './sedes';

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

/** Entra a la clase sin pagar; queda anotado que debe la clase. */
export function entrarFiado(p: { alumnoId: ID; claseId: ID; usuarioId: ID }): Promise<Asistencia> {
  return crear('asistencias', {
    alumnoId: p.alumnoId,
    nombreVisitante: null,
    claseId: p.claseId,
    fecha: hoy(),
    membresiaId: null,
    pagoId: null,
    usuarioId: p.usuarioId,
    anuladaAt: null,
    debe: true,
  });
}

export const esAdeudo = (a: Asistencia) => !!a.debe && !a.pagoId && !a.anuladaAt && vivo(a);

export interface Adeudo {
  asistencia: Asistencia;
  clase: Clase | undefined;
  monto: number;
}

/** Clases que debe un alumno, con su precio de clase suelta (el de esa clase hoy). */
export function adeudosDe(asistencias: Asistencia[], clases: Clase[], planes: Plan[]): Adeudo[] {
  return asistencias
    .filter(esAdeudo)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((asistencia) => {
      const clase = clases.find((c) => c.id === asistencia.claseId);
      return { asistencia, clase, monto: sueltaDeClase(planes, clase)?.precio ?? 0 };
    });
}

/** Cobra lo que debe: un cobro por clase (así cada clase conserva su ingreso) ligado a su asistencia. */
export async function cobrarAdeudos(p: { adeudos: Adeudo[]; metodo: MetodoPago; usuarioId: ID; planes: Plan[] }): Promise<number> {
  return enTransaccion(async () => {
    let total = 0;
    for (const { asistencia, clase, monto } of p.adeudos) {
      const actual = await db.asistencias.get(asistencia.id);
      if (!actual || !esAdeudo(actual)) continue; // otro equipo ya lo cobró
      const plan = sueltaDeClase(p.planes, clase);
      const pago = await crear('pagos', {
        ...conSede(clase?.sedeId),
        alumnoId: asistencia.alumnoId,
        planId: plan?.id ?? null,
        concepto: `${plan?.nombre ?? 'Clase'} (fiada ${deFecha(asistencia.fecha).getDate()}/${deFecha(asistencia.fecha).getMonth() + 1})`,
        monto,
        metodo: p.metodo,
        usuarioId: p.usuarioId,
        fecha: hoy(),
        anuladoAt: null,
        anuladoMotivo: null,
        anuladoPor: null,
      });
      await actualizar('asistencias', asistencia.id, { pagoId: pago.id });
      total += monto;
    }
    return total;
  });
}

// ---------- recargo por atraso (mensualidades) ----------

export interface Atraso {
  /** la mensualidad que se le venció */
  membresia: Membresia;
  dias: number;
  /** fecha en que empezaría la renovación para conservar su día de corte */
  inicioConCorte: Fecha;
}

/**
 * Si su última mensualidad de este plan venció hace poco (≤ 31 días) y no tiene otra vigente,
 * está atrasado: se cobra recargo por día y puede conservar su día de corte ("corta todos los 24").
 */
export function atrasoEnPlan(mems: Membresia[], plan: Plan, dia: Fecha = hoy()): Atraso | null {
  if (plan.tipo !== 'mensual') return null;
  const vivas = mems.filter((m) => !m.anuladaAt && vivo(m));
  if (vivas.some((m) => m.inicio <= dia && m.fin >= dia)) return null;
  const ultima = vivas.filter((m) => m.planId === plan.id && m.fin < dia).sort((a, b) => (a.fin < b.fin ? 1 : -1))[0];
  if (!ultima) return null;
  const dias = diasEntre(ultima.fin, dia);
  if (dias > 31) return null;
  return { membresia: ultima, dias, inicioConCorte: sumarDias(ultima.fin, 1) };
}

// ---------- lista del grupo (la libreta) ----------

export type Marca = 'plan' | 'pagada' | 'debe' | 'beca';

export interface FilaLista {
  alumnoId: ID;
  marcas: Map<Fecha, Marca>;
  debe: number;
  /** su plan que cubre esta clase y está vigente hoy (si tiene) */
  plan: Membresia | null;
}

/** Días del mes en que toca la clase (según sus días de la semana). */
export function sesionesDelMes(clase: Pick<Clase, 'dias'>, mes: string): Fecha[] {
  const [y, m] = mes.split('-').map(Number);
  const dias = new Date(y, m, 0).getDate();
  const r: Fecha[] = [];
  for (let d = 1; d <= dias; d++) {
    const f = `${mes}-${String(d).padStart(2, '0')}`;
    if (clase.dias.includes(deFecha(f).getDay())) r.push(f);
  }
  return r;
}

export function listaDelMes(p: {
  clase: Clase;
  mes: string;
  asistencias: Asistencia[];
  membresias: Membresia[];
  planes: Plan[];
  dia?: Fecha;
}): FilaLista[] {
  const dia = p.dia ?? hoy();
  const precio = sueltaDeClase(p.planes, p.clase)?.precio ?? 0;
  const becas = new Set(p.planes.filter((x) => x.tipo !== 'suelta' && x.precio === 0).map((x) => x.id));
  const filas = new Map<ID, FilaLista>();
  const fila = (id: ID) => {
    let f = filas.get(id);
    if (!f) filas.set(id, (f = { alumnoId: id, marcas: new Map(), debe: 0, plan: null }));
    return f;
  };
  const memPorId = new Map(p.membresias.map((m) => [m.id, m]));
  for (const a of p.asistencias) {
    if (!a.alumnoId || a.claseId !== p.clase.id || !a.fecha.startsWith(p.mes) || a.anuladaAt || !vivo(a)) continue;
    const f = fila(a.alumnoId);
    const mem = a.membresiaId ? memPorId.get(a.membresiaId) : undefined;
    const marca: Marca = esAdeudo(a) ? 'debe' : mem && becas.has(mem.planId) ? 'beca' : a.membresiaId ? 'plan' : 'pagada';
    f.marcas.set(a.fecha, marca);
    if (marca === 'debe') f.debe += precio;
  }
  // También quien pagó un plan que cubre esta clase aunque aún no venga este mes
  const { desde, hasta } = { desde: `${p.mes}-01`, hasta: `${p.mes}-31` };
  for (const m of p.membresias) {
    if (m.anuladaAt || !vivo(m) || m.fin < desde || m.inicio > hasta) continue;
    const cubre = m.claseIds?.length
      ? m.claseIds.includes(p.clase.id)
      : filas.has(m.alumnoId) && (m.disciplinaId === null || m.disciplinaId === p.clase.disciplinaId);
    if (!cubre) continue;
    const f = fila(m.alumnoId);
    if (m.inicio <= dia && m.fin >= dia && (!f.plan || m.fin > f.plan.fin)) f.plan = m;
  }
  return [...filas.values()];
}
