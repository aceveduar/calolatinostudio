interface Contexto {
  request: Request;
  env: {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    ALTA_GRUPAL_LLAVE?: string;
  };
}

const accion = 'registro_alumno';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const json = (datos: object, status = 200) => Response.json(datos, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function configuracion(env: Contexto['env']) {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, TURNSTILE_SITE_KEY: sitekey, TURNSTILE_SECRET_KEY: secreto, ALTA_GRUPAL_LLAVE: llave } = env;
  return url && anon && sitekey && secreto && llave && /^[A-Za-z0-9_-]{43}$/.test(llave)
    ? { url, anon, sitekey, secreto, llave } : null;
}

export function onRequestGet({ env }: Contexto): Response {
  const config = configuracion(env);
  return config ? json({ sitekey: config.sitekey }) : json({ estado: 'servicio' }, 503);
}

async function leerDatos(request: Request) {
  const lector = request.body?.getReader();
  if (!lector) return null;
  const limite = 4096;
  const bytes = new Uint8Array(limite);
  let escritos = 0;
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      if (escritos + value.length > limite) {
        void lector.cancel().catch(() => {});
        return null;
      }
      bytes.set(value, escritos);
      escritos += value.length;
    }
    const d = JSON.parse(new TextDecoder().decode(bytes.subarray(0, escritos)));
    const { campana, solicitud, nombre, telefono, reto } = d ?? {};
    if (typeof campana !== 'string' || !uuid.test(campana) || typeof solicitud !== 'string' || !uuid.test(solicitud)
      || typeof nombre !== 'string' || !nombre.trim() || nombre.length > 120
      || typeof telefono !== 'string' || !telefono.trim() || telefono.length > 32
      || typeof reto !== 'string' || !reto || reto.length > 2048) return null;
    return { campana, solicitud, nombre, telefono, reto };
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }: Contexto): Promise<Response> {
  const config = configuracion(env);
  if (!config) return json({ estado: 'servicio' }, 503);
  const pagina = new URL(request.url);
  if (request.headers.get('Origin') !== pagina.origin || request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return json({ estado: 'datos' }, 400);
  }
  const d = await leerDatos(request);
  if (!d) return json({ estado: 'datos' }, 400);

  try {
    const verificacion = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: config.secreto, response: d.reto }),
      signal: AbortSignal.timeout(7_000),
    });
    if (!verificacion.ok) return json({ estado: 'servicio' }, 503);
    const v = await verificacion.json();
    if (v.success !== true || v.hostname !== pagina.hostname || v.action !== accion || v.cdata !== d.campana) {
      return json({ estado: 'verificacion' }, 403);
    }
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(d.reto));
    const huella = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
    const base = await fetch(`${config.url}/rest/v1/rpc/registrar_alta_verificada`, {
      method: 'POST',
      headers: { apikey: config.anon, Authorization: `Bearer ${config.anon}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(7_000),
      body: JSON.stringify({ p_token: d.campana, p_solicitud: d.solicitud, p_nombre: d.nombre, p_telefono: d.telefono, p_llave: config.llave, p_huella_reto: huella }),
    });
    if (!base.ok) return json({ estado: 'servicio' }, 503);
    const r = await base.json();
    if (r?.estado === 'lista' && typeof r.portal === 'string' && /^[A-Za-z0-9]{20,64}$/.test(r.portal)) {
      return json({ estado: 'lista', portal: r.portal });
    }
    if (['cerrada', 'recepcion', 'datos', 'espera', 'verificacion'].includes(r?.estado)) return json({ estado: r.estado });
    return json({ estado: 'servicio' }, 503);
  } catch {
    return json({ estado: 'servicio' }, 503);
  }
}
