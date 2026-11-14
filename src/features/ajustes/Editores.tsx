import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { useRentas } from '../../app/datos';
import { rentasQueChocanConClase } from '../../domain/agenda';
import { colorClase, nombreClase, nombreMaestro, useClases, useDisciplinas, useExistencias, usePedidosPendientes, useMaestros, usePlanes, useProductos, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, EntradaClave, Etiqueta, Hoja, Segmentos, Selector, Tarjeta, cx } from '../../components/ui';
import { actualizar, borrar, crear } from '../../db/repo';
import { NOMBRE_ROL, type CategoriaProducto, type Clase, type Disciplina, type ID, type Maestro, type Plan, type Producto, type Rol, type Sede, type TipoPlan, type Usuario } from '../../db/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../../db/db';
import { baseTieneColumna } from '../../sync/supabase';
import { LARGO_PIN, crearUsuario, hashPin, largoPin, pinDebil, pinValido } from '../../domain/acceso';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { DIAS_CORTOS } from '../../domain/fechas';
import { describirPlan } from '../alumnos/VenderPlan';
import { EMOJIS_PRODUCTO, estadoExistencia } from '../../domain/tienda';
import { PRINCIPAL, nombreSede, useSedes } from '../../app/sedes';
import { conSede } from '../../domain/sedes';
import { VIGENCIA_BECA, esBeca } from '../../domain/becas';

