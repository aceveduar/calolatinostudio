import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronRight, LockKeyhole } from 'lucide-react';
import { GRUPOS, modulosDe, type Modulo } from '../../app/modulos';
import { useContadores } from '../../app/contadores';
import { usePendientes } from '../../app/pendientes';
import { useSesion } from '../../app/sesion';
import { Avatar, Encabezado, Tarjeta } from '../../components/ui';
import { NOMBRE_ROL } from '../../db/types';

let regreso: { entrada: string; usuarioId: string; abiertas: string[]; y: number } | undefined;

/**
 * "Más": todo lo que no cabe en la barra de abajo, en grupos claros.
 * Se arma solo desde el registro de módulos (app/modulos.ts) según el rol.
 */
export function PantallaMas() {
  const { usuario, bloquear } = useSesion();
  const { key, state } = useLocation();
  const contenedor = useRef<HTMLDivElement>(null);
  const contadores = { ...useContadores(), pendientes: usePendientes(false)?.total ?? 0 };
  // lo que ya es pestaña no se repite aquí
  const modulos = modulosDe(usuario.rol).filter((m) => m.grupo && m.pestana?.[usuario.rol] === undefined);
  const anterior = regreso?.entrada === key && regreso.usuarioId === usuario.id ? regreso : undefined;
  const modulo = modulos.find((m) => m.ruta === state?.ajusteOrigen);

  useLayoutEffect(() => {
    if (anterior) window.scrollTo(0, anterior.y);
    else if (modulo) contenedor.current?.querySelector(`[id="mas-${modulo.id}"]`)?.scrollIntoView({ block: 'center' });
    else window.scrollTo(0, 0);
  }, [anterior, modulo]);

  function recordar(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const abiertas = [...(contenedor.current?.querySelectorAll<HTMLDetailsElement>('details[data-grupo-mas][open]') ?? [])];
    regreso = { entrada: key, usuarioId: usuario.id, abiertas: abiertas.map((el) => el.dataset.grupoMas ?? ''), y: window.scrollY };
  }

  return (
    <div ref={contenedor} className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="-mx-4">
        <Encabezado titulo="Más" sub={`${usuario.nombre} · ${NOMBRE_ROL[usuario.rol]}`} />
      </div>
      {GRUPOS.map((g) => {
        const lista = modulos.filter((m) => m.grupo === g.id);
        if (!lista.length) return null;
        const enlaces = (
          <Tarjeta className="divide-y divide-ink-100">
            {lista.map((m) => <Fila key={m.id} m={m} n={m.contador ? contadores[m.contador] : 0} onAbrir={recordar} />)}
          </Tarjeta>
        );
        if (g.id === 'clases' || g.id === 'config') {
          return (
            <details key={g.id} data-grupo-mas={g.id} open={anterior?.abiertas.includes(g.id) || modulo?.grupo === g.id} className="group mb-3 rounded-2xl bg-superficie ring-1 ring-inset ring-ink-100">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {g.titulo}
                <ChevronDown size={18} className="shrink-0 text-ink-500 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="px-1 pb-1">{enlaces}</div>
            </details>
          );
        }
        return (
          <section key={g.id} className="mb-5">
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">{g.titulo}</h2>
            {enlaces}
          </section>
        );
      })}
      <button onClick={bloquear} className="flex w-full items-center gap-3 rounded-2xl bg-superficie px-4 py-3 text-left ring-1 ring-ink-100 active:bg-ink-50">
        <Avatar nombre={usuario.nombre} tam={36} />
        <span className="flex-1">
          <span className="block font-semibold">Bloquear / cambiar usuario</span>
          <span className="block text-xs text-ink-500">Para que otra persona entre con su PIN</span>
        </span>
        <LockKeyhole size={18} className="text-ink-300" />
      </button>
      <p className="mt-4 text-center text-xs text-ink-500">Compás v{__APP_VERSION__}</p>
    </div>
  );
}

function Fila({ m, n, onAbrir }: { m: Modulo; n: number; onAbrir: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const Icono = m.icono;
  return (
    <Link id={`mas-${m.id}`} to={m.ruta} state={{ desdeMas: true }} onClick={onAbrir} className="flex min-h-12 items-center gap-3 px-3 py-2 active:bg-ink-50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-ink-700">
        <Icono size={19} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{m.titulo}</span>
        {m.ayuda && <span className="block text-xs text-ink-500">{m.ayuda}</span>}
      </span>
      {n > 0 && <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 px-1.5 text-xs font-bold text-brand-600 tabular-nums">{n}</span>}
      <ChevronRight size={16} className="shrink-0 text-ink-300" aria-hidden="true" />
    </Link>
  );
}
