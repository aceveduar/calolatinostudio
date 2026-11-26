import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarPlus, ChevronRight, Combine, Eraser, History, Link2, MessageCircle, Pencil, Phone, QrCode, Search, UserX } from 'lucide-react';
import { HistorialAnterior } from './HistorialAnterior';
import { puedeVerAnterior } from '../../sync/engine';
import { nombreClase, useAlumnos, useClases, useDisciplinas, useEstadosDeAlumno, usePlanes, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { abrirTicketDePlan } from '../../app/ticketAbierto';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Campo, Entrada, Etiqueta, Hoja, Seccion, Tarjeta, Vacio, VerMas, cx } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { db } from '../../db/db';
import type { Alumno, Pago } from '../../db/types';
import { adeudosDe, esAdeudo } from '../../domain/adeudos';
import { NOMBRE_ANONIMO, anonimizarAlumno, fusionarAlumnos, resumenAlumno } from '../../domain/correcciones';
import { dinero } from '../../domain/dinero';
import { deFecha, fechaCorta, hoy, textoFechaHora } from '../../domain/fechas';
import { perfilAlumno, type PerfilAlumno } from '../../domain/perfilAlumno';
import { semaforoAlumno, textoDias } from '../../domain/membresias';
import { DetallePago } from '../caja/PantallaCaja';
import { FormAlumno } from './FormAlumno';
import { ConfirmarReactivacion } from './ConfirmarReactivacion';
import { VenderPlan } from './VenderPlan';
import { CredencialQR } from './CredencialQR';
import { EnviarWhatsApp } from './EnviarWhatsApp';
import { AccesoPaseAlumno } from './AccesoPaseAlumno';
import { TarjetaAdeudos } from './Adeudos';
import { FotoAlumno } from './FotoAlumno';
import { Bienvenida } from './Bienvenida';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function FichaAlumno() {
  const { id } = useParams();
  const nav = useNavigate();
  const avisar = useAvisos();
  const { academia, esDueno } = useSesion();
  const alumno = useLiveQuery(async () => (await db.alumnos.get(id ?? '')) ?? null, [id]);
  const estados = useEstadosDeAlumno(id);
  const planes = usePlanes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const usuarios = useUsuarios();
  const [editar, setEditar] = useState(false);
  const [vender, setVender] = useState(false);
  const [fusionar, setFusionar] = useState(false);
  const [reactivar, setReactivar] = useState(false);
  const [qr, setQr] = useState(false);
  const [whats, setWhats] = useState(false);
  const [pasePersonal, setPasePersonal] = useState(false);
  const [anonimizar, setAnonimizar] = useState(false);
  const [pagoSel, setPagoSel] = useState<Pago | null>(null);
  const [anterior, setAnterior] = useState(false);
  const [todasClases, setTodasClases] = useState(false);
  const [todosPagos, setTodosPagos] = useState(false);
  const verAnterior = useLiveQuery(async () => (alumno ? puedeVerAnterior(alumno.createdAt) : false), [alumno?.createdAt], false);
  // recién dado de alta (desde Alumnos o Interesados): ofrecer mandarle su acceso
  const loc = useLocation();
  const [bienvenida, setBienvenida] = useState(!!(loc.state as { recien?: boolean } | null)?.recien);
  const cerrarBienvenida = () => {
    setBienvenida(false);
    nav(loc.pathname, { replace: true, state: null }); // que "atrás" o recargar no lo vuelva a abrir
  };

  const historial = useLiveQuery(async () => {
    if (!id) return { pagos: [], totalPagos: 0, asistencias: [], fiadas: [], totalAsistencias: 0, repetidas: [] as { claseId: string; fecha: string }[], perfil: null };
    const pagos = await db.pagos.where('alumnoId').equals(id).reverse().sortBy('createdAt');
    const asistencias = await db.asistencias.where('alumnoId').equals(id).filter((a) => !a.anuladaAt && !a.deletedAt).reverse().sortBy('createdAt');
    const vistos = new Set<string>();
    const repetidas: { claseId: string; fecha: string }[] = [];
    for (const a of asistencias) {
      const k = `${a.claseId}|${a.fecha}`;
      if (vistos.has(k)) repetidas.push({ claseId: a.claseId, fecha: a.fecha });
      vistos.add(k);
    }
    const a = await db.alumnos.get(id);
    const perfil = a ? perfilAlumno({ asistencias, pagos, altaEn: a.createdAt, hoy: hoy() }) : null;
    // hasta 60 de cada uno en la ficha (se ven 8 y "Ver…"); antes 20, y "Ver los 20" no cuadraba con "29 clases tomadas"
    return { pagos: pagos.slice(0, 60), totalPagos: pagos.length, asistencias: asistencias.slice(0, 60), fiadas: asistencias.filter(esAdeudo), totalAsistencias: asistencias.length, repetidas, perfil };
  }, [id]);

  if (alumno === undefined) return null;
  if (!alumno || alumno.deletedAt) return <Vacio titulo="Alumno no encontrado" texto="Puede que se haya fusionado con otro registro." />;

  const sem = semaforoAlumno(estados);
  const vigentes = estados
    .filter((e) => e.vigente || (e.membresia.inicio > hoy() && !e.membresia.anuladaAt && !e.membresia.deletedAt))
    .sort((a, b) => Number(b.vigente) - Number(a.vigente) || a.membresia.inicio.localeCompare(b.membresia.inicio));
  const membresiaDelPago = pagoSel && estados.find(({ membresia }) =>
    membresia.pagoId === pagoSel.id && !membresia.anuladaAt && !membresia.deletedAt,
  )?.membresia;
  const adeudos = adeudosDe(historial?.fiadas ?? [], clases, planes);
  const nombre1 = alumno.nombre.split(' ')[0];
  const abrirPagoDePlan = async (pagoId: string) => {
    const p = await db.pagos.get(pagoId);
    if (p) setPagoSel(p);
  };

  // lo que se usa poco, junto y con su explicación (antes eran textos sueltos al final)
  const masOpciones = (
  <Seccion titulo="Más opciones">
    <Tarjeta className="divide-y divide-ink-100">
      <Opcion icono={<Combine size={18} />} titulo="Unir registros" detalle="Si está registrado dos veces" onClick={() => setFusionar(true)} />
      {esDueno && alumno.activo && (
        <Opcion
          icono={<UserX size={18} />}
          titulo="Dar de baja"
          detalle="Sale de la lista habitual y conserva su historial"
          peligro
          onClick={async () => {
            await actualizar('alumnos', alumno.id, { activo: false });
            avisar(`${nombre1} dado de baja`, 'ok', { texto: 'Deshacer', fn: () => actualizar('alumnos', alumno.id, { activo: true }).then(() => undefined) });
            nav('/alumnos');
          }}
        />
      )}
      {esDueno && alumno.nombre !== NOMBRE_ANONIMO && (
        <Opcion icono={<Eraser size={18} />} titulo="Borrar sus datos personales" detalle="Solo si el alumno lo pide" onClick={() => setAnonimizar(true)} />
      )}
    </Tarjeta>
  </Seccion>
  );

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-5xl">
      <button onClick={() => nav(-1)} className="mt-3 -ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Atrás">
        <ArrowLeft />
      </button>
      {/* en computadora: datos y acciones a la izquierda, historial a la derecha (antes una columna angosta) */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div className="min-w-0">

      {!alumno.activo && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-warn-50 px-4 py-3 text-sm text-warn-600">
          <UserX size={18} className="shrink-0" />
          <span className="flex-1 font-medium">Dado de baja.</span>
          {alumno.nombre !== NOMBRE_ANONIMO && (
            <button className="rounded-lg bg-warn-600/15 px-3 py-1.5 font-bold" onClick={() => setReactivar(true)}>
              Reactivar
            </button>
          )}
        </div>
      )}

      <div className="mt-1 flex items-center gap-4">
        <FotoAlumno alumno={alumno} />
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-3 text-2xl leading-tight font-extrabold break-words">{alumno.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Etiqueta tono={sem.color}>{sem.texto}</Etiqueta>
            <span className="text-xs text-ink-500">
              {historial?.totalAsistencias ?? 0} {historial?.totalAsistencias === 1 ? 'clase tomada' : 'clases tomadas'}
            </span>
          </div>
        </div>
        <button onClick={() => setEditar(true)} className="rounded-full p-2.5 text-ink-500 active:bg-ink-100" aria-label="Editar">
          <Pencil size={20} />
        </button>
      </div>
      {historial?.repetidas.map((r) => (
        <p key={r.claseId + r.fecha} className="mt-3 rounded-2xl bg-warn-50 px-4 py-3 text-sm font-medium text-warn-600">
          Aparece 2 veces en {nombreClase(clases.find((c) => c.id === r.claseId), disciplinas)} el {fechaCorta(r.fecha)}. Si se cobró doble, toca el pago repetido abajo y
          anúlalo.
        </p>
      ))}
      {alumno.notas && <p className="mt-3 rounded-xl bg-superficie px-4 py-2 text-sm text-ink-700 ring-1 ring-ink-100">{alumno.notas}</p>}

      <TarjetaAdeudos alumno={alumno} adeudos={adeudos} planes={planes} />

      <Boton bloque variante={adeudos.length ? 'secundario' : 'primario'} onClick={() => setVender(true)} className="mt-4">
        <CalendarPlus size={18} aria-hidden="true" /> Vender plan
      </Boton>

      <Seccion titulo="Planes">
        {vigentes.length === 0 ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Sin plan vigente. Paga por clase.</Tarjeta>
        ) : (
          <div className="space-y-2">
            {vigentes.map((e) => (
              <Tarjeta key={e.membresia.id} className="p-4" onClick={() => abrirPagoDePlan(e.membresia.pagoId)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{planes.find((p) => p.id === e.membresia.planId)?.nombre ?? 'Plan'}</p>
                  <span className="flex items-center gap-1">
                    {e.vigente ? <Etiqueta tono={e.diasRestantes <= 3 ? 'pronto' : 'ok'}>{textoDias(e.diasRestantes)}</Etiqueta> : <Etiqueta>Próximo</Etiqueta>}
                    <ChevronRight size={16} className="text-ink-300" />
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {fechaCorta(e.membresia.inicio)} – {fechaCorta(e.membresia.fin)}
                  {e.restantes !== null && ` · ${e.usadas}/${e.membresia.clasesTotal} clases usadas`}
                </p>
                {!!e.membresia.claseIds?.length && (
                  <p className="mt-0.5 text-sm text-ink-700">
                    Cubre: {e.membresia.claseIds.map((cid) => nombreClase(clases.find((c) => c.id === cid), disciplinas)).join(', ')}
                  </p>
                )}
              </Tarjeta>
            ))}
          </div>
        )}
      </Seccion>

      <div className="mt-3 grid grid-cols-2 gap-x-2 sm:flex sm:flex-wrap">
        <Boton variante="fantasma" aria-label="Ver QR de la credencial" onClick={() => setQr(true)} className="min-h-11 justify-start px-2 text-left text-sm">
          <QrCode size={16} aria-hidden="true" /> Ver QR
        </Boton>
        {alumno.activo && (
          <Boton variante="fantasma" onClick={() => setPasePersonal(true)} className="min-h-11 justify-start px-2 text-left text-sm">
            <Link2 size={16} aria-hidden="true" /> Compartir pase
          </Boton>
        )}
        {alumno.telefono && (
          <>
            <Boton variante="fantasma" onClick={() => setWhats(true)} className="min-h-11 justify-start px-2 text-left text-sm">
              <MessageCircle size={16} className="text-ok-600" aria-hidden="true" /> WhatsApp
            </Boton>
            <a href={`tel:${alumno.telefono}`} className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-2 text-sm font-semibold text-ink-700 active:bg-ink-100">
              <Phone size={16} aria-hidden="true" /> Llamar
            </a>
          </>
        )}
      </div>

      {historial?.perfil && <Resumen perfil={historial.perfil} clase={nombreClase(clases.find((c) => c.id === historial.perfil?.clase?.id), disciplinas)} />}

      <div className="hidden lg:block">{masOpciones}</div>
      </div>
      <div className="min-w-0 lg:[&>section:first-child]:mt-0">
      <Seccion titulo="Últimas clases">
        {!historial?.asistencias.length ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Todavía no ha tomado clases.</Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {(todasClases ? historial.asistencias : historial.asistencias.slice(0, 8)).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{nombreClase(clases.find((c) => c.id === a.claseId), disciplinas)}</p>
                  {a.membresiaId ? <p className="text-xs text-ink-500">Con plan</p>
                    : a.debe ? <p className="text-xs text-ink-500">Clase por pagar</p>
                    : a.pagoId && <p className="text-xs text-ink-500">Clase suelta</p>}
                </div>
                <span className="text-ink-500">{textoFechaHora(a.fecha, a.createdAt)}</span>
              </div>
            ))}
            {historial.asistencias.length > 8 && (
              <VerMas
                abierto={todasClases}
                total={historial.asistencias.length}
                onClick={() => setTodasClases(!todasClases)}
                texto={historial.totalAsistencias > historial.asistencias.length ? `Ver las últimas ${historial.asistencias.length}` : `Ver las ${historial.totalAsistencias} clases`}
              />
            )}
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Pagos">
        {!historial?.pagos.length ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Sin pagos registrados.</Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {(todosPagos ? historial.pagos : historial.pagos.slice(0, 8)).map((p) => (
              <button key={p.id} onClick={() => setPagoSel(p)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm active:bg-ink-50">
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-medium'}>
                  {p.concepto} <span className="text-ink-500">· {fechaCorta(p.fecha)}</span>
                </span>
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-semibold'}>{dinero(p.monto)}</span>
              </button>
            ))}
            {historial.pagos.length > 8 && (
              <VerMas
                abierto={todosPagos}
                total={historial.pagos.length}
                onClick={() => setTodosPagos(!todosPagos)}
                texto={historial.totalPagos > historial.pagos.length ? `Ver los últimos ${historial.pagos.length}` : `Ver los ${historial.totalPagos} pagos`}
              />
            )}
          </Tarjeta>
        )}
        {verAnterior && (
          <button onClick={() => setAnterior(true)} className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand-600 active:bg-brand-50">
            <History size={16} aria-hidden="true" /> Ver historial de hace más de 18 meses
          </button>
        )}
      </Seccion>
      </div>
      </div>

      {/* en el celular, al final; en computadora va en la columna izquierda */}
      <div className="lg:hidden">{masOpciones}</div>

      <HistorialAnterior abierta={anterior} onCerrar={() => setAnterior(false)} alumnoId={alumno.id} nombre={nombre1} />

      <Hoja abierta={editar} onCerrar={() => setEditar(false)} titulo="Editar alumno">
        <FormAlumno alumno={alumno} onGuardado={() => setEditar(false)} />
      </Hoja>
      <Hoja abierta={vender} onCerrar={() => setVender(false)} titulo={`Vender plan a ${nombre1}`}>
        {vender && <VenderPlan alumno={alumno} estados={estados} onHecho={() => setVender(false)} />}
      </Hoja>
      <Hoja abierta={!!pagoSel} onCerrar={() => setPagoSel(null)} titulo="Cobro">
        {pagoSel && (
          <DetallePago
            pago={pagoSel}
            cobro={usuarios.find((u) => u.id === pagoSel.usuarioId)?.nombre}
            anulo={usuarios.find((u) => u.id === pagoSel.anuladoPor)?.nombre}
            onHecho={() => setPagoSel(null)}
            onVerTicket={membresiaDelPago ? (pago) => {
              setPagoSel(null);
              abrirTicketDePlan(academia, alumno, pago, membresiaDelPago, usuarios.find((u) => u.id === pago.usuarioId)?.nombre ?? '—');
            } : undefined}
          />
        )}
      </Hoja>
      <Hoja abierta={anonimizar} onCerrar={() => setAnonimizar(false)} titulo="Borrar datos personales">
        {anonimizar && <BorrarDatos nombre={alumno.nombre} onSi={async () => { await anonimizarAlumno(alumno.id); setAnonimizar(false); avisar('Datos personales borrados'); nav('/alumnos'); }} />}
      </Hoja>
      <Hoja abierta={whats} onCerrar={() => setWhats(false)} titulo={`WhatsApp a ${nombre1}`}>
        {whats && <EnviarWhatsApp alumno={alumno} estados={estados} onEnviado={() => setWhats(false)} />}
      </Hoja>
      <Hoja abierta={pasePersonal && alumno.activo} onCerrar={() => setPasePersonal(false)} titulo="Compartir Mi pase">
        {pasePersonal && alumno.activo && <AccesoPaseAlumno alumno={alumno} />}
      </Hoja>
      <Hoja abierta={bienvenida} onCerrar={cerrarBienvenida} titulo={`¡${nombre1} ya es alumno!`}>
        {bienvenida && <Bienvenida alumno={alumno} onCerrar={cerrarBienvenida} />}
      </Hoja>
      <Hoja abierta={qr} onCerrar={() => setQr(false)} titulo="Credencial">
        {qr && <CredencialQR alumno={alumno} academia={academia} />}
      </Hoja>
      <Hoja abierta={reactivar} onCerrar={() => setReactivar(false)} titulo="Reactivar alumno">
        {reactivar && <ConfirmarReactivacion alumno={alumno} onConfirmado={() => setReactivar(false)} onCancelar={() => setReactivar(false)} />}
      </Hoja>
      <Hoja abierta={fusionar} onCerrar={() => setFusionar(false)} titulo="Unir registros">
        {fusionar && (
          <Fusionar
            actual={alumno}
            onHecho={(destino) => {
              setFusionar(false);
              nav(`/alumnos/${destino}`, { replace: true });
            }}
          />
        )}
      </Hoja>
    </div>
  );
}

