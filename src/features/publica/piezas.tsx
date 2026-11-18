import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';

/** Sección a todo lo ancho con su encabezado. */
export function Seccion({ id, idAlterno, eyebrow, titulo, fondo, children }: { id?: string; idAlterno?: string; eyebrow?: string; titulo: string; fondo?: 'superficie'; children: ReactNode }) {
  return (
    <section id={id ?? idAlterno} className={cx('scroll-mt-16', fondo === 'superficie' ? 'bg-superficie' : 'bg-ink-50')}>
      {/* el horario necesita su propio ancla aunque comparta sección con "Clases" */}
      {idAlterno && id && <span id={idAlterno} />}
      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <div className="pp-revela mb-8">
          {eyebrow && <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">{eyebrow}</p>}
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{titulo}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

export function Dato({ valor, texto }: { valor: number; texto: string }) {
  return (
    <div>
      <dt className="sr-only">{texto}</dt>
      <dd>
        <span className="sr-only">{valor}</span>
        <Contador n={valor} />
        <span className="block text-xs leading-tight text-white/75">{texto}</span>
      </dd>
    </div>
  );
}

export function Precio({ nombre, detalle, precio, extra, destacado }: { nombre: string; detalle: string; precio: number; extra?: string; destacado?: boolean }) {
  return (
    <div className={cx('pp-revela relative flex flex-col rounded-3xl p-5 ring-1', destacado ? 'bg-panel text-white ring-panel' : 'bg-superficie shadow-sm ring-ink-100')}>
      {destacado && <span className="absolute -top-3 left-5 rounded-full bg-brand-500 px-3 py-1 text-xs font-bold text-white">Para venir cuando quieras</span>}
      <p className="text-lg font-extrabold">{nombre}</p>
      <p className={cx('text-sm', destacado ? 'text-white/70' : 'text-ink-500')}>{detalle}</p>
      <p className="mt-4 text-4xl font-extrabold tracking-tight">{dinero(precio)}</p>
      {extra && <p className={cx('mt-1 text-sm font-bold', destacado ? 'text-white/85' : 'text-ok-600')}>{extra}</p>}
    </div>
  );
}

export function Punto({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
        <Check size={14} />
      </span>
      {children}
    </li>
  );
}

/** Número que cuenta hasta su valor al aparecer (sin animación si se pidió menos movimiento). */
export function Contador({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(n);
  useEffect(() => {
    const el = ref.current;
    if (!el || n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n]);
  return (
    <span ref={ref} aria-hidden="true" className="block text-3xl font-extrabold tracking-tight tabular-nums">
      {v}
    </span>
  );
}
