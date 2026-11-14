import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, ShoppingBag } from 'lucide-react';
import { useExistencias, useProductos } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Vacio, cx } from '../../components/ui';
import type { CategoriaProducto, Producto } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { deshacer, type Movimiento } from '../../domain/rapido';
import { estadoExistencia, venderProducto } from '../../domain/tienda';

const GRUPOS: { cat: CategoriaProducto; titulo: string }[] = [
  { cat: 'consumo', titulo: 'Snacks y bebidas' },
  { cat: 'articulo', titulo: 'Artículos' },
];

/**
 * Venta rápida en recepción: cada toque agrega una pieza a la cuenta abierta (junto con las clases).
 * El "−" quita la última pieza de ese producto.
 */
export function Tienda({ movs, onAgregar, onQuitar, onListo }: { movs: Movimiento[]; onAgregar: (m: Movimiento) => void; onQuitar: (m: Movimiento) => void; onListo: () => void }) {
  const { usuario, esDueno } = useSesion();
  const avisar = useAvisos();
  const productos = useProductos().filter((p) => p.activo);
  const stock = useExistencias();
  const [ocupado, setOcupado] = useState(false);

  const enCuenta = (p: Producto) => movs.filter((m) => m.productoId === p.id);
  const total = movs.reduce((s, m) => s + m.monto, 0);

  if (!productos.length)
    return (
      <Vacio icono={<ShoppingBag size={36} />} titulo="Aún no hay productos" texto={esDueno ? 'Agrégalos en Ajustes → Productos.' : 'Pide a la dirección que agregue los productos.'}>
        {esDueno && (
          <Link to="/ajustes/productos" onClick={onListo}>
            <Boton variante="secundario">Agregar productos</Boton>
          </Link>
        )}
      </Vacio>
    );

  const agregar = async (p: Producto) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      onAgregar(await venderProducto({ producto: p, metodo: 'efectivo', usuarioId: usuario.id }));
      navigator.vibrate?.(20);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo vender', 'error');
    } finally {
      setOcupado(false);
    }
  };
  const quitar = async (p: Producto) => {
    const ultimo = enCuenta(p)[0];
    if (!ultimo) return;
    await deshacer(ultimo);
    onQuitar(ultimo);
  };

  return (
    <div className="space-y-4">
      {GRUPOS.map(({ cat, titulo }) => {
        const lista = productos.filter((p) => p.categoria === cat);
        if (!lista.length) return null;
        return (
          <section key={cat}>
            <h3 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">{titulo}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {lista.map((p) => {
                const d = stock.get(p.id) ?? null;
                // descontar lo que ya está en esta cuenta para que el aviso sea inmediato
                const est = estadoExistencia(p, d);
                const n = enCuenta(p).length;
                return (
                  <div key={p.id} className="relative">
                    <button
                      type="button"
                      onClick={() => agregar(p)}
                      className={cx(
                        'flex w-full flex-col items-center gap-0.5 rounded-2xl px-1 pt-3 pb-2.5 ring-1 transition select-none active:scale-95',
                        n ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-superficie ring-ink-100',
                      )}
                      aria-label={`Agregar ${p.nombre}, ${dinero(p.precio)}`}
                    >
                      <span className="text-3xl leading-none">{p.emoji}</span>
                      <span className="mt-1 line-clamp-2 w-full px-1 text-center text-sm leading-tight font-semibold">{p.nombre}</span>
                      <span className="text-sm font-bold">{dinero(p.precio)}</span>
                      {est !== 'libre' && (
                        <span className={cx('text-[11px] font-semibold', est === 'agotado' ? 'text-bad-600' : est === 'pocas' ? 'text-warn-600' : 'text-ink-500')}>
                          {est === 'agotado' ? 'Agotado' : `Quedan ${d}`}
                        </span>
                      )}
                    </button>
                    {n > 0 && (
                      <>
                        <span className="pointer-events-none absolute -top-2 -right-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-500 px-1.5 text-sm font-extrabold text-white shadow animate-pop">
                          {n}
                        </span>
                        <button
                          type="button"
                          onClick={() => quitar(p)}
                          className="absolute -top-2 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-superficie text-ink-700 shadow ring-1 ring-ink-100"
                          aria-label={`Quitar un ${p.nombre}`}
                        >
                          <Minus size={16} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <Boton grande bloque onClick={onListo}>
        {total ? `Listo · cuenta ${dinero(total)}` : 'Listo'}
      </Boton>
    </div>
  );
}