const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

/** El alumno de un vistazo: desde cuándo viene, cada cuánto, su clase de siempre y lo que ha pagado en el año. */
function Resumen({ perfil, clase }: { perfil: PerfilAlumno; clase: string }) {
  const desde = deFecha(perfil.desde).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace('.', '');
  const datos = [
    { titulo: 'Alumno desde', valor: desde },
    { titulo: 'Viene', valor: perfil.porMes ? `~${perfil.porMes} al mes` : 'No en 3 meses', alerta: !perfil.porMes },
    ...(perfil.clase ? [{ titulo: 'Su clase', valor: clase, pie: perfil.dia !== null ? `los ${DIAS_PLURAL[perfil.dia]}` : undefined }] : []),
    { titulo: 'Pagó en 12 meses', valor: dinero(perfil.pagadoAnio) },
  ];
  return (
    <Seccion titulo="Resumen">
      <Tarjeta className="grid grid-cols-2 gap-px overflow-hidden bg-ink-100">
        {datos.map((d) => (
          <div key={d.titulo} className="min-w-0 bg-superficie px-4 py-3">
            <p className="text-xs text-ink-500">{d.titulo}</p>
            <p className={cx('break-words font-bold first-letter:uppercase', d.alerta && 'text-warn-600')}>{d.valor}</p>
            {'pie' in d && d.pie && <p className="truncate text-xs text-ink-500">{d.pie}</p>}
          </div>
        ))}
      </Tarjeta>
    </Seccion>
  );
}

