// Cambios de dos teléfonos sobre el mismo registro: cada uno sube solo lo que cambió.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { actualizar, crear } from '../../src/db/repo';
import { planearSubida, soloCampos } from '../../src/sync/subida';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

describe('qué se sube', () => {
  it('un alta sube completo; un cambio, solo sus campos', async () => {
    const al = await crear('alumnos', { nombre: 'Ana', telefono: '5511112222', activo: true } as never);
    await db.outbox.clear(); // como si el alta ya hubiera subido
    await actualizar('alumnos', al.id, { avisos: { adeudo: 1 } } as never);
    await actualizar('alumnos', al.id, { nombre: 'Ana López', telefono: '5511112222' } as never); // el teléfono no cambió
    const plan = planearSubida(await db.outbox.toArray());
    expect(plan.completos.size).toBe(0);
    expect(plan.parciales.get(al.id)?.sort()).toEqual(['avisos', 'nombre']);
  });

  it('si el alta aún no sube, va completo aunque luego se haya cambiado', async () => {
    const al = await crear('alumnos', { nombre: 'Ana', telefono: '5511112222', activo: true } as never);
    await actualizar('alumnos', al.id, { nombre: 'Ana López' } as never);
    const plan = planearSubida(await db.outbox.toArray());
    expect([...plan.completos]).toEqual([al.id]);
    expect(plan.parciales.size).toBe(0);
  });

  it('el envío parcial lleva la hora del cambio y manda null lo que se quitó', () => {
    expect(soloCampos({ id: 'x', nombre: 'Ana', telefono: '55', foto: undefined, updatedAt: 9 }, ['nombre', 'foto'])).toEqual({ updatedAt: 9, nombre: 'Ana', foto: null });
  });
});
