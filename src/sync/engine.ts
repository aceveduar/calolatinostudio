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
import { SYNC_TABLES, type Asistencia, type ID, type Pago, type SyncTable } from '../db/types';
import { alCambiarLocal } from './bus';
import { supabase } from './supabase';
import { anotarError } from '../app/errores';
import { avisoEsquema } from './esquema';
import { planearSubida, soloCampos } from './subida';
import { hoy, sumarDias } from '../domain/fechas';

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

/** Avance de la PRIMERA descarga en este equipo (las siguientes solo bajan lo nuevo y no lo necesitan). */
export interface ProgresoDescarga {
  hechos: number;
  total: number;
  inicio: number;
}
let progreso: ProgresoDescarga | null = null;
const subsProgreso = new Set<() => void>();
function setProgreso(p: ProgresoDescarga | null) {
  progreso = p;
  subsProgreso.forEach((s) => s());
}
export function useProgresoDescarga(): ProgresoDescarga | null {
  return useSyncExternalStore(
    (cb) => {
      subsProgreso.add(cb);
      return () => subsProgreso.delete(cb);
    },
    () => progreso,
  );
}
let avance: (n: number) => void = () => {};

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
const OMITIBLES = new Set(['academias.color', 'academias.logo', 'academias.mensajes', 'academias.sede_principal', 'usuarios.maestro_id', 'clases.maestro_id', 'clases.curso', 'alumnos.portal', 'productos.opciones', 'academias.recargo_diario', 'academias.meta_diaria', 'academias.salones', 'academias.slug', 'academias.whatsapp', 'academias.pagina', 'pagos.costo', 'alumnos.foto', 'alumnos.avisos', 'gastos.maestro_id', 'gastos_fijos.maestro_id', 'interesados.invito_alumno_id', 'eventos.en_pagina', 'eventos.en_portal', 'interesados.origen', 'cortes.fondo', 'cortes.salidas', 'gastos.de_caja', 'eventos.vestimenta', 'eventos.lugar', 'eventos.direccion', 'eventos.foto']);

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
/**
 * Teléfono nuevo: las asistencias son la mayor parte (cada entrada a clase es un registro). Para abrir y
 * cobrar bien basta con las recientes (los paquetes cuentan sus clases dentro de su vigencia, y la caja y
 * los reportes de 7 y 30 días usan lo reciente). El historial viejo lo baja la siguiente sincronización,
 * ya con la app abierta: mientras no termine, esta tabla no tiene cursor y Reportes lo avisa.
 */
const DIAS_RECIENTES = 90;
const PRIMERO_RECIENTE: SyncTable = 'asistencias';

async function pull(academiaId: ID, conProgreso = false): Promise<void> {
  if (!supabase) return;
  const desde = sumarDias(hoy(), -DIAS_RECIENTES);
  if (conProgreso) {
    // contar primero (consultas ligeras) para que la pantalla diga "45,000 de 167,000"
    const cuentas = await Promise.all(
      SYNC_TABLES.map(async (t) => {
        let q = supabase!.from(aSnake(t)).select('id', { count: 'exact', head: true }).eq(t === 'academias' ? 'id' : 'academia_id', academiaId);
        if (t === PRIMERO_RECIENTE) q = q.gte('fecha', desde);
        else if (CON_VENTANA.has(t)) q = q.gte('fecha', desdeVentana());
        return (await q).count ?? 0;
      }),
    );
    const p = { hechos: 0, total: cuentas.reduce((a, b) => a + b, 0), inicio: Date.now() };
    setProgreso(p);
    avance = (n) => setProgreso({ ...p, hechos: (p.hechos += n) });
  }
  const r = await Promise.allSettled(SYNC_TABLES.map((t) => (conProgreso && t === PRIMERO_RECIENTE ? bajarRecientes(t, academiaId, desde) : bajarTabla(t, academiaId))));
  avance = () => {};
  if (conProgreso) setProgreso(null);
  const falla = r.find((x): x is PromiseRejectedResult => x.status === 'rejected');
  if (falla) throw falla.reason;
}

/**
 * Lo que vive en el teléfono: de las tablas que crecen sin fin (cada entrada y cada cobro), solo los últimos
 * 18 meses; lo anterior queda en la nube. Alcanza para todo lo que usa la app (cobrar, paquetes, cortes,
 * Reportes con sus 12 meses, archivado, "dejaron de venir"). Lo demás (alumnos, planes, clases…) va completo.
 * A 5 años, sin esto, el teléfono guardaría ~270 MB (ver tools/simular-anios.mjs).
 */
export const VENTANA_DIAS = 540;
const CON_VENTANA = new Set<SyncTable>(['asistencias', 'pagos']);
const desdeVentana = () => sumarDias(hoy(), -VENTANA_DIAS);

/** Páginas que se piden a la vez en la primera descarga. */
const EN_PARALELO = 6;

