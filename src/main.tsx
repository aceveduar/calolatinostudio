import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import App from './App';
import { db } from './db/db';
import { BORRAR_AL_INICIAR } from './sync/engine';
import { hayActualizacion } from './app/actualizacion';

// Versión nueva: se avisa y se aplica sin interrumpir un cobro (ver app/actualizacion.ts)
const actualizarSW = registerSW({ immediate: true, onNeedRefresh: () => hayActualizacion(() => void actualizarSW(true)) });

// Solo en builds de demo/pruebas: expone el generador de datos de ejemplo
if (import.meta.env.VITE_SEMILLA === '1') {
  void import('./dev/semilla').then((m) => ((window as unknown as Record<string, unknown>).compasDev = { db, sembrar: m.sembrar, ampliar: m.ampliar, agregarClasesDemo: m.agregarClasesDemo, agregarTiendaDemo: m.agregarTiendaDemo, agregarSedeDemo: m.agregarSedeDemo, agregarBecasDemo: m.agregarBecasDemo, agregarGastosDemo: m.agregarGastosDemo, agregarRentasDemo: m.agregarRentasDemo, agregarPedidosDemo: m.agregarPedidosDemo, agregarFiadosDemo: m.agregarFiadosDemo, agregarEventosDemo: m.agregarEventosDemo, demoCompleta: m.demoCompleta, agregarInteresadosDemo: m.agregarInteresadosDemo, agregarWebDemo: m.agregarWebDemo }));
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
    const { PortalAlumno } = await import('./features/portal/PortalAlumno');
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <PortalAlumno token={portal[1]} />
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
      <App />
    </StrictMode>,
  );
}
void arrancar();
