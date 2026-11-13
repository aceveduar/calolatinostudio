/**
 * Actualizaciones de la app sin interrumpir: nunca recargar a media cobranza.
 * La versión nueva se aplica cuando la app pasa a segundo plano, o cuando el usuario toca "Actualizar".
 */
import { useSyncExternalStore } from 'react';

let aplicar: (() => void) | null = null;
const subs = new Set<() => void>();

export function hayActualizacion(fn: () => void) {
  aplicar = fn;
  subs.forEach((s) => s());
}

export function aplicarActualizacion() {
  aplicar?.();
}

export function useActualizacionPendiente(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => aplicar !== null,
  );
}

// Si la app se va a segundo plano con una versión pendiente, se actualiza sin que nadie lo note.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && aplicar) aplicar();
});