/**
 * Primera descarga de una tabla en este equipo: varias páginas a la vez en lugar de una tras otra (con
 * 100 mil asistencias eran 100+ idas y vueltas en fila). Se ordena por id, que nunca cambia: si alguien
 * edita un registro mientras tanto, no se mueve de página y no se salta ninguno. Lo que cambie o se cree
 * durante la descarga queda después del corte (la hora más nueva ANTES de empezar) y lo baja la pasada
 * normal que sigue.
 */
async function primeraDescarga(tabla: SyncTable, academiaId: ID): Promise<string | null> {
  const col = tabla === 'academias' ? 'id' : 'academia_id';
  const ultimo = await supabase!.from(aSnake(tabla)).select('server_updated_at').eq(col, academiaId).order('server_updated_at', { ascending: false }).limit(1);
  if (ultimo.error) throw ultimo.error;
  const corte = (ultimo.data?.[0]?.server_updated_at as string | undefined) ?? null;
  if (!corte) return null;
  const ventana = CON_VENTANA.has(tabla) ? desdeVentana() : null;
  let cuenta = supabase!.from(aSnake(tabla)).select('id', { count: 'exact', head: true }).eq(col, academiaId).lte('server_updated_at', corte);
  if (ventana) cuenta = cuenta.gte('fecha', ventana);
  const { count, error } = await cuenta;
  if (error) throw error;
  const paginas = Math.ceil((count ?? 0) / POR_PAGINA);
  let siguiente = 0;
  const trabajador = async () => {
    for (let i = siguiente++; i < paginas; i = siguiente++) {
      let consulta = supabase!.from(aSnake(tabla)).select('*').eq(col, academiaId).lte('server_updated_at', corte);
      if (ventana) consulta = consulta.gte('fecha', ventana);
      const { data, error: e } = await consulta.order('id', { ascending: true }).range(i * POR_PAGINA, (i + 1) * POR_PAGINA - 1);
      if (e) throw new Error(`${tabla}: ${e.message}`);
      if (!data.length) continue;
      await guardarDeLaNube(tabla, data, true);
      avance(data.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, paginas) }, trabajador));
  return corte;
}

/** Solo lo reciente de una tabla (sin cursor: la tabla completa la baja después la sincronización normal). */
async function bajarRecientes(tabla: SyncTable, academiaId: ID, desde: string): Promise<void> {
  const { count, error } = await supabase!.from(aSnake(tabla)).select('id', { count: 'exact', head: true }).eq('academia_id', academiaId).gte('fecha', desde);
  if (error) throw new Error(`${tabla}: ${error.message}`);
  const paginas = Math.ceil((count ?? 0) / POR_PAGINA);
  let siguiente = 0;
  const trabajador = async () => {
    for (let i = siguiente++; i < paginas; i = siguiente++) {
      const { data, error: e } = await supabase!.from(aSnake(tabla)).select('*').eq('academia_id', academiaId).gte('fecha', desde).order('id', { ascending: true }).range(i * POR_PAGINA, (i + 1) * POR_PAGINA - 1);
      if (e) throw new Error(`${tabla}: ${e.message}`);
      if (data.length) await guardarDeLaNube(tabla, data, true);
      avance(data.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, paginas) }, trabajador));
}

/** ¿Ya bajó el historial completo? (en un teléfono nuevo, las asistencias viejas llegan con la app ya abierta) */
export const historialCompleto = async () => !!(await getMeta<string>(`cursor:${PRIMERO_RECIENTE}`)) || !(await getMeta<boolean>('nubeVinculada'));

/** La nube manda, salvo en lo que este teléfono aún no sube (ver bajarTabla). */
async function guardarDeLaNube(tabla: SyncTable, data: Record<string, unknown>[], primera = false) {
  await db.transaction('rw', db.table(tabla), db.outbox, async () => {
    const pendientes = new Set((await db.outbox.where('table').equals(tabla).toArray()).map((o) => o.id));
    const remotos = data.map(aLocal).filter((r) => !pendientes.has(r.id as string));
    // primera descarga: el equipo está vacío, no hay con qué comparar (comparar fila por fila la hacía más lenta)
    if (primera) {
      if (remotos.length) await db.table(tabla).bulkPut(remotos);
      return;
    }
    const locales = (await db.table(tabla).bulkGet(remotos.map((r) => r.id as string))) as (Record<string, unknown> | undefined)[];
    const aGuardar = remotos.filter((r, i) => !locales[i] || !igualQue(r, locales[i]!));
    if (aGuardar.length) await db.table(tabla).bulkPut(aGuardar);
  });
}

