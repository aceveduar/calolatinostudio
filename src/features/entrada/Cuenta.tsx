import { useEffect, useState } from 'react';
import { Check, X, ArrowRightLeft } from 'lucide-react';
import { Boton, Campo, Entrada, Hoja, cx } from '../../components/ui';
import { aCentavos, dinero } from '../../domain/dinero';
import { billetesSugeridos, type Movimiento } from '../../domain/rapido';
import { useRespaldoMovimientos } from '../../sync/respaldoMovimiento';

/**
 * Cuenta abierta: junta los cobros hasta que recepción toca "Cerrar cuenta". Sirve para cobrar juntos a una pareja o
 * grupo: se toca el billete con que pagaron y se ve el cambio.
 * Si en la cuenta NO hay dinero (solo entradas con plan o beca), se cierra sola en un momento: no hay nada que
 * cobrar ni cambio que dar, y "Listo" era un toque de más con casi cada alumno. El aviso de abajo conserva
 * "Deshacer" por si se tocó al alumno equivocado. En cuanto recepción toca la cuenta, el cierre se detiene:
 * lo que se cierra por tiempo debe poderse parar (p. ej. para agregarle un agua con calma).
 * Tocar el nombre de un alumno abre sus opciones (ficha, vender plan…): el camino visible al "mantén presionado".
 */
