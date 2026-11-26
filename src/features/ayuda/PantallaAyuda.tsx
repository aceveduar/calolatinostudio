import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Lightbulb, Search, X } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { Tarjeta, Vacio, cx } from '../../components/ui';
import { NOMBRE_ROL } from '../../db/types';
import { manualPara, type Tema } from './contenido';

/**
 * Manual "Cómo se usa", dentro de la app: siempre a la mano, sin internet y al día con la versión.
 * Cada rol ve primero lo suyo, de lo de todos los días a lo menos frecuente. Los temas se abren al tocarlos.
 */
export function PantallaAyuda() {
  const { usuario } = useSesion();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined);
  const capitulos = manualPara(usuario.rol, q);
  const guiaUnica = usuario.rol === 'maestro' && manualPara(usuario.rol, '').reduce((total, c) => total + c.temas.length, 0) === 1;

  return (
    <div className="px-4 pb-10 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-1">
        <button onClick={() => nav(usuario.rol === 'maestro' ? '/' : '/mas')} className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver">
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Cómo se usa</h1>
      </div>
      {!guiaUnica && <p className="mb-4 text-ink-500">Guía corta para {NOMBRE_ROL[usuario.rol].toLowerCase()}: toca un tema para ver los pasos.</p>}

      {!guiaUnica && <label className="relative mb-5 block">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-500" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej. corte, ticket, paquete"
          aria-label="Buscar en el manual"
          className="h-12 w-full rounded-2xl bg-superficie pr-11 pl-11 ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-500 active:bg-ink-100" aria-label="Borrar búsqueda">
            <X size={18} />
          </button>
        )}
      </label>}

      {capitulos.length === 0 && (
        <Tarjeta>
          <Vacio icono={<Search size={32} />} titulo="No encontramos ese tema" texto="Prueba con otra palabra, o en Más → Ayuda y errores manda tu duda a soporte." />
        </Tarjeta>
      )}

      {capitulos.map((c) => (
        <section key={c.id} className="mb-6" aria-labelledby={`cap-${c.id}`}>
          <h2 id={`cap-${c.id}`} className={guiaUnica ? 'sr-only' : 'mb-2 flex items-center gap-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase'}>
            <span aria-hidden="true" className="text-base">
              {c.emoji}
            </span>
            {c.titulo}
          </h2>
          <Tarjeta className="divide-y divide-ink-100">
            {c.temas.map((t) => {
              const expandido = abierto === t.id || (abierto === undefined && guiaUnica) || (!!q && c.temas.length === 1);
              return <TemaManual key={t.id} tema={t} abierto={expandido} onToggle={() => setAbierto(expandido ? null : t.id)} />;
            })}
          </Tarjeta>
        </section>
      ))}
    </div>
  );
}

function TemaManual({ tema, abierto, onToggle }: { tema: Tema; abierto: boolean; onToggle: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-ink-50">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{tema.titulo}</span>
          <span className="block text-sm text-ink-500">{tema.resumen}</span>
        </span>
        <ChevronDown size={18} className={cx('shrink-0 text-ink-300 transition', abierto && 'rotate-180')} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="space-y-3 px-4 pb-4">
          {tema.imagen && (
            <img
              src={`/ayuda/${tema.imagen}.jpg`}
              alt={`Pantalla de ejemplo: ${tema.titulo}`}
              loading="lazy"
              className="mx-auto w-full max-w-[18rem] rounded-2xl ring-1 ring-ink-100"
              onError={(e) => (e.currentTarget.hidden = true)}
            />
          )}
          <ol className="space-y-2">
            {tema.pasos.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="text-[15px] leading-snug">{p}</span>
              </li>
            ))}
          </ol>
          {tema.consejo && (
            <p className="flex gap-2 rounded-xl bg-warn-50 px-3 py-2.5 text-sm text-ink-700">
              <Lightbulb size={17} className="mt-0.5 shrink-0 text-warn-600" aria-hidden="true" />
              {tema.consejo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
