import { useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';
import { cx } from './ui';

/**
 * Teclado numérico para el PIN (4 o 6 dígitos según el usuario).
 * `conTeclado`: también se escribe con el teclado de la computadora (al crear la academia en una PC no
 * funcionaba: solo los botones de la pantalla).
 */
export function TecladoPin({ valor, onChange, error, largo = 6, conTeclado }: { valor: string; onChange: (v: string) => void; error?: boolean; largo?: number; conTeclado?: boolean }) {
  // lo último escrito, al momento: al teclear rápido no se pierden dígitos entre renders
  const actual = useRef(valor);
  actual.current = valor;
  const cambiar = useRef(onChange);
  cambiar.current = onChange;
  const tecla = (t: string) => {
    const v = actual.current;
    const nuevo = t === 'borrar' ? v.slice(0, -1) : v.length < largo ? v + t : v;
    if (nuevo === v) return;
    actual.current = nuevo;
    cambiar.current(nuevo);
  };
  const teclaRef = useRef(tecla);
  teclaRef.current = tecla;
  useEffect(() => {
    if (!conTeclado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        teclaRef.current(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        teclaRef.current('borrar');
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [conTeclado]);
  return (
    <div className="mx-auto w-full max-w-xs">
      <div className={cx('mb-8 flex justify-center gap-4', error && 'animate-[sube_200ms]')}>
        {Array.from({ length: largo }, (_, i) => i).map((i) => (
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
              className="flex h-16 items-center justify-center rounded-2xl bg-superficie text-2xl font-semibold ring-1 ring-ink-100 active:bg-ink-100"
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
