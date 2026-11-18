// Pruebas rápidas de las reglas del negocio (sin navegador). `npm test`
// Las de pantalla están en tests/e2e y se corren con `npm run test:e2e`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unidad/**/*.test.ts'],
    setupFiles: ['tests/unidad/preparar.ts'],
    environment: 'node',
    // nube falsa: ninguna prueba puede tocar la base real aunque llame a sincronizar
    env: { VITE_SUPABASE_URL: 'https://prueba.invalid', VITE_SUPABASE_ANON_KEY: 'clave-de-prueba' },
  },
});
