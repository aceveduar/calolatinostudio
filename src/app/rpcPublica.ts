/**
 * Llamadas a la base desde la página pública y el portal del alumno (sin sesión): solo funciones RPC
 * públicas. Es un fetch directo en lugar de la librería de Supabase, que pesa mucho y aquí no hace falta:
 * con internet lento, cada KB cuenta. Misma forma de respuesta que supabase.rpc ({ data, error }).
 */
const URL_NUBE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- igual que supabase.rpc: la forma la valida quien llama
async function rpc<T = any>(funcion: string, args: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const r = await fetch(`${URL_NUBE}/rest/v1/rpc/${funcion}`, {
      method: 'POST',
      headers: { apikey: CLAVE!, Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const texto = await r.text();
    const cuerpo = texto ? JSON.parse(texto) : null;
    if (!r.ok) return { data: null, error: { message: cuerpo?.message ?? `HTTP ${r.status}` } };
    return { data: cuerpo as T, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

/** null cuando la app no tiene nube configurada (igual que `supabase`). */
export const nubePublica = URL_NUBE && CLAVE ? { rpc } : null;
