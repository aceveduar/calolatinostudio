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

/** Qué animación se ve mientras baja: la pareja bailando o las barras de ritmo (la versión anterior). */
const ANIMACION: 'pareja' | 'barras' = 'pareja';

/** Barras al ritmo (sin movimiento si el teléfono pide reducirlo). */
function Ecualizador({ chico = false }: { chico?: boolean }) {
  return (
    <div className={chico ? 'flex h-6 items-end gap-1' : 'flex h-20 items-end gap-2'} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={`compas-barra rounded-full bg-brand-500 ${chico ? 'w-1.5 opacity-60' : 'w-3'}`} style={{ animationDelay: `${i * 0.13}s`, height: `${[45, 80, 60, 95, 50][i]}%` }} />
      ))}
    </div>
  );
}

/**
 * Una pareja en silueta bailando (dibujo propio, sin imágenes): se mecen al ritmo y ella da un giro.
 * Con el color de la academia; quieta si el teléfono pide reducir el movimiento.
 */
function ParejaBailando() {
  return (
    <div className="flex flex-col items-center text-brand-500" aria-hidden="true">
      <svg viewBox="0 0 120 92" className="h-36 w-auto overflow-visible" fill="currentColor">
        <ellipse cx="60" cy="86" rx="40" ry="3.5" className="fill-ink-100" />
        {/* cada figura es UNA silueta (sin piezas sueltas que se despeguen al moverse); se mueve el cuerpo entero */}
        <g className="baile-pareja">
          {/* él: se balancea al ritmo */}
          <g className="baile-el">
            <circle cx="40" cy="14" r="7" />
            <path d="M32 24Q40 20 48 24L46 50L47.5 84H42.5L40.6 60H39.4L37.5 84H32.5L34 50Z" />
            <path d="M34 27Q27 37 31 47" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </g>
          {/* las manos tomadas */}
          <path d="M46 28Q59 35 73 30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          {/* ella: da una vuelta cada cuatro tiempos */}
          <g className="baile-ella" opacity="0.82">
            <path d="M74 70L72.8 84M86 70L87.2 84" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="80" cy="16" r="6.5" />
            <circle cx="85.5" cy="11" r="3.3" />
            <path d="M75 25Q80 22 85 25L84 44Q94 58 96 71Q80 77 64 71Q66 58 76 44Z" />
            <path d="M84.5 28Q92 17 87 7" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
          </g>
        </g>
      </svg>
      <div className="-mt-1">
        <Ecualizador chico />
      </div>
    </div>
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
      {ANIMACION === 'pareja' ? <ParejaBailando /> : <Ecualizador />}
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