function Opcion({ icono, titulo, detalle, peligro, onClick }: { icono: ReactNode; titulo: string; detalle: string; peligro?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
      <span className={cx('shrink-0', peligro ? 'text-bad-600' : 'text-ink-500')} aria-hidden="true">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block font-semibold', peligro && 'text-bad-600')}>{titulo}</span>
        <span className="block text-xs text-ink-500">{detalle}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-300" aria-hidden="true" />
    </button>
  );
}

/** Une dos registros de la misma persona. Se elige cuál se queda; el otro pasa todo su historial. */
function Fusionar({ actual, onHecho }: { actual: Alumno; onHecho: (destinoId: string) => void }) {
  const avisar = useAvisos();
  const alumnos = useAlumnos();
  const [q, setQ] = useState(actual.nombre.split(' ')[0]);
  const [otro, setOtro] = useState<Alumno | null>(null);
  const [quedarse, setQuedarse] = useState<'actual' | 'otro'>('actual');
  const conteos = useLiveQuery(async () => (otro ? { a: await resumenAlumno(actual.id), b: await resumenAlumno(otro.id) } : null), [actual.id, otro?.id]);

  const candidatos = useMemo(() => {
    const t = normalizar(q.trim());
    return alumnos.filter((a) => a.id !== actual.id && (!t || normalizar(a.nombre).includes(t))).slice(0, 8);
  }, [q, alumnos, actual.id]);

  if (!otro)
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-500">Busca el otro registro de {actual.nombre.split(' ')[0]}:</p>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={20} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-12 w-full rounded-xl bg-superficie pr-4 pl-11 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {candidatos.map((a) => (
          <Tarjeta key={a.id} onClick={() => setOtro(a)} className="flex items-center gap-3 p-3">
            <Avatar nombre={a.nombre} foto={a.foto} tam={36} />
            <span className="flex-1 font-semibold">{a.nombre}</span>
            {!a.activo && <Etiqueta>Baja</Etiqueta>}
          </Tarjeta>
        ))}
      </div>
    );

  const [queda, sale] = quedarse === 'actual' ? [actual, otro] : [otro, actual];
  const cSale = quedarse === 'actual' ? conteos?.b : conteos?.a;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-ink-700">¿Con qué nombre se queda?</p>
      <div className="space-y-2">
        {(['actual', 'otro'] as const).map((k) => {
          const a = k === 'actual' ? actual : otro;
          const c = k === 'actual' ? conteos?.a : conteos?.b;
          return (
            <button
              key={k}
              onClick={() => setQuedarse(k)}
              className={cx('flex w-full items-center gap-3 rounded-2xl bg-superficie p-3 text-left ring-1', quedarse === k ? 'ring-2 ring-brand-500' : 'ring-ink-100')}
            >
              <Avatar nombre={a.nombre} foto={a.foto} tam={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{a.nombre}</span>
                <span className="block text-xs text-ink-500">{c ? `${c.asistencias} clases · ${c.pagos} pagos · ${c.membresias} planes` : '…'}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="rounded-2xl bg-warn-50 p-3 text-sm text-warn-600">
        Todo lo de <b>{sale.nombre}</b>
        {cSale ? ` (${cSale.asistencias} clases, ${cSale.pagos} pagos)` : ''} pasará a <b>{queda.nombre}</b>, y el registro duplicado se retira.
      </p>
      <Boton
        grande
        bloque
        onClick={async () => {
          const repetidas = await fusionarAlumnos(sale.id, queda.id);
          avisar(
            repetidas
              ? `Unidos. Ojo: ${repetidas} entrada${repetidas > 1 ? 's' : ''} repetida${repetidas > 1 ? 's' : ''} el mismo día; revisa sus pagos por si se cobró doble.`
              : 'Registros unidos',
            repetidas ? 'error' : 'ok',
          );
          onHecho(queda.id);
        }}
      >
        <Combine size={20} /> Unir en {queda.nombre.split(' ')[0]}
      </Boton>
      <Boton bloque variante="fantasma" onClick={() => setOtro(null)}>
        Elegir otro
      </Boton>
    </div>
  );
}

/** Confirmación fuerte: es para cuando el alumno lo pide (aviso de privacidad) y no se puede deshacer. */
function BorrarDatos({ nombre, onSi }: { nombre: string; onSi: () => void | Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <p>
        Se borran el nombre, teléfono, foto, notas, su portal y su código QR de <b>{nombre}</b>. Sus pagos y entradas se quedan como “Alumno anónimo”, para que la caja y los reportes sigan cuadrando.
      </p>
      <p className="rounded-xl bg-warn-50 px-3 py-2 font-medium text-warn-600">No se puede deshacer. Hazlo solo si el alumno lo pidió.</p>
      <Campo etiqueta="Escribe BORRAR para confirmar">
        <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" placeholder="BORRAR" />
      </Campo>
      <Boton
        bloque
        grande
        variante="peligro"
        disabled={texto.trim().toUpperCase() !== 'BORRAR' || ocupado}
        onClick={async () => {
          setOcupado(true);
          await onSi();
        }}
      >
        Borrar sus datos
      </Boton>
    </div>
  );
}
