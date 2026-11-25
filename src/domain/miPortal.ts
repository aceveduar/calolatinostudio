/**
 * Lo que el alumno ve en su portal, calculado de sus datos: su próxima clase, su racha,
 * sus insignias y el mensaje para renovar. Funciones puras (sin base ni pantalla).
 */
import { aFecha, DIAS_CORTOS, diasEntre, minutosDelDia, sumarDias } from './fechas';

export type CambioHorario = { cancelada: true } | { hora: string; nombre_sede?: string | null; sede_id?: string | null };

export interface ClaseHorario {
  clase: string;
  color: string | null;
  /** 0 = domingo … 6 = sábado */
  dias: number[];
  hora: string;
  duracion: number;
  excepciones?: Record<string, CambioHorario>;
  sedeCambio?: string | null;
  sedeCambioId?: string | null;
}

export function horarioEnFecha<T extends ClaseHorario>(clase: T, fecha: string): T | null {
  const cambio = clase.excepciones?.[fecha];
  if (!cambio) return clase;
  return 'cancelada' in cambio ? null : { ...clase, hora: cambio.hora, sedeCambio: cambio.nombre_sede, sedeCambioId: cambio.sede_id };
}

export interface ProximaClase {
  clase: ClaseHorario;
  /** 0 = hoy, 1 = mañana… */
  enDias: number;
  /** 'ahora' mientras dura la clase */
  estado: 'ahora' | 'hoy' | 'despues';
  /** minutos para que empiece (solo hoy) */
  faltan: number | null;
  texto: string;
}

/** La siguiente clase de su horario a partir de este momento (incluye la que está en curso). */
export function proximaClase(horario: ClaseHorario[], ahora: Date): ProximaClase | null {
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  for (let d = 0; d < 8; d++) {
    const dia = (ahora.getDay() + d) % 7;
    const fecha = sumarDias(aFecha(ahora), d);
    const candidatas = horario
      .filter((c) => c.dias.includes(dia))
      .map((c) => horarioEnFecha(c, fecha))
      .filter((c) => c !== null)
      .filter((c) => d > 0 || minutosDelDia(c.hora) + c.duracion > min)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    const c = candidatas[0];
    if (!c) continue;
    const inicio = minutosDelDia(c.hora);
    const enCurso = d === 0 && inicio <= min;
    const faltan = d === 0 && !enCurso ? inicio - min : null;
    const cuando = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : DIAS_LARGOS[dia];
    return {
      clase: c,
      enDias: d,
      estado: enCurso ? 'ahora' : d === 0 ? 'hoy' : 'despues',
      faltan,
      texto: enCurso ? 'Está empezando, ¡corre!' : faltan !== null ? `${cuando} · en ${enTiempo(faltan)}` : `${cuando} a las ${c.hora}`,
    };
  }
  return null;
}

const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const enTiempo = (m: number) => (m < 60 ? `${m} min` : m < 120 ? `1 h${m % 60 >= 10 ? ` ${m % 60} min` : ''}` : `${Math.round(m / 60)} h`);

/** Su semana: cada día con clases, de lunes a domingo. */
export function semana(horario: ClaseHorario[]): { dia: string; clases: ClaseHorario[] }[] {
  return [1, 2, 3, 4, 5, 6, 0]
    .map((d) => ({ dia: DIAS_CORTOS[d], clases: horario.filter((c) => c.dias.includes(d)).sort((a, b) => a.hora.localeCompare(b.hora)) }))
    .filter((x) => x.clases.length);
}

/**
 * Semanas seguidas viniendo (lunes a domingo). La semana actual cuenta si ya vino;
 * si aún no viene esta semana, la racha sigue viva desde la pasada.
 */
export function racha(semanasConClase: string[], hoy: string): number {
  const set = new Set(semanasConClase);
  let lunes = lunesDe(hoy);
  if (!set.has(lunes)) lunes = sumarDias(lunes, -7);
  let n = 0;
  while (set.has(lunes)) {
    n++;
    lunes = sumarDias(lunes, -7);
  }
  return n;
}

