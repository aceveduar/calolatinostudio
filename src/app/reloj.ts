import { useSyncExternalStore } from 'react';
import { hoy } from '../domain/fechas';

/**
 * La fecha de hoy que se actualiza sola a medianoche (y al volver a la app),
 * para equipos de recepción que se quedan encendidos toda la noche.
 */
let actual = hoy();
const subs = new Set<() => void>();

function revisar() {
  const h = hoy();
  if (h !== actual) {
    actual = h;
    subs.forEach((s) => s());
  }
}

setInterval(revisar, 30_000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && revisar());

export function useHoy(): string {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => actual,
  );
}