async function bajarTabla(tabla: SyncTable, academiaId: ID): Promise<void> {
  const claveCursor = `cursor:${tabla}`;
  const claveTraslape = `traslape:${tabla}`;
  if (!(await getMeta<string>(claveCursor))) {
    try {
      const corte = await primeraDescarga(tabla, academiaId);
      if (corte) {
        await setMeta(claveCursor, corte);
        await setMeta(claveTraslape, true); // una revisión de los 2 min anteriores al corte, por si acaso
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      if (esTablaFaltante(m)) {
        tablasFaltantes.add(tabla);
        return;
      }
      throw e instanceof Error ? e : new Error(`${tabla}: ${m}`);
    }
  }
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
    await guardarDeLaNube(tabla, data);
    avance(data.length);

    cursor = data[data.length - 1].server_updated_at as string;
    await setMeta(claveCursor, cursor);
    if (data.length < POR_PAGINA) break;
  }
  await setMeta(claveTraslape, nuevos);
}

/**
 * Una vez al día: quita del teléfono las entradas y cobros de hace más de 18 meses que YA están en la nube
 * (nada pendiente de subir). En un equipo sin nube no se borra nada: ahí es la única copia.
 */
export async function podar(ahora = new Date()): Promise<number> {
  if (!(await getMeta<boolean>('nubeVinculada'))) return 0;
  const dia = ahora.toISOString().slice(0, 10);
  if ((await getMeta<string>('podadoEl')) === dia) return 0;
  const limite = sumarDias(hoy(), -VENTANA_DIAS);
  let quitados = 0;
  for (const tabla of CON_VENTANA) {
    await db.transaction('rw', db.table(tabla), db.outbox, async () => {
      const pendientes = new Set((await db.outbox.where('table').equals(tabla).toArray()).map((o) => o.id));
      const viejos = (await db.table(tabla).where('fecha').below(limite).primaryKeys()) as string[];
      const aQuitar = viejos.filter((id) => !pendientes.has(id));
      if (aQuitar.length) await db.table(tabla).bulkDelete(aQuitar);
      quitados += aQuitar.length;
    });
  }
  await setMeta('podadoEl', dia);
  return quitados;
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
      await podar();
      // Solo avisar si algo quedó esperando por la base vieja (si no hay nada de la tienda, no molestar)
      const esperando = await db.outbox.count();
      const falta = esperando ? [...tablasFaltantes, ...columnasFaltantes] : [...columnasFaltantes];
      const atrasada = await revisarEsquema();
      setEstado({ fase: 'al-dia', ultimo: Date.now(), error: falta.length ? `Actualiza la base de datos: falta ${falta.join(', ')} (corre supabase/schema.sql)` : atrasada });
    } catch (e) {
      if (navigator.onLine) anotarError(e, 'sincronización');
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
  await pull(data.academia_id as ID, true);
  await setMeta('nubeVinculada', true);
  await setMeta('academiaId', data.academia_id);
  setEstado({ fase: 'al-dia', ultimo: Date.now() });
  // el historial viejo de asistencias: ya con la app abierta, sin esperar al siguiente minuto
  setTimeout(() => void sincronizar(), 1500);
}


/**
 * Teléfono perdido o robado, o alguien que deja de trabajar ahí: cierra la sesión de la nube en TODOS los
 * equipos (también en este). Cada uno deja de respaldar hasta que alguien vuelva a conectarlo con el correo y
 * la contraseña de la academia; si alguien más sabía la contraseña, conviene cambiarla.
 */
export async function cerrarSesionEnTodos(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw new Error(traducirError(error.message));
  setEstado({ fase: 'desconectada', error: null });
}

/** Si en este teléfono le falta historial a alguien dado de alta hace más de 18 meses (y hay nube para pedírselo). */
export async function puedeVerAnterior(alumnoCreadoEn: number): Promise<boolean> {
  return !!supabase && !!(await getMeta<boolean>('nubeVinculada')) && alumnoCreadoEn < Date.now() - VENTANA_DIAS * 86400000;
}

/**
 * Lo de un alumno de hace más de 18 meses (sus clases y sus pagos): ya no vive en el teléfono, se pide a la nube
 * al verlo y no se guarda. La nube solo deja ver lo de esta academia (RLS).
 */
export async function historialAnterior(alumnoId: ID): Promise<{ pagos: Pago[]; asistencias: Asistencia[] }> {
  if (!supabase) throw new Error('Esta instalación no tiene nube.');
  if (!navigator.onLine) throw new Error('Necesitas internet para ver el historial anterior.');
  const antes = desdeVentana();
  const pedir = (t: 'pagos' | 'asistencias') => supabase!.from(t).select('*').eq('alumno_id', alumnoId).lt('fecha', antes).order('fecha', { ascending: false }).limit(1000);
  const [p, a] = await Promise.all([pedir('pagos'), pedir('asistencias')]);
  const error = p.error ?? a.error;
  if (error) throw new Error(traducirError(error.message));
  const vivos = <T,>(filas: Record<string, unknown>[] | null) => (filas ?? []).map(aLocal).filter((f) => !f.deletedAt) as T[];
  return { pagos: vivos<Pago>(p.data), asistencias: vivos<Asistencia>(a.data).filter((x) => !x.anuladaAt) };
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
