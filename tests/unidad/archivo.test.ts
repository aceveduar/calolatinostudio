import { describe, expect, it } from 'vitest';
import { estaArchivado } from '../../src/domain/archivo';

describe('alumnos archivados (dejaron de venir)', () => {
  const ahora = Date.UTC(2026, 10, 19);
  const hace = (dias: number) => ahora - dias * 86_400_000;
  const a = (x: Partial<{ id: string; activo: boolean; createdAt: number }>) => ({ id: 'a1', activo: true, createdAt: hace(400), ...x });
  it('no vino en 6 meses y no tiene plan: archivado', () => {
    expect(estaArchivado(a({}), new Set(), false, ahora, 180)).toBe(true);
  });
  it('vino en los últimos 6 meses, o tiene plan vigente: no', () => {
    expect(estaArchivado(a({}), new Set(['a1']), false, ahora, 180)).toBe(false);
    expect(estaArchivado(a({}), new Set(), true, ahora, 180)).toBe(false);
  });
  it('recién registrado (aún no viene) o dado de baja a mano: no se archiva', () => {
    expect(estaArchivado(a({ createdAt: hace(20) }), new Set(), false, ahora, 180)).toBe(false);
    expect(estaArchivado(a({ activo: false }), new Set(), false, ahora, 180)).toBe(false);
  });
});
