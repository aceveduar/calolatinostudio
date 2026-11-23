/** Consultas reactivas: la UI se actualiza sola cuando cambia IndexedDB (también tras sincronizar). */
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '../db/db';
import type { Asistencia, Clase, Disciplina, Fecha, ID, Maestro } from '../db/types';
import { estadoMembresia, type EstadoMembresia } from '../domain/membresias';
import { hoy } from '../domain/fechas';
import { existencias, ventasDeProductos } from '../domain/tienda';
import { apartadas, listoParaEntregar } from '../domain/pedidos';

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

// por nombre: en listas y selectores se encuentran solas (antes salían en el orden de su id, sin sentido)
export const useDisciplinas = () =>
  useLiveQuery(async () => (await db.disciplinas.filter(vivo).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [], []);
export const usePlanes = () => useLiveQuery(() => db.planes.filter(vivo).toArray(), [], []);
export const useMaestros = () =>
  useLiveQuery(async () => (await db.maestros.filter(vivo).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], []);
export const useProductos = () =>
  useLiveQuery(async () => (await db.productos.filter(vivo).toArray()).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)), [], []);

/** Piezas disponibles por producto (se recalcula con cada venta, en cualquier equipo). */
export function useExistencias() {
  return useLiveQuery(
    async () => {
      const [productos, ventas, pedidos] = await Promise.all([db.productos.toArray(), ventasDeProductos(), db.pedidos.where('estado').equals('pendiente').toArray()]);
      // lo apartado desde el portal no se puede vender a otro
      const reservado = apartadas(pedidos);
      return new Map(
        productos.map((p) => {
          const n = existencias(p, ventas);
          return [p.id, n === null ? null : n - (reservado.get(p.id) ?? 0)];
        }),
      );
    },
    [],
    new Map<ID, number | null>(),
  );
}
export const useClases = () => useLiveQuery(() => db.clases.filter(vivo).toArray(), [], []);
export const useRentas = () =>
  useLiveQuery(async () => (await db.rentas.filter(vivo).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], []);
export const useUsuarios = () => useLiveQuery(() => db.usuarios.filter(vivo).toArray(), [], []);
export const useAlumnos = () =>
  useLiveQuery(async () => (await db.alumnos.orderBy('nombre').toArray()).filter(vivo), [], []); // de una sola lectura (5,000 alumnos)

export function nombreClase(c: Clase | undefined, disciplinas: Disciplina[]): string {
  if (!c) return 'Clase';
  const d = disciplinas.find((x) => x.id === c.disciplinaId);
  return `${d?.nombre ?? 'Clase'} ${c.nivel}`.trim();
}

export function nombreMaestro(c: Pick<Clase, 'maestroId'> | undefined, maestros: Maestro[]): string {
  return maestros.find((m) => m.id === c?.maestroId)?.nombre ?? '';
}

export function colorClase(c: Clase | undefined, disciplinas: Disciplina[]): string {
  return disciplinas.find((x) => x.id === c?.disciplinaId)?.color ?? '#6e6a7c';
}

/** Estados de membresía de todos los alumnos (para semáforos en listas). */
export function useEstadosPorAlumno(dia: Fecha = hoy()) {
  return useLiveQuery(
    async () => {
      // con índice (fin) y agrupando las entradas por plan en una sola pasada: con miles de planes vigentes,
      // revisar todas las entradas por cada plan eran millones de comparaciones después de cada cobro
      const mems = await db.membresias.where('fin').aboveOrEqual(dia).filter((m) => !m.anuladaAt && !m.deletedAt).toArray();
      // Solo los paquetes (clases contadas) necesitan sus entradas: las mensualidades valen por fecha.
      // Una sola lectura por fecha desde el paquete más antiguo; pedir las entradas plan por plan
      // (anyOf con miles de ids) eran miles de viajes a la base: ~18 s con 5,000 alumnos.
      const paquetes = new Set(mems.filter((m) => m.clasesTotal !== null).map((m) => m.id));
      const desde = mems.filter((m) => paquetes.has(m.id)).reduce((min, m) => (m.inicio < min ? m.inicio : min), dia);
      const asis = paquetes.size ? await db.asistencias.where('fecha').aboveOrEqual(desde).toArray() : [];
      const porPlan = new Map<ID, Asistencia[]>();
      for (const a of asis) if (a.membresiaId && paquetes.has(a.membresiaId)) (porPlan.get(a.membresiaId) ?? porPlan.set(a.membresiaId, []).get(a.membresiaId)!).push(a);
      const mapa = new Map<ID, EstadoMembresia[]>();
      for (const m of mems) {
        const e = estadoMembresia(m, porPlan.get(m.id) ?? [], dia);
        const arr = mapa.get(m.alumnoId) ?? [];
        arr.push(e);
        mapa.set(m.alumnoId, arr);
      }
      return mapa;
    },
    [dia],
    new Map<ID, EstadoMembresia[]>(),
  );
}

export function useEstadosDeAlumno(alumnoId: ID | undefined, dia: Fecha = hoy()) {
  return useLiveQuery(
    async () => {
      if (!alumnoId) return [];
      const mems = await db.membresias.where('alumnoId').equals(alumnoId).filter((m) => !m.anuladaAt && !m.deletedAt).toArray();
      const asis = await db.asistencias.where('alumnoId').equals(alumnoId).toArray();
      return mems.map((m) => estadoMembresia(m, asis, dia)).sort((a, b) => (a.membresia.fin < b.membresia.fin ? 1 : -1));
    },
    [alumnoId, dia],
    [] as EstadoMembresia[],
  );
}

/** Apartados pendientes de recoger, con producto y alumno. */
export function usePedidosPendientes() {
  return useLiveQuery(
    async () => {
      // por recoger: apartados en existencia pendientes y encargos que ya llegaron
      const pedidos = (await db.pedidos.where('estado').anyOf('pendiente', 'llego').filter(vivo).toArray()).sort((a, b) => a.createdAt - b.createdAt);
      const [productos, alumnos] = await Promise.all([db.productos.bulkGet(pedidos.map((p) => p.productoId)), db.alumnos.bulkGet(pedidos.map((p) => p.alumnoId))]);
      return pedidos
        .map((pedido, i) => ({ pedido, producto: productos[i], alumno: alumnos[i] }))
        .filter((x) => listoParaEntregar(x.pedido, x.producto));
    },
    [],
    [],
  );
}

/** Días sin venir (y sin plan vigente) para que un alumno pase a "archivado": sale de la lista, no se borra. */
export const DIAS_ARCHIVO = 180;

/**
 * Quiénes vinieron desde una fecha: se lee solo el índice [fecha+alumnoId] (no cada entrada completa),
 * así es rápido aunque haya cientos de miles de entradas.
 */
export function useVinieronDesde(desde: Fecha) {
  return useLiveQuery(
    async () => {
      const llaves = (await db.asistencias.where('[fecha+alumnoId]').between([desde, Dexie.minKey], [Dexie.maxKey, Dexie.maxKey]).keys()) as unknown as [string, string][];
      return new Set(llaves.map((k) => k[1]));
    },
    [desde],
    null as Set<ID> | null,
  );
}
