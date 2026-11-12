import { NavLink, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { DoorOpen, Users, Wallet, Settings, Cloud, CloudOff, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';
import { db } from '../db/db';
import { useEstadoSync } from '../sync/engine';
import { useSesion } from './sesion';
import { cx } from '../components/ui';

const TABS = [
  { to: '/', texto: 'Entrada', icono: DoorOpen },
  { to: '/alumnos', texto: 'Alumnos', icono: Users },
  { to: '/caja', texto: 'Caja', icono: Wallet },
  { to: '/ajustes', texto: 'Ajustes', icono: Settings },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <BarraSuperior />
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-superficie/95 pb-safe backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, texto, icono: Icono }) => (
            <NavLink
              key={to}
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

function BarraSuperior() {
  const { academia } = useSesion();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-ink-50/95 px-4 pt-safe backdrop-blur">
      <span className="truncate py-2.5 text-sm font-bold text-ink-700">{academia.nombre}</span>
      <IndicadorSync />
    </header>
  );
}

/** Siempre visible y discreto: la gente necesita confiar en que nada se pierde. */
function IndicadorSync() {
  const { fase } = useEstadoSync();
  const pendientes = useLiveQuery(() => db.outbox.count(), [], 0);
  const cfg = {
    'solo-local': { icono: Smartphone, texto: 'En este teléfono', cls: 'text-ink-500' },
    'sin-red': { icono: CloudOff, texto: pendientes ? `Sin red · ${pendientes} por subir` : 'Sin red', cls: 'text-warn-600' },
    sincronizando: { icono: RefreshCw, texto: 'Guardando…', cls: 'text-ink-500 [&_svg]:animate-spin' },
    'al-dia': { icono: Cloud, texto: pendientes ? `${pendientes} por subir` : 'Respaldado', cls: 'text-ok-600' },
    error: { icono: AlertTriangle, texto: 'Revisar nube', cls: 'text-bad-600' },
  }[fase];
  const Icono = cfg.icono;
  return (
    <NavLink to="/ajustes/nube" className={cx('flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold', cfg.cls)}>
      <Icono size={14} /> {cfg.texto}
    </NavLink>
  );
}
