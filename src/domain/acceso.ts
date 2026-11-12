import { db, setMeta } from '../db/db';
import { crear, guardar, uuid } from '../db/repo';
import type { Academia, ID, Rol, Usuario } from '../db/types';

/**
 * El PIN es un candado de uso diario entre personas del mismo equipo,
 * no una credencial fuerte. La seguridad real de los datos en la nube la da Supabase Auth + RLS.
 */
export async function hashPin(pin: string, academiaId: ID): Promise<string> {
  const data = new TextEncoder().encode(`${academiaId}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verificarPin(u: Usuario, pin: string): Promise<boolean> {
  return (await hashPin(pin, u.academiaId)) === u.pinHash;
}

export async function crearUsuario(p: { nombre: string; rol: Rol; pin: string; academiaId: ID }) {
  return crear('usuarios', {
    nombre: p.nombre.trim(),
    rol: p.rol,
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
