import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null cuando no hay credenciales: la app funciona 100% local. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

export const nubeConfigurada = supabase !== null;

/**
 * Comprueba correo y contraseña de la cuenta de la academia SIN cambiar la sesión activa
 * (cliente temporal que no guarda nada). Sirve para autorizar acciones delicadas, como restablecer un PIN.
 */
export async function verificarCuentaAcademia(email: string, password: string, academiaId: string): Promise<void> {
  if (!url || !key) throw new Error('La nube no está configurada');
  const temp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'compas-verificacion' } });
  const { error } = await temp.auth.signInWithPassword({ email, password });
  if (error) throw new Error(/invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
  const { data } = await temp.from('miembros').select('academia_id').eq('academia_id', academiaId).maybeSingle();
  await temp.auth.signOut();
  if (!data) throw new Error('Esa cuenta no es de esta academia.');
}
