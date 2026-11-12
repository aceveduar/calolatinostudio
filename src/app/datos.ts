/** Consultas reactivas: la UI se actualiza sola cuando cambia IndexedDB (también tras sincronizar). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Clase, Disciplina, Fecha, ID, Maestro } from '../db/types';
import { estadoMembresia, type EstadoMembresia } from '../domain/membresias';
import { hoy } from '../domain/fechas';

const vivo = <T extends { deletedAt: number | null }>(x: T) => !x.deletedAt;

export const useDisciplinas = () => useLiveQuery(() => db.disciplinas.filter(vivo).toArray(), [], []);
export const usePlanes = () => useLiveQuery(() => db.planes.filter(vivo).toArray(), [], []);
export const useMaestros = () =>
  useLiveQuery(async () => (await db.maestros.filter(vivo).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], []);
export const useClases = () => useLiveQuery(() => db.clases.filter(vivo).toArray(), [], []);
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
