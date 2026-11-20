import { describe, expect, it } from 'vitest';
import { primerosPasos } from '../../src/domain/primerosPasos';

describe('primeros pasos de una academia nueva', () => {
  const vacia = { logo: false, clases: 0, clasesSinMaestro: 0, planesConPrecio: 0, recepcion: 0, alumnos: 0, nube: false, pagina: false };
  it('academia vacía: nada hecho, y empieza por las clases', () => {
    const p = primerosPasos(vacia);
    expect(p.filter((x) => x.hecho)).toHaveLength(0);
    expect(p[0].id).toBe('clases');
  });
  it('se palomea solo con lo que ya existe; maestros cuenta hasta que todas las clases tengan', () => {
    const p = primerosPasos({ ...vacia, clases: 5, clasesSinMaestro: 2, planesConPrecio: 3 });
    expect(p.find((x) => x.id === 'clases')!.hecho).toBe(true);
    expect(p.find((x) => x.id === 'planes')!.hecho).toBe(true);
    expect(p.find((x) => x.id === 'maestros')!.hecho).toBe(false);
  });
  it('todo listo', () => {
    expect(primerosPasos({ logo: true, clases: 5, clasesSinMaestro: 0, planesConPrecio: 3, recepcion: 1, alumnos: 40, nube: true, pagina: true }).every((x) => x.hecho)).toBe(true);
  });
});
