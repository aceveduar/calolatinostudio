/**
 * Sincronización local-first.
 *  push: el outbox se envía en orden. Un alta sube el registro completo (upsert idempotente por id);
 *        un cambio sube SOLO los campos que cambiaron (ver subida.ts), así un teléfono que estuvo
 *        sin red no pisa lo que otro cambió en el mismo registro mientras tanto.
 *  pull: se baja lo cambiado desde el último cursor (server_updated_at, por tabla).
 * Conflictos: la nube es la verdad. Un registro con cambios locales pendientes nunca se sobrescribe
 * hasta que se sube; si dos teléfonos cambian el MISMO campo, queda el que llegó al último.
 * No se compara la hora de cada teléfono: un reloj adelantado ya no puede ganar siempre.
 */
import { useSyncExternalStore } from 'react';
import { db, getMeta, setMeta } from '../db/db';
import { SYNC_TABLES, type ID, type SyncTable } from '../db/types';
import { alCambiarLocal } from './bus';
import { supabase } from './supabase';
import { avisoEsquema } from './esquema';
import { planearSubida, soloCampos } from './subida';

/** Versión de la base: una vez que está al día no se vuelve a preguntar en esta sesión. */
let esquemaAlDia = false;
async function revisarEsquema(): Promise<string | null> {
  if (esquemaAlDia || !supabase) return null;
  const { data, error } = await supabase.rpc('esquema_version');
  // función inexistente = base anterior a la versión; otro error (red) = no molestar, se reintenta
  if (error && !/esquema_version|PGRST202|does not exist/i.test(`${error.code} ${error.message}`)) return null;
  const aviso = avisoEsquema(error ? null : Number(data));
  esquemaAlDia = aviso === null;
  return aviso;
}

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

