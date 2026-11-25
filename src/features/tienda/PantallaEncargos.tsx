import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ClipboardCopy, MessageCircle, PackageCheck, Plus, Search, Truck } from 'lucide-react';
import { useAlumnos, useProductos } from '../../app/datos';
import { useSedeActual } from '../../app/sedes';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Seccion, Segmentos, Selector, Tarjeta, cx, Cargando } from '../../components/ui';
import { ImagenProducto } from '../../components/ImagenProducto';
import { db } from '../../db/db';
import type { Alumno, ID, MetodoPago, Pedido, Producto } from '../../db/types';
import { aCentavos, dinero } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';
import { cambiarEstado, cancelarPedido, crearEncargo, entregarPedido, listaProveedor, listoParaEntregar, nombrePedido, registrarAnticipo, restaPorPagar, textoProveedor, totalPedido } from '../../domain/pedidos';
import { waLink } from '../../domain/reportes';
import { METODOS } from '../../domain/planes';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function avisoLlegada(pedido: Pedido, producto: Producto | undefined, alumno: Alumno | undefined, academia: string) {
  if (!alumno) return null;
  const saldo = restaPorPagar(pedido);
  return waLink(alumno.telefono, `Hola ${alumno.nombre.split(' ')[0]}, ¡ya llegó tu ${nombrePedido(pedido, producto).toLowerCase()}! Pasa a recogerlo a ${academia}${saldo ? `; quedan ${dinero(saldo)} por pagar` : ''}. 💃🕺`);
}

/**
 * Encargos de la tienda (zapatillas por número, playeras con diseño…):
 * lista para el proveedor → pedidos en camino → listos para entregar.
 */
