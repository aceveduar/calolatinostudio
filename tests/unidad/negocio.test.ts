import { describe, expect, it } from 'vitest';
import { rentabilidadPorClase } from '../../src/domain/rentabilidad';
import { deudores, porRenovar } from '../../src/domain/pendientes';
import { alumno, asistencia, clase, fijo, gasto, membresia, pago, plan } from './fabricas';

describe('lo que deja cada clase', () => {
  const clases = [clase('c1', { maestroId: 'luis' }), clase('c2', { maestroId: 'luis' })];

  it('reparte la mensualidad entre las clases que tomó y el pago del maestro por sesiones', () => {
    const r = rentabilidadPorClase({
      mes: '2026-11',
      clases,
      // c1: 2 sesiones (una con mensualidad); c2: 1 sesión con clase suelta
      asistencias: [
        asistencia('a1', { claseId: 'c1', fecha: '2026-11-02', membresiaId: 'm1' }),
        asistencia('a2', { claseId: 'c1', fecha: '2026-11-04', pagoId: 'ps' }),
        asistencia('a3', { claseId: 'c2', fecha: '2026-11-05', membresiaId: 'm1' }),
      ],
      membresias: [membresia('m1', { pagoId: 'pm' })],
      pagos: [pago('pm', 60000), pago('ps', 6000)],
      gastos: [gasto('g1', 300000, { maestroId: 'luis' })],
      rentas: [],
    });
    const c1 = r.filas.find((f) => f.clase.id === 'c1')!;
    const c2 = r.filas.find((f) => f.clase.id === 'c2')!;
    // mensualidad $600 / 2 clases tomadas = $300 cada una
    expect(c1.ingresos).toBe(30000 + 6000);
    expect(c2.ingresos).toBe(30000);
    // $3,000 del maestro: 2/3 a c1, 1/3 a c2
    expect(c1.costo).toBe(200000);
    expect(c2.costo).toBe(100000);
    expect(c1.ganancia).toBe(36000 - 200000);
    expect(r.sinAsignar).toBe(0);
  });

  it('si aún no se le paga al maestro este mes, estima con su pago fijo', () => {
    const r = rentabilidadPorClase({
      mes: '2026-11',
      clases: [clases[0]],
      asistencias: [asistencia('a1', { claseId: 'c1', pagoId: 'ps' })],
      membresias: [],
      pagos: [pago('ps', 6000)],
      gastos: [],
      fijos: [fijo('f1', 400000, { maestroId: 'luis' })],
      rentas: [],
    });
    expect(r.filas[0]).toMatchObject({ costo: 400000, estimado: true, sinCosto: false });
  });

  it('los cobros anulados no cuentan como ingreso', () => {
    const r = rentabilidadPorClase({
      mes: '2026-11',
      clases: [clase('c1')],
      asistencias: [asistencia('a1', { pagoId: 'ps' })],
      membresias: [],
      pagos: [pago('ps', 6000, { anuladoAt: 1 })],
      gastos: [],
      rentas: [],
    });
    expect(r.filas[0].ingresos).toBe(0);
  });
});

describe('pendientes de recepción', () => {
  const planes = [plan('mensual', { tipo: 'mensual', precio: 65000, clases: null, vigenciaDias: 30 }), plan('beca', { tipo: 'mensual', precio: 0, clases: null })];
  const alumnos = new Map([['al1', alumno('al1')]]);

  it('avisa 3 días antes y hasta una semana después de vencer', () => {
    const m = membresia('m1', { fin: '2026-11-20' });
    const ver = (hoy: string) => porRenovar({ mems: [m], alumnos, planes, hoy }).length;
    expect(ver('2026-11-16')).toBe(0);
    expect(ver('2026-11-17')).toBe(1);
    expect(ver('2026-11-27')).toBe(1);
    expect(ver('2026-11-28')).toBe(0);
  });

  it('no avisa si ya renovó, si es beca o si ya se le escribió', () => {
    const m = membresia('m1', { fin: '2026-11-20' });
    const hoy = '2026-11-19';
    expect(porRenovar({ mems: [m, membresia('m2', { fin: '2026-12-20' })], alumnos, planes, hoy })).toHaveLength(0);
    expect(porRenovar({ mems: [{ ...m, planId: 'beca' }], alumnos, planes, hoy })).toHaveLength(0);
    const avisado = new Map([['al1', alumno('al1', { avisos: { 'vence:m1': 1 } })]]);
    expect(porRenovar({ mems: [m], alumnos: avisado, planes, hoy })).toHaveLength(0);
  });

  it('suma lo que debe cada quien y lo oculta 3 días después de recordarle', () => {
    const suelta = [plan('suelta', { precio: 6000 })];
    const fiado = [asistencia('a1', { alumnoId: 'al1', debe: true }), asistencia('a2', { alumnoId: 'al1', debe: true }), asistencia('a3', { alumnoId: 'al1', debe: true, pagoId: 'p' })];
    const ahora = Date.UTC(2026, 10, 18);
    expect(deudores({ asistencias: fiado, alumnos, clases: [clase('c1')], planes: suelta, ahora })[0]).toMatchObject({ clases: 2, total: 12000 });
    const recordado = new Map([['al1', alumno('al1', { avisos: { adeudo: ahora - 86_400_000 } })]]);
    expect(deudores({ asistencias: fiado, alumnos: recordado, clases: [clase('c1')], planes: suelta, ahora })).toHaveLength(0);
  });
});