/** Lista + hoja de edición: patrón común de todos los catálogos. */
function Catalogo<T extends { id: ID }>({
  items,
  fila,
  titulo,
  form,
  textoNuevo,
}: {
  items: T[];
  fila: (x: T) => ReactNode;
  titulo: (x: T | null) => string;
  form: (x: T | null, cerrar: () => void) => ReactNode;
  textoNuevo: string;
}) {
  const [sel, setSel] = useState<T | null | 'nuevo'>(null);
  const cerrar = () => setSel(null);
  const actual = sel === 'nuevo' ? null : sel;
  return (
    <>
      <Tarjeta className="divide-y divide-ink-100">
        {items.map((x) => (
          <button key={x.id} onClick={() => setSel(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
            {fila(x)}
          </button>
        ))}
      </Tarjeta>
      <Boton bloque variante="secundario" className="mt-3" onClick={() => setSel('nuevo')}>
        <Plus size={18} /> {textoNuevo}
      </Boton>
      <Hoja abierta={sel !== null} onCerrar={cerrar} titulo={sel !== null ? titulo(actual) : ''}>
        {sel !== null && form(actual, cerrar)}
      </Hoja>
    </>
  );
}

const NUEVO = '__nuevo__';

// ---------- Maestros ----------
export function EditorMaestros() {
  const maestros = useMaestros();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const suyas = (m: Maestro) => clases.filter((c) => c.maestroId === m.id && c.activo);
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Da de alta a los maestros y asígnalos a sus clases. Así ves cuántos alumnos y cuánto dinero entra en cada clase de cada maestro.</p>
      <Catalogo
        items={maestros}
        textoNuevo="Nuevo maestro"
        titulo={(m) => (m ? m.nombre : 'Nuevo maestro')}
        fila={(m) => (
          <>
            <Avatar nombre={m.nombre} tam={40} />
            <span className={cx('min-w-0 flex-1', !m.activo && 'opacity-40')}>
              <span className="block truncate font-semibold">{m.nombre}</span>
              <span className="block truncate text-sm text-ink-500">
                {suyas(m).map((c) => nombreClase(c, disciplinas)).join(', ') || 'Sin clases asignadas'}
              </span>
            </span>
            {!m.activo && <Etiqueta>Inactivo</Etiqueta>}
          </>
        )}
        form={(m, cerrar) => <FormMaestro maestro={m} clases={m ? suyas(m) : []} disciplinas={disciplinas} onHecho={cerrar} />}
      />
    </>
  );
}

function FormMaestro({ maestro, clases, disciplinas, onHecho }: { maestro: Maestro | null; clases: Clase[]; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(maestro?.nombre ?? '');
  const [telefono, setTelefono] = useState(maestro?.telefono ?? '');
  const [notas, setNotas] = useState(maestro?.notas ?? '');
  const [activo, setActivo] = useState(maestro?.activo ?? true);

  const guardar = async () => {
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: telefono.replace(/\D/g, ''), notas: notas.trim(), activo };
    if (maestro) await actualizar('maestros', maestro.id, datos);
    else await crear('maestros', datos);
    avisar('Maestro guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!maestro} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Profe Luis" />
      </Campo>
      <Campo etiqueta="WhatsApp (opcional)">
        <Entrada type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. cobra por clase" />
      </Campo>
      {maestro && (
        <div className="rounded-2xl bg-superficie p-4 text-sm ring-1 ring-ink-100">
          <p className="font-semibold">Clases que da</p>
          <p className="mt-1 text-ink-500">
            {clases.length ? clases.map((c) => `${nombreClase(c, disciplinas)} (${c.dias.map((d) => DIAS_CORTOS[d]).join(' ')} ${c.horaInicio})`).join(' · ') : 'Asígnale clases en “Clases y horarios”.'}
          </p>
        </div>
      )}
      {maestro && <Interruptor valor={activo} onChange={setActivo} texto="Sigue dando clases" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim()}>
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Sedes ----------
const COLORES_SEDE = ['#d6304a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#0d9488', '#db2777', '#3d3a48'];

export function EditorSedes() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const sedes = useLiveQuery(async () => (await db.sedes.filter((x) => !x.deletedAt).toArray()).sort((a, b) => a.nombre.localeCompare(b.nombre)), [], [] as Sede[]);
  const clases = useClases();
  const [principal, setPrincipal] = useState(academia.sedePrincipal ?? '');
  const cuenta = (id: ID | null) => clases.filter((c) => (c.sedeId ?? null) === id && c.activo).length;
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">
        Los lugares donde se dan clases. Cada clase pertenece a una sede, y cada equipo elige en Entrada dónde está trabajando: así ve solo esas clases, cobra el precio de esa sede y su corte de caja es aparte.
      </p>
      <Tarjeta className="mb-3 space-y-2 p-4">
        <p className="text-sm font-semibold">Sede principal</p>
        <div className="flex gap-2">
          <Entrada value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Ej. Estudio Calo" />
          <Boton
            variante="secundario"
            disabled={principal.trim() === (academia.sedePrincipal ?? '')}
            onClick={async () => {
              await actualizar('academias', academia.id, { sedePrincipal: principal.trim() || null });
              avisar('Sede principal guardada');
            }}
          >
            Guardar
          </Boton>
        </div>
        <p className="text-xs text-ink-500">{cuenta(null)} clases · Es el lugar de todo lo que ya existía.</p>
      </Tarjeta>
      <Catalogo
        items={sedes}
        textoNuevo="Nueva sede"
        titulo={(x) => (x ? x.nombre : 'Nueva sede')}
        fila={(x) => (
          <>
            <span className="h-4 w-4 rounded-full" style={{ background: x.color }} />
            <span className={cx('flex-1 font-semibold', !x.activo && 'opacity-40')}>{x.nombre}</span>
            <span className="text-sm text-ink-500">{cuenta(x.id)} clases</span>
          </>
        )}
        form={(x, cerrar) => <FormSede sede={x} onHecho={cerrar} />}
      />
    </>
  );
}

function FormSede({ sede, onHecho }: { sede: Sede | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(sede?.nombre ?? '');
  const [color, setColor] = useState(sede?.color ?? COLORES_SEDE[1]);
  const [activo, setActivo] = useState(sede?.activo ?? true);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada autoFocus={!sede} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Casa de Cultura" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="flex flex-wrap gap-3">
          {COLORES_SEDE.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </Campo>
      {sede && <Interruptor valor={activo} onChange={setActivo} texto="Sede activa" />}
      <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">Después: asigna sus clases en “Clases y horarios” y, si su precio es distinto, crea su “Clase suelta” en “Planes y precios”.</p>
      <Boton
        grande
        bloque
        disabled={!nombre.trim()}
        onClick={async () => {
          const datos = { nombre: nombre.trim(), color, activo };
          if (sede) await actualizar('sedes', sede.id, datos);
          else await crear('sedes', datos);
          avisar('Sede guardada');
          onHecho();
        }}
      >
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Productos (tienda) ----------
export function EditorProductos() {
  const productos = useProductos();
  const stock = useExistencias();
  const pendientes = usePedidosPendientes();
  const reservadas = (id: ID) => pendientes.filter((x) => x.pedido.productoId === id).reduce((s, x) => s + x.pedido.cantidad, 0);
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Lo que se vende en recepción: aguas, snacks, playeras… Se cobra desde Entrada con el botón Tienda, en la misma cuenta que la clase.</p>
      <Catalogo
        items={productos}
        textoNuevo="Nuevo producto"
        titulo={(p) => (p ? p.nombre : 'Nuevo producto')}
        fila={(p) => {
          const d = stock.get(p.id) ?? null;
          const est = estadoExistencia(p, d);
          return (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-50 text-2xl">{p.emoji}</span>
              <span className={cx('min-w-0 flex-1', !p.activo && 'opacity-40')}>
                <span className="block truncate font-semibold">{p.nombre}</span>
                <span className="block text-sm text-ink-500">
                  {p.categoria === 'consumo' ? 'Snacks y bebidas' : 'Artículos'}
                  {p.enLinea && ' · en el portal'}
                  {reservadas(p.id) > 0 && ` · ${reservadas(p.id)} apartad${reservadas(p.id) === 1 ? 'a' : 'as'}`}
                </span>
              </span>
              {est !== 'libre' && <Etiqueta tono={est === 'agotado' ? 'sin' : est === 'pocas' ? 'pronto' : 'neutro'}>{est === 'agotado' ? 'Agotado' : `Quedan ${d}`}</Etiqueta>}
              <span className="w-16 text-right font-bold">{dinero(p.precio)}</span>
            </>
          );
        }}
        form={(p, cerrar) => <FormProducto producto={p} disponibles={p ? (stock.get(p.id) ?? null) : null} reservadas={p ? reservadas(p.id) : 0} onHecho={cerrar} />}
      />
    </>
  );
}

function FormProducto({ producto, disponibles: libres, reservadas, onHecho }: { producto: Producto | null; disponibles: number | null; reservadas: number; onHecho: () => void }) {
  // En el anaquel también están las piezas apartadas: el conteo físico las incluye
  const disponibles = libres === null ? null : libres + reservadas;
  const avisar = useAvisos();
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [emoji, setEmoji] = useState(producto?.emoji ?? '💧');
  const [precio, setPrecio] = useState(producto ? aPesosTexto(producto.precio) : '');
  const [categoria, setCategoria] = useState<CategoriaProducto>(producto?.categoria ?? 'consumo');
  const [controlar, setControlar] = useState(producto ? producto.inventario !== null : false);
  const [hay, setHay] = useState(disponibles !== null ? String(Math.max(0, disponibles)) : '');
  const [alerta, setAlerta] = useState(String(producto?.alerta ?? 5));
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [enLinea, setEnLinea] = useState(producto?.enLinea ?? false);
  const [opciones, setOpciones] = useState((producto?.opciones ?? []).join(', '));
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const listaOpciones = [...new Set(opciones.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12);

  const guardar = async () => {
    const nuevoConteo = controlar ? Number(hay) || 0 : null;
    // Solo se reinicia el conteo si cambió lo que hay (así no se pierden ventas de otros equipos)
    const cambioConteo = controlar && (disponibles === null || nuevoConteo !== Math.max(0, disponibles));
    const datos = {
      nombre: nombre.trim(),
      emoji,
      precio: aCentavos(precio),
      categoria,
      alerta: Number(alerta) || 0,
      activo,
      enLinea,
      descripcion: descripcion.trim(),
      // solo se manda si hay opciones (o si había y se quitaron), para no depender de la columna nueva
      ...(listaOpciones.length || producto?.opciones?.length ? { opciones: listaOpciones } : {}),
      ...(controlar ? (cambioConteo ? { inventario: nuevoConteo, inventarioAt: Date.now() } : {}) : { inventario: null, inventarioAt: null }),
    };
    if (producto) await actualizar('productos', producto.id, datos);
    else await crear('productos', { foto: null, inventario: null, inventarioAt: null, ...datos });
    avisar('Producto guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Ícono" grupo>
        <div className="grid grid-cols-7 gap-1.5">
          {EMOJIS_PRODUCTO.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} aria-label={e} aria-pressed={emoji === e}
              className={cx('flex h-11 items-center justify-center rounded-xl text-2xl ring-1', emoji === e ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-superficie ring-ink-100')}>
              {e}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Agua 600 ml" autoFocus={!producto} />
        </Campo>
        <Campo etiqueta="Precio">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
        </Campo>
      </div>
      <Segmentos<CategoriaProducto>
        opciones={[
          { valor: 'consumo', texto: 'Snacks y bebidas' },
          { valor: 'articulo', texto: 'Artículos' },
        ]}
        valor={categoria}
        onChange={setCategoria}
      />
      <Interruptor valor={controlar} onChange={setControlar} texto="Llevar existencias" />
      {controlar && (
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
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || aCentavos(precio) <= 0 || (controlar && hay === '')}>
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Clases ----------
export function EditorClases() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const ordenadas = [...clases].sort((a, b) => nombreClase(a, disciplinas).localeCompare(nombreClase(b, disciplinas)) || a.horaInicio.localeCompare(b.horaInicio));
  return (
    <Catalogo
      items={ordenadas}
      textoNuevo="Nueva clase"
      titulo={(c) => (c ? nombreClase(c, disciplinas) : 'Nueva clase')}
      fila={(c) => (
        <>
          <span className="h-3 w-3 rounded-full" style={{ background: colorClase(c, disciplinas) }} />
          <span className={cx('flex-1', !c.activo && 'opacity-40')}>
            <span className="block font-semibold">{nombreClase(c, disciplinas)}</span>
            <span className="block text-sm text-ink-500">
              {sedes.length > 0 && `${nombreSede(c.sedeId, sedes, academia)} · `}
              {c.dias.map((d) => DIAS_CORTOS[d]).join(', ') || 'Sin días'} · {c.horaInicio}
              {nombreMaestro(c, maestros) && ` · ${nombreMaestro(c, maestros)}`}
            </span>
          </span>
          {!c.activo && <Etiqueta>Pausada</Etiqueta>}
        </>
      )}
      form={(c, cerrar) => <FormClase clase={c} disciplinas={disciplinas} onHecho={cerrar} />}
    />
  );
}

function FormClase({ clase, disciplinas, onHecho }: { clase: Clase | null; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const [disciplinaId, setDisciplinaId] = useState(clase?.disciplinaId ?? disciplinas[0]?.id ?? '');
  const [nivel, setNivel] = useState(clase?.nivel ?? '');
  const maestros = useMaestros().filter((m) => m.activo || m.id === clase?.maestroId);
  const [maestroId, setMaestroId] = useState<string>(clase?.maestroId ?? '');
  const [maestroNuevo, setMaestroNuevo] = useState('');
  const [dias, setDias] = useState<number[]>(clase?.dias ?? []);
  const [hora, setHora] = useState(clase?.horaInicio ?? '19:00');
  const [duracion, setDuracion] = useState(String(clase?.duracionMin ?? 60));
  const [activo, setActivo] = useState(clase?.activo ?? true);
  const sedes = useSedes();
  const [sedeId, setSedeId] = useState<string>(clase?.sedeId ?? '');
  const rentas = useRentas();
  const chocaCon = rentasQueChocanConClase({ id: clase?.id, dias, horaInicio: hora, duracionMin: Number(duracion) || 60, sedeId: sedeId || null }, rentas);

  const guardar = async () => {
    let idMaestro: ID | null = maestroId && maestroId !== NUEVO ? maestroId : null;
    if (maestroId === NUEVO && maestroNuevo.trim()) {
      idMaestro = (await crear('maestros', { nombre: maestroNuevo.trim().replace(/\s+/g, ' '), telefono: '', notas: '', activo: true })).id;
    }
    const datos = { ...conSede(sedeId, clase?.sedeId), disciplinaId, nivel: nivel.trim(), maestroId: idMaestro, dias: [...dias].sort(), horaInicio: hora, duracionMin: Number(duracion) || 60, activo };
    if (clase) await actualizar('clases', clase.id, datos);
    else await crear('clases', datos);
    avisar('Clase guardada');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Disciplina">
          <Selector value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Nivel">
          <Entrada value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder="0, 1, 2…" />
        </Campo>
      </div>
      <Campo etiqueta="Días" grupo>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])}
              className={cx('h-11 rounded-xl text-sm font-semibold ring-1', dias.includes(d) ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
            >
              {DIAS_CORTOS[d]}
            </button>
          ))}
        </div>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Hora">
          <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
        <Campo etiqueta="Duración (min)">
          <Entrada inputMode="numeric" value={duracion} onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ''))} />
        </Campo>
      </div>
      {sedes.length > 0 && (
        <Campo etiqueta="Sede">
          <Selector value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">{nombreSede(null, sedes, academia)}</option>
            {sedes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <Campo etiqueta="Maestro">
        <Selector value={maestroId} onChange={(e) => setMaestroId(e.target.value)}>
          <option value="">Sin asignar</option>
          {maestros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          <option value={NUEVO}>+ Nuevo maestro…</option>
        </Selector>
      </Campo>
      {maestroId === NUEVO && (
        <Campo etiqueta="Nombre del nuevo maestro">
          <Entrada autoFocus value={maestroNuevo} onChange={(e) => setMaestroNuevo(e.target.value)} placeholder="Ej. Profe Luis" />
        </Campo>
      )}
      <Interruptor valor={activo} onChange={setActivo} texto="Clase activa" />
      {chocaCon.length > 0 && (
        <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          Ojo: a esa hora el salón está rentado a {chocaCon.map((r) => r.nombre).join(', ')}. Revisa la Agenda antes de guardar.
        </p>
      )}
      <Boton grande bloque onClick={guardar} disabled={!disciplinaId || !dias.length}>
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Planes ----------
export function EditorPlanes() {
  const { academia } = useSesion();
  const sedes = useSedes();
  const planes = usePlanes();
  const orden: Record<TipoPlan, number> = { suelta: 0, mensual: 1, paquete: 2 };
  return (
    <Catalogo
      items={[...planes].sort((a, b) => (esBeca(a) ? 3 : orden[a.tipo]) - (esBeca(b) ? 3 : orden[b.tipo]))}
      textoNuevo="Nuevo plan"
      titulo={(p) => (p ? p.nombre : 'Nuevo plan')}
      fila={(p) => (
        <>
          <span className={cx('flex-1', !p.activo && 'opacity-40')}>
            <span className="block font-semibold">{p.nombre}</span>
            <span className="block text-sm text-ink-500">
              {describirPlan(p)}
              {sedes.length > 0 && ` · ${p.sedeId ? `solo ${p.sedeId === PRINCIPAL ? nombreSede(null, sedes, academia) : nombreSede(p.sedeId, sedes, academia)}` : 'todas las sedes'}`}
            </span>
          </span>
          {esBeca(p) ? <Etiqueta tono="ok">Beca</Etiqueta> : <span className="font-bold">{dinero(p.precio)}</span>}
        </>
      )}
      form={(p, cerrar) => <FormPlan plan={p} onHecho={cerrar} />}
    />
  );
}

function FormPlan({ plan, onHecho }: { plan: Plan | null; onHecho: () => void }) {
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const [nombre, setNombre] = useState(plan?.nombre ?? '');
  // 'beca' solo existe en el formulario: se guarda como paquete de $0 con clases ilimitadas
  const [tipo, setTipo] = useState<TipoPlan | 'beca'>(esBeca(plan) ? 'beca' : (plan?.tipo ?? 'mensual'));
  const [precio, setPrecio] = useState(plan ? aPesosTexto(plan.precio) : '');
  const [clases, setClases] = useState(String(plan?.clases ?? 8));
  const [vigencia, setVigencia] = useState(String(plan?.vigenciaDias ?? (esBeca(plan) ? VIGENCIA_BECA : 30)));
  const [disciplinaId, setDisciplinaId] = useState<ID | ''>(plan?.disciplinaId ?? '');
  const [activo, setActivo] = useState(plan?.activo ?? true);
  const { academia } = useSesion();
  const sedes = useSedes();
  const [alcance, setAlcance] = useState<string>(plan?.sedeId ?? '');

  const guardar = async () => {
    const datos = {
      ...conSede(alcance, plan?.sedeId),
      nombre: nombre.trim(),
      tipo: tipo === 'beca' ? ('paquete' as const) : tipo,
      precio: tipo === 'beca' ? 0 : aCentavos(precio),
      clases: tipo === 'paquete' ? Number(clases) || 1 : tipo === 'suelta' ? 1 : null,
      vigenciaDias: tipo === 'paquete' ? Number(vigencia) || 30 : tipo === 'beca' ? Number(vigencia) || VIGENCIA_BECA : null,
      disciplinaId: disciplinaId || null,
      activo,
    };
    if (plan) await actualizar('planes', plan.id, datos);
    else await crear('planes', datos);
    avisar('Plan guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Segmentos<TipoPlan | 'beca'>
        opciones={[
          { valor: 'suelta', texto: 'Por clase' },
          { valor: 'mensual', texto: 'Mensual' },
          { valor: 'paquete', texto: 'Paquete' },
          { valor: 'beca', texto: 'Beca' },
        ]}
        valor={tipo}
        onChange={(t) => {
          setTipo(t);
          if (t === 'beca' && !plan) setVigencia(String(VIGENCIA_BECA));
          if (t === 'paquete' && !plan) setVigencia('30');
        }}
      />
      {tipo === 'beca' && (
        <p className="rounded-xl bg-ok-50 px-3 py-2 text-sm text-ok-600">
          El alumno becado entra a sus clases sin pagar. Solo la dirección puede dar becas; al terminar la vigencia se renueva desde su ficha.
        </p>
      )}
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'suelta' ? 'Clase suelta' : tipo === 'mensual' ? 'Mensualidad' : tipo === 'beca' ? 'Beca' : 'Paquete 8 clases'} />
      </Campo>
      {tipo === 'beca' ? (
        <Campo etiqueta="Vigencia (días)" ayuda="180 días ≈ un semestre.">
          <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencia(e.target.value.replace(/\D/g, ''))} />
        </Campo>
      ) : (
        <Campo etiqueta="Precio">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
        </Campo>
      )}
      {tipo === 'paquete' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Clases">
            <Entrada inputMode="numeric" value={clases} onChange={(e) => setClases(e.target.value.replace(/\D/g, ''))} />
          </Campo>
          <Campo etiqueta="Vigencia (días)">
            <Entrada inputMode="numeric" value={vigencia} onChange={(e) => setVigencia(e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      )}
      {sedes.length > 0 && (
        <Campo
          etiqueta={tipo === 'suelta' ? '¿En qué sede aplica este precio?' : '¿En qué sedes sirve?'}
          ayuda={tipo === 'suelta' ? 'Puedes tener un precio de clase suelta distinto en cada sede.' : undefined}
        >
          <Selector value={alcance} onChange={(e) => setAlcance(e.target.value)}>
            <option value="">Todas las sedes</option>
            <option value={PRINCIPAL}>Solo {nombreSede(null, sedes, academia)}</option>
            {sedes.map((x) => (
              <option key={x.id} value={x.id}>
                Solo {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      {tipo !== 'suelta' && (
        <Campo etiqueta="¿Para qué clases sirve?">
          <Selector value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)}>
            <option value="">Todas las disciplinas</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                Solo {d.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <Interruptor valor={activo} onChange={setActivo} texto="Disponible para vender" />
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || (tipo === 'beca' ? !(Number(vigencia) > 0) : aCentavos(precio) <= 0)}>
        Guardar
      </Boton>
    </div>
  );
}

// ---------- Disciplinas ----------
const COLORES = ['#e8445a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#db2777', '#0d9488', '#3d3a48'];

export function EditorDisciplinas() {
  const disciplinas = useDisciplinas();
  const clases = useClases();
  return (
    <Catalogo
      items={disciplinas}
      textoNuevo="Nueva disciplina"
      titulo={(d) => (d ? d.nombre : 'Nueva disciplina')}
      fila={(d) => (
        <>
          <span className="h-4 w-4 rounded-full" style={{ background: d.color }} />
          <span className="flex-1 font-semibold">{d.nombre}</span>
          <span className="text-sm text-ink-500">{clases.filter((c) => c.disciplinaId === d.id).length} clases</span>
        </>
      )}
      form={(d, cerrar) => <FormDisciplina disciplina={d} enUso={!!d && clases.some((c) => c.disciplinaId === d.id)} onHecho={cerrar} />}
    />
  );
}

function FormDisciplina({ disciplina, enUso, onHecho }: { disciplina: Disciplina | null; enUso: boolean; onHecho: () => void }) {
  const [nombre, setNombre] = useState(disciplina?.nombre ?? '');
  const [color, setColor] = useState(disciplina?.color ?? COLORES[2]);
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Cumbia, Kizomba" />
      </Campo>
      <Campo etiqueta="Color" grupo>
        <div className="flex flex-wrap gap-3">
          {COLORES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-10 w-10 rounded-full ring-offset-2', color === c && 'ring-2 ring-ink-900')} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </Campo>
      <Boton
        grande
        bloque
        disabled={!nombre.trim()}
        onClick={async () => {
          if (disciplina) await actualizar('disciplinas', disciplina.id, { nombre: nombre.trim(), color });
          else await crear('disciplinas', { nombre: nombre.trim(), color });
          onHecho();
        }}
      >
        Guardar
      </Boton>
      {disciplina && !enUso && (
        <Boton bloque variante="peligro" onClick={async () => { await borrar('disciplinas', disciplina.id); onHecho(); }}>
          Eliminar
        </Boton>
      )}
    </div>
  );
}

// ---------- Usuarios ----------
export function EditorUsuarios() {
  const usuarios = useUsuarios();
  return (
    <>
      <p className="mb-3 text-sm text-ink-500">Cada persona que cobra tiene su PIN. Así cada cobro queda registrado con su nombre.</p>
      <Catalogo
        items={usuarios}
        textoNuevo="Nuevo usuario"
        titulo={(u) => (u ? u.nombre : 'Nuevo usuario')}
        fila={(u) => (
          <>
            <Avatar nombre={u.nombre} tam={36} />
            <span className={cx('flex-1 font-semibold', !u.activo && 'opacity-40')}>{u.nombre}</span>
            <Etiqueta tono={u.rol === 'dueno' ? 'marca' : u.rol === 'maestro' ? 'ok' : 'neutro'}>{NOMBRE_ROL[u.rol]}</Etiqueta>
          </>
        )}
        form={(u, cerrar) => <FormUsuario usuario={u} onHecho={cerrar} />}
      />
    </>
  );
}

function FormUsuario({ usuario, onHecho }: { usuario: Usuario | null; onHecho: () => void }) {
  const { academia, usuario: yo } = useSesion();
  const avisar = useAvisos();
  const usuarios = useUsuarios();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'recepcion');
  const maestros = useMaestros().filter((m) => m.activo);
  const [maestroId, setMaestroId] = useState<string>(usuario?.maestroId ?? '');
  const vinculada = useLiveQuery(() => getMeta<boolean>('nubeVinculada'), [], false);
  // Si usa nube, el rol "maestro" requiere la base actualizada (si no, la sincronización fallaría)
  const baseLista = useLiveQuery(async () => (vinculada ? baseTieneColumna('usuarios', 'maestro_id') : true), [vinculada], true);
  const [pin, setPin] = useState('');
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const esUltimoDueno = usuario?.rol === 'dueno' && usuarios.filter((u) => u.rol === 'dueno' && u.activo).length === 1;
  const pinOk = pinValido(pin);

  const guardar = async () => {
    if (usuario) {
      await actualizar('usuarios', usuario.id, {
        nombre: nombre.trim(),
        rol: esUltimoDueno ? 'dueno' : rol,
        maestroId: rol === 'maestro' ? maestroId || null : null,
        activo: esUltimoDueno || usuario.id === yo.id ? true : activo,
        ...(pinOk ? { pinHash: await hashPin(pin, academia.id) } : {}),
      });
    } else {
      await crearUsuario({ nombre, rol, pin, academiaId: academia.id, maestroId: maestroId || null });
    }
    avisar('Usuario guardado');
    onHecho();
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      {!esUltimoDueno && (
        <Segmentos<Rol>
          opciones={[
            { valor: 'recepcion', texto: 'Recepción' },
            { valor: 'maestro', texto: 'Maestro' },
            { valor: 'dueno', texto: 'Dueño' },
          ]}
          valor={rol}
          onChange={(r) => {
            setRol(r);
            if (r === 'maestro' && !nombre.trim() && maestros.length === 1) setNombre(maestros[0].nombre);
          }}
        />
      )}
      <p className="-mt-2 px-1 text-xs text-ink-500">
        {rol === 'dueno'
          ? 'Ve y cambia todo: precios, usuarios, reportes y dinero.'
          : rol === 'recepcion'
            ? 'Cobra, da entradas y hace el corte. No cambia precios ni usuarios.'
            : 'Solo ve sus clases: quién llegó, quién es nuevo y sus números. Nunca ve dinero.'}
      </p>
      {rol === 'maestro' &&
        (!baseLista ? (
          <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
            Para dar acceso a maestros hay que actualizar la base de datos (correr supabase/schema.sql). Pídeselo a tu proveedor.
          </p>
        ) : (
          <Campo etiqueta="¿Qué maestro es?">
            <Selector
              value={maestroId}
              onChange={(e) => {
                setMaestroId(e.target.value);
                const m = maestros.find((x) => x.id === e.target.value);
                if (m && !nombre.trim()) setNombre(m.nombre);
              }}
            >
              <option value="">Elige…</option>
              {maestros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
        ))}
      <Campo etiqueta={usuario ? `Nuevo PIN de ${LARGO_PIN} dígitos (déjalo vacío para no cambiarlo)` : `PIN de ${LARGO_PIN} dígitos`} ayuda={usuario && largoPin(usuario) < LARGO_PIN ? `Su PIN actual es de ${largoPin(usuario)} dígitos: cámbialo por uno de ${LARGO_PIN} para más seguridad.` : 'Evita fechas de nacimiento o números seguidos (123456).'}>
        <EntradaClave inputMode="numeric" maxLength={LARGO_PIN} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
        {pin.length === LARGO_PIN && pinDebil(pin) && <span className="mt-1 block text-xs font-medium text-bad-600">Muy fácil de adivinar: usa números sin orden.</span>}
      </Campo>
      {usuario && !esUltimoDueno && usuario.id !== yo.id && <Interruptor valor={activo} onChange={setActivo} texto="Puede entrar a la app" />}
      <Boton grande bloque onClick={guardar} disabled={!nombre.trim() || (!usuario && !pinOk) || (pin.length > 0 && !pinOk) || (rol === 'maestro' && (!maestroId || !baseLista))}>
        Guardar
      </Boton>
    </div>
  );
}

function Interruptor({ valor, onChange, texto }: { valor: boolean; onChange: (v: boolean) => void; texto: string }) {
  return (
    <button type="button" onClick={() => onChange(!valor)} className="flex w-full items-center justify-between rounded-xl bg-superficie px-4 py-3 ring-1 ring-ink-100">
      <span className="font-medium">{texto}</span>
      <span className={cx('relative h-7 w-12 rounded-full transition', valor ? 'bg-ok-600' : 'bg-ink-300')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-superficie shadow transition-all', valor ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
