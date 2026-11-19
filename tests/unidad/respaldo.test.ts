// Respaldo: se descarga comprimido, se restaura completo y sigue abriendo los respaldos viejos sin comprimir.
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { crear } from '../../src/db/repo';
import { exportarRespaldo, leerRespaldo, restaurarRespaldo } from '../../src/domain/respaldo';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
  await db.academias.put({ id: 'a1', nombre: 'Calo', moneda: 'MXN', createdAt: 0, updatedAt: 0, deletedAt: null });
});

async function llenar(n: number) {
  await db.alumnos.bulkAdd(Array.from({ length: n }, (_, i) => ({ id: `al-${String(i).padStart(5, '0')}`, academiaId: 'a1', createdAt: 0, updatedAt: 1, deletedAt: null, nombre: `Alumno ${i}`, telefono: '5511112222', notas: '', codigo: `C${i}`, activo: true })));
  await crear('asistencias', { alumnoId: null, nombreVisitante: 'X', claseId: 'c1', fecha: '2026-11-18', membresiaId: null, pagoId: null, usuarioId: 'u1', anuladaAt: null, debe: true } as never);
}

describe('respaldo', () => {
  it('ida y vuelta comprimido: no se pierde nada y no lleva campos solo del teléfono', { timeout: 30_000 }, async () => {
    await llenar(4500); // más de un bloque de 2,000
    const { archivo, extension } = await exportarRespaldo();
    expect(extension).toBe('json.gz');
    const bytes = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
    const { respaldo, registros } = await leerRespaldo(new File([archivo], 'r.json.gz'));
    expect(registros).toBe(4502); // 4,500 alumnos + 1 entrada + la academia
    expect('deuda' in (respaldo.datos.asistencias![0] as object)).toBe(false);
    await Promise.all(['alumnos', 'asistencias'].map((t) => db.table(t).clear()));
    await restaurarRespaldo(respaldo);
    expect(await db.alumnos.count()).toBe(4500);
    expect(await db.asistencias.where('deuda').equals(1).count()).toBe(1); // el índice se recalcula al restaurar
  });

  it('abre un respaldo viejo sin comprimir', async () => {
    const viejo = { version: 1, exportado: '2026-11-01T00:00:00Z', datos: { academias: [{ id: 'a1', nombre: 'Calo', moneda: 'MXN', createdAt: 0, updatedAt: 0, deletedAt: null }], alumnos: [] } };
    const { academia } = await leerRespaldo(new File([JSON.stringify(viejo, null, 1)], 'r.json'));
    expect(academia.nombre).toBe('Calo');
  });
});