export const CIERRE_SIN_COBRO_MS = 2500;
export function Cuenta({
  movs,
  onDeshacer,
  onTransferencia,
  onCerrar,
  onOpciones,
  incrustado = false,
}: {
  /** abrir las opciones de ese alumno (ficha, vender plan…) */
  onOpciones?: (alumnoId: string) => void;
  /** en escritorio va en el panel lateral, no flotando */
  incrustado?: boolean;
  movs: Movimiento[];
  onDeshacer: (m: Movimiento) => Promise<void>;
  onTransferencia: (pagos: Movimiento[]) => Promise<void>;
  onCerrar: () => void;
}) {
  const [pagoCon, setPagoCon] = useState<number | null>(null);
  const [otroImporte, setOtroImporte] = useState<string | null>(null);
  const [corregir, setCorregir] = useState<Movimiento | null>(null);
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [errorCorreccion, setErrorCorreccion] = useState(false);
  const respaldo = useRespaldoMovimientos(movs.flatMap((m) => [m.pagoId, m.asistenciaId, m.alumnoCreadoId]));
  const [elegirTransferencia, setElegirTransferencia] = useState(false);
  const [cambiandoMetodo, setCambiandoMetodo] = useState(false);
  const [errorMetodo, setErrorMetodo] = useState(false);
  const pagosEfectivo = movs.filter((m) => m.metodo === 'efectivo' && m.pagoId);
  const efectivo = pagosEfectivo.reduce((s, m) => s + m.monto, 0);
  const recibido = pagoCon !== null && pagoCon >= efectivo ? pagoCon : null;
  const textoImporte = otroImporte?.trim() ?? '';
  const importe = /^\d{1,12}(?:[.,]\d{0,2})?$/.test(textoImporte)
    ? aCentavos(textoImporte.replace(',', '.'))
    : null;
  const transfer = movs.filter((m) => m.metodo === 'transferencia').reduce((s, m) => s + m.monto, 0);
  const sinCobro = movs.length > 0 && movs.every((m) => !m.monto);
  // la llave cambia con cada alumno que entra: el tiempo vuelve a empezar si llega otro
  const llave = movs.map((m) => m.key).join(',');
  // tocar la cuenta la "toma": deja de cerrarse sola (con cada alumno nuevo vuelve a contar)
  const [tomada, setTomada] = useState<string | null>(null);
  const pausada = tomada === llave || Boolean(corregir);
  useEffect(() => {
    if (!sinCobro || pausada) return;
    const t = setTimeout(onCerrar, CIERRE_SIN_COBRO_MS);
    return () => clearTimeout(t);
  }, [sinCobro, llave, onCerrar, pausada]);

  async function registrarTransferencia(pagos: Movimiento[]) {
    setCambiandoMetodo(true);
    setErrorMetodo(false);
    try {
      await onTransferencia(pagos);
      setPagoCon(null);
      setElegirTransferencia(false);
    } catch {
      setErrorMetodo(true);
    } finally {
      setCambiandoMetodo(false);
    }
  }

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
  return (
    <div
      className={incrustado ? 'animate-sube' : 'fixed inset-x-0 z-40 mx-auto max-w-2xl px-3 animate-sube'}
      style={incrustado ? undefined : { bottom: 'calc(4.4rem + env(safe-area-inset-bottom))' }}
    >
      <div className="overflow-hidden rounded-3xl bg-panel text-white shadow-2xl shadow-black/30" onPointerDown={() => sinCobro && setTomada(llave)}>
        <div className="max-h-36 lg:max-h-72 divide-y divide-white/10 overflow-y-auto">
          {filas.map(({ m, cantidad, monto }) => (
            <div key={m.key} className="flex items-center gap-3 px-4 py-2">
              <Check size={18} className="shrink-0 text-[#7ee2a8]" />
              <span className="min-w-0 flex-1">
                {m.alumnoId && onOpciones ? (
                  <button type="button" onClick={() => onOpciones(m.alumnoId!)} className="block max-w-full truncate text-left font-semibold underline decoration-white/30 underline-offset-4 active:text-white/70" aria-label={`Opciones de ${m.nombre}`}>
                    {m.nombre}
                  </button>
                ) : (
                  <span className="block truncate font-semibold">
                    {m.nombre}
                    {cantidad > 1 && <span className="ml-1.5 font-bold text-white/70">×{cantidad}</span>}
                  </span>
                )}
                {m.aviso && <span className="block text-xs text-[#ffd48a]">{m.aviso}</span>}
                {m.asistenciaId && (
                  <span className="block text-xs text-white/75">{respaldo(m.pagoId, m.asistenciaId, m.alumnoCreadoId)}</span>
                )}
              </span>
              <span className={cx('text-sm font-bold', !monto && 'text-[#7ee2a8]')}>
                {monto ? dinero(monto) : m.beca ? 'Beca' : 'Plan'}
                {m.metodo === 'transferencia' && <span className="ml-1 font-normal text-white/60">transf.</span>}
              </span>
              {m.asistenciaId ? <button type="button" onClick={() => {
                setTomada(llave);
                setErrorCorreccion(false);
                setCorregir(m);
              }} className="-mr-2 min-h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-white/85 underline underline-offset-4 active:bg-white/10" aria-label={`Corregir ${m.nombre}`}>
                Corregir
              </button> : (
                <button type="button" onClick={() => void onDeshacer(m)} className="-mr-2 rounded-full p-2 text-white/50 active:bg-white/10" aria-label={`Deshacer ${m.nombre}`}>
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
        <Hoja abierta={Boolean(corregir)} titulo="Corregir movimiento" onCerrar={() => {
          if (!corrigiendo) setCorregir(null);
        }}>
          {corregir && (
            <div className="space-y-3">
              <p className="font-bold">{corregir.nombre}</p>
              <p className="text-sm text-ink-700">
                {corregir.pagoId ? `Se quitará la asistencia y el cobro de ${dinero(corregir.monto)} de Caja.` : 'Se quitará la asistencia y dejará de contar en su plan.'}
                {corregir.alumnoCreadoId && ' También se retirará la ficha creada con esta entrada.'}
              </p>
              {errorCorreccion && <p role="alert" className="text-sm text-bad-600">No se pudo quitar el movimiento. Inténtalo de nuevo.</p>}
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" disabled={corrigiendo} onClick={() => setCorregir(null)}>Cancelar</Boton>
                <Boton variante="peligro" disabled={corrigiendo} onClick={async () => {
                  setCorrigiendo(true);
                  setErrorCorreccion(false);
                  try {
                    await onDeshacer(corregir);
                    setCorregir(null);
                  } catch {
                    setErrorCorreccion(true);
                  } finally {
                    setCorrigiendo(false);
                  }
                }}>{corrigiendo ? 'Quitando…' : 'Quitar movimiento'}</Boton>
              </div>
            </div>
          )}
        </Hoja>

        <Hoja abierta={elegirTransferencia} titulo="¿Qué pago fue por transferencia?" onCerrar={() => {
          if (!cambiandoMetodo) setElegirTransferencia(false);
        }}>
          <div className="space-y-2">
            <p className="text-sm text-ink-600">Elige un pago o cambia todos los que están en efectivo.</p>
            {pagosEfectivo.map((m) => (
              <button type="button" key={m.key} disabled={cambiandoMetodo} onClick={() => void registrarTransferencia([m])} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-superficie px-3 py-2 text-left text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-50">
                <span className="break-words">{m.nombre}</span>
                <span className="shrink-0 tabular-nums">{dinero(m.monto)}</span>
              </button>
            ))}
            {pagosEfectivo.length > 1 && (
              <Boton bloque variante="secundario" disabled={cambiandoMetodo} onClick={() => void registrarTransferencia(pagosEfectivo)}>
                Todos por transferencia · {dinero(efectivo)}
              </Boton>
            )}
            {errorMetodo && <p role="alert" className="text-sm text-bad-600">No se pudo cambiar el método de pago. Intenta de nuevo.</p>}
          </div>
        </Hoja>
        {efectivo > 0 ? (
          <div className="border-t border-white/10 px-4 pt-3 pb-3">
            <div className="flex items-start justify-between gap-3 tabular-nums">
              <div>
                <p className="text-xs font-semibold text-white/75">
                  Efectivo a recibir
                </p>
                <p className="text-3xl leading-tight font-extrabold">{dinero(efectivo)}</p>
                {pagosEfectivo.length > 1 && <p className="text-xs text-white/70">{pagosEfectivo.length} pagos en efectivo</p>}
              </div>
              <div aria-live="polite" className="text-right">
                {recibido !== null && (
                  <>
                    <p className="text-xs font-semibold text-white/75">Pagó con {dinero(recibido)}</p>
                    <p className="text-3xl leading-tight font-extrabold text-[#7ee2a8]"><span className="text-sm">Cambio</span> {dinero(recibido - efectivo)}</p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-2.5 flex gap-1.5 sm:gap-2">
              {billetesSugeridos(efectivo).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    const v = recibido === b ? null : b;
                    setPagoCon(v);
                  }}
                  aria-pressed={recibido === b}
                  className={cx('min-h-11 min-w-0 flex-1 rounded-xl px-0.5 text-sm font-bold transition', recibido === b ? 'bg-[#1f9d55] text-white' : 'bg-white/10 active:bg-white/20')}
                >
                  {dinero(b)}
                </button>
              ))}
              <button type="button" onClick={() => setOtroImporte('')} className="min-h-11 min-w-0 flex-1 rounded-xl px-0.5 text-xs leading-tight font-semibold text-white/85 ring-1 ring-white/20 ring-inset active:bg-white/10">
                Otro importe
              </button>
            </div>
            <Hoja abierta={otroImporte !== null} titulo="Efectivo recibido" onCerrar={() => setOtroImporte(null)}>
              {otroImporte !== null && (
                <form className="space-y-3" onSubmit={(e) => {
                  e.preventDefault();
                  if (importe === null || importe < efectivo) return;
                  setPagoCon(importe);
                  setOtroImporte(null);
                }}>
                  <p className="text-sm text-ink-700">Efectivo a recibir <strong>{dinero(efectivo)}</strong></p>
                  <Campo etiqueta="¿Con cuánto pagó?">
                    <Entrada autoFocus inputMode="decimal" placeholder="Ej. 70" value={otroImporte} onChange={(e) => setOtroImporte(e.target.value)} />
                  </Campo>
                  <p aria-live="polite" className={cx('min-h-6 text-sm font-semibold', importe !== null && importe >= efectivo ? 'text-ok-600' : 'text-warn-600')}>
                    {importe !== null ? (importe < efectivo ? `Faltan ${dinero(efectivo - importe)}` : `Cambio ${dinero(importe - efectivo)}`) : textoImporte ? 'Escribe un importe con hasta dos decimales.' : ''}
                  </p>
                  <Boton bloque type="submit" disabled={importe === null || importe < efectivo}>Usar importe</Boton>
                </form>
              )}
            </Hoja>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={cambiandoMetodo} onClick={() => {
                setErrorMetodo(false);
                if (pagosEfectivo.length === 1) void registrarTransferencia(pagosEfectivo);
                else setElegirTransferencia(true);
              }} aria-label="Pagó por transferencia" className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white/85 active:bg-white/10">
                <ArrowRightLeft size={15} /> <span className="whitespace-nowrap">Transferencia</span>
              </button>
              <button type="button" disabled={cambiandoMetodo} onClick={onCerrar} className="min-h-11 flex-1 rounded-xl bg-[#fff] px-2 text-sm font-bold text-[#1c1a24] active:bg-[#ecebf1]">
                Cerrar cuenta
              </button>
            </div>
            {errorMetodo && !elegirTransferencia && <p role="alert" className="mt-2 text-sm text-[#ffd48a]">No se pudo cambiar el método de pago. Intenta de nuevo.</p>}
          </div>
        ) : (
          <div className="relative border-t border-white/10">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-white/60">
                {sinCobro ? (
                  <span className="flex items-center gap-1.5 text-[#7ee2a8]">
                    <Check size={16} aria-hidden="true" /> {movs.length === 1 ? 'Entra' : 'Entran'} con su {movs.every((m) => m.beca) ? 'beca' : 'plan'}
                  </span>
                ) : transfer ? (
                  `${dinero(transfer)} por transferencia`
                ) : (
                  'Sin cobro en efectivo'
                )}
              </span>
              <button onClick={onCerrar} className="h-10 rounded-xl bg-[#fff] px-5 text-[15px] font-bold text-[#1c1a24] active:bg-[#ecebf1]">
                Cerrar cuenta
              </button>
            </div>
            {/* cuenta regresiva del cierre solo: la barrita lo dice sin palabras (se reinicia si entra alguien más; se va si la tocaron) */}
            {sinCobro && !pausada && (
              <span className="absolute inset-x-0 bottom-0 block h-0.5 overflow-hidden" aria-hidden="true" data-cierre-solo="">
                <span key={llave} className="block h-full origin-left bg-[#7ee2a8]/70" style={{ animation: `vaciar ${CIERRE_SIN_COBRO_MS}ms linear forwards` }} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
