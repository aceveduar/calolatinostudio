/**
 * Portal del alumno: un enlace personal (/p/<token>) donde ve su QR, su plan y sus clases sin crear cuenta.
 * El token es secreto y largo (≈143 bits): no se puede adivinar, a diferencia del código de 6 letras del QR.
 * Si se comparte por error, se genera uno nuevo y el anterior deja de servir.
 */
import { actualizar } from '../db/repo';
import type { Alumno, ID } from '../db/types';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const LARGO = 26;

export function generarTokenPortal(): string {
  // rechazo de sesgo: solo bytes < múltiplo del alfabeto
  const limite = 256 - (256 % ALFABETO.length);
  let t = '';
  while (t.length < LARGO) {
    for (const b of crypto.getRandomValues(new Uint8Array(LARGO * 2))) {
      if (b < limite && t.length < LARGO) t += ALFABETO[b % ALFABETO.length];
    }
  }
  return t;
}

export const enlacePortal = (token: string) => `${location.origin}/p/${token}`;

/** Token del portal: lo crea la primera vez que se necesita. */
const enCurso = new Map<ID, Promise<string>>();
export function asegurarPortal(alumno: Pick<Alumno, 'id' | 'portal'>): Promise<string> {
  if (alumno.portal) return Promise.resolve(alumno.portal);
  // dos llamadas seguidas (p. ej. StrictMode) no deben crear dos enlaces distintos
  let p = enCurso.get(alumno.id);
  if (!p) {
    const token = generarTokenPortal();
    p = actualizar('alumnos', alumno.id, { portal: token })
      .then(() => token)
      .finally(() => enCurso.delete(alumno.id));
    enCurso.set(alumno.id, p);
  }
  return p;
}

/** Nuevo enlace; el anterior deja de funcionar. */
export async function regenerarPortal(alumnoId: ID): Promise<string> {
  const token = generarTokenPortal();
  await actualizar('alumnos', alumnoId, { portal: token });
  return token;
}

/** Lo que devuelve la función portal_alumno de la base. */
export interface DatosPortal {
  hoy: string;
  alumno: { nombre: string; codigo: string; foto?: string | null };
  academia: { nombre: string; color: string | null; logo: string | null };
  planes: { plan: string; tipo: string; beca: boolean; inicio: string; fin: string; clases: number | null; usadas: number }[];
  clases: { fecha: string; clase: string; color: string | null }[];
  tienda: { id: string; nombre: string; precio: number; emoji: string; foto: string | null; descripcion: string; opciones: string[]; disponibles: number | null; sobre_pedido?: boolean; dias_entrega?: number | null }[];
  pedidos?: { producto: string; emoji: string; opcion: string | null; nota?: string | null; cantidad: number; precio: number; anticipo?: number; estado: 'pendiente' | 'pedido' | 'llego' | 'entregado' | 'cancelado'; creado: number }[];
}

export const ERRORES_PEDIDO: Record<string, string> = {
  enlace: 'Este enlace ya no funciona. Pide uno nuevo en recepción.',
  cantidad: 'Puedes apartar de 1 a 5 piezas.',
  producto: 'Ese producto ya no está disponible.',
  opcion: 'Elige una talla o color.',
  muchos: 'Ya tienes 5 apartados por recoger. Recógelos en recepción para apartar más.',
  agotado: 'Ya no hay suficientes piezas.',
};
