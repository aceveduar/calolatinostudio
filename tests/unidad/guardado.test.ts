// La puerta única de escritura: todo cambio queda guardado Y anotado para subir a la nube.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { actualizar, borrar, crear } from '../../src/db/repo';
import { entradaSinNombre, nuevoYCobrar } from '../../src/domain/rapido';
import { clase, plan } from './fabricas';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

describe('guardar', () => {
  it('crear guarda el registro y lo deja en la cola para subir', async () => {
    const g = await crear('gastos', { concepto: 'Luz', categoria: 'servicios', monto: 50000, fecha: '2026-11-18', fijoId: null, metodo: 'efectivo', notas: '', usuarioId: 'u1' });
    expect(g).toMatchObject({ academiaId: 'a1', deletedAt: null });
    expect(await db.gastos.get(g.id)).toBeTruthy();
    expect((await db.outbox.toArray()).map((o) => o.id)).toEqual([g.id]);
  });

  it('borrar no elimina: marca la baja para que llegue a los otros teléfonos', async () => {
    const g = await crear('gastos', { concepto: 'Luz', categoria: 'servicios', monto: 50000, fecha: '2026-11-18', fijoId: null, metodo: 'efectivo', notas: '', usuarioId: 'u1' });
    await borrar('gastos', g.id);
    expect((await db.gastos.get(g.id))?.deletedAt).toBeTypeOf('number');
    expect(await db.outbox.count()).toBe(2);
  });

  it('actualizar sube la hora de cambio', async () => {
    const g = await crear('gastos', { concepto: 'Luz', categoria: 'servicios', monto: 50000, fecha: '2026-11-18', fijoId: null, metodo: 'efectivo', notas: '', usuarioId: 'u1' });
    await new Promise((r) => setTimeout(r, 5));
    const n = await actualizar('gastos', g.id, { monto: 60000 });
    expect(n.monto).toBe(60000);
    expect(n.updatedAt).toBeGreaterThan(g.updatedAt);
  });
});

describe('entrada por clase suelta', () => {
  it('vincula la clase y el cobro a la ficha solo cuando se registra al alumno', async () => {
    const salsa = clase('salsa-1');
    await db.clases.put(salsa);
    await db.planes.put(plan('suelta'));
    await nuevoYCobrar('Alumno de prueba', salsa, 'u1');
    await entradaSinNombre(salsa, 'u1');

    const [alumno] = await db.alumnos.toArray();
    const entradas = await db.asistencias.where('claseId').equals(salsa.id).toArray();
    expect(entradas).toHaveLength(2);
    expect(entradas.map((a) => a.alumnoId)).toEqual(expect.arrayContaining([alumno.id, null]));
    for (const entrada of entradas) {
      expect(entrada.membresiaId).toBeNull();
      expect(await db.pagos.get(entrada.pagoId!)).toMatchObject({ alumnoId: entrada.alumnoId, monto: 6000 });
    }
  });

  it('si falta tarifa, no guarda una ficha ni un movimiento incompleto', async () => {
    expect(await nuevoYCobrar('Alumno de prueba', clase('salsa-1'), 'u1')).toEqual({ tipo: 'sin-precio' });
    expect(await db.alumnos.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});
