import { describe, expect, it } from 'vitest';
import { estadoMembresia, membresiaQueCubre } from '../../src/domain/membresias';
import { estadoCurso } from '../../src/domain/cursos';
import { asistencia, membresia } from './fabricas';

describe('planes del alumno', () => {
  it('un paquete se acaba al usar sus clases', () => {
    const m = membresia('m1', { clasesTotal: 2 });
    const usadas = [asistencia('a1', { membresiaId: 'm1' }), asistencia('a2', { membresiaId: 'm1' })];
    expect(estadoMembresia(m, usadas.slice(0, 1), '2026-11-10')).toMatchObject({ vigente: true, restantes: 1 });
    expect(estadoMembresia(m, usadas, '2026-11-10')).toMatchObject({ vigente: false, restantes: 0 });
    // una entrada anulada devuelve la clase
    expect(estadoMembresia(m, [usadas[0], { ...usadas[1], anuladaAt: 1 }], '2026-11-10').vigente).toBe(true);
  });

  it('vence después de su fecha de fin', () => {
    const m = membresia('m1');
    expect(estadoMembresia(m, [], '2026-11-30').vigente).toBe(true);
    expect(estadoMembresia(m, [], '2026-12-01').vigente).toBe(false);
  });

  it('usa primero el plan que vence antes', () => {
    const largo = estadoMembresia(membresia('largo', { fin: '2026-12-31' }), [], '2026-11-10');
    const corto = estadoMembresia(membresia('corto', { fin: '2026-11-20' }), [], '2026-11-10');
    expect(membresiaQueCubre([largo, corto], { id: 'c1', disciplinaId: 'salsa', sedeId: null })?.membresia.id).toBe('corto');
  });

  it('un plan de bachata no cubre salsa, y uno por clase solo sus clases', () => {
    const bachata = estadoMembresia(membresia('b', { disciplinaId: 'bachata' }), [], '2026-11-10');
    const porClase = estadoMembresia(membresia('pc', { claseIds: ['c2'] }), [], '2026-11-10');
    expect(membresiaQueCubre([bachata, porClase], { id: 'c1', disciplinaId: 'salsa', sedeId: null })).toBeNull();
    expect(membresiaQueCubre([bachata, porClase], { id: 'c2', disciplinaId: 'salsa', sedeId: null })?.membresia.id).toBe('pc');
  });
});

describe('cursos: quién puede entrar', () => {
  const curso = { inicio: '2026-11-02', fin: '2027-01-25', semanas: 2 };
  it.each([
    ['2026-10-20', 'pronto', true],
    ['2026-11-10', 'iniciando', true],
    ['2026-11-16', 'iniciando', true],
    ['2026-11-17', 'en-curso', false],
    ['2027-02-01', 'por-definir', false],
  ])('el %s el grupo está %s', (dia, tipo, acepta) => {
    expect(estadoCurso(curso, dia)).toMatchObject({ tipo, aceptaNuevos: acepta });
  });
  it('sin curso se entra cuando sea', () => {
    expect(estadoCurso(null, '2026-11-17').aceptaNuevos).toBe(true);
  });
});
