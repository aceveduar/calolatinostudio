/**
 * Sincronización local-first.
 *  push: el outbox se envía en orden (upsert idempotente por id).
 *  pull: se baja lo cambiado desde el último cursor (server_updated_at, por tabla).
 * Conflictos: gana el `updatedAt` más reciente; un registro con cambios locales
 * pendientes nunca se sobrescribe hasta que se sube.
 */
import { useSyncExternalStore } from 'react';
import { db, getMeta, setMeta } from '../db/db';
import { SYNC_TABLES, type ID, type SyncTable } from '../db/types';
import { alCambiarLocal } from './bus';
import { supabase } from './supabase';

/** solo-local: instalación sin nube · desconectada: hay nube pero este equipo no está conectado (o caducó la sesión) */
export type Fase = 'solo-local' | 'desconectada' | 'sin-red' | 'sincronizando' | 'al-dia' | 'error';
export interface EstadoSync {
  fase: Fase;
  ultimo: number | null;
  error: string | null;
}

let estado: EstadoSync = { fase: 'solo-local', ultimo: null, error: null };
const subs = new Set<() => void>();
function setEstado(p: Partial<EstadoSync>) {
  estado = { ...estado, ...p };
  subs.forEach((s) => s());
}
export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => estado,
  );
}

const aSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const aCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function aRemoto(r: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) o[aSnake(k)] = v;
  return o;
}
function aLocal(r: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (k !== 'server_updated_at') o[aCamel(k)] = v;
  return o;
}

async function push(): Promise<void> {
  if (!supabase) return;
  const retenidos = new Set<ID>();
  for (;;) {
    // Las tablas que la base aún no tiene se saltan (sus cambios esperan en la cola sin frenar al resto)
    const items = await db.outbox.orderBy('seq').filter((o) => !tablasFaltantes.has(o.table) && !retenidos.has(o.id)).limit(500).toArray();
    if (!items.length) return;
    const porTabla = new Map<SyncTable, Set<ID>>();
    for (const it of items) {
      if (!porTabla.has(it.table)) porTabla.set(it.table, new Set());
      porTabla.get(it.table)!.add(it.id);
    }
    // En orden de SYNC_TABLES para respetar llaves foráneas (academias primero).
    for (const tabla of SYNC_TABLES) {
      const ids = porTabla.get(tabla);
      if (!ids) continue;
      let regs = (await db.table(tabla).bulkGet([...ids])).filter(Boolean) as Record<string, unknown>[];
      // Ventas de tienda: esperan en la cola hasta que la base tenga productos (si no, perderían el producto)
      if (tabla === 'pagos' && (tablasFaltantes.has('productos') || columnasFaltantes.has('pagos.producto_id'))) {
        for (const r of regs) if (r.productoId) retenidos.add(r.id as ID);
        regs = regs.filter((r) => !r.productoId);
      }
      if (!regs.length) continue;
      try {
        await subirTolerante(tabla, regs.map(aRemoto));
      } catch (e) {
        // Tabla o columna que la base aún no conoce: esa tabla espera en la cola, las demás siguen
        if (!esTablaFaltante(e) && !/Could not find the '\w+' column/.test(e instanceof Error ? e.message : String(e))) throw e;
        tablasFaltantes.add(tabla);
      }
    }
    await db.outbox.bulkDelete(items.filter((o) => !tablasFaltantes.has(o.table) && !retenidos.has(o.id)).map((o) => o.seq!));
    if (items.every((o) => tablasFaltantes.has(o.table) || retenidos.has(o.id))) return;
  }
}

/** Columnas que la app conoce pero la base aún no (falta correr la migración). */
export const columnasFaltantes = new Set<string>();
/** Tablas nuevas que la base aún no tiene (p. ej. productos antes de correr schema.sql). */
export const tablasFaltantes = new Set<SyncTable>();

function esTablaFaltante(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /Could not find the table|relation .* does not exist|PGRST205|42P01/i.test(m);
}

/**
 * Si la app es más nueva que la base (p. ej. un campo nuevo como el logo), Supabase rechaza
 * TODO el lote. En lugar de detener la sincronización, se omite esa columna y se avisa.
 */
