import { useSyncExternalStore } from 'react';

const consulta = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null;

/** true en laptop/PC (≥1024 px). Reacciona al girar la tablet o cambiar el tamaño de la ventana. */
export function useEsEscritorio(): boolean {
  return useSyncExternalStore(
    (cb) => {
      consulta?.addEventListener('change', cb);
      return () => consulta?.removeEventListener('change', cb);
    },
    () => consulta?.matches ?? false,
  );
}