function lunesDe(f: string): string {
  const d = new Date(`${f}T12:00:00`);
  return sumarDias(f, -((d.getDay() + 6) % 7));
}

export interface Insignia {
  meta: number;
  emoji: string;
  nombre: string;
}

export const INSIGNIAS: Insignia[] = [
  { meta: 1, emoji: '🌱', nombre: 'Primer paso' },
  { meta: 10, emoji: '🔥', nombre: 'Agarró el ritmo' },
  { meta: 25, emoji: '💃', nombre: 'Bailador' },
  { meta: 50, emoji: '⭐', nombre: 'Estrella de la pista' },
  { meta: 100, emoji: '👑', nombre: 'Leyenda' },
  { meta: 200, emoji: '🏆', nombre: 'Maestro del ritmo' },
];

/** Las que ya ganó y la siguiente (con cuántas clases le faltan). */
export function insignias(total: number): { ganadas: Insignia[]; siguiente: Insignia | null; faltan: number; avance: number } {
  const ganadas = INSIGNIAS.filter((i) => total >= i.meta);
  const siguiente = INSIGNIAS.find((i) => total < i.meta) ?? null;
  const anterior = ganadas[ganadas.length - 1]?.meta ?? 0;
  return {
    ganadas,
    siguiente,
    faltan: siguiente ? siguiente.meta - total : 0,
    avance: siguiente ? (total - anterior) / (siguiente.meta - anterior) : 1,
  };
}

export interface PlanPortal {
  plan: string;
  beca: boolean;
  inicio: string;
  fin: string;
  clases: number | null;
  usadas: number;
}

/** Cuánto le queda del plan, para el círculo: por clases si es paquete, si no por días. */
export function restante(p: PlanPortal, hoy: string): { valor: number; unidad: string; fraccion: number; urgente: boolean } {
  const dias = Math.max(0, diasEntre(hoy, p.fin));
  if (p.clases !== null) {
    const quedan = Math.max(0, p.clases - p.usadas);
    return { valor: quedan, unidad: quedan === 1 ? 'clase' : 'clases', fraccion: quedan / (p.clases || 1), urgente: quedan <= 1 || dias <= 3 };
  }
  const total = Math.max(1, diasEntre(p.inicio, p.fin));
  return { valor: dias, unidad: dias === 1 ? 'día' : 'días', fraccion: Math.min(1, dias / total), urgente: dias <= 3 };
}

/** Mensaje de WhatsApp para renovar (o preguntar por planes). */
export function mensajeRenovar(nombre: string, codigo: string, plan: string | null): string {
  return plan
    ? `Hola, soy ${nombre} (código ${codigo}). Quiero renovar mi ${plan}. ¿Me ayudan?`
    : `Hola, soy ${nombre} (código ${codigo}). Quiero saber de las mensualidades y paquetes.`;
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Hola, soy Ana López (código K7P2QX). Quiero ir a Social de salsa (sábado 28 de noviembre, 21:00)…" */
export function mensajeEvento(nombre: string, codigo: string, e: { nombre: string; fecha: string; hora: string }, cuantos = 1): string {
  const [y, m, d] = e.fecha.split('-').map(Number);
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(y, m - 1, d).getDay()];
  return `Hola, soy ${nombre} (código ${codigo}). Quiero ${cuantos > 1 ? `${cuantos} boletos` : 'ir'} a ${e.nombre} (${dia} ${d} de ${MESES_LARGOS[m - 1]}, ${e.hora}). ¿Me apartan lugar?`;
}

/** "Hoy", "Mañana", "En 5 días" o null si falta más de una semana. */
export function faltaParaEvento(hoy: string, fecha: string): string | null {
  const [a, b] = [hoy, fecha].map((f) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)));
  const n = Math.round((b - a) / 86400000);
  return n <= 0 ? 'Hoy' : n === 1 ? 'Mañana' : n <= 7 ? `En ${n} días` : null;
}
