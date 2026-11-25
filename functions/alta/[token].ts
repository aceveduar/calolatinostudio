import type { Env } from '../../cloudflare/publica';

export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const pagina = await env.ASSETS.fetch(new Request(new URL('/', request.url), { headers: request.headers }));
  const headers = new Headers(pagina.headers);
  const csp = headers.get('Content-Security-Policy');
  if (csp) {
    headers.set('Content-Security-Policy', csp.replace(/(^|;\s*)((?:script|frame)-src\s+[^;]+)/g,
      '$1$2 https://challenges.cloudflare.com'));
  }
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(pagina.body, { status: pagina.status, headers });
}
