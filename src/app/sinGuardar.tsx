import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton, Hoja } from '../components/ui';

/**
 * Mientras `activo` (hay cambios sin guardar): si se toca un enlace de la app (menú, pestañas, "atrás"),
 * pregunta antes de salir; si se cierra o recarga la pestaña, el navegador pregunta. Devuelve la hoja que
 * hay que pintar. (La app usa BrowserRouter, que no trae "bloquear la navegación"; el botón atrás del
 * teléfono no se puede detener: para eso la pantalla guarda además un borrador.)
 * `alDescartar`: lo que hay que limpiar si elige salir sin guardar (p. ej. el borrador).
 */
export function useAvisarSiSale(activo: boolean, que = 'tus cambios', alDescartar?: () => void): ReactNode {
  const nav = useNavigate();
  const [destino, setDestino] = useState<string | null>(null);
  useEffect(() => {
    if (!activo) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    const clic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(url.pathname + url.search + url.hash);
    };
    addEventListener('beforeunload', antes);
    // en captura: antes de que el enlace del router haga su navegación
    document.addEventListener('click', clic, true);
    return () => {
      removeEventListener('beforeunload', antes);
      document.removeEventListener('click', clic, true);
    };
  }, [activo]);

  return (
    <Hoja abierta={destino !== null} onCerrar={() => setDestino(null)} titulo="Tienes cambios sin guardar">
      <p className="text-ink-700">Si sales ahora, se pierden {que}.</p>
      <div className="mt-5 grid gap-2">
        <Boton grande bloque onClick={() => setDestino(null)}>
          Seguir editando
        </Boton>
        <Boton
          bloque
          variante="fantasma"
          onClick={() => {
            const a = destino;
            setDestino(null);
            alDescartar?.();
            if (a) nav(a);
          }}
        >
          <span className="text-bad-600">Salir sin guardar</span>
        </Boton>
      </div>
    </Hoja>
  );
}
