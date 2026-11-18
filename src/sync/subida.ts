/**
 * Qué se sube de cada registro pendiente.
 * Un alta (o un cambio sin detalle) sube el registro completo. Un cambio hecho con `actualizar`
 * sube solo los campos que cambiaron: si la tablet de recepción estuvo sin red y marca "ya le avisé",
 * no devuelve a la nube el teléfono viejo del alumno que dirección corrigió mientras tanto.
 */
import type { ID, OutboxItem } from '../db/types';

export interface PlanSubida {
  completos: Set<ID>;
  /** id → campos que cambiaron (en camelCase, como en el teléfono) */
  parciales: Map<ID, string[]>;
}

export function planearSubida(items: Pick<OutboxItem, 'id' | 'campos'>[]): PlanSubida {
  const completos = new Set<ID>();
  const campos = new Map<ID, Set<string>>();
  for (const it of items) {
    if (!it.campos) completos.add(it.id);
    else {
      const s = campos.get(it.id) ?? new Set<string>();
      for (const c of it.campos) s.add(c);
      campos.set(it.id, s);
    }
  }
  const parciales = new Map<ID, string[]>();
  for (const [id, s] of campos) if (!completos.has(id)) parciales.set(id, [...s]);
  return { completos, parciales };
}

/** Solo los campos que cambiaron, más la hora del cambio. */
export function soloCampos(registro: Record<string, unknown>, campos: string[]): Record<string, unknown> {
  const o: Record<string, unknown> = { updatedAt: registro.updatedAt };
  // un campo que se quitó viaja como null (undefined no llega en JSON y la nube conservaría el viejo)
  for (const c of campos) o[c] = registro[c] ?? null;
  return o;
}
