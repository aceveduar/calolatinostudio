import { describe, expect, it } from 'vitest';
import { mismoTelefono } from '../../src/domain/correcciones';

describe('teléfono repetido', () => {
  const lista = [
    { id: 'a', telefono: '55 1234 5678' },
    { id: 'b', telefono: '+52 5512345678' },
    { id: 'c', telefono: '' },
  ];
  it('encuentra a quien ya lo tiene, con o sin lada y espacios', () => {
    expect(mismoTelefono('5512345678', lista).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('no se cuenta a sí mismo al editar, ni avisa con números incompletos', () => {
    expect(mismoTelefono('5512345678', lista, 'a').map((x) => x.id)).toEqual(['b']);
    expect(mismoTelefono('55123', lista)).toEqual([]);
    expect(mismoTelefono('', lista)).toEqual([]);
  });
});
