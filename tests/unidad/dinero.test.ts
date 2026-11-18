import { describe, expect, it } from 'vitest';
import { aCentavos, dinero } from '../../src/domain/dinero';
import { resumenCaja } from '../../src/domain/caja';
import { diasEntre, sumarDias, sumarMeses } from '../../src/domain/fechas';
import { pago } from './fabricas';

describe('dinero', () => {
  it('guarda en centavos y muestra en pesos', () => {
    expect(aCentavos('40.50')).toBe(4050);
    expect(aCentavos('$1,200')).toBe(120000);
    expect(aCentavos('abc')).toBe(0);
    expect(aCentavos('0.1')).toBe(10); // sin errores de redondeo
    expect(dinero(6000).replace(/\s/g, '')).toBe('$60');
  });
});

describe('fechas', () => {
  it('suma días cruzando mes y año', () => {
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diasEntre('2026-11-01', '2026-11-30')).toBe(29);
  });
  it('suma meses sin saltarse el fin de mes', () => {
    expect(sumarMeses('2026-01-15', 1)).toBe('2026-02-15');
  });
});

describe('corte de caja', () => {
  it('suma por método y no cuenta los anulados', () => {
    const r = resumenCaja([
      pago('1', 6000),
      pago('2', 65000, { metodo: 'transferencia', concepto: 'Mensualidad' }),
      pago('3', 2000, { metodo: 'tarjeta', productoId: 'agua', concepto: 'Agua' }),
      pago('4', 9999, { anuladoAt: 1 }),
      pago('5', 5000, { deletedAt: 1 }),
    ]);
    expect(r).toMatchObject({ efectivo: 6000, transferencia: 65000, tarjeta: 2000, total: 73000, tienda: 2000, cobros: 3, anulados: 2 });
    expect(r.porConcepto[0]).toEqual({ concepto: 'Mensualidad', cantidad: 1, monto: 65000 });
  });
});
