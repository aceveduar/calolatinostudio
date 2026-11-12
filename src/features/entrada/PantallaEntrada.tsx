import { useCallback, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, X, Users, Footprints, CalendarDays, MoreHorizontal } from 'lucide-react';
import { colorClase, nombreClase, useAlumnos, useClases, useDisciplinas, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID, MetodoPago } from '../../db/types';
import { claseSugerida, clasesDelDia } from '../../domain/clases';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaLarga, horaDe, hoy } from '../../domain/fechas';
import { semaforoAlumno } from '../../domain/membresias';
import { anularAsistencia, cobrarClaseSuelta } from '../../domain/operaciones';
import { cambiarMetodo, deshacer, entradaRapida, entradaSinNombre, nuevoYCobrar, type Movimiento, type Resultado } from '../../domain/rapido';
import { FormAlumno } from '../alumnos/FormAlumno';
import { METODOS } from '../alumnos/VenderPlan';
import { Cuenta } from './Cuenta';
import { Frecuentes } from './Frecuentes';
import { HojaEntrada } from './HojaEntrada';

const VENTANA_JUNTOS_MS = 8000;
const normalizar =(s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const capitalizar = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export function PantallaEntrada() {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();
  const suelta = usePlanes().find((p) => p.activo && p.tipo === 'suelta');
  const deHoy = useMemo(() => clasesDelDia(clases), [clases]);

  const [claseId, setClaseId] = useState<ID | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const clase: Clase | null = clases.find((c) => c.id === claseId) ?? claseSugerida(deHoy);

  const [q, setQ] = useState('');
  const [vista, setVista] = useState<'llegan' | 'adentro'>('llegan');
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const enCurso = useRef(new Set<string>());
  // Agrupar: toques casi seguidos = pagan juntos (pareja, amigos)
  const ultimoToque = useRef(0);
  const yaPagaron = useRef(false);
  const busca = useRef<HTMLInputElement>(null);

  const hoyAsis = useLiveQuery(() => db.asistencias.where('fecha').equals(hoy()).filter((a) => !a.anuladaAt && !a.deletedAt).toArray(), [], []);
  const conteo = useMemo(() => {
    const m = new Map<ID, number>();
    for (const a of hoyAsis) m.set(a.claseId, (m.get(a.claseId) ?? 0) + 1);
    return m;
  }, [hoyAsis]);
  const adentro = useMemo(
    () => new Set(hoyAsis.filter((a) => a.claseId === clase?.id && a.alumnoId).map((a) => a.alumnoId!)),
    [hoyAsis, clase?.id],
  );
  const pagosHoy = useLiveQuery(
    async () => new Map((await db.pagos.where('fecha').equals(hoy()).filter((p) => !p.anuladoAt && !p.deletedAt).toArray()).map((p) => [p.id, p.monto])),
    [],
    new Map<ID, number>(),
  );
  const cobradoClase = useMemo(
    () => hoyAsis.filter((a) => a.claseId === clase?.id && a.pagoId).reduce((s, a) => s + (pagosHoy.get(a.pagoId!) ?? 0), 0),
    [hoyAsis, pagosHoy, clase?.id],
  );

  const resultados = useMemo(() => {
    const t = normalizar(q.trim());
    if (!t) return [];
    const dig = t.replace(/\D/g, '');
    return alumnos
      .filter((a) => a.activo)
      .filter((a) => normalizar(a.nombre).includes(t) || a.codigo.toLowerCase() === t || (dig.length >= 3 && a.telefono.includes(dig)))
      .slice(0, 8);
  }, [q, alumnos]);

  /** Ejecuta una acción rápida y la suma a la cuenta abierta. */
  const rapido = async (llave: string, nombre: string, fn: (c: Clase) => Promise<Resultado>) => {
    if (!clase) return avisar('Primero elige la clase', 'error');
    if (enCurso.current.has(llave)) return; // evita doble toque
    enCurso.current.add(llave);
    try {
      const r = await fn(clase);
      if (r.tipo === 'ya-entro') return avisar(`${nombre.split(' ')[0]} ya está adentro`);
      if (r.tipo === 'sin-precio') return avisar('Falta el precio de clase suelta (Ajustes → Planes)', 'error');
      navigator.vibrate?.(25);
      const ahora = Date.now();
      const juntos = ahora - ultimoToque.current < VENTANA_JUNTOS_MS && !yaPagaron.current;
      ultimoToque.current = ahora;
      yaPagaron.current = false;
      setMovs((m) => (juntos ? [r.mov, ...m] : [r.mov]));
      if (q) {
        setQ('');
        busca.current?.blur();
      }
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo registrar', 'error');
    } finally {
      enCurso.current.delete(llave);
    }
  };

  const entrarAlumno = (a: Alumno) =>
    rapido(a.id, a.nombre, (c) => entradaRapida({ alumnoId: a.id, nombre: a.nombre, clase: c, usuarioId: usuario.id }));

  const cerrarCuenta = useCallback(() => setMovs([]), []);

  const nombreNuevo = capitalizar(q);
  const exacto = resultados.some((a) => normalizar(a.nombre) === normalizar(q.trim()));

  return (
    <div className={movs.length ? 'pb-72' : undefined}>
      <Encabezado titulo="Entrada" sub={fechaLarga(hoy())} />

      {/* Clases del día */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
        {(verTodas ? clases.filter((c) => c.activo) : deHoy).map((c) => {
          const activa = clase?.id === c.id;
          const color = colorClase(c, disciplinas);
          return (
            <button
              key={c.id}
              onClick={() => setClaseId(c.id)}
              className={cx('flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-left ring-1 transition', activa ? 'text-white ring-transparent' : 'bg-superficie ring-ink-100')}
              style={activa ? { background: color } : undefined}
            >
              {!activa && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
              <span>
                <span className="block text-[15px] leading-tight font-bold">{nombreClase(c, disciplinas)}</span>
                <span className={cx('block text-xs', activa ? 'text-white/80' : 'text-ink-500')}>
                  {verTodas ? c.dias.map((d) => DIAS_CORTOS[d]).join(' ') + ' · ' : ''}
                  {c.horaInicio}
                  {!verTodas && ` · ${conteo.get(c.id) ?? 0}`}
                </span>
              </span>
            </button>
          );
        })}
        <button onClick={() => setVerTodas(!verTodas)} className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-ink-300 px-4 text-sm font-semibold text-ink-500">
          <CalendarDays size={16} /> {verTodas ? 'Solo hoy' : deHoy.length ? 'Otra' : 'Elegir clase'}
        </button>
      </div>

      {clase && !q && (
        <HeroClase
          titulo={nombreClase(clase, disciplinas)}
          color={colorClase(clase, disciplinas)}
          detalle={[clase.horaInicio, clase.maestro && `con ${clase.maestro}`].filter(Boolean).join(' · ')}
          adentro={conteo.get(clase.id) ?? 0}
          cobrado={cobradoClase}
        />
      )}

      {/* Buscador + la "tarjeta" sin nombre */}
      <div className="sticky top-0 z-20 flex gap-2 bg-ink-50/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={22} />
          <input
            ref={busca}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados.length === 1) void entrarAlumno(resultados[0]);
            }}
            placeholder="¿Quién llegó?"
            className="h-14 w-full rounded-2xl bg-superficie pr-11 pl-12 text-lg shadow-sm ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
            autoComplete="off"
            enterKeyHint="go"
          />
          {q && (
            <button
              onClick={() => {
                setQ('');
                busca.current?.focus();
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-ink-500 active:bg-ink-100"
              aria-label="Limpiar"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {suelta && (
          <button
            onClick={() => rapido(crypto.randomUUID(), 'Sin nombre', (c) => entradaSinNombre(c, usuario.id))}
            className="flex h-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-500 px-3.5 leading-none text-white shadow-sm shadow-brand-500/30 transition active:scale-95 active:bg-brand-600"
            aria-label={`Cobrar ${dinero(suelta.precio)} sin nombre`}
          >
            <span className="text-lg font-extrabold">+{dinero(suelta.precio)}</span>
            <span className="mt-0.5 text-[10px] font-semibold text-white/85">sin nombre</span>
          </button>
        )}
      </div>

      <div className="px-4 pb-6">
        {q.trim() ? (
          <div className="space-y-2 pt-1">
            {resultados.map((a) => {
              const s = semaforoAlumno(estados.get(a.id) ?? []);
              const entro = adentro.has(a.id);
              return (
                <div key={a.id} className="flex items-stretch overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
                  <button onClick={() => entrarAlumno(a)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left active:bg-ink-50">
                    <Avatar nombre={a.nombre} />
                    <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{a.nombre}</span>
                    {entro ? (
                      <Etiqueta tono="ok">Adentro</Etiqueta>
                    ) : (
                      <Etiqueta tono={s.tono}>{s.tono === 'sin' && suelta ? `Cobrar ${dinero(suelta.precio)}` : s.texto}</Etiqueta>
                    )}
                  </button>
                  <button onClick={() => setAlumnoSel(a)} className="border-l border-ink-100 px-3 text-ink-500 active:bg-ink-50" aria-label={`Más opciones para ${a.nombre}`}>
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              );
            })}
            {!exacto && (
              <div className="flex items-stretch overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
                <button
                  onClick={() => rapido(`nuevo:${nombreNuevo}`, nombreNuevo, (c) => nuevoYCobrar(nombreNuevo, c, usuario.id))}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left active:bg-ink-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <UserPlus size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-600">Nuevo: {nombreNuevo}</span>
                    <span className="block text-xs text-ink-500">Se registra y {suelta ? `paga ${dinero(suelta.precio)}` : 'entra'} en un toque</span>
                  </span>
                </button>
                <button onClick={() => setNuevo(true)} className="border-l border-ink-100 px-3 text-xs leading-tight font-semibold text-ink-500 active:bg-ink-50">
                  Con
                  <br />
                  datos
                </button>
              </div>
            )}
          </div>
        ) : !clase ? (
          <Vacio icono={<CalendarDays size={40} />} titulo="Hoy no hay clases programadas" texto="Toca “Elegir clase” para registrar entradas en otra clase." />
        ) : (
          <>
            <div className="mb-3">
              <Segmentos<'llegan' | 'adentro'>
                opciones={[
                  { valor: 'llegan', texto: 'Por llegar' },
                  { valor: 'adentro', texto: `Adentro · ${conteo.get(clase.id) ?? 0}` },
                ]}
                valor={vista}
                onChange={setVista}
              />
            </div>
            {vista === 'llegan' ? (
              <>
                <Frecuentes clase={clase} adentro={adentro} onToque={entrarAlumno} onOpciones={setAlumnoSel} />
                <p className="mt-4 px-2 text-center text-xs leading-relaxed text-ink-500">
                  Toca a quien llegó para cobrar o darle entrada.
                  <br />
                  Mantén presionado para más opciones. Si no aparece, búscalo arriba.
                </p>
              </>
            ) : (
              <EnClase clase={clase} onVisitante={() => setVisitante(true)} />
            )}
          </>
        )}
      </div>

      <Cuenta
        key={movs[movs.length - 1]?.key}
        movs={movs}
        onCerrar={cerrarCuenta}
        onPagoCon={(b) => (yaPagaron.current = b !== null)}
        onDeshacer={async (m) => {
          await deshacer(m);
          setMovs((x) => x.filter((y) => y.key !== m.key));
          avisar(`Se deshizo: ${m.nombre}`);
        }}
        onTransferencia={async () => {
          await cambiarMetodo(
            movs.filter((m) => m.metodo === 'efectivo'),
            'transferencia',
          );
          setMovs((x) => x.map((m) => (m.metodo === 'efectivo' ? { ...m, metodo: 'transferencia' } : m)));
        }}
      />

      <HojaEntrada
        alumno={alumnoSel}
        clase={clase}
        onCerrar={() => {
          setAlumnoSel(null);
          setQ('');
        }}
      />

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno
          nombreInicial={nombreNuevo}
          onGuardado={(a) => {
            setNuevo(false);
            setAlumnoSel(a);
          }}
        />
      </Hoja>

      <Hoja abierta={visitante} onCerrar={() => setVisitante(false)} titulo="Visitante sin registro">
        {visitante && <FormVisitante clase={clase} onHecho={() => setVisitante(false)} />}
      </Hoja>
    </div>
  );
}

/** Tarjeta en vivo de la clase: da sensación de "ambiente" y responde a cada cobro. */
function HeroClase({ titulo, color, detalle, adentro, cobrado }: { titulo: string; color: string; detalle: string; adentro: number; cobrado: number }) {
  return (
    <div className="px-4 pt-3">
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-4 text-white shadow-lg"
        style={{
          background: `linear-gradient(135deg in oklab, ${color}, color-mix(in oklab, ${color} 55%, #1c1a24))`,
          boxShadow: `0 12px 28px -12px color-mix(in oklab, ${color} 70%, transparent)`,
        }}
      >
        {/* Anillos decorativos: el "compás" del logo */}
        <svg className="pointer-events-none absolute -top-10 -right-8 h-44 w-44 opacity-20" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="70 37" strokeLinecap="round" transform="rotate(-30 32 32)" />
          <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
        <div className="relative flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wider text-white/75 uppercase">{detalle}</p>
            <p className="mt-0.5 truncate text-2xl font-extrabold tracking-tight">{titulo}</p>
            <p className="mt-1 text-sm font-semibold text-white/85">{cobrado > 0 ? `${dinero(cobrado)} cobrados` : 'Aún sin cobros'}</p>
          </div>
          <div className="text-right">
            <p key={adentro} className="text-5xl leading-none font-extrabold tracking-tight animate-pop">
              {adentro}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/80">{adentro === 1 ? 'bailarín' : 'bailarines'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EnClase({ clase, onVisitante }: { clase: Clase; onVisitante: () => void }) {
  const disciplinas = useDisciplinas();
  const avisar = useAvisos();
  const [quitar, setQuitar] = useState<ID | null>(null);
  const lista = useLiveQuery(
    async () => {
      const asis = await db.asistencias
        .where('[claseId+fecha]')
        .equals([clase.id, hoy()])
        .filter((a) => !a.anuladaAt && !a.deletedAt)
        .toArray();
      const alumnos = await db.alumnos.bulkGet(asis.map((a) => a.alumnoId ?? ''));
      const pagos = await db.pagos.bulkGet(asis.map((a) => a.pagoId ?? ''));
      return asis
        .map((a, i) => ({ a, nombre: alumnos[i]?.nombre ?? a.nombreVisitante ?? 'Visitante', pago: pagos[i] }))
        .sort((x, y) => y.a.createdAt - x.a.createdAt);
    },
    [clase.id],
    [],
  );

  const sel = lista.find((x) => x.a.id === quitar);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wider text-ink-500 uppercase">
          En {nombreClase(clase, disciplinas)} · {lista.length}
        </h2>
        <button onClick={onVisitante} className="flex items-center gap-1 text-sm font-semibold text-brand-600">
          <Footprints size={16} /> Visitante con nombre
        </button>
      </div>
      {lista.length === 0 ? (
        <Tarjeta>
          <Vacio icono={<Users size={36} />} titulo="Aún no llega nadie" texto="Toca a los alumnos en “Por llegar”." />
        </Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-ink-100">
          {lista.map(({ a, nombre, pago }) => (
            <button key={a.id} onClick={() => setQuitar(a.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-ink-50">
              <Avatar nombre={nombre} tam={36} />
              <span className="min-w-0 flex-1 truncate font-medium">{nombre}</span>
              {pago ? <Etiqueta tono="marca">{dinero(pago.monto)}</Etiqueta> : <Etiqueta tono="ok">Plan</Etiqueta>}
              <span className="w-12 text-right text-xs text-ink-500">{horaDe(a.createdAt)}</span>
            </button>
          ))}
        </Tarjeta>
      )}

      <Hoja abierta={!!sel} onCerrar={() => setQuitar(null)} titulo={sel?.nombre}>
        {sel &&
          (sel.pago ? (
            <p className="text-ink-700">
              Esta entrada se cobró ({dinero(sel.pago.monto)}, {sel.pago.metodo}). Para quitarla, anula el cobro en <b>Caja</b> y así el dinero
              también cuadra.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-ink-700">¿Quitar esta entrada? La clase se le devuelve a su plan.</p>
              <Boton
                bloque
                variante="peligro"
                onClick={async () => {
                  await anularAsistencia(sel.a.id);
                  setQuitar(null);
                  avisar('Entrada quitada');
                }}
              >
                Quitar entrada
              </Boton>
            </div>
          ))}
      </Hoja>
    </div>
  );
}

function FormVisitante({ clase, onHecho }: { clase: Clase | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const suelta = usePlanes().find((p) => p.activo && p.tipo === 'suelta');
  const [nombre, setNombre] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);

  if (!clase) return <p className="text-ink-500">Elige primero una clase.</p>;
  if (!suelta) return <p className="text-ink-500">Crea un plan de tipo “clase suelta” en Ajustes.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Para quien viene a probar y no quiere registrarse. Cuenta en caja igual que la tarjeta.</p>
      <Campo etiqueta="Nombre (opcional)">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Visitante" />
      </Campo>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton
        grande
        bloque
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          await cobrarClaseSuelta({ alumnoId: null, nombreVisitante: nombre, claseId: clase.id, plan: suelta, metodo, usuarioId: usuario.id });
          avisar(`${dinero(suelta.precio)} cobrados`);
          onHecho();
        }}
      >
        Cobrar {dinero(suelta.precio)}
      </Boton>
    </div>
  );
}
