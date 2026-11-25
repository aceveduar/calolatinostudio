import { describe, expect, it } from 'vitest';
import { primerosPasos } from '../../src/domain/primerosPasos';

describe('primeros pasos de una academia nueva', () => {
  const vacia = { clases: 0, planesConPrecio: 0 };
  it('academia vacía: nada hecho, y empieza por las clases', () => {
    const p = primerosPasos(vacia);
    expect(p.filter((x) => x.hecho)).toHaveLength(0);
    expect(p[0].id).toBe('clases');
  });
  it('con clases y sin precios, indica que falta configurar los planes', () => {
    const pendientes = primerosPasos({ ...vacia, clases: 5 }).filter((p) => !p.hecho);
    expect(pendientes.map((p) => p.id)).toEqual(['planes']);
  });
  it('todo listo', () => {
    expect(primerosPasos({ clases: 5, planesConPrecio: 3 }).map(({ id, hecho }) => [id, hecho]))
      .toEqual([['clases', true], ['planes', true]]);
  });
});
