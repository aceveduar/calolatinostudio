import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';
import App from './App';

// Actualiza la app en segundo plano cuando hay versión nueva (se aplica al reabrir).
registerSW({ immediate: true });

// Solo en builds de demo/pruebas: expone el generador de datos de ejemplo
if (import.meta.env.VITE_SEMILLA === '1') {
  void import('./dev/semilla').then((m) => ((window as unknown as Record<string, unknown>).compasSemilla = m.sembrar));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