/** Campos que solo existen en el teléfono (índices calculados): nunca se suben. */
const SOLO_LOCALES = new Set(['deuda']);
function aRemoto(r: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (!SOLO_LOCALES.has(k)) o[aSnake(k)] = v;
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
      // Boletos de eventos: igual, esperan a que la base tenga eventos
      if (tabla === 'pagos' && (tablasFaltantes.has('eventos') || columnasFaltantes.has('pagos.evento_id'))) {
        for (const r of regs) if (r.eventoId) retenidos.add(r.id as ID);
        regs = regs.filter((r) => !r.eventoId);
      }
      // Cobros de renta: igual, esperan a que la base tenga rentas (si no, perderían a qué renta y mes pertenecen)
      if (tabla === 'pagos' && (tablasFaltantes.has('rentas') || columnasFaltantes.has('pagos.renta_id') || columnasFaltantes.has('pagos.periodo'))) {
        for (const r of regs) if (r.rentaId) retenidos.add(r.id as ID);
        regs = regs.filter((r) => !r.rentaId);
      }
      if (!regs.length) continue;
      const plan = planearSubida(items.filter((o) => o.table === tabla));
      try {
        const completos = regs.filter((r) => !plan.parciales.has(r.id as ID));
        if (completos.length) await subirTolerante(tabla, completos.map(aRemoto));
        const parciales = regs.filter((r) => plan.parciales.has(r.id as ID));
        for (let i = 0; i < parciales.length; i += 8) {
          await Promise.all(parciales.slice(i, i + 8).map((r) => subirCambios(tabla, r, plan.parciales.get(r.id as ID)!)));
        }
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
const OMITIBLES = new Set(['academias.color', 'academias.logo', 'academias.mensajes', 'academias.sede_principal', 'usuarios.maestro_id', 'clases.maestro_id', 'clases.curso', 'alumnos.portal', 'productos.opciones', 'academias.recargo_diario', 'academias.meta_diaria', 'academias.salones', 'academias.slug', 'academias.whatsapp', 'academias.pagina', 'pagos.costo', 'alumnos.foto', 'alumnos.avisos', 'gastos.maestro_id', 'gastos_fijos.maestro_id', 'interesados.invito_alumno_id']);

/** Reintenta quitando columnas opcionales que la base aún no tiene. */
async function tolerante(tabla: SyncTable, enviar: (limpiar: (f: Record<string, unknown>) => Record<string, unknown>) => Promise<{ message: string } | null>): Promise<void> {
  const limpiar = (f: Record<string, unknown>) => Object.fromEntries(Object.entries(f).filter(([k]) => !columnasFaltantes.has(`${tabla}.${k}`)));
  for (let intento = 0; intento < OMITIBLES.size + 1; intento++) {
    const error = await enviar(limpiar);
    if (!error) return;
    const col = error.message.match(/Could not find the '(\w+)' column/)?.[1];
    const clave = `${tabla}.${col}`;
    if (!col || !OMITIBLES.has(clave) || columnasFaltantes.has(clave)) throw new Error(`${tabla}: ${error.message}`);
    columnasFaltantes.add(clave);
  }
  // Nunca dar por buena una subida que no se confirmó: la cola se conserva para reintentar
  throw new Error(`${tabla}: no se pudo subir`);
}

async function subirTolerante(tabla: SyncTable, filas: Record<string, unknown>[]): Promise<void> {
  await tolerante(tabla, async (limpiar) => (await supabase!.from(aSnake(tabla)).upsert(filas.map(limpiar), { onConflict: 'id' })).error);
}

/** Solo los campos que cambiaron. Si el registro aún no está en la nube (no lo encontró), sube completo. */
async function subirCambios(tabla: SyncTable, reg: Record<string, unknown>, campos: string[]): Promise<void> {
  let existe = true;
  await tolerante(tabla, async (limpiar) => {
    const { data, error } = await supabase!.from(aSnake(tabla)).update(limpiar(aRemoto(soloCampos(reg, campos)))).eq('id', reg.id as string).select('id');
    if (!error) existe = !!data?.length;
    return error;
  });
  if (!existe) await subirTolerante(tabla, [aRemoto(reg)]);
}

const TRASLAPE_MS = 2 * 60_000;

/** ¿El registro de la nube es igual al del teléfono? (campo por campo de lo que manda la nube) */
function igualQue(remoto: Record<string, unknown>, local: Record<string, unknown>): boolean {
  for (const k in remoto) {
    const a = remoto[k];
    const b = local[k];
    if (a === b || (a == null && b == null)) continue;
    if (typeof a !== 'object' || JSON.stringify(a) !== JSON.stringify(b)) return false;
  }
  return true;
}

/** Lo más que entrega Supabase por consulta. */
const POR_PAGINA = 1000;

/**
 * Baja de la nube lo que cambió. Todas las tablas a la vez (antes iban una tras otra: ~20 idas y vueltas
 * de ~0.12 s aunque no hubiera nada nuevo). Si una falla, las demás terminan y luego se reporta el error.
 */
async function pull(academiaId: ID): Promise<void> {
  if (!supabase) return;
  const r = await Promise.allSettled(SYNC_TABLES.map((t) => bajarTabla(t, academiaId)));
  const falla = r.find((x): x is PromiseRejectedResult => x.status === 'rejected');
  if (falla) throw falla.reason;
}

async function bajarTabla(tabla: SyncTable, academiaId: ID): Promise<void> {
  const claveCursor = `cursor:${tabla}`;
  const claveTraslape = `traslape:${tabla}`;
  const guardado = await getMeta<string>(claveCursor);
  // Traslape: si la vez pasada llegaron cambios nuevos, volver a revisar los 2 min anteriores al cursor.
  // Una subida grande de otro teléfono puede terminar DESPUÉS de que leímos filas más nuevas, dejando
  // filas con hora anterior al cursor. Solo hace falta UNA revisión después de recibir cambios: hacerlo
  // siempre volvía a bajar, en cada sincronización, todo lo de esos 2 minutos (miles de filas tras una
  // carga grande).
  const traslape = guardado && (await getMeta<boolean>(claveTraslape)) !== false;
  let cursor = guardado ? new Date(new Date(guardado).getTime() - (traslape ? TRASLAPE_MS : 0)).toISOString() : '1970-01-01T00:00:00Z';
  const hastaAntes = guardado ? new Date(guardado).getTime() : 0;
  let nuevos = false;
  for (;;) {
    const { data, error } = await supabase!
      .from(aSnake(tabla))
      .select('*')
      .eq(tabla === 'academias' ? 'id' : 'academia_id', academiaId)
      .gt('server_updated_at', cursor)
      .order('server_updated_at', { ascending: true })
      .limit(POR_PAGINA);
    if (error && esTablaFaltante(error.message)) {
      tablasFaltantes.add(tabla);
      return;
    }
    if (error) throw new Error(`${tabla}: ${error.message}`);
    if (!data.length) break;
    if (data.some((r) => new Date(r.server_updated_at as string).getTime() > hastaAntes)) nuevos = true;

    // La nube manda, salvo en lo que este teléfono aún no sube. Revisar la cola y guardar en la misma
    // transacción: un cobro hecho justo en este momento no se puede perder. Lo que llega igual a como ya
    // está no se reescribe (cada escritura hace que las pantallas abiertas vuelvan a calcular).
    await db.transaction('rw', db.table(tabla), db.outbox, async () => {
      const pendientes = new Set((await db.outbox.where('table').equals(tabla).toArray()).map((o) => o.id));
      const remotos = data.map(aLocal).filter((r) => !pendientes.has(r.id as string));
      const locales = (await db.table(tabla).bulkGet(remotos.map((r) => r.id as string))) as (Record<string, unknown> | undefined)[];
      const aGuardar = remotos.filter((r, i) => !locales[i] || !igualQue(r, locales[i]!));
      if (aGuardar.length) await db.table(tabla).bulkPut(aGuardar);
    });

    cursor = data[data.length - 1].server_updated_at as string;
    await setMeta(claveCursor, cursor);
    if (data.length < POR_PAGINA) break;
  }
  await setMeta(claveTraslape, nuevos);
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
      const atrasada = await revisarEsquema();
      setEstado({ fase: 'al-dia', ultimo: Date.now(), error: falta.length ? `Actualiza la base de datos: falta ${falta.join(', ')} (corre supabase/schema.sql)` : atrasada });
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

  // Subir todo solo la PRIMERA vez que se conecta la academia. Al reconectar (sesión vencida) ya está en la
  // nube: subir otra vez todo lo del equipo pisaría con versiones viejas lo que otros cambiaron (y en un
  // equipo con datos viejos los volvería a meter). Lo pendiente ya está en la cola y sube solo.
  if (!(await getMeta<boolean>('nubeVinculada'))) await encolarTodo();
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
  await supabase?.auth.signOut({ scope: 'local' }); // solo este teléfono; los demás siguen conectados
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
  // el registro de cuentas se cierra en Supabase cuando ya no se esperan academias nuevas
  if (/signups? not allowed|signup is disabled/i.test(m)) return 'Por ahora no se pueden crear cuentas nuevas. Si ya tienes cuenta, usa "Ya tengo cuenta"; si no, pide acceso a soporte.';
  return m;
}
