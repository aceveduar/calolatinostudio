import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPost } from '../../functions/api/registro-alumno';
import { onRequestGet as obtenerFormulario } from '../../functions/alta/[token]';

const origen = 'https://calo.example.test';
const campana = '11111111-1111-4111-8111-111111111111';
const env = {
  VITE_SUPABASE_URL: 'https://bd.example.test',
  VITE_SUPABASE_ANON_KEY: 'anon-de-prueba',
  TURNSTILE_SITE_KEY: 'sitio-de-prueba',
  TURNSTILE_SECRET_KEY: 'secreto-de-prueba',
  ALTA_GRUPAL_LLAVE: 'A'.repeat(43),
};
const solicitud = () => new Request(`${origen}/api/registro-alumno`, {
  method: 'POST',
  headers: { Origin: origen, 'Content-Type': 'application/json' },
  body: JSON.stringify({ campana, solicitud: campana, nombre: 'Alumna Prueba', telefono: '5512340000', reto: 'reto-de-prueba' }),
});

describe('verificación del alta en Pages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('publica únicamente la clave del sitio', async () => {
    const respuesta = onRequestGet({ env, request: solicitud() });
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store');
    expect(await respuesta.json()).toEqual({ sitekey: env.TURNSTILE_SITE_KEY });
  });

  it('limita los permisos del widget al formulario público', async () => {
    const respuesta = await obtenerFormulario({
      request: new Request(`${origen}/alta/${campana}`),
      env: { ASSETS: { fetch: async () => new Response('HTML', {
        headers: { 'Content-Security-Policy': "script-src 'self'; frame-src 'self'; object-src 'none'" },
      }) } },
    });
    expect(respuesta.headers.get('Content-Security-Policy')).toBe("script-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'");
    expect(respuesta.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it.each([
    { success: false },
    { success: true, hostname: 'otro.example.test', action: 'registro_alumno', cdata: campana },
    { success: true, hostname: 'calo.example.test', action: 'registro_alumno', cdata: 'otra-campana' },
  ])('rechaza un reto inválido o de otro destino antes de llegar a Supabase', async (reto) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(reto));
    vi.stubGlobal('fetch', fetch);
    const respuesta = await onRequestPost({ env, request: solicitud() });
    expect(respuesta.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('consulta el RPC restringido tras validar y devuelve solo el pase', async () => {
    const portal = 'abcd'.repeat(8);
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ success: true, hostname: 'calo.example.test', action: 'registro_alumno', cdata: campana }))
      .mockResolvedValueOnce(Response.json({ estado: 'lista', portal, interno: 'omitido' }));
    vi.stubGlobal('fetch', fetch);
    const respuesta = await onRequestPost({ env, request: solicitud() });
    expect(await respuesta.json()).toEqual({ estado: 'lista', portal });
    expect(fetch.mock.calls[1][0]).toMatch(/\/registrar_alta_verificada$/);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ p_llave: env.ALTA_GRUPAL_LLAVE, p_token: campana });
  });
});
