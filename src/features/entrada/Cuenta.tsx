import { useEffect, useState } from 'react';
import { Check, X, ArrowRightLeft } from 'lucide-react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { billetesSugeridos, type Movimiento } from '../../domain/rapido';

const INACTIVIDAD_MS = 20_000;

/**
 * Cuenta abierta: los cobros seguidos se suman (pareja o amigos que pagan juntos),
 * Monse toca con qué billete pagaron y ve el cambio. Se cierra sola tras 20 s sin uso.
 */
export function Cuenta({
  movs,
  onDeshacer,
  onTransferencia,
  onCerrar,
  onPagoCon,
}: {
  onPagoCon: (billete: number | null) => void;
  movs: Movimiento[];
  onDeshacer: (m: Movimiento) => void;
  onTransferencia: () => void;
  onCerrar: () => void;
}) {
  const [pagoCon, setPagoCon] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const efectivo = movs.filter((m) => m.metodo === 'efectivo').reduce((s, m) => s + m.monto, 0);
  const transfer = movs.filter((m) => m.metodo === 'transferencia').reduce((s, m) => s + m.monto, 0);

  // reinicia el temporizador con cada cambio o toque
  useEffect(() => {
    const t = setTimeout(onCerrar, INACTIVIDAD_MS);
    return () => clearTimeout(t);
  }, [movs, tick, onCerrar]);

  if (!movs.length) return null;
  const toque = () => setTick((n) => n + 1);

  return (
    <div
      className="fixed inset-x-0 z-40 mx-auto max-w-2xl px-3 animate-sube"
      style={{ bottom: 'calc(4.4rem + env(safe-area-inset-bottom))' }}
      onPointerDown={toque}
    >
      <div className="overflow-hidden rounded-3xl bg-ink-900 text-white shadow-2xl shadow-ink-900/30">
        <div className="max-h-36 divide-y divide-white/10 overflow-y-auto">
          {movs.map((m) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-2">
              <Check size={18} className="shrink-0 text-ok-50" />
              <span className="min-w-0 flex-1 truncate font-semibold">{m.nombre}</span>
              <span className={cx('text-sm font-bold', !m.monto && 'text-ok-50')}>
                {m.monto ? dinero(m.monto) : 'Plan'}
                {m.metodo === 'transferencia' && <span className="ml-1 font-normal text-white/60">transf.</span>}
              </span>
              <button onClick={() => onDeshacer(m)} className="-mr-2 rounded-full p-2 text-white/50 active:bg-white/10" aria-label={`Deshacer ${m.nombre}`}>
                <X size={18} />
              </button>
            </div>
          ))}
        </div>

        {efectivo > 0 ? (
          <div className="border-t border-white/10 px-4 pt-3 pb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/60">
                {pagoCon ? `Pagó con ${dinero(pagoCon)}` : movs.length > 1 ? `Pagan juntos · ${movs.length}` : 'Cobrar en efectivo'}
              </span>
              {pagoCon ? (
                <span className="text-2xl font-extrabold text-ok-50">Cambio {dinero(pagoCon - efectivo)}</span>
              ) : (
                <span className="text-2xl font-extrabold">{dinero(efectivo)}</span>
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {billetesSugeridos(efectivo).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    const v = pagoCon === b ? null : b;
                    setPagoCon(v);
                    onPagoCon(v);
                  }}
                  className={cx('h-11 rounded-xl text-[15px] font-bold transition', pagoCon === b ? 'bg-ok-600 text-white' : 'bg-white/10 active:bg-white/20')}
                >
                  {dinero(b)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={onTransferencia} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white/70 active:bg-white/10">
                <ArrowRightLeft size={15} /> Fue transferencia
              </button>
              <button onClick={onCerrar} className="h-10 flex-1 rounded-xl bg-white text-[15px] font-bold text-ink-900 active:bg-ink-100">
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
            <span className="text-sm text-white/60">{transfer ? `${dinero(transfer)} por transferencia` : 'Sin cobro en efectivo'}</span>
            <button onClick={onCerrar} className="h-10 rounded-xl bg-white px-5 text-[15px] font-bold text-ink-900 active:bg-ink-100">
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
