import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../components/ui';

/**
 * Fila que se desliza (fotos, testimonios). En el celular se desliza con el dedo; en computadora, con el
 * mouse no se puede, así que aparecen flechas a los lados, solo cuando hay más que ver hacia ese lado.
 */
export function Carrusel({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  const lista = useRef<HTMLUListElement>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(true);
  const medir = () => {
    const el = lista.current;
    if (!el) return;
    // el imán de deslizar deja el primero alineado con el margen (px-5), no en 0
    const margen = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    setAlInicio(el.scrollLeft <= margen + 8);
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - margen - 8);
  };
  useEffect(() => {
    medir();
    const el = lista.current;
    if (!el) return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mover = (d: number) => lista.current?.scrollBy({ left: d * lista.current.clientWidth * 0.8, behavior: 'smooth' });
  const flecha = 'absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-superficie text-ink-900 shadow-lg ring-1 ring-ink-100 transition hover:scale-105 sm:flex';
  return (
    <div className="relative">
      <ul ref={lista} onScroll={medir} aria-label={etiqueta} className={cx('no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-1', className)}>
        {children}
      </ul>
      {!alInicio && (
        <button type="button" onClick={() => mover(-1)} className={cx(flecha, '-left-3')} aria-label={`${etiqueta}: anteriores`}>
          <ChevronLeft size={24} />
        </button>
      )}
      {!alFinal && (
        <button type="button" onClick={() => mover(1)} className={cx(flecha, '-right-3')} aria-label={`${etiqueta}: ver más`}>
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}
