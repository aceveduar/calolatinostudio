import { useEffect, useState } from 'react';
import { sinPartirNivel } from '../../domain/nombres';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { cx } from '../../components/ui';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS } from '../../domain/fechas';
import { type DatosPublica } from '../../domain/publica';
import { DIAS_LARGOS, SEMANA, horaFin, type Estados, minutos, enCuanto } from './comun';

/**
 * Horario por día: abre en hoy (o el siguiente día con clases), con "Ahora" y "Siguiente" en vivo.
 * "Toda la semana" muestra todo junto, para quien quiere planear.
 */
export function Horario({ clases, estados, onApartar, wa }: { clases: DatosPublica['clases']; estados: Estados; onApartar?: (id: string) => void; wa: (c: DatosPublica['clases'][number], dia: number) => string | null }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const hoyDia = ahora.getDay();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  const conClase = SEMANA.filter((x) => clases.some((c) => c.dias.includes(x)));
  // hoy, o el siguiente día que tenga clases
  const porDefecto = [0, 1, 2, 3, 4, 5, 6].map((k) => (hoyDia + k) % 7).find((x) => conClase.includes(x)) ?? 'semana';
  const [elegido, setElegido] = useState<number | 'semana' | null>(null);
  const dia = elegido !== null && (elegido === 'semana' || conClase.includes(elegido)) ? elegido : porDefecto;
  const delDia = (x: number) => clases.filter((c) => c.dias.includes(x)).sort((a, b) => a.hora.localeCompare(b.hora));
  // en vivo (solo hoy): la que está pasando y la siguiente
  const deHoy = delDia(hoyDia);
  const enCurso = new Set(deHoy.filter((c) => minutos(c.hora) <= min && min < minutos(c.hora) + c.duracion).map((c) => c.id));
  const siguiente = deHoy.find((c) => minutos(c.hora) > min);

  // sin onApartar (alumno que viene de su portal) la clase solo se ve: no es botón
  const Fila = onApartar ? 'button' : 'div';
  const fila = (c: DatosPublica['clases'][number], vivo: boolean, dd: number) => {
    const e = estados.get(c.id);
    const esAhora = vivo && enCurso.has(c.id);
    const esSiguiente = vivo && siguiente?.id === c.id;
    return (
      <li key={c.id} className={cx('flex items-stretch overflow-hidden rounded-2xl bg-superficie shadow-sm ring-1 transition', esAhora ? 'ring-2 ring-ok-600' : 'ring-ink-100')}>
        <Fila
          {...(onApartar
            ? { type: 'button' as const, onClick: () => onApartar(c.id), 'aria-label': `Apartar lugar en ${c.clase}, ${DIAS_LARGOS[dd].toLowerCase()} ${c.hora}` }
            : {})}
          className={cx('group flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left', onApartar ? 'hover:bg-ink-50 active:bg-ink-50' : 'pr-3')}
        >
        <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: c.color ?? 'var(--marca)' }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
            {sinPartirNivel(c.clase)}
            {esAhora && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-50 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-ok-600 uppercase">
                <span className="pp-pulso h-2 w-2 rounded-full bg-ok-600" /> Ahora
              </span>
            )}
            {esSiguiente && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-extrabold whitespace-nowrap text-brand-600">{enCuanto(minutos(c.hora) - min)}</span>}
          </span>
          {e?.texto && <span className={cx('block text-xs font-semibold', e.aceptaNuevos ? 'text-ok-600' : 'text-ink-500')}>{e.texto}</span>}
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold text-ink-700 tabular-nums">
            {c.hora}–{horaFin(c.hora, c.duracion)}
          </span>
          {c.precio ? <span className="block text-sm font-bold text-brand-600">{dinero(c.precio)}</span> : null}
        </span>
        {onApartar && <ChevronRight size={18} className="shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden="true" />}
        </Fila>
        {wa(c, dd) && (
          <a
            href={wa(c, dd)!}
            target="_blank"
            rel="noreferrer"
            aria-label={`Preguntar por WhatsApp por ${c.clase}`}
            className="flex w-12 shrink-0 items-center justify-center border-l border-ink-100 text-[#1fae55] hover:bg-ink-50"
          >
            <MessageCircle size={20} />
          </a>
        )}
      </li>
    );
  };

  return (
    <div className="mt-6">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Día">
        {conClase.map((x) => (
          <button
            key={x}
            aria-pressed={dia === x}
            onClick={() => setElegido(x)}
            className={cx(
              'flex shrink-0 flex-col items-center rounded-2xl px-4 py-2 ring-1 transition',
              dia === x ? 'bg-ink-900 text-ink-50 ring-ink-900' : 'bg-superficie ring-ink-100 hover:bg-ink-50',
            )}
          >
            <span className="text-sm font-extrabold">{x === hoyDia ? 'Hoy' : DIAS_CORTOS[x]}</span>
            <span className={cx('text-[11px]', dia === x ? 'text-ink-50/70' : 'text-ink-500')}>
              {delDia(x).length} {delDia(x).length === 1 ? 'clase' : 'clases'}
            </span>
          </button>
        ))}
        <button
          aria-pressed={dia === 'semana'}
          onClick={() => setElegido('semana')}
          className={cx('min-h-11 shrink-0 rounded-2xl px-4 py-2 text-sm font-extrabold ring-1 transition', dia === 'semana' ? 'bg-ink-900 text-ink-50 ring-ink-900' : 'bg-superficie ring-ink-100 hover:bg-ink-50')}
        >
          Toda la semana
        </button>
      </div>
      {onApartar && <p className="mt-3 text-xs text-ink-500">Toca una clase para apartar tu lugar.</p>}
      {dia === 'semana' ? (
        <div className="mt-5 grid gap-x-6 gap-y-5 lg:grid-cols-2">
          {conClase.map((x) => (
            <div key={x}>
              <p className="mb-2 text-xs font-extrabold tracking-widest text-ink-500 uppercase">{DIAS_LARGOS[x]}</p>
              <ul className="space-y-2">{delDia(x).map((c) => fila(c, x === hoyDia, x))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-xs font-extrabold tracking-widest text-ink-500 uppercase">
            {DIAS_LARGOS[dia]}
            {dia === hoyDia ? ' · hoy' : ''}
          </p>
          <ul className="grid gap-2 lg:grid-cols-2">{delDia(dia).map((c) => fila(c, dia === hoyDia, dia))}</ul>
        </div>
      )}
    </div>
  );
}
