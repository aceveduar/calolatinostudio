import { describe, expect, it } from 'vitest';
import { valorRestante, type EstadoMembresia } from '../../src/domain/membresias';

const estado = (m: Partial<EstadoMembresia['membresia']>, e: Partial<EstadoMembresia> = {}): EstadoMembresia =>
  ({
    membresia: { id: 'm', inicio: '2026-11-01', fin: '2026-11-30', clasesTotal: null, ...m },
    vigente: true,
    usadas: 0,
    restantes: null,
    diasRestantes: 0,
    ...e,
  }) as EstadoMembresia;

describe('abonar lo que le queda al cambiar de plan', () => {
  it('mensualidad: la parte de los días que faltan (sin contar hoy), en pesos completos', () => {
    // 30 días, faltan 15 → la mitad de $400
    expect(valorRestante(estado({}), 40000, '2026-11-15')).toBe(20000);
    // faltan 20 de 30 → $266.66 → $266
    expect(valorRestante(estado({}), 40000, '2026-11-10')).toBe(26600);
    // el último día ya no queda nada
    expect(valorRestante(estado({}), 40000, '2026-11-30')).toBe(0);
  });

  it('paquete: las clases que no ha tomado', () => {
    expect(valorRestante(estado({ clasesTotal: 8 }, { restantes: 3, usadas: 5 }), 28000, '2026-11-10')).toBe(10500);
  });

  it('beca, plan de $0 o plan que ya no está vigente: nada', () => {
    expect(valorRestante(estado({}), 0, '2026-11-10')).toBe(0);
    expect(valorRestante(estado({}, { vigente: false }), 40000, '2026-11-10')).toBe(0);
  });
});
