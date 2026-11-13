import { useState } from 'react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { deFecha } from '../../domain/fechas';

/**
 * Ingresos por día: una sola serie (sin leyenda; el título la nombra), en el color de la academia.
 * Barras delgadas con punta redondeada sobre la base, 2 px de separación, ejes discretos.
 * Tocar/pasar sobre una barra muestra el detalle; "Ver tabla" da la misma información en texto.
 */
export function GraficaBarras({ datos }: { datos: { fecha: string; monto: number }[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);
  const max = Math.max(1, ...datos.map((d) => d.monto));
  const tope = escalaBonita(max);
  const total = datos.reduce((s, d) => s + d.monto, 0);
  const pocos = datos.length <= 10;
  const etiqueta = (f: string, largo = false) =>
    deFecha(f).toLocaleDateString('es-MX', largo ? { weekday: 'long', day: 'numeric', month: 'short' } : pocos ? { weekday: 'short' } : { day: 'numeric', month: 'short' });
  const marcas = pocos ? datos.map((_, i) => i) : [0, Math.floor((datos.length - 1) / 2), datos.length - 1];
  const actual = sel !== null ? datos[sel] : null;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-sm text-ink-500 first-letter:uppercase">{actual ? etiqueta(actual.fecha, true) : `Total del periodo`}</p>
        <p className="text-lg font-extrabold">{dinero(actual ? actual.monto : total)}</p>
      </div>

      {tabla ? (
        <div className="max-h-64 overflow-y-auto rounded-xl ring-1 ring-ink-100">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-100">
              {datos.map((d) => (
                <tr key={d.fecha}>
                  <td className="px-3 py-1.5 text-ink-700 first-letter:uppercase">{etiqueta(d.fecha, true)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{dinero(d.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setSel(null)}>
          {/* rejilla discreta: tope y mitad */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40">
            {[1, 0.5].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-dashed border-ink-100" style={{ top: `${(1 - f) * 100}%` }}>
                <span className="absolute -top-2 right-0 bg-superficie pl-1 text-[10px] text-ink-500">{dinero(tope * f)}</span>
              </div>
            ))}
          </div>
          <div className="relative flex h-40 items-end border-b border-ink-300" style={{ gap: 2 }} role="img" aria-label={`Ingresos por día, total ${dinero(total)}`}>
            {datos.map((d, i) => (
              <button
                key={d.fecha}
                type="button"
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(sel === i ? null : i)}
                className="group flex h-full min-w-0 flex-1 items-end"
                aria-label={`${etiqueta(d.fecha, true)}: ${dinero(d.monto)}`}
              >
                <span
                  className={cx('block w-full rounded-t-[4px] transition-opacity', sel !== null && sel !== i && 'opacity-40')}
                  style={{ height: `${(d.monto / tope) * 100}%`, minHeight: d.monto ? 2 : 0, background: 'var(--marca)' }}
                />
              </button>
            ))}
          </div>
          <div className="relative mt-1 h-4 text-[10px] text-ink-500">
            {marcas.map((i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 whitespace-nowrap first-letter:uppercase"
                style={{ left: `${((i + 0.5) / datos.length) * 100}%` }}
              >
                {etiqueta(datos[i].fecha)}
              </span>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setTabla(!tabla)} className="mt-2 text-xs font-semibold text-brand-600">
        {tabla ? 'Ver gráfica' : 'Ver como tabla'}
      </button>
    </div>
  );
}

/** Redondea el máximo hacia arriba a un número "bonito" (1, 2, 2.5, 5 × 10ⁿ) para la rejilla. */
function escalaBonita(v: number): number {
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
  return 10 * exp;
}
