import { useRef, useState } from 'react';
import { Barcode, Camera, ChevronDown, ImagePlus, Plus, Trash2, Truck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLectorUSB } from '../../app/codigos';
import { EscanerCodigo } from '../../components/EscanerCodigo';
import { useExistencias, usePedidosPendientes, useProductos } from '../../app/datos';
import { useAvisos } from '../../components/avisos';
import { prepararFoto } from '../../app/fotos';
import { ImagenProducto } from '../../components/ImagenProducto';
import { Boton, Campo, Entrada, Etiqueta, Hoja, Interruptor, Segmentos, cx } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import { type CategoriaProducto, type ID, type Producto } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { apartadas } from '../../domain/pedidos';
import { estadoExistencia } from '../../domain/tienda';
import { Catalogo } from './Catalogo';

// ---------- Productos (tienda) ----------
export function EditorProductos() {
  const productos = useProductos();
  const stock = useExistencias();
  // Escanear: si el código ya es de un producto lo abre; si no, da de alta uno nuevo con ese código.
  // También llega aquí desde Entrada con ?codigo=… ("Darlo de alta").
  const [params, setParams] = useSearchParams();
  const [porCodigo, setPorCodigo] = useState<{ producto: Producto | null; codigo: string } | null>(() => {
    const c = params.get('codigo');
    return c ? { producto: null, codigo: c } : null;
  });
  const [camara, setCamara] = useState(false);
  const abrirCodigo = (codigo: string) => {
    setCamara(false);
    setPorCodigo({ producto: productos.find((x) => x.codigo === codigo) ?? null, codigo });
  };
  useLectorUSB(abrirCodigo, !porCodigo && !camara);
  const pendientes = usePedidosPendientes();
  const porProducto = apartadas(pendientes.map(({ pedido }) => pedido));
  const reservadas = (id: ID) => porProducto.get(id) ?? 0;
  return (
    <>
      {camara && <EscanerCodigo titulo="Escanear producto" onCodigo={abrirCodigo} onCerrar={() => setCamara(false)} />}
      <Hoja
        abierta={!!porCodigo}
        onCerrar={() => {
          setPorCodigo(null);
          if (params.get('codigo')) setParams({}, { replace: true });
        }}
        titulo={porCodigo?.producto ? porCodigo.producto.nombre : 'Nuevo producto'}
      >
        {porCodigo && (
          <FormProducto
            key={porCodigo.codigo}
            producto={porCodigo.producto}
            codigoInicial={porCodigo.codigo}
            disponibles={porCodigo.producto ? (stock.get(porCodigo.producto.id) ?? null) : null}
            reservadas={porCodigo.producto ? reservadas(porCodigo.producto.id) : 0}
            onHecho={() => {
              setPorCodigo(null);
              if (params.get('codigo')) setParams({}, { replace: true });
            }}
          />
        )}
      </Hoja>
      <Catalogo
        items={productos}
        textoNuevo="Nuevo producto"
        vacio="Aún no hay productos."
        arriba={(nuevo) => (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Boton bloque onClick={nuevo}>
                <Plus size={18} /> Nuevo producto
              </Boton>
              <Boton bloque variante="secundario" onClick={() => setCamara(true)}>
                <Barcode size={18} /> Escanear
              </Boton>
            </div>
            <Link to="/encargos" className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-brand-600">
              <Truck size={16} aria-hidden="true" /> Ver encargos
            </Link>
          </div>
        )}
        titulo={(p) => (p ? p.nombre : 'Nuevo producto')}
        fila={(p) => {
          const d = stock.get(p.id) ?? null;
          const est = estadoExistencia(p, d);
          const porEntregar = pendientes.filter(({ pedido }) => pedido.productoId === p.id).reduce((s, { pedido }) => s + pedido.cantidad, 0);
          return (
            <>
              <ImagenProducto foto={p.foto} tam={40} />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold">{p.nombre}</span>
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-ink-500">
                  {!p.activo && <Etiqueta tono="neutro">Inactivo</Etiqueta>}
                  {p.activo && p.sobrePedido && <span>Sobre pedido</span>}
                  {p.activo && !p.sobrePedido && (est === 'agotado' || est === 'pocas') && <Etiqueta tono={est === 'agotado' ? 'sin' : 'pronto'}>{est === 'agotado' ? 'Agotado' : `Quedan ${d}`}</Etiqueta>}
                  {p.activo && !p.sobrePedido && est === 'ok' && <span>Quedan {d}</span>}
                  {p.activo && p.enLinea && <span>En el portal</span>}
                  {porEntregar > 0 && <span>{porEntregar} por entregar</span>}
                </span>
              </span>
              <span className="shrink-0 text-right font-bold">{dinero(p.precio)}</span>
            </>
          );
        }}
        form={(p, cerrar) => <FormProducto producto={p} disponibles={p ? (stock.get(p.id) ?? null) : null} reservadas={p ? reservadas(p.id) : 0} onHecho={cerrar} />}
      />
    </>
  );
}

