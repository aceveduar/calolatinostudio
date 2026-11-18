// La puerta única de escritura: todo cambio queda guardado Y anotado para subir a la nube.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { actualizar, borrar, crear } from '../../src/db/repo';

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