/**
 * Columnas opcionales que se pueden omitir si la base aún no las tiene: el registro sigue siendo válido sin ellas.
 * Cualquier otra columna faltante detiene la subida y CONSERVA la cola (nunca se sube un registro incompleto).
 */
const OMITIBLES = new Set(['academias.color', 'academias.logo', 'academias.mensajes', 'academias.sede_principal', 'usuarios.maestro_id', 'clases.maestro_id']);

async function subirTolerante(tabla: SyncTable, filas: Record<string, unknown>[]): Promise<void> {
  for (let intento = 0; intento < OMITIBLES.size + 1; intento++) {
    const limpias = filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !columnasFaltantes.has(`${tabla}.${k}`))));
    const { error } = await supabase!.from(tabla).upsert(limpias, { onConflict: 'id' });
    if (!error) return;
    const col = error.message.match(/Could not find the '(\w+)' column/)?.[1];
    const clave = `${tabla}.${col}`;
    if (!col || !OMITIBLES.has(clave) || columnasFaltantes.has(clave)) throw new Error(`${tabla}: ${error.message}`);
    columnasFaltantes.add(clave);
  }
  // Nunca dar por buena una subida que no se confirmó: la cola se conserva para reintentar
  throw new Error(`${tabla}: no se pudo subir`);
}

const TRASLAPE_MS = 2 * 60_000;

async function pull(academiaId: ID): Promise<void> {
  if (!supabase) return;
  for (const tabla of SYNC_TABLES) {
    const claveCursor = `cursor:${tabla}`;
    const guardado = await getMeta<string>(claveCursor);
    // Traslape: volver a revisar los últimos 2 min. Una subida grande de otro teléfono puede
    // terminar DESPUÉS de que leímos filas más nuevas, dejando filas con hora anterior al cursor.
    // Repetirlas es inofensivo (se ignoran si no son más nuevas que las locales).
    let cursor = guardado ? new Date(new Date(guardado).getTime() - TRASLAPE_MS).toISOString() : '1970-01-01T00:00:00Z';
    for (;;) {
      const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .eq(tabla === 'academias' ? 'id' : 'academia_id', academiaId)
        .gt('server_updated_at', cursor)
        .order('server_updated_at', { ascending: true })
        .limit(500);
      if (error && esTablaFaltante(error.message)) {
        tablasFaltantes.add(tabla);
        break;
      }
      if (error) throw new Error(`${tabla}: ${error.message}`);
      if (!data.length) break;

      const pendientes = new Set((await db.outbox.where('table').equals(tabla).toArray()).map((o) => o.id));
      const locales = await db.table(tabla).bulkGet(data.map((r) => r.id as string));
      const aGuardar = data
        .map((r, i) => ({ remoto: aLocal(r), local: locales[i] as { updatedAt: number } | undefined }))
        .filter(({ remoto, local }) => !pendientes.has(remoto.id as string) && (!local || (remoto.updatedAt as number) >= local.updatedAt))
        .map(({ remoto }) => remoto);
      if (aGuardar.length) await db.table(tabla).bulkPut(aGuardar);

      cursor = data[data.length - 1].server_updated_at as string;
      await setMeta(claveCursor, cursor);
      if (data.length < 500) break;
    }
  }
}

let corriendo: Promise<void> | null = null;

export async function sincronizar(): Promise<void> {
  if (!supabase) return setEstado({ fase: 'solo-local' });
  if (corriendo) return corriendo;
  corriendo = (async () => {
    try {
      const academiaId = await getMeta<ID>('academiaId');
      const vinculada = await getMeta<boolean>('nubeVinculada');
      const { data } = await supabase.auth.getSession();
      if (!academiaId) return setEstado({ fase: 'solo-local' });
      // Nunca dejar de sincronizar en silencio: si este equipo no está conectado, decirlo
      if (!vinculada) return setEstado({ fase: 'desconectada', error: null });
      if (!data.session) return setEstado({ fase: 'desconectada', error: 'La sesión de la nube caducó. Vuelve a conectar con el correo de la academia.' });
      if (!navigator.onLine) return setEstado({ fase: 'sin-red' });
      tablasFaltantes.clear(); // reintentar: quizá ya se corrió la migración
      setEstado({ fase: 'sincronizando', error: null });
      await push();
      await pull(academiaId);
      // Solo avisar si algo quedó esperando por la base vieja (si no hay nada de la tienda, no molestar)
      const esperando = await db.outbox.count();
      const falta = esperando ? [...tablasFaltantes, ...columnasFaltantes] : [...columnasFaltantes];
      setEstado({ fase: 'al-dia', ultimo: Date.now(), error: falta.length ? `Actualiza la base de datos: falta ${falta.join(', ')} (corre supabase/schema.sql)` : null });
    } catch (e) {
      setEstado({ fase: navigator.onLine ? 'error' : 'sin-red', error: e instanceof Error ? e.message : String(e) });
    } finally {
      corriendo = null;
    }
  })();
  return corriendo;
}