/** Foto real del producto: con la cámara o de la galería; se guarda pequeña (400 px). */
export function FotoDeProducto({ foto, onChange }: { foto: string | null; onChange: (f: string | null) => void }) {
  const avisar = useAvisos();
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const usar = async (f: File | undefined) => {
    if (!f) return;
    setOcupado(true);
    try {
      onChange(await prepararFoto(f, 400, 70_000));
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo usar esa foto', 'error');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Campo etiqueta="Foto del producto" grupo>
      <div className="flex items-center gap-3">
        <ImagenProducto foto={foto} tam={88} className="ring-1 ring-ink-100" />
        <div className="grid flex-1 gap-2">
          <Boton variante="secundario" disabled={ocupado} onClick={() => camara.current?.click()}>
            <Camera size={18} /> {foto ? 'Tomar otra' : 'Tomar foto'}
          </Boton>
          <div className="flex gap-2">
            <Boton variante="secundario" className="flex-1" disabled={ocupado} onClick={() => galeria.current?.click()}>
              <ImagePlus size={18} /> Galería
            </Boton>
            {foto && (
              <Boton variante="fantasma" onClick={() => onChange(null)} aria-label="Quitar foto">
                <Trash2 size={18} className="text-bad-600" />
              </Boton>
            )}
          </div>
        </div>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void usar(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => { void usar(e.target.files?.[0]); e.target.value = ''; }} />
    </Campo>
  );
}

export function FormProducto({ producto, codigoInicial, disponibles: libres, reservadas, onHecho }: { producto: Producto | null; codigoInicial?: string; disponibles: number | null; reservadas: number; onHecho: () => void }) {
  // En el anaquel también están las piezas apartadas: el conteo físico las incluye
  const disponibles = libres === null ? null : libres + reservadas;
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [foto, setFoto] = useState<string | null>(producto?.foto ?? null);
  const [precio, setPrecio] = useState(producto ? aPesosTexto(producto.precio) : '');
  const [costo, setCosto] = useState(producto?.costo ? aPesosTexto(producto.costo) : '');
  const ganancia = aCentavos(precio) - aCentavos(costo);
  const [categoria, setCategoria] = useState<CategoriaProducto>(producto?.categoria ?? 'consumo');
  const [controlar, setControlar] = useState(producto ? producto.inventario !== null : false);
  const [hay, setHay] = useState(disponibles !== null ? String(Math.max(0, disponibles)) : '');
  const conteoInicial = useRef(hay);
  const [alerta, setAlerta] = useState(String(producto?.alerta ?? 5));
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [enLinea, setEnLinea] = useState(producto?.enLinea ?? false);
  const [sobrePedido, setSobrePedido] = useState(!!producto?.sobrePedido);
  const [diasEntrega, setDiasEntrega] = useState(producto?.diasEntrega ? String(producto.diasEntrega) : '');
  const [opciones, setOpciones] = useState((producto?.opciones ?? []).join(', '));
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [codigo, setCodigo] = useState(producto?.codigo ?? codigoInicial ?? '');
  const [camara, setCamara] = useState(false);
  const productos = useProductos();
  const repetido = codigo.trim() ? productos.find((x) => x.codigo === codigo.trim() && x.id !== producto?.id) : undefined;
  const listaOpciones = [...new Set(opciones.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12);
  const esSobrePedido = categoria === 'articulo' && sobrePedido;
  const llevaExistencias = controlar && !esSobrePedido;
  const agotadoEnPortal = llevaExistencias && hay !== '' && Number(hay) <= reservadas;

  const guardar = async () => {
    const nuevoConteo = llevaExistencias ? Number(hay) || 0 : null;
    // Solo se reinicia el conteo si cambió lo que hay (así no se pierden ventas de otros equipos)
    const cambioConteo = llevaExistencias && (producto?.inventario == null || nuevoConteo !== Number(conteoInicial.current));
    const datos = {
      nombre: nombre.trim(),
      // foto real del producto (si se tomó o se quitó)
      ...(foto || producto?.foto ? { foto } : {}),
      precio: aCentavos(precio),
      // costo: solo se manda si lo tiene (o si lo tenía y se quitó)
      ...(aCentavos(costo) > 0 ? { costo: aCentavos(costo) } : producto?.costo ? { costo: null } : {}),
      categoria,
      alerta: Number(alerta) || 0,
      activo,
      enLinea,
      descripcion: descripcion.trim(),
      // solo se manda si hay opciones (o si había y se quitaron), para no depender de la columna nueva
      ...(listaOpciones.length || producto?.opciones?.length ? { opciones: listaOpciones } : {}),
      ...(codigo.trim() ? { codigo: codigo.trim() } : producto?.codigo ? { codigo: null } : {}),
      ...(llevaExistencias ? (cambioConteo ? { inventario: nuevoConteo, inventarioAt: Date.now() } : {}) : { inventario: null, inventarioAt: null }),
      // sobre pedido: se encarga al proveedor (solo se manda si aplica, para no depender de la columna nueva)
      ...(esSobrePedido ? { sobrePedido: true, diasEntrega: Number(diasEntrega) || null } : producto?.sobrePedido ? { sobrePedido: false, diasEntrega: null } : {}),
    };
    if (producto) await actualizar('productos', producto.id, datos);
    else await crear('productos', { emoji: '', foto: null, inventario: null, inventarioAt: null, ...datos });
    avisar('Producto guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Agua 600 ml" autoFocus={!producto} />
        </Campo>
        <Campo etiqueta="Precio">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
        </Campo>
      </div>
      <FotoDeProducto foto={foto} onChange={setFoto} />
      <details open={!!codigoInicial} className="group rounded-xl bg-superficie ring-1 ring-ink-100">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Costo y código de barras
          <ChevronDown size={16} className="text-ink-500 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 px-3 pb-3">
          <Campo etiqueta="¿Cuánto te cuesta? (opcional)" ayuda="Solo lo ve la dirección. Sirve para saber cuánto te deja cada venta.">
            <Entrada inputMode="decimal" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="$ costo por pieza" />
          </Campo>
          {aCentavos(costo) > 0 && aCentavos(precio) > 0 && (
            <p className={cx('-mt-2 rounded-xl px-3 py-2 text-sm font-semibold', ganancia > 0 ? 'bg-ok-50 text-ok-600' : 'bg-bad-50 text-bad-600')}>
              {ganancia > 0
                ? `Te deja ${dinero(ganancia)} por pieza (${Math.round((ganancia / aCentavos(precio)) * 100)}% del precio)`
                : `Ojo: lo vendes ${ganancia === 0 ? 'al costo' : `${dinero(-ganancia)} abajo del costo`}`}
            </p>
          )}
          <Campo etiqueta="Código de barras (opcional)" ayuda="Para cobrarlo escaneando, con la cámara o con un lector.">
            <div className="flex gap-2">
              <Entrada inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\s/g, ''))} placeholder="Escanéalo o escríbelo" />
              <Boton variante="secundario" onClick={() => setCamara(true)} aria-label="Escanear código de barras">
                <Barcode size={18} />
              </Boton>
            </div>
          </Campo>
          {repetido && <p className="-mt-2 rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">Ese código ya es de “{repetido.nombre}”.</p>}
          {camara && (
            <EscanerCodigo
              titulo="Código del producto"
              onCodigo={(c) => {
                setCodigo(c);
                setCamara(false);
              }}
              onCerrar={() => setCamara(false)}
            />
          )}
        </div>
      </details>
      <Segmentos<CategoriaProducto>
        opciones={[
          { valor: 'consumo', texto: 'Snacks y bebidas' },
          { valor: 'articulo', texto: 'Artículos' },
        ]}
        valor={categoria}
        onChange={setCategoria}
      />
      {categoria === 'articulo' && <Interruptor valor={esSobrePedido} onChange={setSobrePedido} texto="Sobre pedido" />}
      {esSobrePedido && (
        <Campo etiqueta="Días estimados de entrega (opcional)" ayuda="La estimación se muestra al encargar en el portal.">
          <Entrada inputMode="numeric" value={diasEntrega} onChange={(e) => setDiasEntrega(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 15" />
        </Campo>
      )}
      {!esSobrePedido && <Interruptor valor={controlar} onChange={setControlar} texto="Llevar existencias" />}
      {llevaExistencias && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="¿Cuántas hay ahora?" ayuda="Se descuentan solas al vender.">
            <Entrada inputMode="numeric" value={hay} onChange={(e) => setHay(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </Campo>
          <Campo etiqueta="Avisar cuando queden">
            <Entrada inputMode="numeric" value={alerta} onChange={(e) => setAlerta(e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      )}
      {llevaExistencias && reservadas > 0 && (
        <p className="-mt-2 px-1 text-xs text-ink-500">
          {reservadas} {reservadas === 1 ? 'pieza está apartada' : 'piezas están apartadas'} desde el portal: cuéntalas también, se descuentan al entregarlas.
        </p>
      )}
      {producto && <Interruptor valor={activo} onChange={setActivo} texto="Disponible para vender" />}
      <section aria-label="Portal de alumnos" className="space-y-3">
        <Interruptor valor={enLinea} onChange={setEnLinea} texto="Mostrar en el portal de alumnos" />
        {enLinea && (
          <>
            <p className="px-1 text-sm text-ink-500" aria-live="polite">
              {!activo ? 'El producto está inactivo y se oculta del portal.'
                : esSobrePedido ? 'En el portal aparecerá «Encargar». El artículo se pide al proveedor.'
                  : agotadoEnPortal ? 'En el portal aparecerá «Agotado» hasta que haya existencias libres.'
                    : 'En el portal aparecerá «Apartar» para recoger en recepción.'}
            </p>
            <Campo etiqueta="Tallas o colores (opcional)" ayuda="Sepáralos con comas. El alumno elige una opción.">
              <Entrada value={opciones} onChange={(e) => setOpciones(e.target.value)} placeholder="Ej. CH, M, G" />
            </Campo>
            <Campo etiqueta="Descripción (opcional)">
              <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Algodón, logo bordado" />
            </Campo>
          </>
        )}
      </section>
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || aCentavos(precio) <= 0 || (llevaExistencias && hay === '') || !!repetido}>
        Guardar
      </Boton>
    </div>
  );
}
