/**
 * /a/<slug>: la misma app de siempre, pero con el título, la descripción, la foto y los datos
 * del estudio ya escritos en el HTML (para la vista previa en Facebook/WhatsApp y para Google).
 * Si algo falla, se entrega la página tal cual: nunca se rompe.
 */
import { decodificarImagen, etiquetas, leerPublica, type Env } from '../../cloudflare/publica';

interface Contexto {
  request: Request;
  env: Env;
  params: { slug?: string | string[] };
}

export async function onRequestGet({ request, env, params }: Contexto): Promise<Response> {
  const url = new URL(request.url);
  const pagina = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers }));
  const slug = String(params.slug ?? '').toLowerCase();
  const datos = await leerPublica(env, slug);
  if (!datos || !(pagina.headers.get('content-type') ?? '').includes('text/html')) return pagina;

  const conImagen = decodificarImagen(datos.pagina?.portada) ?? decodificarImagen(datos.academia.logo);
  const { titulo, html } = etiquetas(datos, `${url.origin}/a/${slug}`, conImagen ? `${url.origin}/og/${slug}` : null, !!decodificarImagen(datos.pagina?.portada));

  const res = new HTMLRewriter()
    .on('title', { element: (e) => void e.setInnerContent(titulo) })
    // las de la app (Compás) no aplican aquí
    .on('meta[name="description"]', { element: (e) => void e.remove() })
    .on('meta[name="apple-mobile-web-app-title"]', { element: (e) => void e.setAttribute('content', datos.academia.nombre) })
    .on('head', { element: (e) => void e.append(html, { html: true }) })
    .transform(pagina);
  const h = new Headers(res.headers);
  return new Response(res.body, { status: 200, headers: h });
}
