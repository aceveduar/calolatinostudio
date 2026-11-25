import type { Clase, Fecha } from '../db/types';
import { aFecha, minutosDelDia } from './fechas';

export function claseEnFecha(clase: Clase, fecha: Fecha): Clase | null {
  const cambio = clase.excepciones?.[fecha];
  if (!cambio) return clase;
  if ('cancelada' in cambio) return null;
  return { ...clase, horaInicio: cambio.hora, sedeId: cambio.sede, salonId: cambio.salon };
}

function enVentanaDeEntrada(clase: Clase, minuto: number): boolean {
  const inicio = minutosDelDia(clase.horaInicio);
  return minuto >= inicio - 30 && minuto < inicio + clase.duracionMin;
}

/** Solo sugerir un traslado si hay actividad próxima o en curso en una única sede distinta. */
export function claseEnOtraSede(clases: Clase[], sedeActual: string | null, ahora = new Date()): Clase | null {
  const minuto = ahora.getHours() * 60 + ahora.getMinutes();
  const fecha = aFecha(ahora);
  const cercanas = clasesDelDia(clases, ahora).filter((c) => {
    if (c.curso && (fecha < c.curso.inicio || (c.curso.fin && fecha > c.curso.fin))) return false;
    return enVentanaDeEntrada(c, minuto);
  });
  const primera = cercanas[0];
  if (!primera) return null;
  const sede = primera.sedeId ?? null;
  return sede !== sedeActual && cercanas.every((c) => (c.sedeId ?? null) === sede) ? primera : null;
}

export function clasesDelDia(clases: Clase[], fecha: Date = new Date()): Clase[] {
  const dia = fecha.getDay();
  const fechaLocal = aFecha(fecha);
  return clases
    .flatMap((c) => {
      if (!c.activo || c.deletedAt || !c.dias.includes(dia)) return [];
      const efectiva = claseEnFecha(c, fechaLocal);
      return efectiva ? [efectiva] : [];
    })
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

/** La clase que está por empezar o en curso; si no, la siguiente; si no, la última del día. */
export function claseSugerida(deHoy: Clase[], ahora: Date = new Date()): Clase | null {
  if (!deHoy.length) return null;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const enCurso = deHoy.find((c) => enVentanaDeEntrada(c, min));
  if (enCurso) return enCurso;
  return deHoy.find((c) => minutosDelDia(c.horaInicio) > min) ?? deHoy[deHoy.length - 1];
}