export function PantallaEncargos() {
  const nav = useNavigate();
  const { academia, usuario } = useSesion();
  const avisar = useAvisos();
  const [sedeActual] = useSedeActual();
  const [nuevo, setNuevo] = useState(false);
  const [params, setParams] = useSearchParams();
  const [buscar, setBuscar] = useState('');
  const datos = useLiveQuery(async () => {
    const [pedidos, productos, alumnos] = await Promise.all([
      db.pedidos.where('estado').anyOf('pendiente', 'pedido', 'llego').filter((p) => !p.deletedAt).toArray(),
      db.productos.toArray(),
      db.alumnos.toArray(),
    ]);
    return { pedidos: pedidos.sort((a, b) => a.createdAt - b.createdAt), productos: new Map(productos.map((p) => [p.id, p])), alumnos: new Map(alumnos.map((a) => [a.id, a])) };
  }, []);
  if (!datos) return <Cargando />;
  const { pedidos, productos, alumnos } = datos;
  const pedidoId = params.get('pedido');
  const sel = pedidos.find((p) => p.id === pedidoId);
  const seleccionar = (id?: ID) => {
    const siguientes = new URLSearchParams(params);
    if (id) siguientes.set('pedido', id);
    else siguientes.delete('pedido');
    setParams(siguientes, { replace: true, preventScrollReset: true });
  };
  const lista = listaProveedor(pedidos, productos);
  const enCamino = pedidos.filter((p) => p.estado === 'pedido');
  const listos = pedidos.filter((p) => listoParaEntregar(p, productos.get(p.productoId)));
  const texto = textoProveedor(lista, academia.nombre);
  const consulta = normalizar(buscar.trim());
  const encontrados = consulta ? pedidos.filter((p) => {
    const nombre = alumnos.get(p.alumnoId)?.nombre ?? '';
    const producto = nombrePedido(p, productos.get(p.productoId));
    return normalizar(`${nombre} ${producto}`).includes(consulta);
  }) : [];

  const fila = (p: Pedido, accion?: React.ReactNode) => {
    const prod = productos.get(p.productoId);
    const al = alumnos.get(p.alumnoId);
    return (
      <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => seleccionar(p.id)}>
          <ImagenProducto foto={prod?.foto} tam={40} />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold">
              {nombrePedido(p, prod)}
              {p.cantidad > 1 && ` ×${p.cantidad}`}
            </span>
            <span className="block break-words text-xs text-ink-500">{al?.nombre ?? 'Alumno'}</span>
          </span>
        </button>
        {accion}
      </div>
    );
  };

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <button onClick={() => nav(-1)} className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Atrás">
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Encargos</h1>
        <Boton onClick={() => setNuevo(true)}>
          <Plus size={18} /> Nuevo
        </Boton>
      </div>

      {pedidoId && !sel && (
        <Tarjeta className="mb-3 flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <p>Este pedido ya no aparece entre los encargos abiertos.</p>
          <Boton variante="secundario" onClick={() => seleccionar()}>Cerrar aviso</Boton>
        </Tarjeta>
      )}

      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <Entrada aria-label="Buscar pedidos por alumno, producto o talla" placeholder="Alumno, producto o talla" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-10" />
      </label>
      {consulta ? (
        <Seccion titulo={`Pedidos encontrados · ${encontrados.length}`}>
          {encontrados.length ? (
            <Tarjeta className="divide-y divide-ink-100">
              {encontrados.map((p) => {
                const listo = listoParaEntregar(p, productos.get(p.productoId));
                const saldo = restaPorPagar(p);
                return fila(p, (
                  <span className="max-w-28 shrink-0 text-right text-xs text-ink-600">
                    <span className={cx('block font-bold', listo && 'text-ok-600')}>{listo ? 'Listo para entregar' : p.estado === 'pedido' ? 'En camino' : 'Por pedir'}</span>
                    {listo && <span>{saldo ? `Por cobrar ${dinero(saldo)}` : 'Sin saldo'}</span>}
                  </span>
                ));
              })}
            </Tarjeta>
          ) : <Tarjeta className="p-4 text-sm text-ink-500">No hay pedidos abiertos que coincidan.</Tarjeta>}
          <Boton variante="secundario" className="mt-2" onClick={() => setBuscar('')}>Ver todos los pedidos</Boton>
        </Seccion>
      ) : (
        <>
          <Seccion titulo={`Listos para entregar · ${listos.length}`}>
            {listos.length === 0 ? (
              <p className="px-1 text-sm text-ink-500">Aún no hay pedidos listos.</p>
            ) : (
              <Tarjeta className="divide-y divide-ink-100">
                {listos.map((p) => {
                  const saldo = restaPorPagar(p);
                  return fila(p, <span className="shrink-0 text-right text-xs font-semibold text-ink-500">{saldo ? <>Saldo <b className="text-ink-900">{dinero(saldo)}</b></> : 'Sin saldo'}</span>);
                })}
              </Tarjeta>
            )}
          </Seccion>

          <Seccion titulo={`En camino · ${enCamino.length}`}>
            {enCamino.length === 0 ? (
              <p className="px-1 text-sm text-ink-500">Aún no hay pedidos en camino.</p>
            ) : (
              <Tarjeta className="divide-y divide-ink-100">
                {enCamino.map((p) => {
                  const al = alumnos.get(p.alumnoId);
                  return fila(p, (
                    <Boton
                      variante="secundario"
                      onClick={async () => {
                        await cambiarEstado([p.id], 'llego');
                        const prod = productos.get(p.productoId);
                        const wa = avisoLlegada(p, prod, al, academia.nombre);
                        avisar('Marcado como llegó', 'ok', wa ? { texto: 'Avisarle', fn: () => void window.open(wa, '_blank', 'noopener') } : undefined);
                      }}
                    >
                      Llegó
                    </Boton>
                  ));
                })}
              </Tarjeta>
            )}
          </Seccion>

          <Seccion titulo={`Por pedir al proveedor · ${lista.reduce((s, r) => s + r.cantidad, 0)}`}>
            {lista.length === 0 ? (
              <p className="px-1 text-sm text-ink-500">Aún no hay encargos para el proveedor.</p>
            ) : (
              <>
                <Tarjeta className="divide-y divide-ink-100">
                  {lista.map((r) => (
                    <div key={`${r.producto?.id}|${r.opcion}|${r.nota}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-extrabold text-brand-600">{r.cantidad}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {r.producto?.nombre}
                          {r.opcion && <span className="font-normal text-ink-500"> · talla {r.opcion}</span>}
                        </span>
                        {r.nota && <span className="block text-sm text-ink-700">{r.nota}</span>}
                        <span className="block truncate text-xs text-ink-500">{r.pedidos.map((p) => alumnos.get(p.alumnoId)?.nombre.split(' ')[0]).join(', ')}</span>
                      </span>
                    </div>
                  ))}
                </Tarjeta>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Boton
                    variante="secundario"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(texto);
                        avisar('Lista copiada');
                      } catch {
                        avisar('No se pudo copiar', 'error');
                      }
                    }}
                  >
                    <ClipboardCopy size={18} /> Copiar lista
                  </Boton>
                  <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-superficie px-2 text-sm font-semibold ring-1 ring-inset ring-ink-100 active:bg-ink-50">
                    <MessageCircle size={18} className="text-ok-600" aria-hidden="true" /> WhatsApp
                  </a>
                </div>
                <Boton
                  grande
                  bloque
                  className="mt-2"
                  onClick={async () => {
                    const ids = lista.flatMap((r) => r.pedidos.map((p) => p.id));
                    await cambiarEstado(ids, 'pedido');
                    avisar(`${ids.length} ${ids.length === 1 ? 'encargo marcado' : 'encargos marcados'} como pedidos al proveedor`);
                  }}
                >
                  <Truck size={20} /> Ya se los pedí al proveedor
                </Boton>
              </>
            )}
          </Seccion>

        </>
      )}

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Nuevo encargo">
        {nuevo && <FormEncargo sedeId={sedeActual} onHecho={() => setNuevo(false)} />}
      </Hoja>
      <Hoja abierta={!!sel} onCerrar={() => seleccionar()} titulo={sel ? nombrePedido(sel, productos.get(sel.productoId)) : ''}>
        {sel && <DetalleEncargo key={sel.id} pedido={sel} producto={productos.get(sel.productoId)} alumno={alumnos.get(sel.alumnoId)} usuarioId={usuario.id} sedeId={sedeActual} onHecho={() => seleccionar()} />}
      </Hoja>
    </div>
  );
}

function DetalleEncargo({ pedido, producto, alumno, usuarioId, sedeId, onHecho }: { pedido: Pedido; producto: Producto | undefined; alumno: Alumno | undefined; usuarioId: ID; sedeId: ID | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [anticipo, setAnticipo] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const listo = listoParaEntregar(pedido, producto);
  const resto = restaPorPagar(pedido);
  const whatsapp = pedido.estado === 'llego' ? avisoLlegada(pedido, producto, alumno, academia.nombre) : null;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-superficie p-4 text-sm ring-1 ring-ink-100">
        <p>
          <b>{alumno?.nombre ?? 'Alumno'}</b> · {pedido.cantidad} {pedido.cantidad === 1 ? 'pieza' : 'piezas'} · {fechaCorta(new Date(pedido.createdAt).toISOString().slice(0, 10))}
        </p>
        {pedido.nota && <p className="mt-1">{pedido.nota}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 tabular-nums">
          <div><dt className="text-xs text-ink-500">Total</dt><dd className="font-semibold">{dinero(totalPedido(pedido))}</dd></div>
          <div><dt className="text-xs text-ink-500">Anticipo</dt><dd className="font-semibold">{dinero(pedido.anticipo ?? 0)}</dd></div>
          <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 font-bold">
            <dt>{resto ? 'Saldo por cobrar' : 'Sin saldo pendiente'}</dt>
            <dd className="text-lg text-brand-600">{dinero(resto)}</dd>
          </div>
        </dl>
      </div>
      {resto > 0 && <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />}
      {listo ? (
        <Boton
          grande
          bloque
          disabled={entregando || !producto}
          onClick={async () => {
            if (!producto || entregando) return;
            setEntregando(true);
            try {
              await entregarPedido({ pedido, producto, metodo, usuarioId, sedeId });
              avisar(resto ? `Entregado · ${dinero(resto)}` : 'Pedido entregado');
              onHecho();
            } catch {
              avisar('No se pudo registrar la entrega. Inténtalo de nuevo.', 'error');
            } finally {
              setEntregando(false);
            }
          }}
        >
          <PackageCheck size={20} aria-hidden="true" /> {entregando ? 'Registrando…' : resto ? `Entregar y cobrar ${dinero(resto)}` : 'Marcar como entregado'}
        </Boton>
      ) : (
        resto > 0 && (
          <div className="flex gap-2">
            <Entrada inputMode="decimal" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} placeholder="Anticipo $" aria-label="Anticipo" />
            <Boton
              variante="secundario"
              disabled={aCentavos(anticipo) <= 0}
              onClick={async () => {
                if (!producto) return;
                try {
                  await registrarAnticipo({ pedido, producto, monto: aCentavos(anticipo), metodo, usuarioId, sedeId });
                  avisar(`Anticipo cobrado · ${dinero(aCentavos(anticipo))}`);
                  onHecho();
                } catch (e) {
                  avisar(e instanceof Error ? e.message : 'No se pudo cobrar', 'error');
                }
              }}
            >
              Cobrar anticipo
            </Boton>
          </div>
        )
      )}
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-ok-50 px-4 font-semibold text-ok-600">
          <MessageCircle size={18} aria-hidden="true" /> Avisar por WhatsApp
        </a>
      )}
      {confirmar ? (
        <Boton
          bloque
          variante="secundario"
          disabled={entregando}
          onClick={async () => {
            await cancelarPedido(pedido.id);
            avisar(pedido.anticipo ? 'Encargo cancelado: si hay que devolver el anticipo, anúlalo en Caja' : 'Encargo cancelado');
            onHecho();
          }}
        >
          <span className="text-bad-600">Sí, cancelar el encargo</span>
        </Boton>
      ) : (
        <Boton bloque variante="fantasma" disabled={entregando} onClick={() => setConfirmar(true)}>
          <span className="text-bad-600">Cancelar encargo</span>
        </Boton>
      )}
    </div>
  );
}

function FormEncargo({ sedeId, onHecho }: { sedeId: ID | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const alumnos = useAlumnos();
  const productos = useProductos().filter((p) => p.activo && p.categoria === 'articulo');
  const [q, setQ] = useState('');
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [productoId, setProductoId] = useState<string>('');
  const producto = productos.find((p) => p.id === productoId) ?? productos.find((p) => p.sobrePedido) ?? productos[0];
  const [opcion, setOpcion] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [anticipo, setAnticipo] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);
  const encontrados = useMemo(() => {
    const t = normalizar(q.trim());
    return t.length < 2 ? [] : alumnos.filter((a) => a.activo && (normalizar(a.nombre).includes(t) || a.telefono.includes(t))).slice(0, 6);
  }, [q, alumnos]);
  if (!producto) return <p className="text-ink-500">Primero da de alta artículos en Ajustes → Productos.</p>;
  const opciones = producto.opciones ?? [];
  const falta = !alumno || (opciones.length > 0 && !opcion);

  return (
    <div className="space-y-4">
      {alumno ? (
        <button onClick={() => setAlumno(null)} className="flex w-full items-center justify-between rounded-xl bg-superficie px-4 py-3 text-left ring-1 ring-ink-100">
          <span className="font-semibold">{alumno.nombre}</span>
          <span className="text-sm text-brand-600">Cambiar</span>
        </button>
      ) : (
        <Campo etiqueta="¿Para quién?">
          <Entrada value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o teléfono del alumno" autoFocus />
          {encontrados.length > 0 && (
            <div className="mt-1 divide-y divide-ink-100 rounded-xl bg-superficie ring-1 ring-ink-100">
              {encontrados.map((a) => (
                <button key={a.id} type="button" onClick={() => setAlumno(a)} className="block w-full px-4 py-2.5 text-left active:bg-ink-50">
                  {a.nombre}
                </button>
              ))}
            </div>
          )}
        </Campo>
      )}
      <Campo etiqueta="Producto">
        <Selector
          value={producto.id}
          onChange={(e) => {
            setProductoId(e.target.value);
            setOpcion(null);
          }}
        >
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {dinero(p.precio)}
              {p.sobrePedido ? ' · sobre pedido' : ''}
            </option>
          ))}
        </Selector>
      </Campo>
      {opciones.length > 0 && (
        <div role="group" aria-label="Talla">
          <p className="mb-1.5 px-1 text-sm font-medium text-ink-700">Talla</p>
          <div className="flex flex-wrap gap-2">
            {opciones.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={opcion === o}
                onClick={() => setOpcion(o)}
                className={cx('h-11 min-w-12 rounded-xl px-3 font-semibold ring-1', opcion === o ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      <Campo etiqueta="Detalles (color, diseño…)">
        <Entrada value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. negras, tacón 5 cm" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Piezas">
          <Entrada inputMode="numeric" value={String(cantidad)} onChange={(e) => setCantidad(Math.max(1, Math.min(20, Number(e.target.value.replace(/\D/g, '')) || 1)))} />
        </Campo>
        <Campo etiqueta="Anticipo (opcional)">
          <Entrada inputMode="decimal" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} placeholder="$" />
        </Campo>
      </div>
      {aCentavos(anticipo) > 0 && <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />}
      <Boton
        grande
        bloque
        disabled={ocupado || falta}
        onClick={async () => {
          if (!alumno) return;
          setOcupado(true);
          try {
            await crearEncargo({ alumnoId: alumno.id, producto, opcion, nota, cantidad, anticipo: aCentavos(anticipo), metodo, usuarioId: usuario.id, sedeId });
            avisar(`Encargo registrado · ${dinero(producto.precio * cantidad)}${aCentavos(anticipo) ? ` (anticipo ${dinero(aCentavos(anticipo))})` : ''}`);
            onHecho();
          } catch (e) {
            avisar(e instanceof Error ? e.message : 'No se pudo registrar', 'error');
          } finally {
            setOcupado(false);
          }
        }}
      >
        {!alumno ? 'Elige al alumno' : opciones.length && !opcion ? 'Elige la talla' : `Registrar encargo · ${dinero(producto.precio * cantidad)}`}
      </Boton>
    </div>
  );
}
