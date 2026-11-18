import { useState } from 'react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { type DatosPublica } from '../../domain/publica';

/**
 * "¿Qué plan te conviene?": según cuántas veces por semana quiere venir, cuánto le cuesta al mes
 * cada forma de pagar y cuál le sale más barata. Usa los precios reales de la sede.
 */
export function Calculadora({ planes, suelta }: { planes: DatosPublica['planes']; suelta: DatosPublica['planes'][number] }) {
  const [veces, setVeces] = useState(2);
  const alMes = veces * 4;
  const opciones = [
    { nombre: 'Clase suelta', costo: suelta.precio * alMes, detalle: `${alMes} × ${dinero(suelta.precio)}` },
    ...planes
      .filter((x) => x.tipo === 'paquete' && x.clases)
      .map((x) => {
        const k = Math.ceil(alMes / x.clases!);
        return { nombre: x.nombre, costo: k * x.precio, detalle: k === 1 ? `${x.clases} clases` : `${k} paquetes de ${x.clases} clases` };
      }),
    ...planes.filter((x) => x.tipo === 'mensual' && !x.grupos).map((x) => ({ nombre: x.nombre, costo: x.precio, detalle: 'ilimitado' })),
  ];
  if (opciones.length < 2) return null;
  const mejor = opciones.reduce((a, b) => (b.costo < a.costo ? b : a));
  const maximo = Math.max(...opciones.map((o) => o.costo));
  const ahorro = suelta.precio * alMes - mejor.costo;

  return (
    <div className="pp-revela mt-8 grid gap-6 rounded-3xl bg-superficie p-5 shadow-sm ring-1 ring-ink-100 sm:p-7 md:grid-cols-2">
      <div>
        <p className="text-xs font-extrabold tracking-widest text-brand-600 uppercase">Calculadora</p>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">¿Qué plan te conviene?</p>
        <label htmlFor="pp-veces" className="mt-5 block text-sm font-semibold text-ink-700">
          ¿Cuántas veces por semana quieres venir?
        </label>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">
          {veces} <span className="text-lg font-bold text-ink-500">{veces === 1 ? 'vez' : 'veces'} por semana</span>
        </p>
        <input
          id="pp-veces"
          type="range"
          min={1}
          max={6}
          step={1}
          value={veces}
          onChange={(e) => setVeces(Number(e.target.value))}
          aria-valuetext={`${veces} ${veces === 1 ? 'vez' : 'veces'} por semana`}
          className="pp-slider mt-2"
          style={{ ['--slider-progress' as string]: `${((veces - 1) / 5) * 100}%` }}
        />
        <div className="flex justify-between text-xs font-semibold text-ink-500" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-500">Son unas {alMes} clases al mes.</p>
      </div>
      <div aria-live="polite">
        <div className="rounded-2xl bg-panel p-5 text-white">
          <p className="text-sm text-white/70">Te conviene</p>
          <p className="text-2xl font-extrabold">{mejor.nombre}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {dinero(mejor.costo)} <span className="text-base font-bold text-white/70">al mes</span>
          </p>
          <p className="text-sm text-white/70">≈ {dinero(Math.round(mejor.costo / alMes / 100) * 100)} por clase</p>
          {ahorro > 0 && <p className="mt-2 inline-block rounded-full bg-ok-600 px-3 py-1 text-sm font-bold">Ahorras {dinero(ahorro)} vs. pagar por clase</p>}
        </div>
        <ul className="mt-4 space-y-2">
          {opciones
            .slice()
            .sort((a, b) => a.costo - b.costo)
            .map((o) => (
              <li key={o.nombre}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className={cx('font-semibold', o === mejor && 'text-brand-600')}>{o.nombre}</span>
                  <span className="font-bold tabular-nums">{dinero(o.costo)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cx('h-full origin-left rounded-full transition-transform duration-500', o === mejor ? 'bg-brand-500' : 'bg-ink-300')}
                    style={{ transform: `scaleX(${o.costo / maximo})` }}
                  />
                </div>
                <p className="text-[11px] text-ink-500">{o.detalle}</p>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
