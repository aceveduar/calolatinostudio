/** /p/<token>/manifiesto: para guardar el portal del alumno en su pantalla de inicio (ver cloudflare/portal.ts). */
import { TOKEN_PORTAL, manifiestoPortal } from '../../../cloudflare/portal';

export function onRequestGet({ params }: { params: { token?: string | string[] } }): Response {
  const token = String(params.token ?? '');
  if (!TOKEN_PORTAL.test(token)) return new Response('No existe', { status: 404 });
  return new Response(JSON.stringify(manifiestoPortal(token)), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=86400', 'Referrer-Policy': 'no-referrer' },
  });
}
