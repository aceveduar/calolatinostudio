// Índices locales: "quién debe" sin recorrer toda la historia, y siempre al día.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { actualizar, crear } from '../../src/db/repo';
import { asistencia } from './fabricas';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

const deben = () => db.asistencias.where('deuda').equals(1).count();

describe('índice de deudas', () => {
  it('se marca al fiar y se quita al pagar, anular o borrar', async () => {
    const a = await crear('asistencias', { ...asistencia('x', { alumnoId: 'al1', debe: true }), id: undefined } as never);
    expect(await deben()).toBe(1);
    await actualizar('asistencias', a.id, { pagoId: 'p1' });
    expect(await deben()).toBe(0);
    await actualizar('asistencias', a.id, { pagoId: null });
    expect(await deben()).toBe(1);
    await actualizar('asistencias', a.id, { anuladaAt: 5 });
    expect(await deben()).toBe(0);
  });

  it('lo que baja de la nube también queda marcado (sin que la nube conozca el campo)', async () => {
    await db.asistencias.bulkPut([asistencia('n1', { debe: true }), asistencia('n2', { debe: true, pagoId: 'p' }), asistencia('n3')]);
    expect(await deben()).toBe(1);
    // la nube manda la versión pagada: se desmarca
    await db.asistencias.put(asistencia('n1', { debe: true, pagoId: 'p9' }));
    expect(await deben()).toBe(0);
  });

  it('las entradas de un cobro se encuentran por índice', async () => {
    await db.asistencias.bulkPut([asistencia('a', { pagoId: 'p1' }), asistencia('b', { pagoId: 'p1' }), asistencia('c', { pagoId: 'p2' })]);
    expect((await db.asistencias.where('pagoId').equals('p1').toArray()).map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});
