/**
 * Manifiesto del portal del alumno: al guardarlo en la pantalla de inicio se instala "Mi pase", que abre
 * SU portal (/p/<token>) y no la app de la academia (cuyo manifiesto abre "/").
 */
export const TOKEN_PORTAL = /^[A-Za-z0-9]{20,64}$/;

/**
 * Nombre bajo el ícono: "Mi Calo" (primera palabra de la academia; corto para que no se corte en la
 * pantalla de inicio). Nombre completo: "Mi pase · Calo Latino Studio". Sin academia: "Mi pase".
 */
export function nombresApp(academia?: string | null): { corto: string; largo: string } {
  // sin caracteres de control ni < > " (va dentro de un JSON y bajo un ícono)
  const a = [...(academia ?? '')].filter((ch) => ch >= ' ' && !'<>"'.includes(ch)).join('').trim().slice(0, 40);
  const primera = a.split(/\s+/)[0] ?? '';
  return { corto: primera && primera.length <= 9 ? `Mi ${primera}` : 'Mi pase', largo: a ? `Mi pase · ${a}` : 'Mi pase' };
}

export function manifiestoPortal(token: string, academia?: string | null) {
  const inicio = `/p/${token}`;
  const { corto, largo } = nombresApp(academia);
  return {
    id: inicio,
    name: largo,
    short_name: corto,
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
