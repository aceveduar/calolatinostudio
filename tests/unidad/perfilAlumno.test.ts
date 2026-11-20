import { describe, expect, it } from 'vitest';
import { perfilAlumno } from '../../src/domain/perfilAlumno';
import type { Asistencia, Pago } from '../../src/db/types';

const a = (fecha: string, claseId = 'lady', extra: Partial<Asistencia> = {}) => ({ id: fecha + claseId, fecha, claseId, anuladaAt: null, deletedAt: null, ...extra }) as Asistencia;
const p = (fecha: string, monto: number, extra: Partial<Pago> = {}) => ({ id: fecha + monto, fecha, monto, anuladoAt: null, deletedAt: null, ...extra }) as Pago;

describe('perfil del alumno (su ficha de un vistazo)', () => {
  it('desde cuándo, cada cuánto, su clase y día, y lo pagado en el año', () => {
    // sábados (2026-11-14, 10-31, 10-17, 10-03…) a Lady Style; una vez a Salsa
    const r = perfilAlumno({
      asistencias: [a('2026-11-14'), a('2026-10-31'), a('2026-10-17'), a('2026-10-03'), a('2026-09-05'), a('2026-08-22', 'salsa'), a('2025-05-31'), a('2026-11-07', 'lady', { anuladaAt: 1 })],
      pagos: [p('2026-11-14', 30000), p('2026-10-10', 30000), p('2025-05-30', 30000), p('2026-09-01', 30000, { anuladoAt: 5 })],
      altaEn: new Date('2025-05-30T12:00:00').getTime(),
      hoy: '2026-11-20',
    });
    expect(r.desde).toBe('2025-05-30'); // se dio de alta antes de su primera clase
    expect(r.porMes).toBe(2); // 6 entradas en los últimos 90 días → ~2 al mes (la anulada no cuenta)
    expect(r.clase).toEqual({ id: 'lady', veces: 6 });
    expect(r.dia).toBe(6); // sábado
    expect(r.pagadoAnio).toBe(60000); // sin el de hace más de un año ni el anulado
  });

  it('alguien que nunca ha venido: desde su alta y sin clase ni día', () => {
    const r = perfilAlumno({ asistencias: [], pagos: [], altaEn: new Date('2026-11-01T10:00:00').getTime(), hoy: '2026-11-20' });
    expect(r).toEqual({ desde: '2026-11-01', porMes: 0, clase: null, dia: null, pagadoAnio: 0 });
  });
});
