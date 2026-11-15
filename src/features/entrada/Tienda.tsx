import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Barcode, Minus, PackageCheck, ShoppingBag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLectorUSB } from '../../app/codigos';
import { EscanerCodigo } from '../../components/EscanerCodigo';
import { useExistencias, usePedidosPendientes, useProductos } from '../../app/datos';
import { cancelarPedido, entregarPedido, nombrePedido, restaPorPagar } from '../../domain/pedidos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Vacio, cx } from '../../components/ui';
import type { CategoriaProducto, ID, Producto } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { deshacer, type Movimiento } from '../../domain/rapido';
import { estadoExistencia, productoPorCodigo, venderProducto } from '../../domain/tienda';

const GRUPOS: { cat: CategoriaProducto; titulo: string }[] = [
  { cat: 'consumo', titulo: 'Snacks y bebidas' },
  { cat: 'articulo', titulo: 'Artículos' },
];

/**
 * Venta rápida en recepción: cada toque agrega una pieza a la cuenta abierta (junto con las clases).
 * El "−" quita la última pieza de ese producto.
 */
export function Tienda({ movs, onAgregar, onQuitar, onListo, sedeId }: { sedeId: ID | null; movs: Movimiento[]; onAgregar: (m: Movimiento) => void; onQuitar: (m: Movimiento) => void; onListo: () => void }) {
  const { usuario, esDueno } = useSesion();
  const avisar = useAvisos();
  const productos = useProductos().filter((p) => p.activo);
  const stock = useExistencias();
  const [ocupado, setOcupado] = useState(false);
  const pendientes = usePedidosPendientes();
  const nav = useNavigate();
  const [camara, setCamara] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Código escaneado (cámara o lector USB): suma el producto a la cuenta. */
  const porCodigo = async (codigo: string) => {
    const p = await productoPorCodigo(codigo);
    if (!p) {
      setAviso(`Código ${codigo} no registrado`);
      avisar(`El código ${codigo} no es de ningún producto`, 'error', esDueno ? { texto: 'Darlo de alta', fn: () => { onListo(); nav(`/ajustes/productos?codigo=${encodeURIComponent(codigo)}`); } } : undefined);
      return;
    }
    try {
      onAgregar(await venderProducto({ producto: p, metodo: 'efectivo', usuarioId: usuario.id, sedeId }));
      setAviso(`${p.emoji} ${p.nombre} · ${dinero(p.precio)}`);
      navigator.vibrate?.(20);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo vender', 'error');
    }
  };
  useLectorUSB(porCodigo, !camara);
  const [cancelando, setCancelando] = useState<ID | null>(null);

  const enCuenta = (p: Producto) => movs.filter((m) => m.productoId === p.id);
  const total = movs.reduce((s, m) => s + m.monto, 0);

  const entregar = async (x: (typeof pendientes)[number]) => {
    if (ocupado || !x.producto) return;
    setOcupado(true);
    try {
      onAgregar(await entregarPedido({ pedido: x.pedido, producto: x.producto, metodo: 'efectivo', usuarioId: usuario.id, sedeId }));
      avisar(`Entregado a ${x.alumno?.nombre.split(' ')[0] ?? 'el alumno'}: se sumó a la cuenta`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo entregar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  const apartados = pendientes.length > 0 && (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">
        <PackageCheck size={14} /> Apartados por recoger · {pendientes.length}
      </h3>
      <div className="divide-y divide-ink-100 rounded-2xl bg-superficie ring-1 ring-ink-100">
        {pendientes.map((x) => (
          <div key={x.pedido.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="text-2xl leading-none">{x.producto?.emoji ?? '🛍️'}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {nombrePedido(x.pedido, x.producto)}
                {x.pedido.cantidad > 1 && ` ×${x.pedido.cantidad}`}
              </span>
              <span className="block truncate text-xs text-ink-500">
                {x.alumno?.nombre ?? 'Alumno'} · {dinero(restaPorPagar(x.pedido))}
                {x.pedido.anticipo ? ` (dejó ${dinero(x.pedido.anticipo)})` : ''}
              </span>
            </span>
            {cancelando === x.pedido.id ? (
              <span className="flex gap-1">
                <Boton
                  variante="secundario"
                  onClick={async () => {
                    await cancelarPedido(x.pedido.id);
                    setCancelando(null);
                    avisar('Apartado cancelado');
                  }}
                >
                  <span className="text-bad-600">Cancelar</span>
                </Boton>
                <Boton variante="fantasma" onClick={() => setCancelando(null)}>
                  No
                </Boton>
              </span>
            ) : (
              <>
                <button className="px-1 text-xs font-semibold text-ink-500" onClick={() => setCancelando(x.pedido.id)} aria-label={`Cancelar apartado de ${x.alumno?.nombre ?? 'alumno'}`}>
                  ✕
                </button>
                <Boton onClick={() => entregar(x)} disabled={ocupado || !x.producto}>
                  Entregar
                </Boton>
              </>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-xs text-ink-500">“Entregar” suma el apartado a la cuenta para cobrarlo.</p>
    </section>
  );

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
      onAgregar(await venderProducto({ producto: p, metodo: 'efectivo', usuarioId: usuario.id, sedeId }));
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
      <button
        type="button"
        onClick={() => {
          setAviso(null);
          setCamara(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-superficie py-3 font-semibold ring-1 ring-ink-100 active:bg-ink-50"
      >
        <Barcode size={20} /> Escanear código de barras
      </button>
      {camara && <EscanerCodigo titulo="Cobrar escaneando" continuo aviso={aviso} onCodigo={porCodigo} onCerrar={() => setCamara(false)} />}
      {apartados}
      <Link to="/encargos" onClick={onListo} className="flex items-center justify-between rounded-2xl bg-superficie px-4 py-3 text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-50">
        <span className="flex items-center gap-2">
          <Truck size={18} /> Encargos (zapatillas, playeras…)
        </span>
        <span className="text-brand-600">Ver</span>
      </Link>
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
