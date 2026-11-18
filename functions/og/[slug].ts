/**
 * /og/<slug>: la foto de portada (o el logo) como imagen normal, para la vista previa
 * de Facebook y WhatsApp, que no aceptan imágenes incrustadas en el HTML.
 * (Con la base al día la vista previa ya apunta a /img/…; esto queda para enlaces viejos.)
 */
import { decodificarImagen, leerImagen, leerPublica, type Env } from '../../cloudflare/publica';

export async function onRequestGet({ env, params }: { env: Env; params: { slug?: string | string[] } }): Promise<Response> {
  const slug = String(params.slug ?? '').toLowerCase();
  // primero solo la foto (ligero); si la base aún no tiene imagen_publica, todo el contenido
  let img = decodificarImagen(await leerImagen(env, slug, 'portada')) ?? decodificarImagen(await leerImagen(env, slug, 'logo'));
  if (!img) {
    const datos = await leerPublica(env, slug);
    img = decodificarImagen(datos?.pagina?.portada) ?? decodificarImagen(datos?.academia.logo);
  }
  if (!img) return new Response('Sin imagen', { status: 404 });
  return new Response(img.bytes, { headers: { 'Content-Type': img.tipo, 'Cache-Control': 'public, max-age=3600' } });
}
