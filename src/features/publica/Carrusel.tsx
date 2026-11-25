import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../components/ui';

/**
 * Fila que se desliza con el dedo o con las flechas.
 */
export function Carrusel({ etiqueta, children, className }: { etiqueta: string; children: ReactNode; className?: string }) {
  const lista = useRef<HTMLUListElement>(null);
  const [alInicio, setAlInicio] = useState(true);
  const [alFinal, setAlFinal] = useState(true);
  const medir = () => {
    const el = lista.current;
    if (!el) return;
    setAlInicio(el.scrollLeft <= 2);
    setAlFinal(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
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
  const flecha = 'flex h-11 w-11 items-center justify-center rounded-full bg-superficie text-brand-600 ring-1 ring-inset ring-ink-100 active:bg-brand-50 disabled:opacity-35';
  return (
    <div className="relative">
      <ul ref={lista} onScroll={medir} aria-label={etiqueta} className={cx('no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-px pt-px pb-1', className)}>
        {children}
      </ul>
      {(!alInicio || !alFinal) && (
        <div className="mt-1 flex justify-end gap-1.5">
          <button type="button" onClick={() => mover(-1)} disabled={alInicio} className={flecha} aria-label={`${etiqueta}: anteriores`}>
            <ChevronLeft size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => mover(1)} disabled={alFinal} className={flecha} aria-label={`${etiqueta}: ver más`}>
            <ChevronRight size={19} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
