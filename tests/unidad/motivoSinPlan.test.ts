// Alguien "con plan" que paga una clase: la app debe decir por qué (si no, parece un error al cobrar).
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import type { Clase, Membresia } from '../../src/db/types';
import { estadoMembresia, membresiaQueCubre } from '../../src/domain/membresias';
import { motivoSinPlan } from '../../src/domain/rapido';
import { hoy, sumarDias } from '../../src/domain/fechas';

const base = { academiaId: 'a1', createdAt: 1, updatedAt: 1, deletedAt: null };
const clase = (id: string, disciplinaId: string, nivel: string, sedeId: string | null = null) =>
  ({ ...base, id, disciplinaId, nivel, sedeId, maestro: '', maestroId: null, dias: [1], horaInicio: '19:00', duracionMin: 60, activo: true }) as unknown as Clase;
const mem = (x: Partial<Membresia>) =>
  ({ ...base, id: 'm', alumnoId: 'al', planId: 'p', pagoId: 'pg', disciplinaId: null, inicio: sumarDias(hoy(), -5), fin: sumarDias(hoy(), 20), clasesTotal: null, anuladaAt: null, ...x }) as Membresia;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
  await db.disciplinas.bulkPut([
    { ...base, id: 'lady', nombre: 'Lady Style', color: '#d92776' },
    { ...base, id: 'salsa', nombre: 'Salsa', color: '#e8445a' },
  ] as never[]);
  await db.clases.bulkPut([clase('lady0', 'lady', '0'), clase('salsa1', 'salsa', '1'), clase('salsaCentro', 'salsa', '1', 'centro')]);
});

const motivo = async (m: Membresia, claseId: string, usadas = 0) => {
  const c = (await db.clases.get(claseId))!;
  const asis = Array.from({ length: usadas }, (_, i) => ({ id: `a${i}`, membresiaId: m.id, anuladaAt: null, deletedAt: null })) as never[];
  const estados = [estadoMembresia(m, asis, hoy())];
  expect(membresiaQueCubre(estados, c)).toBeNull(); // efectivamente, ese plan no cubre esta clase
  return motivoSinPlan(estados, c);
};

describe('por qué alguien con plan paga esta clase', () => {
  it('plan de clases fijas: dice para cuál es', async () => {
    expect(await motivo(mem({ claseIds: ['lady0'] }), 'salsa1')).toBe('su plan es solo para Lady Style 0');
  });
  it('plan de una disciplina', async () => {
    expect(await motivo(mem({ disciplinaId: 'lady' }), 'salsa1')).toBe('su plan es solo de Lady Style');
  });
  it('plan de otra sede', async () => {
    expect(await motivo(mem({ sedeId: 'principal-x' }), 'salsaCentro')).toBe('su plan es de otra sede');
  });
  it('paquete sin clases aunque siga en fecha', async () => {
    expect(await motivo(mem({ clasesTotal: 4 }), 'salsa1', 4)).toBe('a su paquete ya no le quedan clases');
  });
  it('sin plan en fecha: nada que explicar (cobrar es lo normal)', async () => {
    const c = (await db.clases.get('salsa1'))!;
    expect(await motivoSinPlan([estadoMembresia(mem({ fin: sumarDias(hoy(), -1) }), [], hoy())], c)).toBeNull();
  });
});
