import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, X, Users, Footprints, CalendarDays, MoreHorizontal, AlertTriangle, ScanLine, ShoppingBag, MapPin, ChevronDown, Check, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePendientes } from '../../app/pendientes';
import { PrimerosPasos } from './PrimerosPasos';
import { BienvenidaRecepcion } from './Bienvenida';
import { useNoActualizarMientras } from '../../app/actualizacion';
import { colorClase, nombreClase, nombreMaestro, useAlumnos, useAlumnosArchivados, useMaestros, useClases, useDisciplinas, useEstadosPorAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { mismaSede, nombreSede, useSedeActual, useSedes } from '../../app/sedes';
import { sueltaDeClase, sueltaPara } from '../../domain/sedes';
import { useAngosta, useEsEscritorio } from '../../app/pantalla';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID, MetodoPago } from '../../db/types';
import { claseEnFecha, claseEnOtraSede, claseSugerida, clasesDelDia } from '../../domain/clases';
import { dinero } from '../../domain/dinero';
import { consultaTelefono, digitosTelefono } from '../../domain/telefono';
import { DIAS_CORTOS, fechaLarga, horaDe, hoy } from '../../domain/fechas';
import { membresiaQueCubre } from '../../domain/membresias';
import { cobrarClaseSuelta } from '../../domain/operaciones';
import { cambiarMetodo, deshacer, entradaRapida, entradaSinNombre, nuevoYCobrar, type Movimiento, type Resultado } from '../../domain/rapido';
import { FormAlumno } from '../alumnos/FormAlumno';
import { ConfirmarReactivacion } from '../alumnos/ConfirmarReactivacion';
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
import { CorregirEntrada, EstadoEntrada } from './CorregirEntrada';
import { NOMBRE_ANONIMO, parecidos } from '../../domain/correcciones';

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
  // la pista "(escribe para buscar)" es para computadora con teclado; en una tablet táctil (también ancha) no aplica y se cortaba
  const conTeclado = typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches;
  const avisar = useAvisos();
  const todasLasClases = useClases();
  const sedes = useSedes();
  const [sedeActual, cambiarSede] = useSedeActual();
  // Solo las clases de la sede donde está este equipo
  const fechaEntrada = hoy();
  const clases = useMemo(() => todasLasClases
    .flatMap((c) => {
      const efectiva = c.activo ? claseEnFecha(c, fechaEntrada) : null;
      return efectiva && mismaSede(efectiva.sedeId, sedeActual) ? [efectiva] : [];
    }), [todasLasClases, sedeActual, fechaEntrada]);
  const [elegirSede, setElegirSede] = useState(false);
  const [elegirClase, setElegirClase] = useState(false);
  const disciplinas = useDisciplinas();
  const maestros = useMaestros();
  const alumnos = useAlumnos();
  // null mientras carga: así la bienvenida de "aún no tienes alumnos" no parpadea en una academia con alumnos
  const totalAlumnos = useLiveQuery(() => db.alumnos.count(), [], null);
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
  const archivados = useAlumnosArchivados(alumnos, estados, Boolean(q.trim()));
  const [vista, setVista] = useState<'llegan' | 'adentro'>('llegan');
  const [alumnoSel, setAlumnoSel] = useState<Alumno | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [porReactivar, setPorReactivar] = useState<Alumno | null>(null);
  const [visitante, setVisitante] = useState(false);
  const [escanear, setEscanear] = useState(false);
  const [tienda, setTienda] = useState(false);
  const porRecoger = usePedidosPendientes().length;
  const pendientes = usePendientes(false)?.total ?? 0;
  const [movs, setMovs] = useState<Movimiento[]>([]);
  // con una cuenta abierta la app no se actualiza sola (se perdería el total que se está cobrando)
  useNoActualizarMientras(movs.length > 0);
  const enCurso = useRef(new Set<string>());
  const cambioSede = useRef<{ id: ID | null } | null>(null);
  const [cambiandoA, setCambiandoA] = useState<{ id: ID | null } | null>(null);
  const sedeOcupada = movs.length > 0 || Boolean(cambiandoA);
  useEffect(() => {
    if (cambiandoA && (sedeActual === cambiandoA.id || (cambiandoA.id && !sedes.some((s) => s.id === cambiandoA.id)))) {
      cambioSede.current = null;
      setCambiandoA(null);
    }
  }, [cambiandoA, sedeActual, sedes]);
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
    const t = normalizar(q.trim()).replace(/\s+/g, ' ');
    if (!t) return [];
    const dig = consultaTelefono(t);
    const candidatos = alumnos.filter((a) => a.nombre !== NOMBRE_ANONIMO);
    const porCodigo = candidatos.filter((a) => a.codigo.toLowerCase() === t);
    if (porCodigo.length) return porCodigo;
    return candidatos
      .filter((a) => normalizar(a.nombre).includes(t) || (dig.length >= 3 && digitosTelefono(a.telefono).includes(dig)))
      .slice(0, 8);
  }, [q, alumnos]);

  /** Ejecuta una acción rápida y la suma a la cuenta abierta. */
  /** Devuelve el resultado (null si no se pudo). `silencioso`: sin avisos, quien llama muestra el resultado (escáner). */
  const rapido = async (llave: string, nombre: string, fn: (c: Clase) => Promise<Resultado>, silencioso = false): Promise<Resultado | null> => {
    if (cambioSede.current) {
      if (!silencioso) avisar('Espera a que cambie la sede.', 'error');
      return null;
    }
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
      // tiene plan pero esta clase se cobra: decir por qué (si no, parece un error)
      if (!silencioso && r.mov.aviso) avisar(`${nombre.split(' ')[0]} paga esta clase: ${r.mov.aviso}`);
      // La cuenta junta todo hasta que recepción toca "Listo": nada se cierra sin confirmar
      setMovs((m) => [r.mov, ...m]);
      if (q) {
        setQ('');
        busca.current?.blur();
      }
      return r;
    } catch (e) {
      if (!silencioso) avisar(e instanceof Error ? e.message : 'No se pudo guardar la entrada', 'error');
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
    if (!r) return { tono: 'error', titulo: nombre, detalle: 'No se pudo guardar la entrada' };
    if (r.tipo === 'ya-entro') return { tono: 'aviso', titulo: nombre, detalle: 'Ya está en esta clase. Sin nuevo cobro.' };
    if (r.tipo === 'sin-precio') return { tono: 'error', titulo: 'Falta el precio', detalle: 'Configura la clase suelta en Ajustes' };
    return { tono: 'ok', titulo: nombre, detalle: r.mov.monto ? `Entrada registrada · ${dinero(r.mov.monto)}${r.mov.aviso ? ` · ${r.mov.aviso}` : ''}` : r.mov.beca ? 'Entró con su beca' : 'Entró con su plan' };
  };

  const cerrarCuenta = useCallback(() => setMovs([]), []);

  // Lector de códigos USB/Bluetooth (PC): un producto se suma a la cuenta; el QR de un alumno le da entrada.
  // Si hay una hoja abierta (p. ej. la Tienda), esa hoja lo atiende.
  useLectorUSB(async (codigo) => {
    const llave = `lector:${codigo}`;
    if (document.querySelector('[role=dialog]') || cambioSede.current || enCurso.current.has(llave)) return;
    enCurso.current.add(llave);
    try {
      setQ('');
      const p = await productoPorCodigo(codigo);
      if (p) {
        const mov = await venderProducto({ producto: p, metodo: 'efectivo', usuarioId: usuario.id, sedeId: sedeActual });
        setMovs((x) => [mov, ...x]);
        avisar(`${p.nombre} · ${dinero(p.precio)}`);
        return;
      }
      const alumno = leerQR(codigo);
      if (alumno) {
        const r = await alEscanear(alumno);
        avisar(`${r.titulo} · ${r.detalle}`, r.tono === 'error' ? 'error' : 'ok');
        return;
      }
      avisar(`El código ${codigo} no es de ningún producto ni alumno`, 'error');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo registrar la lectura', 'error');
    } finally {
      enCurso.current.delete(llave);
    }
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
        onOpciones={async (id) => {
          const a = await db.alumnos.get(id);
          if (a) setAlumnoSel(a);
        }}
        onDeshacer={async (m) => {
          await deshacer(m);
          setMovs((x) => x.filter((y) => y.key !== m.key));
          avisar(`Se deshizo: ${m.nombre}`);
        }}
        onTransferencia={async (seleccion) => {
          const ids = new Set(seleccion.map((m) => m.key));
          await cambiarMetodo(seleccion, 'transferencia');
          setMovs((x) => x.map((m) => (ids.has(m.key) ? { ...m, metodo: 'transferencia' } : m)));
        }}
      />
  );

  const nombreNuevo = capitalizar(q);
  const consultaEsNombre = /^(?=.*\p{L})[\p{L}\p{M} .’'-]{2,}$/u.test(q.trim());
  const exacto = resultados.some((a) => normalizar(a.nombre) === normalizar(q.trim()) || a.codigo.toLowerCase() === q.trim().toLowerCase());
  // Errores de dedo ("Ana Lopes", "Carlos Ruis"): mostrar parecidos antes de crear un duplicado
  const similares = useMemo(
    () => (consultaEsNombre && !exacto ? parecidos(q, alumnos.filter((a) => a.nombre !== NOMBRE_ANONIMO && !resultados.includes(a))) : []),
    [q, consultaEsNombre, exacto, alumnos, resultados],
  );
  const hayCoincidencias = resultados.length > 0 || similares.length > 0;
  const elegirAlumno = (a: Alumno) => {
    if (a.activo) void entrarAlumno(a);
    else setPorReactivar(a);
  };

  // Prevención: avisar si se cobra en una clase que no es la de ahora
  const sugerida = claseSugerida(deHoy);
  const claseRara = clase && sugerida && clase.id !== sugerida.id ? sugerida : null;
  const claseNoEsHoy = clase && !deHoy.some((c) => c.id === clase.id);
  const cambiarSedeEntrada = async (id: ID | null, claseSugeridaId?: ID) => {
    if (movs.length || enCurso.current.size || cambioSede.current) return;
    if (id === sedeActual) {
      setElegirSede(false);
      return;
    }
    const destino = { id };
    cambioSede.current = destino;
    try {
      await cambiarSede(id);
      setClaseId(claseSugeridaId ?? null);
      setElegirSede(false);
      setCambiandoA(destino);
      avisar(`Ahora en ${nombreSede(id, sedes, academia)}`);
    } catch {
      cambioSede.current = null;
      avisar('No se pudo cambiar de sede. Inténtalo de nuevo.', 'error');
    }
  };

  return (
    <div className={cx(movs.length > 0 && !esc && 'pb-72', 'lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6')}>
      <div className="min-w-0">
      <Encabezado
        titulo="Entrada"
        sub={sedes.length > 0 ? (
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="first-letter:uppercase">{fechaLarga(hoy()).replace(/,? de [a-záéíóú]+$/i, '').replace(',', '')}</span>
            <button
              type="button"
              disabled={sedeOcupada}
              onClick={() => setElegirSede(true)}
              aria-label={`Cambiar sede: ${nombreSede(sedeActual, sedes, academia)}`}
              aria-haspopup="dialog"
              className="flex min-h-11 items-center gap-1 rounded-lg px-1 text-left font-semibold text-brand-600 active:bg-brand-50 disabled:text-ink-500"
            >
              {nombreSede(sedeActual, sedes, academia)} <ChevronDown size={15} className="shrink-0" aria-hidden="true" />
            </button>
          </span>
        ) : fechaLarga(hoy())}
        accion={
          pendientes > 0 ? (
            <Link
              to="/pendientes"
              className="relative flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-superficie px-3 text-sm font-bold text-ink-700 ring-1 ring-ink-100 active:bg-ink-50"
              aria-label={`${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'}: a quién escribir y qué cobrar`}
            >
              <ListChecks size={18} className="text-brand-600" aria-hidden="true" />
              {/* más de 99 ya no dice nada (y abruma): "99+" */}
              <span className="tabular-nums">{pendientes > 99 ? '99+' : pendientes}</span>
              <span className="hidden font-semibold lg:inline">{pendientes === 1 ? 'pendiente' : 'pendientes'}</span>
            </Link>
          ) : undefined
        }
      />
      {sedes.length > 0 && (
        <SugerenciaSede
          clases={todasLasClases.filter((c) => !c.sedeId || sedes.some((s) => s.id === c.sedeId))}
          sedeActual={sedeActual}
          nombreDeSede={(id) => nombreSede(id, sedes, academia)}
          nombreDeClase={(c) => nombreClase(c, disciplinas)}
          ocupado={sedeOcupada}
          cambiar={cambiarSedeEntrada}
        />
      )}
      {sedes.length > 0 && movs.length > 0 && (
        <p className="mx-4 text-sm text-ink-500">Termina la cuenta para cambiar de sede.</p>
      )}

      {/* academia nueva: lo que falta configurar (solo el dueño; se va sola al terminar) */}
      <PrimerosPasos />
      <BienvenidaRecepcion />

      {/* La clase: una sola tarjeta (antes la clase salía dos veces: en una fila de botones y en esta tarjeta).
          Se toca para cambiar de clase (y de sede, si hay varias). */}
      {q && clase && (
        <div className="px-4 pt-3">
          <button type="button" onClick={() => setElegirClase(true)} className="flex min-h-10 w-full items-center gap-2 rounded-xl bg-superficie px-3 text-left text-sm ring-1 ring-ink-100" aria-label={`Clase: ${nombreClase(clase, disciplinas)}. Tocar para cambiar de clase`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorClase(clase, disciplinas) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              <b>{nombreClase(clase, disciplinas)}</b> · {clase.horaInicio}
            </span>
            <span className="flex items-center font-semibold text-brand-600">
              Cambiar <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}
      {!q &&
        (clase ? (
          <HeroClase
            titulo={nombreClase(clase, disciplinas)}
            color={colorClase(clase, disciplinas)}
            detalle={[clase.horaInicio, nombreMaestro(clase, maestros) && `con ${nombreMaestro(clase, maestros)}`].filter(Boolean).join(' · ')}
            sede={sedes.length > 0 ? nombreSede(sedeActual, sedes, academia) : undefined}
            adentro={conteo.get(clase.id) ?? 0}
            cobrado={cobradoClase}
            onCambiar={() => setElegirClase(true)}
          />
        ) : (
          <div className="px-4 pt-3">
            <button type="button" onClick={() => setElegirClase(true)} className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-ink-300 px-5 py-4 text-left font-semibold text-ink-700 active:bg-ink-50">
              <CalendarDays size={22} className="text-brand-600" aria-hidden="true" /> {deHoy.length ? 'Elegir clase' : 'Hoy no hay clases · Elegir clase'}
              <ChevronDown size={18} className="ml-auto text-ink-500" aria-hidden="true" />
            </button>
          </div>
        ))}

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
              if (e.key === 'Enter' && exacto && resultados.length === 1) elegirAlumno(resultados[0]);
            }}
            aria-label="Buscar alumno por nombre, celular o código del pase"
            placeholder={esc && conTeclado ? '¿Quién llegó? (escribe para buscar)' : angosta ? 'Buscar…' : '¿Quién llegó?'}
            className={cx('h-14 w-full rounded-2xl bg-superficie pl-11 text-lg shadow-sm ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500', q ? 'pr-10' : 'pr-2')}
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
          onClick={() => { if (!cambioSede.current) setTienda(true); }}
          aria-label={porRecoger ? `Tienda, ${porRecoger} ${porRecoger === 1 ? 'apartado' : 'apartados'} por recoger` : 'Tienda'}
          className="relative flex h-14 w-12 shrink-0 items-center justify-center rounded-2xl bg-superficie text-ink-700 shadow-sm ring-1 ring-ink-100 active:scale-95 sm:w-14"
        >
          <ShoppingBag size={24} />
          {porRecoger > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-extrabold text-white shadow">{porRecoger > 99 ? '99+' : porRecoger}</span>
          )}
        </button>
        <button
          onClick={() => { if (!cambioSede.current) setEscanear(true); }}
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
              const entro = adentro.has(a.id);
              const plan = clase && membresiaQueCubre(estados.get(a.id) ?? [], clase);
              return (
                <div key={a.id} className="flex items-stretch overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
                  <button onClick={() => elegirAlumno(a)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left active:bg-ink-50">
                    <Avatar nombre={a.nombre} foto={a.foto} />
                    <DatosResultado alumno={a} archivado={archivados.has(a.id)} />
                    {!a.activo ? (
                      <Etiqueta tono="pronto">Revisar ficha</Etiqueta>
                    ) : entro ? (
                      <Etiqueta tono="ok">Adentro</Etiqueta>
                    ) : (
                      <Etiqueta tono={plan ? 'ok' : suelta && clase ? 'marca' : 'neutro'}>
                        {!clase ? 'Elegir clase' : plan ? 'Entrada con plan' : suelta ? `Cobrar ${dinero(suelta.precio)}` : 'Sin tarifa'}
                      </Etiqueta>
                    )}
                  </button>
                  {a.activo && (
                    <button onClick={() => setAlumnoSel(a)} className="border-l border-ink-100 px-3 text-ink-500 active:bg-ink-50" aria-label={`Más opciones para ${a.nombre}`}>
                      <MoreHorizontal size={20} />
                    </button>
                  )}
                </div>
              );
            })}
            {similares.length > 0 && (
              <>
                <p className="px-1 pt-1 text-xs font-bold tracking-wider text-warn-600 uppercase">¿Es alguno de estos?</p>
                {similares.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => a.activo ? setAlumnoSel(a) : setPorReactivar(a)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-warn-50 p-3 text-left ring-1 ring-warn-600/20 active:brightness-95"
                  >
                    <Avatar nombre={a.nombre} foto={a.foto} />
                    <DatosResultado alumno={a} archivado={archivados.has(a.id)} />
                    <Etiqueta tono="pronto">Revisar ficha</Etiqueta>
                  </button>
                ))}
              </>
            )}
            {!consultaEsNombre ? (
              !hayCoincidencias && <p className="px-2 py-3 text-sm text-ink-600">No encontramos a nadie. Revisa el celular o el código, o busca por nombre.</p>
            ) : hayCoincidencias ? (
              <Boton bloque variante="secundario" onClick={() => setNuevo(true)}>Registrar a otra persona</Boton>
            ) : (
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
                    <span className="block text-xs text-ink-500">
                      {clase && suelta ? `Crea su ficha y cobra ${dinero(suelta.precio)} · ${nombreClase(clase, disciplinas)}` : 'Elige una clase con tarifa para registrar y cobrar'}
                    </span>
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
              {vista === 'llegan' && <div className="mt-1 flex justify-end"><BotonVisitante onClick={() => setVisitante(true)} /></div>}
            </div>
            {vista === 'llegan' || esc ? (
              <>
                <Frecuentes key={clase.id} clase={clase} precioClase={suelta?.precio} adentro={adentro} vinieronHoy={vinieronHoy} onToque={async (alumno) => (await entrarAlumno(alumno))?.tipo === 'ok'} onOpciones={setAlumnoSel} />
                {totalAlumnos === 0 ? (
                  // el primer día: todavía no hay a quién tocar, así que se dice cómo se registra al primero
                  <Vacio
                    icono={<UserPlus size={36} />}
                    titulo="Aún no tienes alumnos"
                    texto="Cuando llegue alguien, escribe su nombre arriba y toca “Nuevo”: queda registrado y entra en un toque."
                  />
                ) : (
                <p className="mt-4 px-2 text-center text-xs leading-relaxed text-ink-500">
                  Toca a quien llegó para cobrar o darle entrada.
                  <br />
                  Para ver su ficha o venderle un plan, toca su nombre en la cuenta (o mantén presionada su tarjeta). Si no aparece, búscalo arriba.
                </p>
                )}
              </>
            ) : (
              <EnClase clase={clase} movs={movs} />
            )}
          </>
        )}
      </div>
      </div>

      {esc && (
        <aside className="sticky top-6 mt-6 space-y-4">
          {cuenta}
          {clase && <EnClase clase={clase} movs={movs} onVisitante={() => setVisitante(true)} />}
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

      <Hoja abierta={Boolean(porReactivar)} onCerrar={() => setPorReactivar(null)} titulo="Reactivar alumno">
        {porReactivar && (
          <ConfirmarReactivacion
            alumno={porReactivar}
            onCancelar={() => setPorReactivar(null)}
            onConfirmado={(a) => {
              setPorReactivar(null);
              setAlumnoSel(a);
            }}
          />
        )}
      </Hoja>

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno
          nombreInicial={nombreNuevo}
          archivados={archivados}
          onGuardado={(a) => {
            setNuevo(false);
            setAlumnoSel(a);
          }}
        />
      </Hoja>

      <Hoja
        abierta={elegirClase}
        onCerrar={() => {
          setElegirClase(false);
          setVerTodas(false);
        }}
        titulo={verTodas || !deHoy.length ? 'Todas las clases' : 'Clases de hoy'}
      >
        {elegirClase && (
          <div className="space-y-2">
            {(verTodas || !deHoy.length ? clases : deHoy).map((c) => {
              const activa = clase?.id === c.id;
              const n = conteo.get(c.id) ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClaseId(c.id);
                    setElegirClase(false);
                    setVerTodas(false);
                  }}
                  aria-current={activa || undefined}
                  className={cx('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-inset focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-brand-600', activa ? 'bg-brand-50 ring-brand-500' : 'bg-superficie ring-ink-100')}
                >
                  <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colorClase(c, disciplinas) }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{nombreClase(c, disciplinas)}</span>
                    <span className="block text-sm text-ink-500">
                      {verTodas ? c.dias.map((d) => DIAS_CORTOS[d]).join(' ') + ' · ' : ''}
                      {c.horaInicio}
                      {nombreMaestro(c, maestros) && ` · ${nombreMaestro(c, maestros)}`}
                    </span>
                  </span>
                  {!verTodas && (
                    <span className="text-right">
                      <span className="block text-lg leading-none font-extrabold">{n}</span>
                      <span className="text-[11px] text-ink-500">adentro</span>
                    </span>
                  )}
                </button>
              );
            })}
            {deHoy.length > 0 && (
            <button type="button" onClick={() => setVerTodas(!verTodas)} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-brand-600 active:bg-brand-50">
              <CalendarDays size={16} aria-hidden="true" /> {verTodas ? 'Ver solo las de hoy' : 'Ver todas las clases'}
            </button>
            )}
            {sedes.length > 0 && (
              <button
                type="button"
                disabled={sedeOcupada}
                aria-haspopup="dialog"
                onClick={() => {
                  setElegirClase(false);
                  setElegirSede(true);
                }}
                className="flex min-h-11 w-full items-center gap-2 border-t border-ink-100 px-2 py-2 text-left text-sm disabled:opacity-50"
              >
                <MapPin size={18} style={{ color: sedes.find((x) => x.id === sedeActual)?.color ?? 'var(--marca)' }} aria-hidden="true" />
                <span className="flex-1">
                  {nombreSede(sedeActual, sedes, academia)}
                </span>
                <span className="font-semibold text-brand-600">Cambiar sede</span>
              </button>
            )}
          </div>
        )}
      </Hoja>

      <Hoja abierta={elegirSede} onCerrar={() => setElegirSede(false)} titulo="Cambiar sede">
        {elegirSede && (
          <div className="space-y-2">
            {[null, ...sedes.map((x) => x.id)].map((id) => {
              const x = sedes.find((y) => y.id === id);
              const actual = mismaSede(id, sedeActual);
              const planSuelta = sueltaPara(planes, id);
              return (
                <button
                  key={id ?? 'principal'}
                  type="button"
                  aria-current={actual || undefined}
                  disabled={sedeOcupada}
                  onClick={() => void cambiarSedeEntrada(id)}
                  className={cx('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-inset active:brightness-95 focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-brand-600', actual ? 'bg-brand-50 ring-brand-200' : 'bg-superficie ring-ink-100')}
                >
                  <MapPin size={20} className="shrink-0" style={{ color: x?.color ?? 'var(--marca)' }} aria-hidden="true" />
                  <span className="flex-1">
                    <span className="block font-semibold">{nombreSede(id, sedes, academia)}</span>
                    <span className="block text-sm text-ink-500">
                      {planSuelta ? `Clase suelta · tarifa base ${dinero(planSuelta.precio)}` : 'Sin tarifa general de clase suelta'}
                    </span>
                  </span>
                  {actual && <Check size={18} className="shrink-0 text-brand-600" aria-hidden="true" />}
                </button>
              );
            })}
            <p className="px-1 pt-1 text-xs text-ink-500">Los cobros y el corte de caja quedan en la sede elegida.</p>
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
            clase={clase ? nombreClase(clase, disciplinas) : undefined}
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

function SugerenciaSede({ clases, sedeActual, nombreDeSede, nombreDeClase, ocupado, cambiar }: {
  clases: Clase[];
  sedeActual: ID | null;
  nombreDeSede: (id: ID | null) => string;
  nombreDeClase: (clase: Clase) => string;
  ocupado: boolean;
  cambiar: (id: ID | null, claseId: ID) => Promise<void>;
}) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const actualizarHora = () => setAhora(new Date());
    const intervalo = window.setInterval(actualizarHora, 30_000);
    document.addEventListener('visibilitychange', actualizarHora);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', actualizarHora);
    };
  }, []);
  const sugerida = claseEnOtraSede(clases, sedeActual, ahora);
  if (!sugerida || ocupado) return null;
  const destino = sugerida.sedeId ?? null;
  return (
    <div className="mx-4 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm">
      <p><strong>{nombreDeSede(destino)}</strong> · {nombreDeClase(sugerida)} · {sugerida.horaInicio}</p>
      <button type="button" onClick={() => void cambiar(destino, sugerida.id)} className="min-h-11 font-bold text-brand-600">
        Cambiar a {nombreDeSede(destino)}
      </button>
    </div>
  );
}

