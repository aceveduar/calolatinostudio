import { describe, expect, it } from 'vitest';
import { nombreSaludo, nombresSinRepetir, sinPartirNivel } from '../../src/domain/nombres';

describe('nombres en la cuadrícula de Entrada', () => {
  it('corto si es único; con más apellido solo cuando dos se verían igual', () => {
    const r = nombresSinRepetir([
      { id: '1', nombre: 'Camila Ríos' },
      { id: '2', nombre: 'Camila Ruiz Pérez' },
      { id: '3', nombre: 'Daniel Domínguez' },
      { id: '4', nombre: 'Martín Cruz López' },
      { id: '5', nombre: 'Martín Cruz Méndez' },
      { id: '6', nombre: 'Ana' },
      { id: '7', nombre: 'José Luis Pérez' },
      { id: '8', nombre: 'José Luis Pérez' },
    ]);
    expect(r.get('1')).toBe('Camila Ríos');
    expect(r.get('2')).toBe('Camila Ruiz');
    expect(r.get('3')).toBe('Daniel D.');
    expect(r.get('4')).toBe('Martín Cruz L.');
    expect(r.get('5')).toBe('Martín Cruz M.');
    expect(r.get('6')).toBe('Ana');
    expect(r.get('7')).toBe('José Luis Pérez'); // idénticos: el nombre completo (y su foto o la ficha los distinguen)
  });
});

describe('saludo y nivel', () => {
  it('saluda por el nombre, sin quedarse en el título', () => {
    expect(nombreSaludo('Ana López')).toBe('Ana');
    expect(nombreSaludo('Profe Luis Herrera')).toBe('Profe Luis');
    expect(nombreSaludo('Dirección Calo')).toBe('Dirección Calo');
    expect(nombreSaludo('Monse')).toBe('Monse');
  });
  it('el nivel no se separa del nombre de la clase', () => {
    expect(sinPartirNivel('Contemporáneo 0')).toBe('Contemporáneo 0');
    expect(sinPartirNivel('Salsa en línea 2')).toBe('Salsa en línea 2');
  });
});
