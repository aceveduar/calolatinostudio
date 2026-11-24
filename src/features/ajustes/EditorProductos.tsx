import { useRef, useState } from 'react';
import { Barcode, Camera, ImagePlus, Plus, Trash2, Truck } from 'lucide-react';
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
  const reservadas = (id: ID) => pendientes.filter((x) => x.pedido.productoId === id).reduce((s, x) => s + x.pedido.cantidad, 0);
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Lo que se vende en recepción: aguas, snacks, playeras… Se cobra desde Entrada con el botón Tienda, en la misma cuenta que la clase.</p>
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
        arriba={(nuevo) => (
          // lo de todos los días arriba y lado a lado (antes 3 botones a lo ancho y "Nuevo" hasta abajo de la lista)
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Boton bloque onClick={nuevo}>
                <Plus size={18} /> Nuevo
              </Boton>
              <Boton bloque variante="secundario" onClick={() => setCamara(true)}>
                <Barcode size={18} /> Escanear
              </Boton>
            </div>
            <Link to="/encargos" className="flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-brand-600">
              <Truck size={16} aria-hidden="true" /> Encargos y proveedor
            </Link>
          </div>
        )}
        titulo={(p) => (p ? p.nombre : 'Nuevo producto')}
        fila={(p) => {
          const d = stock.get(p.id) ?? null;
          const est = estadoExistencia(p, d);
          return (
            <>
              <ImagenProducto foto={p.foto} tam={40} />
              <span className={cx('min-w-0 flex-1', !p.activo && 'opacity-40')}>
                <span className="block truncate font-semibold">{p.nombre}</span>
                {/* una línea corta de texto y lo demás como etiquetas (antes 3 renglones apretados) */}
                <span className="block truncate text-sm text-ink-500">
                  {p.categoria === 'consumo' ? 'Snacks y bebidas' : 'Artículos'}
                  {p.costo ? ` · te deja ${dinero(p.precio - p.costo)}` : ''}
                </span>
                {(est !== 'libre' || p.enLinea || reservadas(p.id) > 0) && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {est !== 'libre' && <Etiqueta tono={est === 'agotado' ? 'sin' : est === 'pocas' ? 'pronto' : 'neutro'}>{est === 'agotado' ? 'Agotado' : `Quedan ${d}`}</Etiqueta>}
                    {p.enLinea && <Etiqueta tono="marca">En el portal</Etiqueta>}
                    {reservadas(p.id) > 0 && <Etiqueta tono="pronto">{reservadas(p.id) === 1 ? '1 apartada' : `${reservadas(p.id)} apartadas`}</Etiqueta>}
                  </span>
                )}
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
    <Campo etiqueta="Foto del producto" ayuda="Toma una foto o elige una imagen de tu galería. Puedes agregarla después." grupo>
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

  const guardar = async () => {
    const conteo = controlar && !sobrePedido;
    const nuevoConteo = conteo ? Number(hay) || 0 : null;
    // Solo se reinicia el conteo si cambió lo que hay (así no se pierden ventas de otros equipos)
    const cambioConteo = conteo && (disponibles === null || nuevoConteo !== Math.max(0, disponibles));
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
      ...(conteo ? (cambioConteo ? { inventario: nuevoConteo, inventarioAt: Date.now() } : {}) : { inventario: null, inventarioAt: null }),
      // sobre pedido: se encarga al proveedor (solo se manda si aplica, para no depender de la columna nueva)
      ...(sobrePedido ? { sobrePedido: true, diasEntrega: Number(diasEntrega) || null } : producto?.sobrePedido ? { sobrePedido: false } : {}),
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
      <Segmentos<CategoriaProducto>
        opciones={[
          { valor: 'consumo', texto: 'Snacks y bebidas' },
          { valor: 'articulo', texto: 'Artículos' },
        ]}
        valor={categoria}
        onChange={setCategoria}
      />
      {categoria === 'articulo' && <Interruptor valor={sobrePedido} onChange={setSobrePedido} texto="Sobre pedido (se encarga al proveedor)" />}
      {sobrePedido && categoria === 'articulo' && (
        <Campo etiqueta="¿Cuántos días tarda en llegar? (aprox.)" ayuda="Se le dice al alumno al encargar. Los encargos se juntan en Encargos para mandarlos al proveedor.">
          <Entrada inputMode="numeric" value={diasEntrega} onChange={(e) => setDiasEntrega(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 15" />
        </Campo>
      )}
      {!(sobrePedido && categoria === 'articulo') && <Interruptor valor={controlar} onChange={setControlar} texto="Llevar existencias" />}
      {controlar && !(sobrePedido && categoria === 'articulo') && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="¿Cuántas hay ahora?" ayuda="Se descuentan solas al vender.">
            <Entrada inputMode="numeric" value={hay} onChange={(e) => setHay(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </Campo>
          <Campo etiqueta="Avisar cuando queden">
            <Entrada inputMode="numeric" value={alerta} onChange={(e) => setAlerta(e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      )}
      {controlar && reservadas > 0 && (
        <p className="-mt-2 px-1 text-xs text-ink-500">
          {reservadas} {reservadas === 1 ? 'pieza está apartada' : 'piezas están apartadas'} desde el portal: cuéntalas también, se descuentan al entregarlas.
        </p>
      )}
      <Interruptor valor={enLinea} onChange={setEnLinea} texto="Mostrar en el portal de alumnos" />
      {enLinea && (
        <>
          <Campo etiqueta="Tallas o colores (opcional)" ayuda="Sepáralos con comas. El alumno elige uno al apartar.">
            <Entrada value={opciones} onChange={(e) => setOpciones(e.target.value)} placeholder="Ej. CH, M, G" />
          </Campo>
          <Campo etiqueta="Descripción (opcional)">
            <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Algodón, logo bordado" />
          </Campo>
        </>
      )}
      {producto && <Interruptor valor={activo} onChange={setActivo} texto="Disponible para vender" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || aCentavos(precio) <= 0 || (controlar && hay === '') || !!repetido}>
        Guardar
      </Boton>
    </div>
  );
}
