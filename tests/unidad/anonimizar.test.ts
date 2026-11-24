// Derecho de cancelación: se borran los datos personales del alumno, pero sus pagos y entradas se quedan.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { borrar, crear } from '../../src/db/repo';
import { NOMBRE_ANONIMO, anonimizarAlumno, reactivarAlumno } from '../../src/domain/correcciones';
import type { Alumno, Pago } from '../../src/db/types';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

describe('borrar los datos personales de un alumno', () => {
  it('quita nombre, teléfono, foto, notas, portal y código; los pagos se quedan', async () => {
    const a = await crear('alumnos', { nombre: 'Ana López', telefono: '5512345678', notas: 'lesión', codigo: 'K7P2QX', activo: true, foto: 'data:image/jpeg;base64,x', portal: 'tokenSecretoDeVeinteChars', avisos: null } as unknown as Omit<Alumno, 'id' | 'academiaId' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
    await crear('pagos', { alumnoId: a.id, planId: null, concepto: 'Mensualidad', monto: 40000, metodo: 'efectivo', usuarioId: 'u1', fecha: '2026-11-01', anuladoAt: null, anuladoMotivo: null, anuladoPor: null } as unknown as Omit<Pago, 'id' | 'academiaId' | 'createdAt' | 'updatedAt' | 'deletedAt'>);
    await anonimizarAlumno(a.id);
    const x = (await db.alumnos.get(a.id))!;
    expect(x.nombre).toBe(NOMBRE_ANONIMO);
    expect([x.telefono, x.notas, x.foto, x.portal, x.activo]).toEqual(['', '', null, null, false]);
    expect(x.codigo).not.toBe('K7P2QX'); // su credencial anterior deja de servir
    expect(await db.pagos.where('alumnoId').equals(a.id).count()).toBe(1); // la caja sigue cuadrando
    expect(await db.outbox.where('id').equals(a.id).count()).toBeGreaterThan(0); // y se sube a la nube
    await expect(reactivarAlumno(a.id)).rejects.toThrow('Esta ficha ya no está disponible');
  });
});

describe('reactivar la ficha original', () => {
  it('conserva la identidad y el vínculo al historial aunque se solicite dos veces', async () => {
    const baja = await crear('alumnos', { nombre: 'Ana López', telefono: '5512345678', notas: '', codigo: 'K7P2QX', activo: false, portal: 'tokenSecretoDeVeinteChars' });
    const activadas = await Promise.all([reactivarAlumno(baja.id), reactivarAlumno(baja.id)]);
    for (const ficha of activadas) {
      expect(ficha).toMatchObject({ id: baja.id, codigo: baja.codigo, portal: baja.portal, activo: true });
    }
    expect(await db.alumnos.count()).toBe(1);
    await borrar('alumnos', baja.id);
    await expect(reactivarAlumno(baja.id)).rejects.toThrow('Esta ficha ya no está disponible');
  });
});
