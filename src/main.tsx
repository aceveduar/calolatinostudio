import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import App from './App';
import { db } from './db/db';
import { BORRAR_AL_INICIAR } from './sync/engine';

// Actualiza la app en segundo plano cuando hay versión nueva (se aplica al reabrir).
registerSW({ immediate: true });

// Solo en builds de demo/pruebas: expone el generador de datos de ejemplo
if (import.meta.env.VITE_SEMILLA === '1') {
  void import('./dev/semilla').then((m) => ((window as unknown as Record<string, unknown>).compasDev = { sembrar: m.sembrar, ampliar: m.ampliar }));
}

async function arrancar() {
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
