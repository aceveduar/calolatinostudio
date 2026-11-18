import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarPlus, ChevronRight, Combine, MessageCircle, Pencil, Phone, QrCode, Search, UserX } from 'lucide-react';
import { nombreClase, useAlumnos, useClases, useDisciplinas, useEstadosDeAlumno, usePlanes, useUsuarios } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Etiqueta, Hoja, Seccion, Tarjeta, Vacio, cx } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { db } from '../../db/db';
import type { Alumno, Pago } from '../../db/types';
import { fusionarAlumnos, resumenAlumno } from '../../domain/correcciones';
import { dinero } from '../../domain/dinero';
import { fechaCorta, hoy, textoFechaHora } from '../../domain/fechas';
import { semaforoAlumno, textoDias } from '../../domain/membresias';
import { DetallePago } from '../caja/PantallaCaja';
import { FormAlumno } from './FormAlumno';
import { VenderPlan } from './VenderPlan';
import { CredencialQR } from './CredencialQR';
import { EnviarWhatsApp } from './EnviarWhatsApp';
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
  const [qr, setQr] = useState(false);
  const [whats, setWhats] = useState(false);
  const [pagoSel, setPagoSel] = useState<Pago | null>(null);
  // recién dado de alta (desde Alumnos o Interesados): ofrecer mandarle su acceso
  const loc = useLocation();
  const [bienvenida, setBienvenida] = useState(!!(loc.state as { recien?: boolean } | null)?.recien);
  const cerrarBienvenida = () => {
    setBienvenida(false);
    nav(loc.pathname, { replace: true, state: null }); // que "atrás" o recargar no lo vuelva a abrir
  };

  const historial = useLiveQuery(async () => {
    if (!id) return { pagos: [], asistencias: [], totalAsistencias: 0, repetidas: [] as { claseId: string; fecha: string }[] };
    const pagos = await db.pagos.where('alumnoId').equals(id).reverse().sortBy('createdAt');
    const asistencias = await db.asistencias.where('alumnoId').equals(id).filter((a) => !a.anuladaAt && !a.deletedAt).reverse().sortBy('createdAt');
    const vistos = new Set<string>();
    const repetidas: { claseId: string; fecha: string }[] = [];
    for (const a of asistencias) {
      const k = `${a.claseId}|${a.fecha}`;
      if (vistos.has(k)) repetidas.push({ claseId: a.claseId, fecha: a.fecha });
      vistos.add(k);
    }
    return { pagos: pagos.slice(0, 20), asistencias: asistencias.slice(0, 20), totalAsistencias: asistencias.length, repetidas };
  }, [id]);

  if (alumno === undefined) return null;
  if (!alumno || alumno.deletedAt) return <Vacio titulo="Alumno no encontrado" texto="Puede que se haya fusionado con otro registro." />;

  const sem = semaforoAlumno(estados);
  const vigentes = estados.filter((e) => e.vigente || e.membresia.inicio > hoy());
  const nombre1 = alumno.nombre.split(' ')[0];
  const abrirPagoDePlan = async (pagoId: string) => {
    const p = await db.pagos.get(pagoId);
    if (p) setPagoSel(p);
  };

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <button onClick={() => nav(-1)} className="mt-3 -ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Atrás">
        <ArrowLeft />
      </button>

      {!alumno.activo && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-warn-50 px-4 py-3 text-sm text-warn-600">
          <UserX size={18} className="shrink-0" />
          <span className="flex-1 font-medium">Dado de baja. No aparece en Entrada.</span>
          <button
            className="rounded-lg bg-warn-600/15 px-3 py-1.5 font-bold"
            onClick={async () => {
              await actualizar('alumnos', alumno.id, { activo: true });
              avisar(`${nombre1} reactivado`);
            }}
          >
            Reactivar
          </button>
        </div>
      )}

      <div className="mt-1 flex items-center gap-4">
        <FotoAlumno alumno={alumno} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{alumno.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Etiqueta tono={sem.tono}>{sem.texto}</Etiqueta>
            <span className="text-xs text-ink-500">{historial?.totalAsistencias ?? 0} clases tomadas</span>
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

      <TarjetaAdeudos alumno={alumno} />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Boton grande onClick={() => setVender(true)} className="col-span-2">
          <CalendarPlus size={20} /> Vender plan
        </Boton>
        <Boton variante="secundario" onClick={() => setQr(true)} className="col-span-2">
          <QrCode size={18} /> Credencial con QR
        </Boton>
        {alumno.telefono && (
          <>
            <Boton bloque variante="secundario" onClick={() => setWhats(true)}>
              <MessageCircle size={18} className="text-ok-600" /> WhatsApp
            </Boton>
            <a href={`tel:${alumno.telefono}`}>
              <Boton bloque variante="secundario">
                <Phone size={18} /> Llamar
              </Boton>
            </a>
          </>
        )}
      </div>

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
              </Tarjeta>
            ))}
            <p className="px-1 text-xs text-ink-500">¿Se vendió el plan equivocado? Tócalo para anularlo y vende el correcto.</p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Últimas clases">
        {!historial?.asistencias.length ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Todavía no ha tomado clases.</Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {historial.asistencias.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{nombreClase(clases.find((c) => c.id === a.claseId), disciplinas)}</span>
                <span className="text-ink-500">{textoFechaHora(a.fecha, a.createdAt)}</span>
              </div>
            ))}
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Pagos">
        {!historial?.pagos.length ? (
          <Tarjeta className="p-4 text-sm text-ink-500">Sin pagos registrados.</Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {historial.pagos.map((p) => (
              <button key={p.id} onClick={() => setPagoSel(p)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm active:bg-ink-50">
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-medium'}>
                  {p.concepto} <span className="text-ink-500">· {fechaCorta(p.fecha)}</span>
                </span>
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-semibold'}>{dinero(p.monto)}</span>
              </button>
            ))}
          </Tarjeta>
        )}
      </Seccion>

      <div className="mt-8 space-y-1">
        <button className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-ink-700" onClick={() => setFusionar(true)}>
          <Combine size={16} /> ¿Está registrado dos veces? Unir registros
        </button>
        {esDueno && alumno.activo && (
          <button
            className="w-full py-3 text-sm font-semibold text-bad-600"
            onClick={async () => {
              await actualizar('alumnos', alumno.id, { activo: false });
              avisar(`${nombre1} dado de baja`, 'ok', { texto: 'Deshacer', fn: () => actualizar('alumnos', alumno.id, { activo: true }).then(() => undefined) });
              nav('/alumnos');
            }}
          >
            Dar de baja
          </button>
        )}
      </div>

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
          />
        )}
      </Hoja>
      <Hoja abierta={whats} onCerrar={() => setWhats(false)} titulo={`WhatsApp a ${nombre1}`}>
        {whats && <EnviarWhatsApp alumno={alumno} estados={estados} onEnviado={() => setWhats(false)} />}
      </Hoja>
      <Hoja abierta={bienvenida} onCerrar={cerrarBienvenida} titulo={`¡${nombre1} ya es alumno!`}>
        {bienvenida && <Bienvenida alumno={alumno} onCerrar={cerrarBienvenida} />}
      </Hoja>
      <Hoja abierta={qr} onCerrar={() => setQr(false)} titulo="Credencial">
        {qr && <CredencialQR alumno={alumno} academia={academia} />}
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
