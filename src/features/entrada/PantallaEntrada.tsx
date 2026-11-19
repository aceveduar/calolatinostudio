import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, X, Users, Footprints, CalendarDays, MoreHorizontal, AlertTriangle, ScanLine, ShoppingBag, MapPin, ChevronDown, Check, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePendientes } from '../../app/pendientes';
import { useNoActualizarMientras } from '../../app/actualizacion';
import { colorClase, nombreClase, nombreMaestro, useAlumnos, useMaestros, useClases, useDisciplinas, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { mismaSede, nombreSede, useSedeActual, useSedes } from '../../app/sedes';
import { sueltaDeClase, sueltaPara } from '../../domain/sedes';
import { useAngosta, useEsEscritorio } from '../../app/pantalla';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID, MetodoPago } from '../../db/types';
import { claseSugerida, clasesDelDia } from '../../domain/clases';
import { dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaLarga, horaDe, hoy } from '../../domain/fechas';
import { semaforoAlumno } from '../../domain/membresias';
import { cobrarClaseSuelta } from '../../domain/operaciones';
import { cambiarMetodo, deshacer, entradaRapida, entradaSinNombre, nuevoYCobrar, type Movimiento, type Resultado } from '../../domain/rapido';
import { FormAlumno } from '../alumnos/FormAlumno';
import { METODOS } from '../../domain/planes';
import { Cuenta } from './Cuenta';
import { Frecuentes } from './Frecuentes';
import { Escaner, type LecturaQR } from './Escaner';
import { Tienda } from './Tienda';
import { usePedidosPendientes } from '../../app/datos';
import { sincronizar } from '../../sync/engine';
import { useLectorUSB } from '../../app/codigos';
import { productoPorCodigo, venderProducto } from '../../domain/tienda';
import { leerQR } from '../../domain/qr';
import { HojaEntrada } from './HojaEntrada';
import { CorregirEntrada } from './CorregirEntrada';
import { parecidos } from '../../domain/correcciones';