/** Tarjeta en vivo de la clase: da sensación de "ambiente" y responde a cada cobro. */
function HeroClase({ titulo, color, detalle, sede, adentro, cobrado, onCambiar }: { titulo: string; color: string; detalle: string; sede?: string; adentro: number; cobrado: number; onCambiar: () => void }) {
  return (
    <div className="px-4 pt-3">
      <button
        type="button"
        onClick={onCambiar}
        aria-label={`Clase: ${titulo}, ${detalle}${sede ? ` · ${sede}` : ''}. ${adentro} adentro. Tocar para cambiar de clase`}
        aria-haspopup="dialog"
        className="relative block w-full overflow-hidden rounded-3xl px-5 py-3.5 text-left text-white shadow-lg transition active:scale-[0.99]"
        style={{
          background: `linear-gradient(135deg in oklab, ${color}, color-mix(in oklab, ${color} 55%, #1c1a24))`,
          boxShadow: `0 12px 28px -12px color-mix(in oklab, ${color} 70%, transparent)`,
        }}
      >
        {/* Anillos decorativos: el "compás" del logo */}
        <svg className="pointer-events-none absolute -top-10 -right-8 h-44 w-44 opacity-15" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="70 37" strokeLinecap="round" transform="rotate(-30 32 32)" />
          <circle cx="32" cy="32" r="27" fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="4 6" />
        </svg>
        <span className="relative flex items-end justify-between gap-4">
          <span className="block min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-white/90">
              <span className="line-clamp-2">{detalle}</span>
              <ChevronDown size={15} className="shrink-0" aria-hidden="true" />
            </span>
            <span className="mt-0.5 block break-words text-xl leading-tight font-extrabold tracking-tight sm:text-2xl">{titulo}</span>
            <span className="block mt-0.5 text-sm font-semibold text-white/85">{cobrado > 0 ? `${dinero(cobrado)} en cobros registrados` : 'Aún sin cobros'}</span>
          </span>
          <span className="block text-right">
            <span key={adentro} className="block text-5xl leading-none font-extrabold tracking-tight animate-pop">
              {adentro}
            </span>
            <span className="block mt-1 text-xs font-semibold text-white/80">{adentro === 1 ? 'bailarín' : 'bailarines'}</span>
          </span>
        </span>
      </button>
    </div>
  );
}

