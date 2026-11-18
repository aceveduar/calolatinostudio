/**
 * Actualizaciones de la app sin interrumpir: nunca recargar a media cobranza.
 * La versión nueva se aplica cuando la app pasa a segundo plano, o cuando el usuario toca "Actualizar".
 */
import { useEffect, useSyncExternalStore } from 'react';

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

/** Pantallas con algo a medias (p. ej. una cuenta abierta en Entrada): mientras haya alguna, no se actualiza sola. */
let ocupadas = 0;
export function useNoActualizarMientras(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    ocupadas++;
    return () => {
      ocupadas--;
    };
  }, [activo]);
}

// Si la app se va a segundo plano con una versión pendiente, se actualiza sin que nadie lo note
// (salvo que haya una cuenta abierta: al volver, Monse debe seguir viendo el total que estaba cobrando).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && aplicar && ocupadas === 0) aplicar();
});
