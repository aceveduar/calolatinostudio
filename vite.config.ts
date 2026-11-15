import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Compás · Academia de baile',
        short_name: 'Compás',
        description: 'Cobros y asistencia para academias de baile. Funciona sin internet.',
        lang: 'es-MX',
        theme_color: '#f6f5f9',
        background_color: '#f6f5f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Supabase nunca se cachea: los datos viven en IndexedDB
        navigateFallbackDenylist: [/^\/api/],
        // Lector de códigos de barras (~1 MB): se guarda la primera vez que se escanea y luego sirve sin internet
        runtimeCaching: [{ urlPattern: /\.wasm$/, handler: 'CacheFirst', options: { cacheName: 'lector-codigos', expiration: { maxEntries: 4 } } }],
      },
    }),
  ],
});