function DatosResultado({ alumno, archivado }: { alumno: Alumno; archivado: boolean }) {
  const final = digitosTelefono(alumno.telefono).slice(-4);
  const estado = !alumno.activo ? 'De baja' : archivado ? 'Archivado' : '';
  const detalles = [final.length === 4 ? `Cel. •••• ${final}` : `Pase ${alumno.codigo}`, estado].filter(Boolean).join(' · ');
  return (
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-semibold sm:text-[17px]">{alumno.nombre}</span>
      <span className="block text-xs text-ink-500">{detalles}</span>
    </span>
  );
}

function BotonVisitante({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-left text-sm font-semibold text-brand-600 active:bg-brand-50">
      <Footprints size={16} className="shrink-0" aria-hidden="true" /> Visitante con nombre
    </button>
  );
}

function EnClase({ clase, movs, onVisitante }: { clase: Clase; movs: Movimiento[]; onVisitante?: () => void }) {
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
        .map((a, i) => ({
          a,
          nombre: alumnos[i]?.nombre ?? a.nombreVisitante ?? 'Visitante',
          foto: alumnos[i]?.foto,
          pago: pagos[i],
        }))
        .sort((x, y) => y.a.createdAt - x.a.createdAt);
    },
    [clase.id],
    [],
  );

  const sel = lista.find((x) => x.a.id === quitar);
  const enCuenta = new Set(movs.map((m) => m.asistenciaId));
  const visitante = onVisitante && <BotonVisitante onClick={onVisitante} />;

  if (!lista.length) return (
    <Tarjeta className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-1.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-600">
        <Users size={17} aria-hidden="true" /> Aún no llega nadie
      </p>
      {visitante}
    </Tarjeta>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-bold tracking-wider text-ink-500 uppercase">
          En {nombreClase(clase, disciplinas)} · {lista.length}
        </h2>
        {visitante}
      </div>
        <Tarjeta className="divide-y divide-ink-100">
          {lista.map(({ a, nombre, foto, pago }) => (
            <div key={a.id} className="flex w-full items-center gap-2 px-3 py-2.5">
              <Avatar nombre={nombre} foto={foto} tam={36} />
              <span className="min-w-0 flex-1 truncate font-medium">{nombre}</span>
              <EstadoEntrada asistencia={a} pago={pago} />
              <div className="shrink-0 text-right">
                <span className="block text-xs text-ink-500">{horaDe(a.createdAt)}</span>
                {enCuenta.has(a.id) ? <span className="text-xs text-ink-500">En cuenta</span> : (
                  <button type="button" onClick={() => setQuitar(a.id)} aria-label={`Corregir entrada de ${nombre}`} className="min-h-8 rounded-lg px-1 text-xs font-semibold text-brand-600 underline underline-offset-4 active:bg-brand-50">
                    Corregir
                  </button>
                )}
              </div>
            </div>
          ))}
        </Tarjeta>

      <Hoja abierta={!!sel} onCerrar={() => setQuitar(null)} titulo="Corregir entrada">
        {sel && <CorregirEntrada asistencia={sel.a} nombre={sel.nombre} onHecho={() => setQuitar(null)} />}
      </Hoja>
    </div>
  );
}

function FormVisitante({ clase, onHecho }: { clase: Clase | null; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const suelta = sueltaDeClase(usePlanes(), clase);
  const [nombre, setNombre] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);

  if (!clase) return <p className="text-ink-500">Elige primero una clase.</p>;
  if (!suelta) return <p className="text-ink-500">Crea un plan de tipo “clase suelta” en Ajustes.</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-700">Entrada a <strong>{nombreClase(clase, disciplinas)}</strong> · {clase.horaInicio}</p>
      <p className="text-sm text-ink-500">Se registra la visita y el cobro en caja. El nombre es una referencia para esta visita.</p>
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
          try {
            await cobrarClaseSuelta({ alumnoId: null, nombreVisitante: nombre, claseId: clase.id, plan: suelta, metodo, usuarioId: usuario.id });
            avisar(`${dinero(suelta.precio)} cobrados`);
            onHecho();
          } catch {
            avisar('No se pudo guardar el cobro. Intenta de nuevo.', 'error');
          } finally {
            setOcupado(false);
          }
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
