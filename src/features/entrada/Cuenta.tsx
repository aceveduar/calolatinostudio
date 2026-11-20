import { useEffect, useState } from 'react';
import { Check, X, ArrowRightLeft } from 'lucide-react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { billetesSugeridos, type Movimiento } from '../../domain/rapido';

/**
 * Cuenta abierta: junta los cobros hasta que recepción toca "Listo". Sirve para cobrar juntos a una pareja o
 * grupo: se toca el billete con que pagaron y se ve el cambio.
 * Si en la cuenta NO hay dinero (solo entradas con plan o beca), se cierra sola en un momento: no hay nada que
 * cobrar ni cambio que dar, y "Listo" era un toque de más con casi cada alumno. El aviso de abajo conserva
 * "Deshacer" por si se tocó al alumno equivocado.
 */
export const CIERRE_SIN_COBRO_MS = 2500;
export function Cuenta({
  movs,
  onDeshacer,
  onTransferencia,
  onCerrar,
  incrustado = false,
}: {
  /** en escritorio va en el panel lateral, no flotando */
  incrustado?: boolean;
  movs: Movimiento[];
  onDeshacer: (m: Movimiento) => void;
  onTransferencia: () => void;
  onCerrar: () => void;
}) {
  const [pagoCon, setPagoCon] = useState<number | null>(null);
  const efectivo = movs.filter((m) => m.metodo === 'efectivo').reduce((s, m) => s + m.monto, 0);
  const transfer = movs.filter((m) => m.metodo === 'transferencia').reduce((s, m) => s + m.monto, 0);
  const sinCobro = movs.length > 0 && movs.every((m) => !m.monto);
  // la llave cambia con cada alumno que entra: el tiempo vuelve a empezar si llega otro
  const llave = movs.map((m) => m.key).join(',');
  useEffect(() => {
    if (!sinCobro) return;
    const t = setTimeout(onCerrar, CIERRE_SIN_COBRO_MS);
    return () => clearTimeout(t);
  }, [sinCobro, llave, onCerrar]);

  if (!movs.length) return null;
  // Productos iguales en una sola fila ("Agua ×2"); la ✕ quita una pieza (la más reciente)
  const filas: { m: Movimiento; cantidad: number; monto: number }[] = [];
  for (const m of movs) {
    const f = m.productoId ? filas.find((x) => x.m.productoId === m.productoId && x.m.metodo === m.metodo) : undefined;
    if (f) {
      f.cantidad++;
      f.monto += m.monto;
    } else filas.push({ m, cantidad: 1, monto: m.monto });
  }
  const hayProductos = movs.some((m) => m.productoId);

  return (
    <div
      className={incrustado ? 'animate-sube' : 'fixed inset-x-0 z-40 mx-auto max-w-2xl px-3 animate-sube'}
      style={incrustado ? undefined : { bottom: 'calc(4.4rem + env(safe-area-inset-bottom))' }}
    >
      <div className="overflow-hidden rounded-3xl bg-panel text-white shadow-2xl shadow-black/30">
        <div className="max-h-36 lg:max-h-72 divide-y divide-white/10 overflow-y-auto">
          {filas.map(({ m, cantidad, monto }) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-2">
              {m.emoji ? <span className="w-[18px] shrink-0 text-center text-lg leading-none">{m.emoji}</span> : <Check size={18} className="shrink-0 text-[#7ee2a8]" />}
              <span className="min-w-0 flex-1 truncate font-semibold">
                {m.nombre}
                {cantidad > 1 && <span className="ml-1.5 font-bold text-white/70">×{cantidad}</span>}
              </span>
              <span className={cx('text-sm font-bold', !monto && 'text-[#7ee2a8]')}>
                {monto ? dinero(monto) : m.beca ? 'Beca' : 'Plan'}
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
                {pagoCon ? `Pagó con ${dinero(pagoCon)}` : hayProductos ? 'Total de la cuenta' : movs.length > 1 ? `Pagan juntos · ${movs.length}` : 'Cobrar en efectivo'}
              </span>
              {pagoCon ? (
                <span className="text-2xl font-extrabold text-[#7ee2a8]">Cambio {dinero(pagoCon - efectivo)}</span>
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
                  }}
                  className={cx('h-11 rounded-xl text-[15px] font-bold transition', pagoCon === b ? 'bg-[#1f9d55] text-white' : 'bg-white/10 active:bg-white/20')}
                >
                  {dinero(b)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={onTransferencia} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white/70 active:bg-white/10">
                <ArrowRightLeft size={15} /> Fue transferencia
              </button>
              <button onClick={onCerrar} className="h-10 flex-1 rounded-xl bg-[#fff] text-[15px] font-bold text-[#1c1a24] active:bg-[#ecebf1]">
                Listo
              </button>
            </div>
          </div>
        ) : (
          <div className="relative border-t border-white/10">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">
                {sinCobro ? (
                  <span className="flex items-center gap-1.5 text-[#7ee2a8]">
                    <Check size={16} aria-hidden="true" /> {movs.length === 1 ? 'Entra' : 'Entran'} con su {movs.every((m) => m.beca) ? 'beca' : 'plan'} · se cierra solo
                  </span>
                ) : transfer ? (
                  `${dinero(transfer)} por transferencia`
                ) : (
                  'Sin cobro en efectivo'
                )}
              </span>
              <button onClick={onCerrar} className="h-10 rounded-xl bg-[#fff] px-5 text-[15px] font-bold text-[#1c1a24] active:bg-[#ecebf1]">
                Listo
              </button>
            </div>
            {/* cuenta regresiva del cierre solo (se reinicia si entra alguien más) */}
            {sinCobro && (
              <span className="absolute inset-x-0 bottom-0 block h-0.5 overflow-hidden" aria-hidden="true">
                <span key={llave} className="block h-full origin-left bg-[#7ee2a8]/70" style={{ animation: `vaciar ${CIERRE_SIN_COBRO_MS}ms linear forwards` }} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
