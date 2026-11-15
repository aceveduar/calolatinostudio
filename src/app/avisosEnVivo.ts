/**
 * Avisos en vivo: cuando llega (desde el portal, la página pública u otro equipo) un apartado, un encargo
 * o un interesado nuevo, suena un timbre y aparece un aviso con "Ver".
 * Lo que se capturó en ESTE equipo no avisa (está en su cola de subida), y al abrir la app no avisa de lo viejo.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { ID } from '../db/types';
import { useAvisos } from '../components/avisos';
import { timbre } from './sonido';

const RECIENTE_MS = 15 * 60_000;

interface Nuevo {
  id: ID;
  creado: number;
  texto: string;
  ruta: string;
}

export function useAvisosEnVivo(activo: boolean) {
  const avisar = useAvisos();
  const nav = useNavigate();
  const vistos = useRef<Set<ID> | null>(null);
  const navRef = useRef(nav);
  navRef.current = nav;

  const nuevos = useLiveQuery(
    async (): Promise<Nuevo[] | null> => {
      if (!activo) return null;
      const desde = Date.now() - 24 * 3600_000;
      const [pedidos, interesados] = await Promise.all([
        db.pedidos.where('estado').equals('pendiente').filter((p) => !p.deletedAt && p.createdAt > desde).toArray(),
        db.interesados.where('estado').equals('nuevo').filter((i) => !i.deletedAt && i.createdAt > desde).toArray(),
      ]);
      const [productos, alumnos] = await Promise.all([db.productos.bulkGet(pedidos.map((p) => p.productoId)), db.alumnos.bulkGet(pedidos.map((p) => p.alumnoId))]);
      return [
        ...pedidos.map((p, i) => {
          const prod = productos[i];
          const quien = alumnos[i]?.nombre.split(' ').slice(0, 2).join(' ') ?? 'Un alumno';
          return {
            id: p.id,
            creado: p.createdAt,
            texto: `${prod?.sobrePedido ? '🧾 Nuevo encargo' : '📦 Nuevo apartado'}: ${prod?.nombre ?? 'producto'}${p.opcion ? ` (${p.opcion})` : ''} · ${quien}`,
            ruta: prod?.sobrePedido ? '/encargos' : '/',
          };
        }),
        ...interesados.map((i) => ({ id: i.id, creado: i.createdAt, texto: `📣 Nuevo interesado: ${i.nombre}`, ruta: '/alumnos/interesados' })),
      ];
    },
    [activo],
    null,
  );

  useEffect(() => {
    if (!nuevos) return;
    // primera carga: lo que ya estaba no avisa
    if (!vistos.current) {
      vistos.current = new Set(nuevos.map((n) => n.id));
      return;
    }
    const llegaron = nuevos.filter((n) => !vistos.current!.has(n.id));
    if (!llegaron.length) return;
    for (const n of llegaron) vistos.current.add(n.id);
    void (async () => {
      // lo capturado en este equipo sigue en la cola de subida: no se avisa a uno mismo
      const propios = new Set((await db.outbox.where('table').anyOf('pedidos', 'interesados').toArray()).map((o) => o.id));
      const ajenos = llegaron.filter((n) => !propios.has(n.id) && Date.now() - n.creado < RECIENTE_MS);
      if (!ajenos.length) return;
      timbre();
      const n = ajenos[ajenos.length - 1];
      avisar(ajenos.length > 1 ? `${n.texto} (y ${ajenos.length - 1} más)` : n.texto, 'ok', { texto: 'Ver', fn: () => navRef.current(n.ruta) });
    })();
  }, [nuevos, avisar]);
}
