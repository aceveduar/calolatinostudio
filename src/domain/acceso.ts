import { db, setMeta } from '../db/db';
import { crear, guardar, uuid } from '../db/repo';
import type { Academia, ID, Rol, Usuario } from '../db/types';

/**
 * El PIN es un candado de uso diario entre personas del mismo equipo,
 * no una credencial fuerte. La seguridad real de los datos en la nube la da Supabase Auth + RLS.
 */
/** Largo de los PIN nuevos. Los de 4 dígitos ya creados siguen funcionando. */
export const LARGO_PIN = 6;
/** Muy fácil de adivinar: todos iguales (111111) o seguidos (123456, 654321). */
export function pinDebil(pin: string): boolean {
  const d = [...pin].map(Number);
  const pasos = d.slice(1).map((x, i) => x - d[i]);
  return pasos.every((p) => p === 0) || pasos.every((p) => p === 1) || pasos.every((p) => p === -1);
}
export const pinValido = (pin: string) => pin.length === LARGO_PIN && /^\d+$/.test(pin) && !pinDebil(pin);

async function huella(pin: string, academiaId: ID): Promise<string> {
  const data = new TextEncoder().encode(`${academiaId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Se guarda "largo:huella" (p. ej. "6:ab12…"); los PIN antiguos no llevan prefijo y son de 4. */
export async function hashPin(pin: string, academiaId: ID): Promise<string> {
  return `${pin.length}:${await huella(pin, academiaId)}`;
}

export function largoPin(u: Pick<Usuario, 'pinHash'>): number {
  const m = /^(\d+):/.exec(u.pinHash);
  return m ? Number(m[1]) : 4;
}

export async function verificarPin(u: Usuario, pin: string): Promise<boolean> {
  if (pin.length !== largoPin(u)) return false;
  return u.pinHash.replace(/^\d+:/, '') === (await huella(pin, u.academiaId));
}

export async function crearUsuario(p: { nombre: string; rol: Rol; pin: string; academiaId: ID; maestroId?: ID | null }) {
  return crear('usuarios', {
    nombre: p.nombre.trim(),
    rol: p.rol,
    maestroId: p.rol === 'maestro' ? (p.maestroId ?? null) : null,
    pinHash: await hashPin(p.pin, p.academiaId),
    activo: true,
  });
}

/** Primer arranque: crea la academia con datos de ejemplo editables. */
export async function crearAcademia(p: { nombre: string; duenoNombre: string; pin: string }): Promise<Usuario> {
  const ahora = Date.now();
  const academia: Academia = {
    id: uuid(),
    nombre: p.nombre.trim(),
    moneda: 'MXN',
    createdAt: ahora,
    updatedAt: ahora,
    deletedAt: null,
  };
  await setMeta('academiaId', academia.id);
  await guardar('academias', academia);
  const dueno = await crearUsuario({ nombre: p.duenoNombre, rol: 'dueno', pin: p.pin, academiaId: academia.id });

  const salsa = await crear('disciplinas', { nombre: 'Salsa', color: '#e8445a' });
  const bachata = await crear('disciplinas', { nombre: 'Bachata', color: '#7c4ddb' });

  await crear('planes', { nombre: 'Clase suelta', tipo: 'suelta', precio: 4000, clases: 1, vigenciaDias: null, disciplinaId: null, activo: true });
  await crear('planes', { nombre: 'Mensualidad', tipo: 'mensual', precio: 40000, clases: null, vigenciaDias: null, disciplinaId: null, activo: true });
  await crear('planes', { nombre: 'Paquete 8 clases', tipo: 'paquete', precio: 28000, clases: 8, vigenciaDias: 30, disciplinaId: null, activo: true });

  const clases = [
    { d: salsa.id, nivel: '0', dias: [1, 3, 5], hora: '19:00' },
    { d: salsa.id, nivel: '1', dias: [1, 3, 5], hora: '20:00' },
    { d: salsa.id, nivel: '2', dias: [2, 4], hora: '20:00' },
    { d: bachata.id, nivel: '0', dias: [2, 4], hora: '19:00' },
  ];
  for (const c of clases) {
    await crear('clases', { disciplinaId: c.d, nivel: c.nivel, maestroId: null, dias: c.dias, horaInicio: c.hora, duracionMin: 60, activo: true });
  }
  return dueno;
}

export async function hayAcademia(): Promise<boolean> {
  return (await db.academias.count()) > 0;
}
