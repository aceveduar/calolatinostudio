type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa al motor de sincronización que hay cambios locales pendientes. */
export function notificarCambioLocal() {
  listeners.forEach((l) => l());
}

export function alCambiarLocal(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
