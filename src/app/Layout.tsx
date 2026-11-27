import { Suspense } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { pestanaActiva, pestanasDe } from './modulos';
import { useContadores } from './contadores';
import { useAvisosEnVivo } from './avisosEnVivo';
import { useLiveQuery } from 'dexie-react-hooks';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Smartphone, LockKeyhole } from 'lucide-react';
import { db } from '../db/db';
import { useEstadoSync } from '../sync/engine';
import { useSesion } from './sesion';
import { HojaTicket } from '../features/alumnos/HojaTicket';
import { aplicarActualizacion, useEstadoActualizacion } from './actualizacion';
import { useHoy } from './reloj';
import { Avatar, cx } from '../components/ui';
import { Tropiezo } from '../components/Tropiezo';
import { LogoAcademia } from '../components/LogoAcademia';

/** Pestañas de la barra de abajo / lateral: salen del registro de módulos (app/modulos.ts). */
type Pestana = ReturnType<typeof pestanasDe>[number];

/**
 * Teléfono: barra superior + pestañas abajo (alcance del pulgar).
 * Laptop/PC (≥1024 px): barra lateral fija y contenido a todo lo ancho.
 */
export function Layout() {
  const { usuario } = useSesion();
  const dia = useHoy();
  const tabs = pestanasDe(usuario.rol);
  const ruta = useLocation().pathname;
  const activa = pestanaActiva(usuario.rol, ruta);
  const c = useContadores();
  // globo en "Más" si hay algo que atender ahí
  const pendientesMas = c.interesados + c.encargos + c.testimonios;
  // timbre + aviso cuando llega un apartado, encargo o interesado nuevo (recepción y dirección)
  useAvisosEnVivo(usuario.rol !== 'maestro');
  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral tabs={tabs} activa={activa} pendientesMas={pendientesMas} />
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl min-w-0 flex-col lg:max-w-none lg:flex-1">
        <BarraSuperior />
        <main className={cx('mx-auto w-full flex-1 lg:max-w-6xl lg:px-6 lg:pb-10', tabs.length < 2 ? 'pb-8' : 'pb-24')}>
          {/* key = fecha: a medianoche la pantalla se vuelve a montar con el día nuevo */}
          <div key={dia} className="contents">
            {/* si una pantalla falla, solo esa muestra el aviso; al cambiar de pantalla se reintenta */}
            <Tropiezo nivel="pantalla" key={ruta}>
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
              {/* solo en compilaciones de prueba: ?romper simula una pantalla que falla */}
              {import.meta.env.VITE_SEMILLA === '1' && new URLSearchParams(location.search).has('romper') && <Romper />}
            </Tropiezo>
          </div>
        </main>
      </div>
      {/* ticket de compra: se abre desde el aviso después de cobrar un plan */}
      <HojaTicket />
      <nav className={cx('fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-superficie/95 pb-safe backdrop-blur lg:hidden', tabs.length < 2 && 'hidden')}>
        <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((m) => {
            const Icono = m.icono;
            const on = activa === m.id;
            return (
              <Link
                key={m.id}
                to={m.ruta}
                aria-current={on ? 'page' : undefined}
                className={cx('relative flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold', on ? 'text-brand-600' : 'text-ink-500')}
              >
                <span className={cx('relative rounded-full px-4 py-1 transition', on && 'bg-brand-50')}>
                  <Icono size={22} strokeWidth={on ? 2.4 : 2} />
                  {m.id === 'mas' && pendientesMas > 0 && <span className="absolute top-0 right-2 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-superficie" aria-label={`${pendientesMas} pendientes`} />}
                </span>
                {m.corto ?? m.titulo}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function BarraLateral({ tabs, activa, pendientesMas }: { tabs: Pestana[]; activa: string | null; pendientesMas: number }) {
  const { academia, usuario, bloquear } = useSesion();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-ink-100 bg-superficie px-4 py-5 lg:flex">
      <div className="flex items-center gap-3 px-2">
        <LogoAcademia academia={academia} tam={40} />
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{academia.nombre}</span>
          <span className="block text-xs text-ink-500">Compás</span>
        </span>
      </div>
      <nav className="mt-8 flex flex-col gap-1">
        {tabs.map((m) => {
          const Icono = m.icono;
          return (
            <Link
              key={m.id}
              to={m.ruta}
              aria-current={activa === m.id ? 'page' : undefined}
              className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition', activa === m.id ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-50')}
            >
              <Icono size={20} /> <span className="flex-1">{m.corto ?? m.titulo}</span>
              {m.id === 'mas' && pendientesMas > 0 && <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-extrabold text-white">{pendientesMas}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <div className="px-2">
          <IndicadorSync />
        </div>
        <button onClick={bloquear} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink-50">
          <Avatar nombre={usuario.nombre} tam={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{usuario.nombre}</span>
            <span className="block text-xs text-ink-500">Cambiar usuario</span>
          </span>
          <LockKeyhole size={16} className="text-ink-300" />
        </button>
      </div>
    </aside>
  );
}

function BarraSuperior() {
  const { academia, usuario, bloquear } = useSesion();
  const actualizacion = useEstadoActualizacion();
  return (
    <>
      {actualizacion !== 'sin-aviso' && (
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-ink-50 px-4 py-1 text-sm lg:px-6">
          <div role="status" className="flex items-center gap-2 font-medium text-ink-700">
            <RefreshCw size={16} aria-hidden="true" className={cx('shrink-0', actualizacion === 'actualizando' && 'motion-safe:animate-spin')} />
            {actualizacion === 'ocupada' ? 'Puedes actualizar al terminar la cuenta.'
              : actualizacion === 'actualizando' ? 'Actualizando…'
              : actualizacion === 'reintentar' ? 'La actualización tardó más de lo esperado. Reintenta o recarga la página.'
              : 'Nueva versión disponible'}
          </div>
          {(actualizacion === 'disponible' || actualizacion === 'reintentar') && (
            <button type="button" onClick={aplicarActualizacion} className="min-h-11 shrink-0 rounded-lg px-2 font-semibold text-brand-600 hover:bg-brand-50">
              {actualizacion === 'reintentar' ? 'Reintentar' : 'Actualizar'}
            </button>
          )}
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-ink-50/95 px-4 pt-safe backdrop-blur lg:hidden">
        <span className="flex min-w-0 items-center gap-2 py-2">
          <LogoAcademia academia={academia} tam={26} />
          <span className="truncate text-sm font-bold text-ink-700">{academia.nombre}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <IndicadorSync />
          {/* Quién está cobrando, y cambiar de usuario en un toque */}
          <button onClick={bloquear} className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full py-1 pr-1 pl-2 active:bg-ink-100" aria-label={`${usuario.nombre} · cambiar usuario`}>
            <Avatar nombre={usuario.nombre} tam={26} />
          </button>
        </span>
      </header>
    </>
  );
}

/** Siempre visible y discreto: la gente necesita confiar en que nada se pierde. */
function IndicadorSync() {
  const { fase, error } = useEstadoSync();
  const pendientes = useLiveQuery(() => db.outbox.count(), [], 0);
  const cfg = {
    'solo-local': { icono: Smartphone, texto: 'En este equipo', cls: 'text-ink-500' },
    desconectada: { icono: CloudOff, texto: 'Sin respaldo · Conectar', cls: 'bg-warn-50 text-warn-600' },
    'sin-red': { icono: CloudOff, texto: pendientes ? 'Sin red · se subirá solo' : 'Sin red', cls: 'text-warn-600' },
    sincronizando: { icono: RefreshCw, texto: 'Guardando…', cls: 'text-ink-500 [&_svg]:animate-spin' },
    'al-dia': error
      ? { icono: AlertTriangle, texto: 'Falta actualizar la base', cls: 'bg-warn-50 text-warn-600' }
      : { icono: Cloud, texto: pendientes ? 'Subiendo…' : 'Respaldado', cls: 'text-ok-600' },
    error: { icono: AlertTriangle, texto: 'Revisar nube', cls: 'text-bad-600' },
  }[fase];
  const Icono = cfg.icono;
  return (
    <NavLink to="/ajustes/nube" className={cx('flex min-h-10 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.cls)}>
      <Icono size={14} /> {cfg.texto}
    </NavLink>
  );
}

function Romper(): never {
  throw new Error('Falla de prueba');
}
