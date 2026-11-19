// Funciones de Cloudflare de la página pública (con la base simulada).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as img } from '../../functions/img/[slug]/[archivo]';
import { imagenParaVistaPrevia, type Publica } from '../../cloudflare/publica';

const env = { VITE_SUPABASE_URL: 'https://prueba.invalid', VITE_SUPABASE_ANON_KEY: 'k', ASSETS: { fetch: async () => new Response('') } };
const JPG = 'data:image/jpeg;base64,' + btoa('\xff\xd8\xff fake');

afterEach(() => vi.unstubAllGlobals());

describe('/img/<slug>/<clave>.<huella>', () => {
  const pedir = (archivo: string) => {
    const esperas: Promise<unknown>[] = [];
    const r = img({ request: new Request(`https://x/img/calo-latino/${archivo}`), env, params: { slug: 'calo-latino', archivo }, waitUntil: (p) => esperas.push(p) });
    return { r, esperas };
  };

  it('sirve la foto con caché larga y pide solo esa foto a la base', async () => {
    const llamadas: unknown[] = [];
    vi.stubGlobal('fetch', async (_u: string, o: RequestInit) => {
      llamadas.push(JSON.parse(o.body as string));
      return new Response(JSON.stringify(JPG));
    });
    const res = await pedir('g3.0123456789').r;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(new Uint8Array(await res.arrayBuffer())[0]).toBe(0xff);
    expect(llamadas).toEqual([{ p_slug: 'calo-latino', p_clave: 'g3' }]);
  });

  it('la segunda vez sale de la caché sin tocar la base', async () => {
    const guardadas = new Map<string, Response>();
    vi.stubGlobal('caches', { default: { match: async (r: Request) => guardadas.get(r.url)?.clone(), put: async (r: Request, res: Response) => void guardadas.set(r.url, res) } });
    const fetch = vi.fn(async () => new Response(JSON.stringify(JPG)));
    vi.stubGlobal('fetch', fetch);
    const a = pedir('portada.0123456789');
    await a.r;
    await Promise.all(a.esperas);
    expect((await pedir('portada.0123456789').r).status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rechaza nombres raros sin preguntar a la base', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const a of ['portada', '../x.0123456789', 'alumnos.0123456789', "p_1' or 1=1.0123456789"]) expect((await pedir(a).r).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si la foto ya no existe: 404 con caché corta', async () => {
    vi.stubGlobal('fetch', async () => new Response('null'));
    const res = await pedir('logo.0123456789').r;
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });
});

describe('foto de la vista previa en Facebook', () => {
  const datos = (portada: string | null, logo: string | null) => ({ academia: { nombre: 'Calo', color: null, logo, whatsapp: null, sede_principal: 'x' }, pagina: { portada }, sedes: [], clases: [], planes: [] }) as Publica;
  it('usa el enlace /img de la base nueva', () => {
    expect(imagenParaVistaPrevia(datos('/img/calo/portada.abc', null), 'https://s', 'calo')).toEqual({ url: 'https://s/img/calo/portada.abc', grande: true });
    expect(imagenParaVistaPrevia(datos(null, '/img/calo/logo.abc'), 'https://s', 'calo')).toEqual({ url: 'https://s/img/calo/logo.abc', grande: false });
  });
  it('con la base vieja (foto incrustada) usa /og', () => {
    expect(imagenParaVistaPrevia(datos(JPG, null), 'https://s', 'calo')).toEqual({ url: 'https://s/og/calo', grande: true });
    expect(imagenParaVistaPrevia(datos(null, null), 'https://s', 'calo')).toBeNull();
  });
});

describe('/p/<token>/manifiesto (guardar el portal en la pantalla de inicio)', async () => {
  const { onRequestGet: manifiesto } = await import('../../functions/p/[token]/manifiesto');
  it('abre SU portal, no la app de la academia', async () => {
    const r = manifiesto({ params: { token: 'AbCdEfGhJkLmNpQrStUvWxYz23' } });
    const m = await r.json();
    expect(r.headers.get('Content-Type')).toBe('application/manifest+json');
    expect(m.start_url).toBe('/p/AbCdEfGhJkLmNpQrStUvWxYz23');
    expect(m.scope).toBe('/p/AbCdEfGhJkLmNpQrStUvWxYz23');
    expect(m.name).toBe('Mi pase');
  });
  it('se llama como su academia: "Mi Calo" bajo el ícono', async () => {
    const r = manifiesto({ request: new Request('https://x.dev/p/AbCdEfGhJkLmNpQrStUvWxYz23/manifiesto?a=Calo%20Latino%20Studio'), params: { token: 'AbCdEfGhJkLmNpQrStUvWxYz23' } });
    const m = await r.json();
    expect(m.short_name).toBe('Mi Calo');
    expect(m.name).toBe('Mi pase · Calo Latino Studio');
    const raro = await manifiesto({ request: new Request('https://x.dev/p/AbCdEfGhJkLmNpQrStUvWxYz23/manifiesto?a=%3Cscript%3EAcademiaDeNombreLarguisimo'), params: { token: 'AbCdEfGhJkLmNpQrStUvWxYz23' } }).json();
    expect(raro.short_name).toBe('Mi pase');
    expect(raro.name).not.toMatch(/[<>]/);
  });
  it('rechaza tokens raros', () => {
    for (const t of ['corto', '../../etc', 'a'.repeat(80), 'AbCdEfGhJkLmNpQrStUv"><x']) expect(manifiesto({ params: { token: t } }).status).toBe(404);
  });
});
