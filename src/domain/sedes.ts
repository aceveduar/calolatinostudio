/** Reglas de sede para planes y precios. */
import type { Clase, ID, Plan } from '../db/types';

/** Alcance de planes: vacío = todas · PRINCIPAL = solo la principal · id = esa sede. */
export const PRINCIPAL = '00000000-0000-4000-8000-000000000000';

/** Clave de sede de una clase/cobro (vacío = principal). */
export const claveSede = (sedeId: ID | null | undefined): ID => sedeId ?? PRINCIPAL;

/** ¿Un plan/membresía con este alcance sirve en esta sede? */
export const sirveEn = (alcance: ID | null | undefined, sedeId: ID | null | undefined) => !alcance || alcance === claveSede(sedeId);

/**
 * Clase suelta de una clase: el plan de su sede, con el precio propio de la clase si el maestro puso su tarifa.
 * (El plan sigue siendo el de la sede, para que los reportes lo agrupen igual.)
 */
export function sueltaDeClase(planes: Plan[], clase: Pick<Clase, 'sedeId' | 'precioSuelta'> | null | undefined): Plan | undefined {
  const base = sueltaPara(planes, clase?.sedeId);
  return base && clase?.precioSuelta ? { ...base, precio: clase.precioSuelta } : base;
}

/** Precio de clase suelta para una sede: el de esa sede si existe; si no, el general. */
export function sueltaPara(planes: Plan[], sedeId: ID | null | undefined): Plan | undefined {
  const sueltas = planes.filter((p) => p.tipo === 'suelta' && p.activo && !p.deletedAt);
  return sueltas.find((p) => p.sedeId && p.sedeId === claveSede(sedeId)) ?? sueltas.find((p) => !p.sedeId);
}

/**
 * Campo de sede para guardar: solo se incluye si hay sede (o si hay que borrar una que había).
 * Así, mientras una academia use solo su sede principal, los registros no cambian y la sincronización
 * no depende de que la base ya tenga las columnas nuevas.
 */
export function conSede(nueva: ID | null | undefined, anterior?: ID | null): { sedeId?: ID | null } {
  if (nueva) return { sedeId: nueva };
  return anterior ? { sedeId: null } : {};
}
