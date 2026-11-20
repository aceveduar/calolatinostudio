import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito';
const variantes: Record<Variante, string> = {
  primario: 'bg-brand-500 text-white active:bg-brand-600 shadow-sm shadow-brand-500/30',
  exito: 'bg-ok-600 text-white active:brightness-95 shadow-sm shadow-ok-600/30',
  secundario: 'bg-superficie text-ink-900 ring-1 ring-ink-100 active:bg-ink-50',
  fantasma: 'text-ink-700 active:bg-ink-100',
  peligro: 'bg-bad-50 text-bad-600 active:brightness-95',
};

export function Boton({
  variante = 'primario',
  grande,
  bloque,
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; grande?: boolean; bloque?: boolean }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        grande ? 'h-14 px-6 text-lg' : 'h-11 px-4 text-[15px]',
        bloque && 'w-full',
        variantes[variante],
        className,
      )}
    />
  );
}

/**
 * Campo con etiqueta. Para un solo control usa <label> (tocar la etiqueta enfoca el control).
 * Con `grupo` (varios botones, p. ej. días de la semana) usa un grupo con nombre: un <label> haría que
 * tocar la etiqueta activara el primer botón y que el lector de pantalla lo nombrara mal.
 */
export function Campo({ etiqueta, ayuda, grupo, children }: { etiqueta: string; ayuda?: string; grupo?: boolean; children: ReactNode }) {
  const Tag = grupo ? 'div' : 'label';
  return (
    <Tag className="block" {...(grupo ? { role: 'group', 'aria-label': etiqueta } : {})}>
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-ink-500">{ayuda}</span>}
    </Tag>
  );
}

const baseInput =
  'w-full h-12 rounded-xl bg-superficie px-4 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-ink-300';

export function Entrada(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(baseInput, p.className)} />;
}

/** Campo de contraseña o PIN con botón de ojo para ver lo escrito. */
export function EntradaClave(p: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <input {...p} type={ver ? 'text' : 'password'} className={cx(baseInput, 'pr-12', p.className)} />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2.5 text-ink-500 hover:bg-ink-50 active:bg-ink-100"
        aria-label={ver ? 'Ocultar' : 'Mostrar'}
        aria-pressed={ver}
      >
        {ver ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}

export function Selector(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(baseInput, 'appearance-none', p.className)} />;
}

export function Segmentos<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-ink-100 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cx(
            'flex-1 h-10 rounded-lg text-sm font-semibold transition',
            valor === o.valor ? 'bg-superficie text-ink-900 shadow-sm' : 'text-ink-500',
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export type Tono = 'ok' | 'pronto' | 'sin' | 'neutro' | 'marca';
const tonos: Record<Tono, string> = {
  ok: 'bg-ok-50 text-ok-600',
  pronto: 'bg-warn-50 text-warn-600',
  sin: 'bg-bad-50 text-bad-600',
  neutro: 'bg-ink-100 text-ink-700',
  marca: 'bg-brand-50 text-brand-600',
};
export function Etiqueta({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tonos[tono])}>
      {children}
    </span>
  );
}

export function Tarjeta({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('block w-full text-left rounded-2xl bg-superficie ring-1 ring-ink-100', onClick && 'active:bg-ink-50', className)}>
      {children}
    </Tag>
  );
}

// tonos con contraste AA (≥ 4.5:1) para las iniciales en blanco
const coloresAvatar = ['#d13d51', '#7c4ddb', '#1a7ab6', '#138645', '#b06005', '#d92776', '#0b8278'];
export function Avatar({ nombre, tam = 44, foto }: { nombre: string; tam?: number; foto?: string | null }) {
  if (foto) return <img src={foto} alt="" width={tam} height={tam} className="shrink-0 rounded-full object-cover" style={{ width: tam, height: tam }} />;
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
  let h = 0;
  for (const ch of nombre) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: tam, height: tam, background: coloresAvatar[h % coloresAvatar.length], fontSize: tam * 0.38 }}
    >
      {iniciales || '?'}
    </span>
  );
}

