import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

/** Cuántos pendientes tiene cada módulo (se muestran como globo en "Más" y en la pestaña). */
export function useContadores(): { interesados: number; encargos: number; testimonios: number } {
  return useLiveQuery(
    async () => {
      const [interesados, encargos, testimonios] = await Promise.all([
        db.interesados.where('estado').equals('nuevo').filter((i) => !i.deletedAt).count(),
        // encargos sobre pedido que aún hay que pedir al proveedor
        (async () => {
          const pend = await db.pedidos.where('estado').equals('pendiente').filter((p) => !p.deletedAt).toArray();
          const prods = await db.productos.bulkGet(pend.map((p) => p.productoId));
          return pend.filter((_, i) => prods[i]?.sobrePedido).length;
        })(),
        db.testimonios.where('estado').equals('pendiente').filter((t) => !t.deletedAt).count(),
      ]);
      return { interesados, encargos, testimonios };
    },
    [],
    { interesados: 0, encargos: 0, testimonios: 0 },
  );
}
