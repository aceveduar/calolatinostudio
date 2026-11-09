import type { Clase } from '../db/types';
import { minutosDelDia } from './fechas';

export function clasesDelDia(clases: Clase[], fecha: Date = new Date()): Clase[] {
  const dia = fecha.getDay();
  return clases
    .filter((c) => c.activo && !c.deletedAt && c.dias.includes(dia))
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

/** La clase que está por empezar o en curso; si no, la siguiente; si no, la última del día. */
export function claseSugerida(deHoy: Clase[], ahora: Date = new Date()): Clase | null {
  if (!deHoy.length) return null;
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const enCurso = deHoy.find((c) => {
    const ini = minutosDelDia(c.horaInicio);
    return min >= ini - 30 && min < ini + c.duracionMin;
  });
  if (enCurso) return enCurso;
  return deHoy.find((c) => minutosDelDia(c.horaInicio) > min) ?? deHoy[deHoy.length - 1];
}
