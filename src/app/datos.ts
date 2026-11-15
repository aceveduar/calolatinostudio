/** Consultas reactivas: la UI se actualiza sola cuando cambia IndexedDB (también tras sincronizar). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Clase, Disciplina, Fecha, ID, Maestro } from '../db/types';
import { estadoMembresia, type EstadoMembresia } from '../domain/membresias';
import { hoy } from '../domain/fechas';
import { existencias, ventasDeProductos } from '../domain/tienda';
import { apartadas, listoParaEntregar } from '../domain/pedidos';

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

export const useDisciplinas = () => useLiveQuery(() => db.disciplinas.filter(vivo).toArray(), [], []);
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
  useLiveQuery(() => db.alumnos.orderBy('nombre').filter(vivo).toArray(), [], []);

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
      const mems = await db.membresias.filter((m) => !m.anuladaAt && !m.deletedAt && m.fin >= dia).toArray();
      const ids = mems.map((m) => m.id);
      const asis = ids.length ? await db.asistencias.where('membresiaId').anyOf(ids).toArray() : [];
      const mapa = new Map<ID, EstadoMembresia[]>();
      for (const m of mems) {
        const e = estadoMembresia(m, asis, dia);
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