export function Vacio({ icono, titulo, texto, children }: { icono?: ReactNode; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icono && <div className="mb-3 text-ink-300">{icono}</div>}
      <p className="font-semibold text-ink-700">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-ink-500">{texto}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Hoja inferior: el patrón natural en teléfono para acciones rápidas. */
export function Hoja({ abierta, onCerrar, titulo, children }: { abierta: boolean; onCerrar: () => void; titulo?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!abierta) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [abierta, onCerrar]);

  // Teclado (PC): al abrir, el foco entra a la hoja; Tab no se escapa al fondo; al cerrar vuelve a donde estaba.
  // Solo depende de `abierta` para no robar el foco mientras se escribe.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta) return;
    const antes = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(id);
      if (antes?.isConnected) antes.focus({ preventScroll: true });
    };
  }, [abierta]);
  const atraparTab = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return;
    const f = [...panel.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (!f.length) return;
    const i = f.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && i === f.length - 1) {
      e.preventDefault();
      f[0].focus();
    }
  };

  if (!abierta) return null;
  // Portal al <body>: así ninguna barra fija/pegajosa de la página puede quedar encima de la hoja,
  // sin importar desde qué parte de la pantalla se abra.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={typeof titulo === 'string' ? titulo : undefined}>
      <div className="absolute inset-0 bg-panel/40 animate-aparece" onClick={onCerrar} />
      <div
        ref={panel}
        tabIndex={-1}
        onKeyDown={atraparTab}
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ink-50 pb-safe outline-none animate-sube sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-ink-50/95 px-5 pt-3 pb-2 backdrop-blur">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink-300 sm:hidden" />
          <div className="mt-2 flex-1 text-lg font-bold">{titulo}</div>
          <button onClick={onCerrar} className="-mr-1 mt-2 rounded-full p-2.5 text-ink-500 active:bg-ink-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: string; accion?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{titulo}</h1>
        {sub && <p className="text-sm text-ink-500 first-letter:uppercase">{sub}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-500">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Interruptor({ valor, onChange, texto }: { valor: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      onClick={() => onChange(!valor)}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-superficie px-4 py-3 text-left text-ink-900 ring-1 ring-ink-100"
    >
      <span className="font-medium">{texto}</span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition', valor ? 'bg-ok-600' : 'bg-ink-300')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-superficie shadow transition-all', valor ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

/**
 * Filtros como chips en una fila que se desliza (mejor que Segmentos cuando son más de 3 opciones en celular).
 */
export function Chips<T extends string>({ opciones, valor, onChange, etiqueta }: { opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void; etiqueta?: string }) {
  return (
    <div role="group" aria-label={etiqueta} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cx(
            'h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 transition',
            valor === o.valor ? 'bg-panel text-white ring-panel' : 'bg-superficie text-ink-700 ring-ink-100',
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Al pie de una lista larga: se ven unos cuantos y se despliegan todos al tocar. */
export function VerMas({ abierto, total, onClick, texto }: { abierto: boolean; total: number; onClick: () => void; texto?: string }) {
  return (
    <button onClick={onClick} className="w-full py-3 text-center text-sm font-semibold text-brand-600 active:bg-ink-50">
      {abierto ? 'Ver menos' : (texto ?? `Ver los ${total}`)}
    </button>
  );
}

/**
 * Mientras una pantalla pesada carga sus datos: en lugar de quedar en blanco (parece que falló), un aviso.
 * Aparece solo si la espera pasa de 1/4 de segundo, para no parpadear en las pantallas rápidas.
 */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  const [ver, setVer] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVer(true), 250);
    return () => clearTimeout(t);
  }, []);
  if (!ver) return null;
  return (
    <div role="status" className="flex flex-col items-center gap-3 px-4 py-16 text-ink-500">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-ink-100 border-t-brand-500" aria-hidden="true" />
      <span className="text-sm font-semibold">{texto}</span>
    </div>
  );
}
