/**
 * /og/<slug>: la foto de portada (o el logo) como imagen normal, para la vista previa
 * de Facebook y WhatsApp, que no aceptan imágenes incrustadas en el HTML.
 */
import { decodificarImagen, leerPublica, type Env } from '../../cloudflare/publica';

export async function onRequestGet({ env, params }: { env: Env; params: { slug?: string | string[] } }): Promise<Response> {
  const datos = await leerPublica(env, String(params.slug ?? '').toLowerCase());
  const img = decodificarImagen(datos?.pagina?.portada) ?? decodificarImagen(datos?.academia.logo);
  if (!img) return new Response('Sin imagen', { status: 404 });
  return new Response(img.bytes, { headers: { 'Content-Type': img.tipo, 'Cache-Control': 'public, max-age=3600' } });
}