const normalizar =(s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const capitalizar = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export function PantallaEntrada() {
  const { usuario, academia } = useSesion();
  const esc = useEsEscritorio();
  const angosta = useAngosta();
  const avisar = useAvisos();
  const todasLasClases = useClases();
  const sedes = useSedes();
  const [sedeActual, cambiarSede] = useSedeActual();
  // Solo las clases de la sede donde está este equipo
  const clases = useMemo(() => todasLasClases.filter((c) => mismaSede(c.sedeId, sedeActual)), [todasLasClases, sedeActual]);
  const [elegirSede, setElegirSede] = useState(false);
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();
  const planes = usePlanes();
  const deHoy = useMemo(() => clasesDelDia(clases), [clases]);

  // la clase elegida a mano se recuerda al ir y volver de otras pantallas (90 min; luego vuelve a sugerir la de la hora)
  const [claseId, setClaseIdEstado] = useState<ID | null>(leerClaseElegida);
  const setClaseId = useCallback((id: ID | null) => {
    setClaseIdEstado(id);
    guardarClaseElegida(id);
  }, []);
  const [verTodas, setVerTodas] = useState(false);
  const clase: Clase | null = clases.find((c) => c.id === claseId) ?? claseSugerida(deHoy);
  // precio de la clase elegida (cada maestro puede tener su tarifa); si no hay clase, el de la sede
  const suelta = clase ? sueltaDeClase(planes, clase) : sueltaPara(planes, sedeActual);

  const [q, setQ] = useState('');
  const [vista, setVista] = useState<'llegan' | 'adentro'>('llegan');
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [visitante, setVisitante] = useState(false);
  const [escanear, setEscanear] = useState(false);
  const [tienda, setTienda] = useState(false);
  const porRecoger = usePedidosPendientes().length;
  const pendientes = usePendientes(false)?.total ?? 0;
  const [movs, setMovs] = useState<Movimiento[]>([]);
  // con una cuenta abierta la app no se actualiza sola (se perdería el total que se está cobrando)
  useNoActualizarMientras(movs.length > 0);
  const enCurso = useRef(new Set<string>());
  const busca = useRef<HTMLInputElement>(null);

  const hoyAsis = useLiveQuery(() => db.asistencias.where('fecha').equals(hoy()).toArray().then((xs) => xs.filter((a) => !a.anuladaAt && !a.deletedAt)), [], []);
  const conteo = useMemo(() => {
    const m = new Map<ID, number>();
    for (const a of hoyAsis) m.set(a.claseId, (m.get(a.claseId) ?? 0) + 1);
    return m;
  }, [hoyAsis]);
  const vinieronHoy = useMemo(
    () => [...new Set([...hoyAsis].sort((a, b) => a.createdAt - b.createdAt).flatMap((a) => (a.alumnoId ? [a.alumnoId] : [])))],
    [hoyAsis],
  );
  const adentro = useMemo(
    () => new Set(hoyAsis.filter((a) => a.claseId === clase?.id && a.alumnoId).map((a) => a.alumnoId!)),
    [hoyAsis, clase?.id],
  );
  const pagosHoy = useLiveQuery(
    async () => new Map((await db.pagos.where('fecha').equals(hoy()).toArray()).filter((p) => !p.anuladoAt && !p.deletedAt).map((p) => [p.id, p.monto])),
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
  /** Devuelve el resultado (null si no se pudo). `silencioso`: sin avisos, quien llama muestra el resultado (escáner). */
  const rapido = async (llave: string, nombre: string, fn: (c: Clase) => Promise<Resultado>, silencioso = false): Promise<Resultado | null> => {
    if (!clase) {
      if (!silencioso) avisar('Primero elige la clase', 'error');
      return null;
    }
    if (enCurso.current.has(llave)) return null; // evita doble toque
    enCurso.current.add(llave);
    try {
      const r = await fn(clase);
      if (r.tipo === 'ya-entro') {
        if (!silencioso) avisar(`${nombre.split(' ')[0]} ya está adentro`);
        return r;
      }
      if (r.tipo === 'sin-precio') {
        if (!silencioso) avisar('Falta el precio de clase suelta (Ajustes → Planes)', 'error');
        return r;
      }
      navigator.vibrate?.(25);
      // La cuenta junta todo hasta que recepción toca "Listo": nada se cierra sin confirmar
      setMovs((m) => [r.mov, ...m]);
      if (q) {
        setQ('');
        busca.current?.blur();
      }
      return r;
    } catch (e) {
      if (!silencioso) avisar(e instanceof Error ? e.message : 'No se pudo registrar', 'error');
      return null;
    } finally {
      enCurso.current.delete(llave);
    }
  };

  const entrarAlumno = (a: Alumno, silencioso = false) =>
    rapido(a.id, a.nombre, (c) => entradaRapida({ alumnoId: a.id, nombre: a.nombre, clase: c, usuarioId: usuario.id }), silencioso);

  /** Escáner: registra y describe en grande qué pasó. */
  const alEscanear = async (codigo: string): Promise<LecturaQR> => {
    const buscar = () => db.alumnos.where('codigo').equals(codigo).filter((x) => !x.deletedAt).first();
    let a = await buscar();
    // Pudo darse de alta en otro equipo hace segundos: traer lo nuevo de la nube y volver a buscar
    if (!a && navigator.onLine) {
      await sincronizar();
      a = await buscar();
    }
    if (!a)
      return {
        tono: 'error',
        titulo: 'Alumno no encontrado',
        detalle: navigator.onLine ? 'Ese QR no es de un alumno activo de esta academia' : 'Sin internet: si se registró en otro equipo, aún no llega aquí',
      };
    const nombre = a.nombre;
    if (!a.activo) return { tono: 'aviso', titulo: nombre, detalle: 'Está dado de baja' };
    if (!clase) return { tono: 'error', titulo: 'Elige la clase primero', detalle: 'Cierra el escáner y elige la clase' };
    const r = await entrarAlumno(a, true);
    if (!r) return { tono: 'error', titulo: nombre, detalle: 'No se pudo registrar' };
    if (r.tipo === 'ya-entro') return { tono: 'aviso', titulo: nombre, detalle: 'Ya está adentro de esta clase' };
    if (r.tipo === 'sin-precio') return { tono: 'error', titulo: 'Falta el precio', detalle: 'Configura la clase suelta en Ajustes' };
    return { tono: 'ok', titulo: nombre, detalle: r.mov.monto ? `Cobrar ${dinero(r.mov.monto)}` : r.mov.beca ? 'Becado · entra sin pagar' : 'Entró con su plan' };
  };

  const cerrarCuenta = useCallback(() => setMovs([]), []);

  // Lector de códigos USB/Bluetooth (PC): un producto se suma a la cuenta; el QR de un alumno le da entrada.
  // Si hay una hoja abierta (p. ej. la Tienda), esa hoja lo atiende.
  useLectorUSB(async (codigo) => {
    if (document.querySelector('[role=dialog]')) return;
    setQ('');
    const p = await productoPorCodigo(codigo);
    if (p) {
      try {
        const mov = await venderProducto({ producto: p, metodo: 'efectivo', usuarioId: usuario.id, sedeId: sedeActual });
        setMovs((x) => [mov, ...x]);
        avisar(`${p.emoji} ${p.nombre} · ${dinero(p.precio)}`);
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'No se pudo vender', 'error');
      }
      return;
    }
    const alumno = leerQR(codigo);
    if (alumno) {
      const r = await alEscanear(alumno);
      avisar(`${r.titulo} · ${r.detalle}`, r.tono === 'error' ? 'error' : 'ok');
      return;
    }
    avisar(`El código ${codigo} no es de ningún producto ni alumno`, 'error');
  }, true, true);

  // Teclado (laptop/PC): escribir en cualquier momento busca; Esc limpia
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (document.querySelector('[role=dialog]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        setQ('');
        busca.current?.blur();
        return;
      }
      if (t.matches('input, textarea, select') || e.key.length !== 1 || !/[\p{L}\p{N} ]/u.test(e.key)) return;
      busca.current?.focus();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  const cuenta = (
    <Cuenta
        incrustado={esc}
        key={movs[movs.length - 1]?.key}
        movs={movs}
        onCerrar={cerrarCuenta}
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
  );

  const nombreNuevo = capitalizar(q);
  const exacto = resultados.some((a) => normalizar(a.nombre) === normalizar(q.trim()));
  // Errores de dedo ("Ana Lopes", "Carlos Ruis"): mostrar parecidos antes de crear un duplicado
  const similares = useMemo(
    () => (q.trim() && !exacto ? parecidos(q, alumnos.filter((a) => a.activo && !resultados.includes(a))) : []),
    [q, exacto, alumnos, resultados],
  );

  // Prevención: avisar si se cobra en una clase que no es la de ahora
  const sugerida = claseSugerida(deHoy);
  const claseRara = clase && sugerida && clase.id !== sugerida.id ? sugerida : null;
  const claseNoEsHoy = clase && !deHoy.some((c) => c.id === clase.id);

  return (
    <div className={cx(movs.length > 0 && !esc && 'pb-72', 'lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6')}>
      <div className="min-w-0">
      <Encabezado
        titulo="Entrada"
        sub={fechaLarga(hoy())}
        accion={
          pendientes || sedes.length > 0 ? (
            <div className="flex max-w-[65%] min-w-0 items-center gap-2">
              {pendientes > 0 && (
                <Link
                  to="/pendientes"
                  className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-brand-500 py-2 pr-3 pl-2.5 text-sm font-bold text-white shadow-sm shadow-brand-500/30 active:scale-95"
                  aria-label={`${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}: a quién escribir y qué cobrar`}
                >
                  <ListChecks size={16} /> {pendientes}
                  <span className={sedes.length ? 'hidden font-semibold lg:inline' : 'font-semibold'}>{pendientes === 1 ? 'pendiente' : 'pendientes'}</span>
                </Link>
              )}
              {sedes.length > 0 && (
                <button
                  onClick={() => setElegirSede(true)}
                  className="flex min-h-10 min-w-0 items-center gap-1.5 rounded-full bg-superficie py-2 pr-3 pl-2.5 text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-50"
                  aria-label="Cambiar sede"
                >
                  <MapPin size={16} className="shrink-0" style={{ color: sedes.find((x) => x.id === sedeActual)?.color ?? 'var(--marca)' }} />
                  <span className="truncate">{nombreSede(sedeActual, sedes, academia)}</span>
                  <ChevronDown size={14} className="shrink-0 text-ink-500" />
                </button>
              )}
            </div>
          ) : undefined
        }
      />

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
              // el color de la disciplina un poco más oscuro: el texto blanco se lee con cualquier color que elijan
              style={activa ? { background: `color-mix(in oklab, ${color} 80%, black)` } : undefined}
            >
              {!activa && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
              <span>
                <span className="block text-[15px] leading-tight font-bold">{nombreClase(c, disciplinas)}</span>
                <span className={cx('block text-xs', activa ? 'text-white/90' : 'text-ink-500')}>
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
          detalle={[clase.horaInicio, nombreMaestro(clase, maestros) && `con ${nombreMaestro(clase, maestros)}`].filter(Boolean).join(' · ')}
          adentro={conteo.get(clase.id) ?? 0}
          cobrado={cobradoClase}
        />
      )}

      {clase && (claseNoEsHoy || claseRara) && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-warn-50 px-4 py-2.5 text-sm text-warn-600">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1 font-medium">
            {claseNoEsHoy ? `${nombreClase(clase, disciplinas)} no es clase de hoy.` : `La clase de ahora es ${nombreClase(claseRara!, disciplinas)}.`}
          </span>
          {claseRara && (
            <button onClick={() => setClaseId(claseRara.id)} className="shrink-0 rounded-lg bg-warn-600/15 px-2.5 py-1 font-bold">
              Cambiar
            </button>
          )}
        </div>
      )}

      {/* Buscador + la "tarjeta" sin nombre */}
      <div className="sticky top-0 z-20 flex gap-2 bg-ink-50/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-300" size={20} />
          <input
            ref={busca}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados.length === 1) void entrarAlumno(resultados[0]);
            }}
            placeholder={esc ? '¿Quién llegó? (escribe para buscar)' : angosta ? 'Buscar…' : '¿Quién llegó?'}
            className="h-14 w-full rounded-2xl bg-superficie pr-10 pl-11 text-lg shadow-sm ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
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
        <button
          onClick={() => setTienda(true)}
          aria-label={porRecoger ? `Tienda, ${porRecoger} ${porRecoger === 1 ? 'apartado' : 'apartados'} por recoger` : 'Tienda'}
          className="relative flex h-14 w-12 shrink-0 items-center justify-center rounded-2xl bg-superficie text-ink-700 shadow-sm ring-1 ring-ink-100 active:scale-95 sm:w-14"
        >
          <ShoppingBag size={24} />
          {porRecoger > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-extrabold text-white shadow">{porRecoger}</span>
          )}
        </button>
        <button
          onClick={() => setEscanear(true)}
          className="flex h-14 w-12 shrink-0 items-center justify-center rounded-2xl bg-superficie text-ink-700 shadow-sm ring-1 ring-ink-100 active:scale-95 sm:w-14"
          aria-label="Escanear QR"
        >
          <ScanLine size={24} />
        </button>
        {suelta && (
          <button
            onClick={() => rapido(crypto.randomUUID(), 'Sin nombre', (c) => entradaSinNombre(c, usuario.id))}
            className="flex h-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-500 px-3.5 leading-none text-white shadow-sm shadow-brand-500/30 transition active:scale-95 active:bg-brand-600"
            aria-label={`Cobrar ${dinero(suelta.precio)} sin nombre`}
          >
            <span className="text-lg font-extrabold">+{dinero(suelta.precio)}</span>
            <span className="mt-0.5 text-[10px] font-semibold text-white">sin nombre</span>
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
                    <Avatar nombre={a.nombre} foto={a.foto} />
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
            {similares.length > 0 && (
              <>
                <p className="px-1 pt-1 text-xs font-bold tracking-wider text-warn-600 uppercase">¿Es alguno de estos?</p>
                {similares.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => entrarAlumno(a)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-warn-50 p-3 text-left ring-1 ring-warn-600/20 active:brightness-95"
                  >
                    <Avatar nombre={a.nombre} foto={a.foto} />
                    <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{a.nombre}</span>
                    <Etiqueta tono="pronto">Parecido</Etiqueta>
                  </button>
                ))}
              </>
            )}
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
            <div className="mb-3 lg:hidden">
              <Segmentos<'llegan' | 'adentro'>
                opciones={[
                  { valor: 'llegan', texto: 'Por llegar' },
                  { valor: 'adentro', texto: `Adentro · ${conteo.get(clase.id) ?? 0}` },
                ]}
                valor={vista}
                onChange={setVista}
              />
            </div>
            {vista === 'llegan' || esc ? (
              <>
                <Frecuentes clase={clase} adentro={adentro} vinieronHoy={vinieronHoy} onToque={entrarAlumno} onOpciones={setAlumnoSel} />
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
      </div>

      {esc && (
        <aside className="sticky top-6 mt-6 space-y-4">
          {movs.length ? (
            cuenta
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-ink-100 px-6 py-8 text-center text-sm text-ink-500">
              <p className="font-semibold text-ink-700">Cuenta</p>
              <p className="mt-1">Al cobrar aparece aquí el total y el cambio.</p>
            </div>
          )}
          {clase && <EnClase clase={clase} onVisitante={() => setVisitante(true)} />}
        </aside>
      )}

      {!esc && cuenta}

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

      <Hoja abierta={elegirSede} onCerrar={() => setElegirSede(false)} titulo="¿Dónde estás hoy?">
        {elegirSede && (
          <div className="space-y-2">
            {[null, ...sedes.map((x) => x.id)].map((id) => {
              const x = sedes.find((y) => y.id === id);
              const n = todasLasClases.filter((c) => mismaSede(c.sedeId, id) && c.activo).length;
              return (
                <button
                  key={id ?? 'principal'}
                  onClick={async () => {
                    await cambiarSede(id);
                    setClaseId(null);
                    setElegirSede(false);
                    avisar(`Ahora en ${nombreSede(id, sedes, academia)}`);
                  }}
                  className={cx('flex w-full items-center gap-3 rounded-2xl bg-superficie p-4 text-left ring-1', mismaSede(id, sedeActual) ? 'ring-2 ring-brand-500' : 'ring-ink-100')}
                >
                  <MapPin size={22} style={{ color: x?.color ?? 'var(--marca)' }} />
                  <span className="flex-1">
                    <span className="block font-semibold">{nombreSede(id, sedes, academia)}</span>
                    <span className="block text-sm text-ink-500">
                      {n} clases · clase suelta {sueltaPara(planes, id) ? dinero(sueltaPara(planes, id)!.precio) : 'sin precio'}
                    </span>
                  </span>
                  {mismaSede(id, sedeActual) && <Check size={20} className="text-brand-600" />}
                </button>
              );
            })}
            <p className="px-1 pt-1 text-xs text-ink-500">Este equipo recuerda la sede. Los cobros y el corte de caja quedan en la sede elegida.</p>
          </div>
        )}
      </Hoja>

      <Hoja abierta={tienda} onCerrar={() => setTienda(false)} titulo="Tienda">
        {tienda && (
          <Tienda
            movs={movs}
            sedeId={sedeActual}
            onAgregar={(m) => setMovs((x) => [m, ...x])}
            onQuitar={(m) => setMovs((x) => x.filter((y) => y.key !== m.key))}
            onListo={() => setTienda(false)}
          />
        )}
      </Hoja>

      <Hoja abierta={escanear} onCerrar={() => setEscanear(false)} titulo="Escanear credencial">
        {escanear && (
          <Escaner
            movs={movs}
            onListo={() => setEscanear(false)}
            onCodigo={alEscanear}
          />
        )}
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
        <button onClick={onVisitante} className="-my-2 -mr-2 flex items-center gap-1 rounded-xl px-2 py-2.5 text-sm font-semibold text-brand-600 active:bg-brand-50">
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

      <Hoja abierta={!!sel} onCerrar={() => setQuitar(null)} titulo="Corregir entrada">
        {sel && <CorregirEntrada asistencia={sel.a} nombre={sel.nombre} onHecho={() => setQuitar(null)} />}
      </Hoja>
    </div>
  );
}

function FormVisitante({ clase, onHecho }: { clase: Clase | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const suelta = sueltaDeClase(usePlanes(), clase);
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

const CLAVE_CLASE = 'compas:clase-elegida';
const RECORDAR_CLASE_MS = 90 * 60_000;
function leerClaseElegida(): ID | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE_CLASE) ?? 'null') as { id: ID; at: number } | null;
    return g && Date.now() - g.at < RECORDAR_CLASE_MS ? g.id : null;
  } catch {
    return null;
  }
}
function guardarClaseElegida(id: ID | null) {
  try {
    if (id) sessionStorage.setItem(CLAVE_CLASE, JSON.stringify({ id, at: Date.now() }));
    else sessionStorage.removeItem(CLAVE_CLASE);
  } catch {
    /* sin almacenamiento: solo no se recuerda */
  }
}
