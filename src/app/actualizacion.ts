/**
 * Actualizaciones de la app sin interrumpir: nunca recargar a media cobranza.
 * La versión nueva se aplica cuando la app pasa a segundo plano, o cuando el usuario toca "Actualizar".
 */
import { useEffect, useSyncExternalStore } from 'react';

let aplicar: (() => void) | null = null;
let usarRegistro = false;
const subs = new Set<() => void>();
let ocupadas = 0;
let estado = 'sin-aviso';

function publicar() {
  subs.forEach((s) => s());
}

function cambiarEstado(nuevo: string) {
  estado = nuevo;
  publicar();
}

const abierta = Date.now();

export function hayActualizacion(fn: () => void, real = false) {
  // Recién abierta (nadie está cobrando todavía): se pone al día de una vez, sin aviso.
  aplicar = fn;
  usarRegistro = real;
  if (Date.now() - abierta < 8000 && ocupadas === 0) {
    if (real) void aplicarActualizacion();
    else fn();
    return;
  }
  if (estado === 'sin-aviso') cambiarEstado('disponible');
}

export async function aplicarActualizacion() {
  if (!aplicar || ocupadas > 0 || estado === 'actualizando') return;
  cambiarEstado('actualizando');
  const registro = usarRegistro ? await navigator.serviceWorker?.getRegistration().catch(() => undefined) : undefined;
  if (ocupadas > 0) {
    cambiarEstado('disponible');
    return;
  }
  const nuevo = registro?.waiting ?? registro?.installing;
  if (nuevo) {
    // Usa el worker que Chrome reporta para este registro, también si
    // la instalación se inició desde otra pestaña.
    nuevo.postMessage({ type: 'SKIP_WAITING' });
  } else if (registro?.active) {
    // Otra pestaña pudo activar la versión después de mostrarse el aviso.
    window.location.reload();
    return;
  } else {
    aplicar();
  }
  // Workbox suele recargar al cambiar el controlador. La activación también
  // permite completar el cambio cuando ese evento no llega a esta pestaña.
  function alActivar() {
    if (nuevo?.state !== 'activated') return;
    nuevo.removeEventListener('statechange', alActivar);
    clearTimeout(espera);
    window.location.reload();
  }
  const espera = window.setTimeout(() => {
    nuevo?.removeEventListener('statechange', alActivar);
    cambiarEstado('reintentar');
  }, 12000);
  nuevo?.addEventListener('statechange', alActivar);
  alActivar();
}

export function useEstadoActualizacion() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => ocupadas > 0 && estado !== 'sin-aviso' && estado !== 'actualizando' ? 'ocupada' : estado,
  );
}

/** Pantallas con algo a medias (p. ej. una cuenta abierta en Entrada): mientras haya alguna, no se actualiza sola. */
export function useNoActualizarMientras(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    ocupadas++;
    publicar();
    return () => {
      ocupadas--;
      publicar();
    };
  }, [activo]);
}

// Si la app se va a segundo plano con una versión pendiente, se actualiza sin que nadie lo note
// (salvo que haya una cuenta abierta: al volver, Monse debe seguir viendo el total que estaba cobrando).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void aplicarActualizacion();
});
