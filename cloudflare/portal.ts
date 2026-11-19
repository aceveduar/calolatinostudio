/**
 * Manifiesto del portal del alumno: al guardarlo en la pantalla de inicio se instala "Mi pase", que abre
 * SU portal (/p/<token>) y no la app de la academia (cuyo manifiesto abre "/").
 */
export const TOKEN_PORTAL = /^[A-Za-z0-9]{20,64}$/;

export function manifiestoPortal(token: string) {
  const inicio = `/p/${token}`;
  return {
    id: inicio,
    name: 'Mi pase',
    short_name: 'Mi pase',
    description: 'Tu pase de entrada, tu plan y tus clases.',
    lang: 'es-MX',
    start_url: inicio,
    scope: inicio,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#f6f5f9',
    background_color: '#f6f5f9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
