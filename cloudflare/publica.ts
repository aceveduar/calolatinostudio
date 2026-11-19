/**
 * Utilidades de la página pública para las funciones de Cloudflare Pages.
 * La página se arma en el navegador; Facebook, WhatsApp y Google no ejecutan ese código,
 * así que aquí se les entrega el título, la descripción, la foto y los datos del estudio ya escritos.
 */

export interface Env {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface Contenido {
  frase?: string;
  intro?: string;
  portada?: string | null;
  primera?: string;
  ubicaciones?: Record<string, { direccion: string; referencias?: string }>;
  preguntas?: { p: string; r: string }[];
  redes?: { instagram?: string; facebook?: string; tiktok?: string };
}

export interface Publica {
  academia: { nombre: string; color: string | null; logo: string | null; whatsapp: string | null; sede_principal: string };
  pagina?: Contenido;
  sedes: { id: string; nombre: string }[];
  clases: { clase: string }[];
  planes: { tipo: string; precio: number; sede_id: string | null }[];
}

export const slugOk = (s: string) => /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(s);

/** Datos públicos del estudio (los mismos que ve cualquiera en la página). null si no existe o falla. */
export async function leerPublica(env: Env, slug: string): Promise<Publica | null> {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !slugOk(slug)) return null;
  try {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/pagina_publica`, {
      method: 'POST',
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    return (await r.json()) as Publica | null;
  } catch {
    return null;
  }
}

/** Una foto de la página (portada, logo, galería gN, producto p_<id>) como data URL. null si no hay. */
export async function leerImagen(env: Env, slug: string, clave: string): Promise<string | null> {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY || !slugOk(slug)) return null;
  try {
    const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/imagen_publica`, {
      method: 'POST',
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_slug: slug, p_clave: clave }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return (await r.json()) as string | null;
  } catch {
    return null;
  }
}

/**
 * La imagen para la vista previa de Facebook/WhatsApp: la portada o, si no hay, el logo.
 * Con la base nueva vienen como enlace /img/… ; con la vieja, incrustadas (se sirven por /og/<slug>).
 */
export function imagenParaVistaPrevia(d: Publica, origen: string, slug: string): { url: string; grande: boolean } | null {
  const portada = d.pagina?.portada;
  const v = portada || d.academia.logo;
  if (!v) return null;
  if (v.startsWith('/img/')) return { url: origen + v, grande: !!portada };
  return decodificarImagen(v) ? { url: `${origen}/og/${slug}`, grande: !!decodificarImagen(portada) } : null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Etiquetas para la vista previa (Facebook/WhatsApp) y para Google. */
export function etiquetas(d: Publica, url: string, imagen: string | null, grande = false): { titulo: string; html: string } {
  const p = d.pagina ?? {};
  const nombre = d.academia.nombre;
  const titulo = p.frase ? `${nombre} · ${p.frase}` : `${nombre} · Clases de baile`;
  const disciplinas = [...new Set(d.clases.map((c) => c.clase.split(' ')[0]))].slice(0, 4);
  const descripcion = (
    p.intro ||
    `Clases de ${disciplinas.length ? disciplinas.join(', ').replace(/, ([^,]*)$/, ' y $1') : 'baile'} para todos los niveles. Horarios, precios y agenda tu primera clase.`
  ).slice(0, 200);
  const principal = p.ubicaciones?.principal?.direccion;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: nombre,
    description: descripcion,
    url,
    ...(imagen ? { image: imagen } : {}),
    ...(d.academia.whatsapp ? { telephone: `+52${d.academia.whatsapp}` } : {}),
    ...(principal ? { address: { '@type': 'PostalAddress', streetAddress: principal, addressCountry: 'MX' } } : {}),
    sameAs: Object.values(p.redes ?? {}).filter(Boolean),
  };
  const meta = (k: string, v: string, attr = 'property') => `<meta ${attr}="${k}" content="${esc(v)}" />`;
  const html = [
    meta('description', descripcion, 'name'),
    `<link rel="canonical" href="${esc(url)}" />`,
    meta('og:type', 'website'),
    meta('og:site_name', nombre),
    meta('og:title', titulo),
    meta('og:description', descripcion),
    meta('og:url', url),
    meta('og:locale', 'es_MX'),
    ...(imagen ? [meta('og:image', imagen), meta('twitter:card', grande ? 'summary_large_image' : 'summary', 'name')] : [meta('twitter:card', 'summary', 'name')]),
    ...(d.academia.color ? [meta('theme-color', d.academia.color, 'name')] : []),
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
  return { titulo, html };
}

/**
 * Lo que adelanta la carga con internet lento: los datos de la página ya escritos en el HTML (así no se
 * espera a que el código pida los datos después) y la foto de portada pedida desde el principio.
 * El bloque de datos es JSON, no código: el navegador no lo ejecuta y la política de seguridad no lo bloquea.
 */
export function adelantos(d: Publica, slug: string): string {
  const portada = d.pagina?.portada;
  return [
    ...(typeof portada === 'string' && portada.startsWith('/img/') ? [`<link rel="preload" as="image" href="${esc(portada)}" fetchpriority="high" />`] : []),
    `<script id="pp-datos" type="application/json" data-slug="${esc(slug)}">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}

/** "data:image/jpeg;base64,…" → bytes y tipo. */
export function decodificarImagen(dataUrl: string | null | undefined): { bytes: Uint8Array; tipo: string } | null {
  const m = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, tipo: m[1] };
}
