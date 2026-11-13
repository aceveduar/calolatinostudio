import { NavLink, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DoorOpen, Users, Wallet, Settings, Cloud, CloudOff, RefreshCw, AlertTriangle, Smartphone, Sparkles, ChartColumn, LockKeyhole, GraduationCap } from 'lucide-react';
import type { Rol } from '../db/types';
import { db } from '../db/db';
import { useEstadoSync } from '../sync/engine';
import { useSesion } from './sesion';
import { aplicarActualizacion, useActualizacionPendiente } from './actualizacion';
import { Avatar, cx } from '../components/ui';
import { LogoAcademia } from '../components/LogoAcademia';

const TABS: { to: string; texto: string; icono: typeof DoorOpen; para: Rol[] }[] = [
  { to: '/', texto: 'Entrada', icono: DoorOpen, para: ['dueno', 'recepcion'] },
  { to: '/', texto: 'Mis clases', icono: GraduationCap, para: ['maestro'] },
  { to: '/alumnos', texto: 'Alumnos', icono: Users, para: ['dueno', 'recepcion'] },
  { to: '/caja', texto: 'Caja', icono: Wallet, para: ['dueno', 'recepcion'] },
  { to: '/reportes', texto: 'Reportes', icono: ChartColumn, para: ['dueno'] },
  { to: '/ajustes', texto: 'Ajustes', icono: Settings, para: ['dueno', 'recepcion'] },
];

/**
 * Teléfono: barra superior + pestañas abajo (alcance del pulgar).
 * Laptop/PC (≥1024 px): barra lateral fija y contenido a todo lo ancho.
 */
export function Layout() {
  const { usuario } = useSesion();
  const tabs = TABS.filter((t) => t.para.includes(usuario.rol));
  return (
    <div className="min-h-dvh lg:flex">
      <BarraLateral tabs={tabs} />
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl min-w-0 flex-col lg:max-w-none lg:flex-1">
        <BarraSuperior />
        <main className={cx('mx-auto w-full flex-1 lg:max-w-6xl lg:px-6 lg:pb-10', tabs.length < 2 ? 'pb-8' : 'pb-24')}>
          <Outlet />
        </main>
      </div>
      <nav className={cx('fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-superficie/95 pb-safe backdrop-blur lg:hidden', tabs.length < 2 && 'hidden')}>
        <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ to, texto, icono: Icono }) => (
            <NavLink
              key={texto}
              to={to}
              end={to === '/'}
              className={({ isActive }) => cx('flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold', isActive ? 'text-brand-600' : 'text-ink-500')}
            >
              {({ isActive }) => (
                <>
                  <span className={cx('rounded-full px-4 py-1 transition', isActive && 'bg-brand-50')}>
                    <Icono size={22} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {texto}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function BarraLateral({ tabs }: { tabs: typeof TABS }) {
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
        {tabs.map(({ to, texto, icono: Icono }) => (
          <NavLink
            key={texto}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition', isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-50')
            }
          >
            <Icono size={20} /> {texto}
          </NavLink>
        ))}
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
  const nueva = useActualizacionPendiente();
  return (
    <>
      {nueva && (
        <button onClick={aplicarActualizacion} className="flex w-full items-center justify-center gap-2 bg-brand-500 px-4 pt-safe py-2 text-sm font-semibold text-white">
          <Sparkles size={16} /> Hay una versión nueva · Toca para actualizar
        </button>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-ink-50/95 px-4 pt-safe backdrop-blur lg:hidden">
        <span className="flex min-w-0 items-center gap-2 py-2">
          <LogoAcademia academia={academia} tam={26} />
          <span className="truncate text-sm font-bold text-ink-700">{academia.nombre}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <IndicadorSync />
          {/* Quién está cobrando, y cambiar de usuario en un toque */}
          <button onClick={bloquear} className="flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2 active:bg-ink-100" aria-label={`${usuario.nombre} · cambiar usuario`}>
            <Avatar nombre={usuario.nombre} tam={26} />
          </button>
        </span>
      </header>
    </>
  );
}

/** Siempre visible y discreto: la gente necesita confiar en que nada se pierde. */
function IndicadorSync() {
  const { fase } = useEstadoSync();
  const pendientes = useLiveQuery(() => db.outbox.count(), [], 0);
  const cfg = {
    'solo-local': { icono: Smartphone, texto: 'En este equipo', cls: 'text-ink-500' },
    'sin-red': { icono: CloudOff, texto: pendientes ? 'Sin red · se subirá solo' : 'Sin red', cls: 'text-warn-600' },
    sincronizando: { icono: RefreshCw, texto: 'Guardando…', cls: 'text-ink-500 [&_svg]:animate-spin' },
    'al-dia': { icono: Cloud, texto: pendientes ? 'Subiendo…' : 'Respaldado', cls: 'text-ok-600' },
    error: { icono: AlertTriangle, texto: 'Revisar nube', cls: 'text-bad-600' },
  }[fase];
  const Icono = cfg.icono;
  return (
    <NavLink to="/ajustes/nube" className={cx('flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold', cfg.cls)}>
      <Icono size={14} /> {cfg.texto}
    </NavLink>
  );
}
