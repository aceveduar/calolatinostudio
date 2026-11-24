import { useProductos } from '../../app/datos';
import { Seccion, Tarjeta } from '../../components/ui';
import type { Pago } from '../../db/types';
import { dinero } from '../../domain/dinero';

/**
 * Tienda en el periodo: cuánto se vendió, cuánto costó y cuánto dejó (solo dirección).
 * El costo sale de cada venta (guardado al vender); si una venta vieja no lo tiene, se usa el costo actual del producto.
 */
export function ResumenTienda({ pagos }: { pagos: Pago[] }) {
  const productos = useProductos();
  const ventas = pagos.filter((p) => p.productoId && !p.anuladoAt && !p.deletedAt);
  if (!ventas.length) return null;
  const porProducto = new Map<string, { nombre: string; piezas: number; vendido: number; costo: number; conCosto: boolean }>();
  for (const v of ventas) {
    const prod = productos.find((x) => x.id === v.productoId);
    const piezas = v.cantidad ?? 1;
    const costo = v.costo ?? (prod?.costo ? prod.costo * piezas : 0);
    const f = porProducto.get(v.productoId!) ?? { nombre: prod?.nombre ?? v.concepto, piezas: 0, vendido: 0, costo: 0, conCosto: false };
    f.piezas += piezas;
    f.vendido += v.monto;
    f.costo += costo;
    f.conCosto ||= costo > 0;
    porProducto.set(v.productoId!, f);
  }
  const filas = [...porProducto.values()].sort((a, b) => b.vendido - a.vendido);
  const vendido = filas.reduce((s, f) => s + f.vendido, 0);
  const conCosto = filas.filter((f) => f.conCosto);
  const ganancia = conCosto.reduce((s, f) => s + f.vendido - f.costo, 0);
  const sinCosto = filas.length - conCosto.length;

  return (
    <Seccion titulo="Tienda">
      <Tarjeta className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-ink-500">Vendido</p>
            <p className="text-xl font-extrabold">{dinero(vendido)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-500">Te dejó</p>
            <p className="text-xl font-extrabold text-ok-600">{conCosto.length ? dinero(ganancia) : '—'}</p>
          </div>
        </div>
        {sinCosto > 0 && <p className="mt-2 text-xs text-ink-500">{sinCosto === filas.length ? 'Pon el costo de tus productos (Ajustes → Productos) para ver cuánto te dejan.' : `${sinCosto} ${sinCosto === 1 ? 'producto no tiene' : 'productos no tienen'} costo; no cuentan en la ganancia.`}</p>}
      </Tarjeta>
      <Tarjeta className="mt-2 divide-y divide-ink-100">
        {filas.slice(0, 6).map((f) => (
          <div key={f.nombre} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{f.nombre}</span>
              <span className="block text-xs text-ink-500">
                {f.piezas} {f.piezas === 1 ? 'pieza' : 'piezas'}
                {f.conCosto ? ` · te dejó ${dinero(f.vendido - f.costo)}` : ''}
              </span>
            </span>
            <span className="font-bold">{dinero(f.vendido)}</span>
          </div>
        ))}
      </Tarjeta>
    </Seccion>
  );
}