let iniciado = false;
export function iniciarSync() {
  if (iniciado) return;
  iniciado = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  const pronto = () => {
    clearTimeout(t);
    t = setTimeout(sincronizar, 1500);
  };
  alCambiarLocal(pronto);
  window.addEventListener('online', () => void sincronizar());
  window.addEventListener('offline', () => setEstado({ fase: 'sin-red' }));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void sincronizar());
  setInterval(() => void sincronizar(), 60_000);
  void sincronizar();
}

/** Encola todo lo local (al vincular por primera vez con la nube). */
export async function encolarTodo(): Promise<void> {
  const at = Date.now();
  for (const tabla of SYNC_TABLES) {
    const ids = (await db.table(tabla).toCollection().primaryKeys()) as ID[];
    await db.outbox.bulkAdd(ids.map((id) => ({ table: tabla, id, at })));
  }
}

/** Dueño: crea cuenta en la nube y sube la academia de este teléfono. */
export async function vincularAcademia(email: string, password: string, crearCuenta: boolean): Promise<void> {
  if (!supabase) throw new Error('La nube no está configurada');
  const academiaId = await getMeta<ID>('academiaId');
  const academia = academiaId ? await db.academias.get(academiaId) : undefined;
  if (!academia) throw new Error('No hay academia local');

  const auth = crearCuenta
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  if (auth.error) throw new Error(traducirError(auth.error.message));
  if (!auth.data.session) throw new Error('Revisa tu correo para confirmar la cuenta y luego entra con "Ya tengo cuenta".');

  const { error } = await supabase.rpc('vincular_academia', { p_id: academia.id, p_nombre: academia.nombre });
  if (error) throw new Error(traducirError(error.message));

  await encolarTodo();
  await setMeta('nubeVinculada', true);
  await sincronizar();
}

/** Teléfono nuevo: entra con la cuenta y descarga la academia. */
export async function entrarEnDispositivoNuevo(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('La nube no está configurada');
  const auth = await supabase.auth.signInWithPassword({ email, password });
  if (auth.error) throw new Error(traducirError(auth.error.message));
  const { data, error } = await supabase.from('miembros').select('academia_id').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Esta cuenta no tiene una academia vinculada.');
  // Descargar TODO antes de "abrir" la academia en este teléfono:
  // si se marcara antes, la app mostraría la caja en $0 mientras bajan los cobros.
  setEstado({ fase: 'sincronizando' });
  await pull(data.academia_id as ID);
  await setMeta('nubeVinculada', true);
  await setMeta('academiaId', data.academia_id);
  setEstado({ fase: 'al-dia', ultimo: Date.now() });
}


export const BORRAR_AL_INICIAR = 'compas:borrar-al-iniciar';

/** Quita la academia de ESTE teléfono (no toca la nube). Quien llama debe verificar que no se pierde nada. */
export async function quitarAcademiaDelTelefono(): Promise<void> {
  await supabase?.auth.signOut();
  // El borrado se hace al reiniciar (main.tsx), antes de que alguna pantalla abra la base:
  // con la app abierta, las consultas en vivo la reabren y el borrado se queda bloqueado.
  localStorage.setItem(BORRAR_AL_INICIAR, '1');
  location.replace('/');
}

function traducirError(m: string): string {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Usa "Ya tengo cuenta".';
  if (/password/i.test(m) && /6/.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/ya está vinculada/i.test(m)) return m;
  return m;
}
