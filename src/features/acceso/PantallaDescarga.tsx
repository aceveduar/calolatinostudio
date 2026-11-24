import { useEffect, useState } from 'react';
import type { ProgresoDescarga } from '../../sync/engine';

/**
 * Primera vez en un teléfono: baja toda la academia (con años de historial pueden ser decenas de miles de
 * registros). En lugar de un "Descargando…" que parece trabado: cuánto lleva, cuánto falta, una animación
 * con ritmo y frases que cambian. Solo pasa una vez por equipo.
 */
const FRASES = [
  'Afinando el compás…',
  'Acomodando a los alumnos en la pista…',
  'Contando pasos de salsa…',
  'Repasando el horario de clases…',
  'Sumando cada pago, centavo por centavo…',
  'Calentando motores 💃🕺',
  'Revisando que nadie se quede sin su clase…',
  'Casi listos para el primer cobro…',
];

const n = (x: number) => x.toLocaleString('es-MX');

/** Ilustración vectorial de dos figuras articuladas. Ambas giran alrededor del mismo punto de contacto. */
function ParejaBailando() {
  return (
    <svg viewBox="0 0 300 214" className="h-44 max-h-[32dvh] w-auto max-w-full sm:h-52" aria-hidden="true">
      <g className="baile-ritmo">
        <g className="baile-figura baile-figura-a">
          <g className="baile-pierna baile-pierna-a1">
            <path d="M70 120 87 124 75 161 55 187 42 181 60 151Z" fill="#273742" />
            <path d="M43 178c4 0 8 2 13 6l-5 7-12 2-9-5c-4-2-2-6 1-7l7 2Z" fill="#ba7851" />
          </g>
          <g className="baile-pierna baile-pierna-a2">
            <path d="m80 120 20 2 6 38 1 31-14 2-4-28-14-30Z" fill="#314552" />
            <path d="m93 189 13-2 9 6 9 2c6 3 4 7-1 8l-28-1c-5 0-5-6-2-13Z" fill="#d4976a" />
          </g>
          <path d="M72 50 92 47 95 65c-3 8-13 11-23 3Z" fill="#a8664c" />
          <g className="baile-brazo-libre baile-brazo-a">
            <path d="M67 70 44 90c-3 3-2 8 1 11l21 14 6-8-15-14 17-12Z" className="fill-brand-600" />
            <path d="m65 107 5-1 10 6c3 2 1 6-2 6l-11-4Z" fill="#a8664c" />
          </g>
          <path d="m98 68 21 26 24 3-1 10-28 1c-7-1-15-9-22-16Z" className="fill-brand-600" />
          <path d="m141 96 7-2 7 5-3 6-11 2Z" fill="#a8664c" />
          <path d="M62 75q2-10 14-13l9 7 10-7q11 3 13 13l-10 43 2 7c-11 7-22 6-34 3l5-13Z" className="fill-brand-500" />
          <path d="m77 65 8 5 10-7-3 12-7-4-6 6Z" fill="#f3ddb6" />
          <path d="M84 79c3 16 2 29-1 42m12-40-5 38M75 82l2 26" fill="none" stroke="#fff" strokeOpacity=".21" strokeWidth="2" strokeLinecap="round" />
          <path d="M72 48c-2-14 3-25 14-27 10-1 18 6 18 18l6 7-6 3c-1 6-4 10-9 11-7 1-13-4-17-10Z" fill="#b87757" />
          <path d="M72 49c-5-5-6-13-4-20 2-8 9-13 20-13 7 0 13 3 16 10-8 0-12 6-17 11l-6 1-1 9-5-3Z" fill="#24313b" />
          <path d="M88 51c3 4 10 7 15 2-1 5-5 8-9 7-3-1-5-4-6-9Z" fill="#24313b" />
        </g>
        <g className="baile-figura baile-figura-b">
          <g className="baile-pierna baile-pierna-b1">
            <path d="m199 132 13 2 0 28-18 29-9-4 14-31Z" fill="#925840" />
            <path d="m189 185 9 3-5 13-4-1 1-5-8 7-10-1c-5-1-6-5-1-7l9-2Z" fill="#da8b5b" />
          </g>
          <g className="baile-pierna baile-pierna-b2">
            <path d="m218 132 12-3 5 28 19 25-8 7-25-26Z" fill="#aa6b4d" />
            <path d="m244 184 9-6 7 9 1 10-4 1-2-6-7 5-12-1c-4-2-3-6 1-6Z" fill="#e9a06c" />
          </g>
          <g className="baile-brazo-libre baile-brazo-b">
            <path d="M227 66c6-4 12-1 15 5l17 16c3 4 2 9-3 11l-28 8-3-9 21-8-15-9Z" fill="#a76548" />
            <path d="m225 97-9-1c-5 1-5 5-1 7l11 3 4-4Z" fill="#a76548" />
          </g>
          <path d="M200 69c4-5 12-3 13 2 2 5 0 8-4 12l-25 23c-4 3-9 4-13 3l-20-6 2-9 23 4Z" fill="#a76548" />
          <path d="m155 95-8-4-5 3 5 7 7 3Z" fill="#a76548" />
          <g className="baile-falda">
            <path d="M201 101c6-5 19-7 26-2l10 20 16 24c-8 7-21 14-35 15-13 2-25-1-39-3l15-27Z" fill="#df774f" />
            <path d="M197 121c8 4 24 7 37 3m-43 13c11 5 34 5 52-1m-57 15c15 5 37 6 61-6" fill="none" stroke="#f7b476" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <path d="m207 49 14 2 2 12-3 5-15-5Z" fill="#a76548" />
          <path d="m204 60 9 6 10-6c10 2 14 12 10 22l-8 21c-7 3-17 3-24 0l1-16c-5-5-7-11-4-19Z" fill="#e28358" />
          <path d="m203 62 9 4 11-5-5 15c-5 2-9 2-13-1Z" fill="#f2a266" />
          <path d="M199 42c-1-11 4-21 14-23 10 0 18 7 17 17l-4 16c-4 10-13 13-20 4l-6-5-5-3Z" fill="#ad6d4e" />
          <path d="M197 39c-3-11 4-22 13-25 11-4 22 0 27 11 4 7 4 20-1 26l-11 4-3-12c-8-1-16-7-20-15Z" fill="#263744" />
          <path d="M232 25c4-8 15-8 19-1 6 9 0 17-8 18-2 8-7 12-13 13Z" fill="#263744" />
          <path d="M208 21c6-4 14-3 19 2" fill="none" stroke="#f2ba77" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="219" cy="48" r="3.2" fill="none" stroke="#f7c98b" strokeWidth="1.8" />
        </g>
        <ellipse cx="150" cy="99" rx="5.5" ry="3.6" transform="rotate(17 150 99)" fill="#b67858" />
      </g>
    </svg>
  );
}

