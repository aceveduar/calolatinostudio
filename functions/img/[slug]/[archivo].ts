/**
 * /img/<slug>/<clave>.<huella>: una foto de la página pública como imagen normal.
 * La base solo manda el enlace (pesa KB); aquí se sirve la foto una vez y Cloudflare la guarda
 * en caché un año. La huella cambia cuando cambia la foto, así nunca se ve una vieja.
 */
import { decodificarImagen, leerImagen, type Env } from '../../../cloudflare/publica';

interface Contexto {
  request: Request;
  env: Env;
  params: { slug?: string | string[]; archivo?: string | string[] };
  waitUntil: (p: Promise<unknown>) => void;
}

const ARCHIVO = /^(portada|logo|g\d{1,2}|[pe]_[0-9a-f-]{36})\.[0-9a-f]{10}$/;

export async function onRequestGet({ request, env, params, waitUntil }: Contexto): Promise<Response> {
  const m = String(params.archivo ?? '').match(ARCHIVO);
  if (!m) return new Response('No existe', { status: 404 });

  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const guardada = await cache?.match(request);
  if (guardada) return guardada;

  const img = decodificarImagen(await leerImagen(env, String(params.slug ?? '').toLowerCase(), m[1]));
  if (!img) return new Response('Sin imagen', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });

  const res = new Response(img.bytes, {
    headers: { 'Content-Type': img.tipo, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
  if (cache) waitUntil(cache.put(request, res.clone()));
  return res;
}
