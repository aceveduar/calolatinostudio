import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '../db/db';
import type { Academia, ID, Usuario } from '../db/types';

const HORAS_SESION = 10;

interface Sesion {
  academia: Academia;
  usuario: Usuario;
  esDueno: boolean;
  esMaestro: boolean;
  bloquear: () => void;
}

const Ctx = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de sesión');
  return s;
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'sin-academia' }
  | { fase: 'bloqueada'; academia: Academia }
  | { fase: 'abierta'; academia: Academia; usuario: Usuario };

/**
 * Determina qué pantalla mostrar: alta inicial, bloqueo por PIN o la app.
 * La sesión dura un turno (10 h) para no pedir PIN cada vez que se abre la app.
 */
export function useEstadoApp() {
  const [usuarioId, setUsuarioId] = useState<ID | null | undefined>(undefined);

  const datos = useLiveQuery(async () => {
    const academiaId = await getMeta<ID>('academiaId');
    const academia = academiaId ? await db.academias.get(academiaId) : undefined;
    return { academia: academia ?? null };
  }, []);

  useEffect(() => {
    const revisar = () =>
      getMeta<{ usuarioId: ID; hasta: number }>('sesion').then((s) => {
        setUsuarioId(s && s.hasta > Date.now() ? s.usuarioId : null);
      });
    void revisar();
    // El turno (10 h) vence aunque la app se quede abierta
    const t = setInterval(() => void revisar(), 60_000);
    return () => clearInterval(t);
  }, []);

  // undefined = cargando, null = no existe
  const usuario = useLiveQuery(
    async () => (usuarioId ? ((await db.usuarios.get(usuarioId)) ?? null) : null),
    [usuarioId],
  );

  const abrir = useCallback(async (u: Usuario) => {
    await setMeta('sesion', { usuarioId: u.id, hasta: Date.now() + HORAS_SESION * 3600_000 });
    // Cada persona empieza en su pantalla principal, nunca donde se quedó la anterior
    history.replaceState(null, '', '/');
    setUsuarioId(u.id);
  }, []);

  const bloquear = useCallback(async () => {
    await setMeta('sesion', null);
    setUsuarioId(null);
  }, []);

  let estado: Estado;
  if (!datos || usuarioId === undefined || usuario === undefined) estado = { fase: 'cargando' };
  else if (!datos.academia) estado = { fase: 'sin-academia' };
  else if (!usuario || !usuario.activo || usuario.deletedAt) estado = { fase: 'bloqueada', academia: datos.academia };
  else estado = { fase: 'abierta', academia: datos.academia, usuario };

  return { estado, abrir, bloquear };
}

export function ProveedorSesion({ academia, usuario, bloquear, children }: Omit<Sesion, 'esDueno' | 'esMaestro'> & { children: ReactNode }) {
  return <Ctx.Provider value={{ academia, usuario, esDueno: usuario.rol === 'dueno', esMaestro: usuario.rol === 'maestro', bloquear }}>{children}</Ctx.Provider>;
}
