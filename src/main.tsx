import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import App from './App';
import { db } from './db/db';
import { BORRAR_AL_INICIAR } from './sync/engine';
import { hayActualizacion } from './app/actualizacion';
import { Tropiezo } from './components/Tropiezo';
import { anotarError } from './app/errores';

// Errores inesperados fuera de una pantalla (promesas sin atender, scripts): también se anotan para soporte
addEventListener('error', (e) => anotarError(e.error ?? e.message, `${location.pathname} (error)`));
addEventListener('unhandledrejection', (e) => anotarError(e.reason, `${location.pathname} (promesa)`));

// Versión nueva: se avisa y se aplica sin interrumpir un cobro (ver app/actualizacion.ts)
const actualizarSW = registerSW({
  immediate: true,
  onNeedRefresh: () => hayActualizacion(() => void actualizarSW(true)),
  // Instalada en el teléfono, la app casi nunca se recarga (despierta de memoria), y el navegador solo busca
  // versión nueva al cargar. Por eso se pregunta al volver a la pantalla y cada 30 min.
  onRegisteredSW: (_url, r) => {
    if (!r) return;
    const revisar = () => {
      if (navigator.onLine) void r.update().catch(() => {});
    };
    setInterval(revisar, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisar();
    });
  },
});

// Solo en builds de demo/pruebas: expone el generador de datos de ejemplo
if (import.meta.env.VITE_SEMILLA === '1') {
  void Promise.all([import('./dev/semilla'), import('./db/repo'), import('./sync/engine'), import('./dev/grande')]).then(([m, repo, sync, grande]) => ((window as unknown as Record<string, unknown>).compasDev = { db, academiaGrande: grande.academiaGrande, actualizar: repo.actualizar, sincronizar: sync.sincronizar, simularActualizacion: () => hayActualizacion(() => ((window as unknown as Record<string, unknown>).__actualizada = true)), sembrar: m.sembrar, ampliar: m.ampliar, agregarClasesDemo: m.agregarClasesDemo, agregarTiendaDemo: m.agregarTiendaDemo, agregarSedeDemo: m.agregarSedeDemo, agregarBecasDemo: m.agregarBecasDemo, agregarGastosDemo: m.agregarGastosDemo, agregarRentasDemo: m.agregarRentasDemo, agregarPedidosDemo: m.agregarPedidosDemo, agregarFiadosDemo: m.agregarFiadosDemo, agregarEventosDemo: m.agregarEventosDemo, demoCompleta: m.demoCompleta, agregarInteresadosDemo: m.agregarInteresadosDemo, agregarWebDemo: m.agregarWebDemo }));
}

async function arrancar() {
  // Portal del alumno (/p/<token>): página pública aparte; no abre la base de la academia en ese teléfono
  // Página pública del estudio (/a/<slug>): para compartir en Facebook; tampoco abre la base de la academia
  const publica = location.pathname.match(/^\/a\/([a-zA-Z0-9-]{3,40})\/?$/);
  if (publica) {
    const { PaginaPublica } = await import('./features/publica/PaginaPublica');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <PaginaPublica slug={publica[1].toLowerCase()} />
      </StrictMode>,
    );
    return;
  }
  const portal = location.pathname.match(/^\/p\/([A-Za-z0-9]{20,64})\/?$/);
  if (portal) {
    // Instalable como "Mi pase": su propio manifiesto (abre SU portal, no la app de la academia)
    document.querySelector('link[rel=manifest]')?.setAttribute('href', `/p/${portal[1]}/manifiesto`);
    // Chrome avisa que se puede instalar, a veces antes de que exista la tarjeta "Ten tu pase a un toque"
    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      (window as unknown as { __avisoInstalar?: Event }).__avisoInstalar = e;
      dispatchEvent(new Event('compas:instalable'));
    });
    const { PortalAlumno } = await import('./features/portal/PortalAlumno');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Tropiezo nivel="app">
          <PortalAlumno token={portal[1]} />
        </Tropiezo>
      </StrictMode>,
    );
    return;
  }
  // "Quitar academia de este teléfono": borrar la base local antes de abrirla
  try {
    if (localStorage.getItem(BORRAR_AL_INICIAR)) {
      await db.delete();
      localStorage.removeItem(BORRAR_AL_INICIAR);
      await db.open();
    }
  } catch {
    /* sin almacenamiento: seguir */
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Tropiezo nivel="app">
        <App />
      </Tropiezo>
    </StrictMode>,
  );
}
void arrancar();