function textoFalta(p: ProgresoDescarga, ahora: number): string | null {
  const t = (ahora - p.inicio) / 1000;
  if (p.hechos < p.total * 0.05 || t < 3) return null; // aún no hay con qué calcular
  const s = Math.max(0, Math.round(((p.total - p.hechos) * t) / p.hechos));
  if (s <= 5) return 'Ya casi…';
  return s < 60 ? `Faltan como ${Math.ceil(s / 5) * 5} segundos` : `Faltan como ${Math.round(s / 60)} min`;
}

export function PantallaDescarga({ progreso }: { progreso: ProgresoDescarga | null }) {
  const [ahora, setAhora] = useState(() => Date.now());
  const [frase, setFrase] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setAhora(Date.now()), 1000);
    const f = setInterval(() => setFrase((x) => (x + 1) % FRASES.length), 3200);
    return () => {
      clearInterval(a);
      clearInterval(f);
    };
  }, []);
  const total = progreso?.total ?? 0;
  const hechos = Math.min(progreso?.hechos ?? 0, total);
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const falta = progreso && total ? textoFalta({ ...progreso, hechos }, ahora) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-50 px-8 pt-safe pb-safe text-center" role="status" aria-live="polite">
      <ParejaBailando />
      <h1 className="mt-8 text-2xl font-extrabold tracking-tight">Bajando tu academia</h1>
      <p className="mt-1 min-h-6 text-ink-500">{FRASES[frase]}</p>

      <div className="mt-8 w-full max-w-xs">
        {total > 0 ? (
          <>
            <div className="h-3 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Avance de la descarga">
              <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-700 tabular-nums">
              {n(hechos)} de {n(total)} registros · {pct}%
            </p>
            {falta && <p className="text-sm text-ink-500">{falta}</p>}
          </>
        ) : (
          <p className="text-sm font-semibold text-ink-700">Revisando cuánto hay que bajar…</p>
        )}
      </div>

      <p className="mt-10 max-w-xs text-sm text-ink-500">
        Esto pasa <b className="text-ink-700">solo la primera vez</b> en este teléfono. Después abre al instante y funciona aunque no haya internet. No cierres la app mientras tanto.
      </p>
    </div>
  );
}
