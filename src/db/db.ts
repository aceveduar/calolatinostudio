import Dexie, { type EntityTable } from 'dexie';
import type {
  Academia,
  Alumno,
  Asistencia,
  Clase,
  Corte,
  Disciplina,
  Membresia,
  Meta,
  OutboxItem,
  Pago,
  Plan,
  Usuario,
} from './types';

/** Base de datos local (IndexedDB). La app siempre lee y escribe aquí primero. */
export class CompasDB extends Dexie {
  academias!: EntityTable<Academia, 'id'>;
  usuarios!: EntityTable<Usuario, 'id'>;
  disciplinas!: EntityTable<Disciplina, 'id'>;
  clases!: EntityTable<Clase, 'id'>;
  planes!: EntityTable<Plan, 'id'>;
  alumnos!: EntityTable<Alumno, 'id'>;
  membresias!: EntityTable<Membresia, 'id'>;
  pagos!: EntityTable<Pago, 'id'>;
  asistencias!: EntityTable<Asistencia, 'id'>;
  cortes!: EntityTable<Corte, 'id'>;
  outbox!: EntityTable<OutboxItem, 'seq'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor() {
    super('compas');
    this.version(1).stores({
      academias: 'id',
      usuarios: 'id, academiaId',
      disciplinas: 'id, academiaId',
      clases: 'id, academiaId, disciplinaId',
      planes: 'id, academiaId',
      alumnos: 'id, academiaId, nombre, codigo',
      membresias: 'id, academiaId, alumnoId, fin',
      pagos: 'id, academiaId, fecha, alumnoId',
      asistencias: 'id, academiaId, fecha, alumnoId, membresiaId, [claseId+fecha]',
      cortes: 'id, academiaId, fecha',
      outbox: '++seq, table, id',
      meta: 'key',
    });
  }
}

export const db = new CompasDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Pide al navegador no borrar los datos locales (importante en iOS). */
export async function pedirAlmacenamientoPersistente(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* no soportado */
  }
}
