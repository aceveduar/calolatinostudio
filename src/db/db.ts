import Dexie, { type EntityTable } from 'dexie';
import type {
  Academia,
  Alumno,
  Asistencia,
  Clase,
  Corte,
  Disciplina,
  Maestro,
  Membresia,
  Meta,
  OutboxItem,
  Pago,
  Plan,
  Producto,
  Sede,
  Usuario,
} from './types';

/** Base de datos local (IndexedDB). La app siempre lee y escribe aquí primero. */
export class CompasDB extends Dexie {
  academias!: EntityTable<Academia, 'id'>;
  usuarios!: EntityTable<Usuario, 'id'>;
  disciplinas!: EntityTable<Disciplina, 'id'>;
  maestros!: EntityTable<Maestro, 'id'>;
  clases!: EntityTable<Clase, 'id'>;
  planes!: EntityTable<Plan, 'id'>;
  productos!: EntityTable<Producto, 'id'>;
  sedes!: EntityTable<Sede, 'id'>;
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

    // v2: maestros como catálogo. El texto libre de cada clase se convierte en un maestro.
    this.version(2)
      .stores({
        maestros: 'id, academiaId',
        clases: 'id, academiaId, disciplinaId, maestroId',
      })
      .upgrade(async (tx) => {
        const ahora = Date.now();
        const porNombre = new Map<string, string>();
        await tx
          .table('clases')
          .toCollection()
          .modify((c: Clase & { maestro?: string }) => {
            const crudo = (c.maestro ?? '').trim().replace(/\s+/g, ' ');
            // "profe luis" → "Profe Luis" (solo si venía todo en minúsculas)
            const nombre = crudo === crudo.toLowerCase() ? crudo.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : crudo;
            let maestroId: string | null = null;
            if (nombre) {
              const clave = `${c.academiaId}:${nombre.toLowerCase()}`;
              maestroId = porNombre.get(clave) ?? crypto.randomUUID();
              if (!porNombre.has(clave)) {
                porNombre.set(clave, maestroId);
                void tx.table('maestros').add({ id: maestroId, academiaId: c.academiaId, nombre, telefono: '', notas: '', activo: true, createdAt: ahora, updatedAt: ahora, deletedAt: null });
                void tx.table('outbox').add({ table: 'maestros', id: maestroId, at: ahora });
              }
            }
            c.maestroId = maestroId;
            c.updatedAt = ahora;
            void tx.table('outbox').add({ table: 'clases', id: c.id, at: ahora });
          });
      });

    // v3: tienda (productos) y ventas ligadas a producto
    this.version(3).stores({
      productos: 'id, academiaId',
      pagos: 'id, academiaId, fecha, alumnoId, productoId',
    });

    // v4: sedes (lugares). Lo existente queda en la sede principal (sedeId vacío): no hay que migrar nada.
    this.version(4).stores({ sedes: 'id, academiaId' });
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
