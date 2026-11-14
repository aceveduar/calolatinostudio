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

/** Pantalla de celular angosta (≤ 430 px), para acortar textos que no caben. */
const angosta = typeof window !== 'undefined' ? window.matchMedia('(max-width: 430px)') : null;
export function useAngosta(): boolean {
  return useSyncExternalStore(
    (cb) => {
      angosta?.addEventListener('change', cb);
      return () => angosta?.removeEventListener('change', cb);
    },
    () => angosta?.matches ?? false,
  );
}
