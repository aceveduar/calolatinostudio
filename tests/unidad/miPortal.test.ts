import { describe, expect, it } from 'vitest';
import { insignias, mensajeRenovar, proximaClase, racha, restante, semana, type ClaseHorario } from '../../src/domain/miPortal';

const salsa: ClaseHorario = { clase: 'Salsa 1', color: '#e00', dias: [1, 3], hora: '19:00', duracion: 60 };
const bachata: ClaseHorario = { clase: 'Bachata 0', color: '#70f', dias: [3], hora: '20:00', duracion: 60 };
// 2026-11-18 es miércoles
const a = (hhmm: string, dia = '2026-11-18') => new Date(`${dia}T${hhmm}:00`);

describe('tu próxima clase', () => {
  it('hoy, con cuánto falta', () => {
    expect(proximaClase([salsa, bachata], a('17:30'))).toMatchObject({ clase: salsa, estado: 'hoy', faltan: 90, texto: 'Hoy · en 1 h 30 min' });
  });
  it('la que está en curso cuenta como "ahora"', () => {
    expect(proximaClase([salsa, bachata], a('19:20'))).toMatchObject({ clase: salsa, estado: 'ahora' });
  });
  it('si ya pasaron las de hoy, la siguiente de la semana', () => {
    expect(proximaClase([salsa, bachata], a('21:30'))).toMatchObject({ clase: salsa, enDias: 5, texto: 'Lunes a las 19:00' });
    expect(proximaClase([salsa], a('21:30', '2026-11-16'))).toMatchObject({ enDias: 2, texto: 'Miércoles a las 19:00' });
    expect(proximaClase([{ ...salsa, dias: [4] }], a('21:30'))).toMatchObject({ enDias: 1, texto: 'Mañana a las 19:00' });
  });
  it('sin horario no inventa nada', () => {
    expect(proximaClase([], a('10:00'))).toBeNull();
  });
  it('la semana ordenada de lunes a domingo', () => {
    expect(semana([bachata, salsa]).map((d) => `${d.dia}:${d.clases.map((c) => c.clase).join('+')}`)).toEqual(['Lun:Salsa 1', 'Mié:Salsa 1+Bachata 0']);
  });
});

describe('racha de semanas', () => {
  it('cuenta semanas seguidas aunque esta semana aún no venga', () => {
    expect(racha(['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-19'], '2026-11-18')).toBe(3);
    expect(racha(['2026-11-09', '2026-11-02'], '2026-11-18')).toBe(2);
  });
  it('se rompe si faltó una semana completa', () => {
    expect(racha(['2026-11-02'], '2026-11-18')).toBe(0);
  });
});

describe('insignias', () => {
  it('las ganadas y lo que falta para la siguiente', () => {
    expect(insignias(0)).toMatchObject({ ganadas: [], faltan: 1 });
    const r = insignias(24);
    expect(r.ganadas.map((i) => i.meta)).toEqual([1, 10]);
    expect(r).toMatchObject({ faltan: 1, siguiente: { meta: 25 } });
    expect(insignias(500)).toMatchObject({ siguiente: null, avance: 1 });
  });
});

describe('lo que le queda del plan', () => {
  it('paquete: por clases; urgente con 1', () => {
    expect(restante({ plan: 'P', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: 8, usadas: 7 }, '2026-11-18')).toMatchObject({ valor: 1, unidad: 'clase', urgente: true });
  });
  it('mensualidad: por días', () => {
    expect(restante({ plan: 'M', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: null, usadas: 12 }, '2026-11-18')).toMatchObject({ valor: 12, unidad: 'días', urgente: false });
    expect(restante({ plan: 'M', beca: false, inicio: '2026-11-01', fin: '2026-11-20', clases: null, usadas: 0 }, '2026-11-18')).toMatchObject({ valor: 2, urgente: true });
  });
  it('mensaje para renovar con su código', () => {
    expect(mensajeRenovar('Ana López', 'K7P2QX', 'Paquete 8 clases')).toBe('Hola, soy Ana López (código K7P2QX). Quiero renovar mi Paquete 8 clases. ¿Me ayudan?');
  });
});

describe('eventos en el portal', () => {
  it('el mensaje dice quién es, qué evento y cuándo', async () => {
    const { mensajeEvento } = await import('../../src/domain/miPortal');
    expect(mensajeEvento('Ana López', 'K7P2QX', { nombre: 'Social de salsa', fecha: '2026-11-28', hora: '21:00' })).toBe(
      'Hola, soy Ana López (código K7P2QX). Quiero ir a Social de salsa (sábado 28 de noviembre, 21:00). ¿Me apartan lugar?',
    );
  });
  it('cuánto falta', async () => {
    const { faltaParaEvento } = await import('../../src/domain/miPortal');
    expect(faltaParaEvento('2026-11-19', '2026-11-19')).toBe('Hoy');
    expect(faltaParaEvento('2026-11-19', '2026-11-20')).toBe('Mañana');
    expect(faltaParaEvento('2026-11-19', '2026-11-24')).toBe('En 5 días');
    expect(faltaParaEvento('2026-11-19', '2026-12-24')).toBeNull();
  });
});
