import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarPlus, MessageCircle, Pencil, Phone } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas, useEstadosDeAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { Avatar, Boton, Etiqueta, Hoja, Seccion, Tarjeta, Vacio } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { db } from '../../db/db';
import { dinero } from '../../domain/dinero';
import { fechaCorta, hoy, textoFechaHora } from '../../domain/fechas';
import { semaforoAlumno, textoDias } from '../../domain/membresias';
import { FormAlumno } from './FormAlumno';
import { VenderPlan } from './VenderPlan';

export function FichaAlumno() {
  const { id } = useParams();
  const nav = useNavigate();
  const { academia, esDueno } = useSesion();
  const alumno = useLiveQuery(async () => (await db.alumnos.get(id ?? '')) ?? null, [id]);
  const estados = useEstadosDeAlumno(id);
  const planes = usePlanes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const [editar, setEditar] = useState(false);
  const [vender, setVender] = useState(false);

  const historial = useLiveQuery(async () => {
    if (!id) return { pagos: [], asistencias: [], totalAsistencias: 0 };
    const pagos = await db.pagos.where('alumnoId').equals(id).reverse().sortBy('createdAt');
    const asistencias = await db.asistencias.where('alumnoId').equals(id).filter((a) => !a.anuladaAt).reverse().sortBy('createdAt');
    return { pagos: pagos.slice(0, 20), asistencias: asistencias.slice(0, 20), totalAsistencias: asistencias.length };
  }, [id]);

  if (alumno === undefined) return null;
  if (!alumno) return <Vacio titulo="Alumno no encontrado" />;

  const sem = semaforoAlumno(estados);
  const vigentes = estados.filter((e) => e.vigente || e.membresia.inicio > hoy());
  const tel = alumno.telefono.length === 10 ? `52${alumno.telefono}` : alumno.telefono;
  const nombre1 = alumno.nombre.split(' ')[0];
  const recordatorio = encodeURIComponent(
    sem.tono === 'sin'
      ? `Hola ${nombre1}, ¡te esperamos en ${academia.nombre}! 💃🕺`
      : `Hola ${nombre1}, te recordamos que tu plan en ${academia.nombre} está por terminar. ¡Te esperamos!`,
  );

  return (
    <div className="px-4 pb-8">
      <button onClick={() => nav(-1)} className="mt-3 -ml-2 rounded-full p-2 active:bg-ink-100" aria-label="Atrás">
        <ArrowLeft />
      </button>

      <div className="mt-1 flex items-center gap-4">
        <Avatar nombre={alumno.nombre} tam={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{alumno.nombre}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Etiqueta tono={sem.tono}>{sem.texto}</Etiqueta>
            <span className="text-xs text-ink-500">{historial?.totalAsistencias ?? 0} clases tomadas</span>
          </div>
        </div>
        <button onClick={() => setEditar(true)} className="rounded-full p-2 text-ink-500 active:bg-ink-100" aria-label="Editar">
          <Pencil size={20} />
        </button>
      </div>
      {alumno.notas && <p className="mt-3 rounded-xl bg-white px-4 py-2 text-sm text-ink-700 ring-1 ring-ink-100">{alumno.notas}</p>}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Boton grande onClick={() => setVender(true)} className="col-span-2">
          <CalendarPlus size={20} /> Vender plan
        </Boton>
        {alumno.telefono && (
          <>
            <a href={`https://wa.me/${tel}?text=${recordatorio}`} target="_blank" rel="noreferrer">
              <Boton bloque variante="secundario">
                <MessageCircle size={18} className="text-ok-600" /> WhatsApp
              </Boton>
            </a>
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
              <Tarjeta key={e.membresia.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{planes.find((p) => p.id === e.membresia.planId)?.nombre ?? 'Plan'}</p>
                  {e.vigente ? <Etiqueta tono={e.diasRestantes <= 3 ? 'pronto' : 'ok'}>{textoDias(e.diasRestantes)}</Etiqueta> : <Etiqueta>Próximo</Etiqueta>}
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {fechaCorta(e.membresia.inicio)} – {fechaCorta(e.membresia.fin)}
                  {e.restantes !== null && ` · ${e.usadas}/${e.membresia.clasesTotal} clases usadas`}
                </p>
              </Tarjeta>
            ))}
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
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-medium'}>
                  {p.concepto} <span className="text-ink-500">· {fechaCorta(p.fecha)}</span>
                </span>
                <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-semibold'}>{dinero(p.monto)}</span>
              </div>
            ))}
          </Tarjeta>
        )}
      </Seccion>

      {esDueno && (
        <button
          className="mt-8 w-full py-3 text-sm font-semibold text-bad-600"
          onClick={async () => {
            if (!confirm(`¿Dar de baja a ${alumno.nombre}? Su historial se conserva.`)) return;
            await actualizar('alumnos', alumno.id, { activo: false });
            nav('/alumnos');
          }}
        >
          Dar de baja
        </button>
      )}

      <Hoja abierta={editar} onCerrar={() => setEditar(false)} titulo="Editar alumno">
        <FormAlumno alumno={alumno} onGuardado={() => setEditar(false)} />
      </Hoja>
      <Hoja abierta={vender} onCerrar={() => setVender(false)} titulo={`Vender plan a ${alumno.nombre.split(' ')[0]}`}>
        {vender && <VenderPlan alumno={alumno} estados={estados} onHecho={() => setVender(false)} />}
      </Hoja>
    </div>
  );
}
