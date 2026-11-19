// Resumen por mes de Reportes: se guarda para meses cerrados y se borra solo si cambia algo de ese mes.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, getMeta, setMeta } from '../../src/db/db';
import { actualizar, crear } from '../../src/db/repo';
import { resumenMes } from '../../src/app/resumenMeses';
import type { Pago } from '../../src/db/types';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

const pago = (fecha: string, monto: number) =>
  crear('pagos', { alumnoId: null, planId: null, concepto: 'x', monto, metodo: 'efectivo', usuarioId: 'u1', fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null } as unknown as Omit<Pago, 'id' | 'academiaId' | 'createdAt' | 'updatedAt' | 'deletedAt'>);

describe('resumen de meses cerrados', () => {
  it('se calcula una vez y se guarda; si cambia un pago de ese mes, se borra y se recalcula', async () => {
    const p = await pago('2026-09-10', 50000);
    await pago('2026-10-05', 20000);
    const r1 = await resumenMes('2026-09', '2026-11', []);
    expect(Object.values(r1.ingresos).reduce((a, b) => a + b, 0)).toBe(50000);
    expect(await getMeta('resumenMes:2026-09')).toBeTruthy();
    await actualizar('pagos', p.id, { anuladoAt: Date.now() }); // se anula un pago de septiembre
    await new Promise((r) => setTimeout(r, 20));
    expect(await getMeta('resumenMes:2026-09')).toBeUndefined();
    const r2 = await resumenMes('2026-09', '2026-11', []);
    expect(Object.values(r2.ingresos).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('el mes en curso no se guarda (cambia con cada cobro)', async () => {
    await pago('2026-11-03', 10000);
    await resumenMes('2026-11', '2026-11', []);
    expect(await getMeta('resumenMes:2026-11')).toBeUndefined();
  });
  it('un cambio en otro mes no borra los demás', async () => {
    await pago('2026-08-10', 1000);
    await resumenMes('2026-08', '2026-11', []);
    await pago('2026-10-01', 1000);
    await new Promise((r) => setTimeout(r, 20));
    expect(await getMeta('resumenMes:2026-08')).toBeTruthy();
  });
});
