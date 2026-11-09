import { Delete } from 'lucide-react';
import { cx } from './ui';

/** Teclado numérico para PIN de 4 dígitos. */
export function TecladoPin({ valor, onChange, error }: { valor: string; onChange: (v: string) => void; error?: boolean }) {
  const tecla = (t: string) => {
    if (t === 'borrar') return onChange(valor.slice(0, -1));
    if (valor.length < 4) onChange(valor + t);
  };
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className={cx('mb-8 flex justify-center gap-4', error && 'animate-[sube_200ms]')}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              'h-4 w-4 rounded-full transition',
              error ? 'bg-bad-600' : i < valor.length ? 'bg-brand-500 scale-110' : 'bg-ink-100 ring-1 ring-ink-300',
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar'].map((t, i) =>
          t === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => tecla(t)}
              className="flex h-16 items-center justify-center rounded-2xl bg-white text-2xl font-semibold ring-1 ring-ink-100 active:bg-ink-100"
              aria-label={t === 'borrar' ? 'Borrar' : t}
            >
              {t === 'borrar' ? <Delete size={24} /> : t}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
