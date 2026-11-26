import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, Ellipsis, Globe, Megaphone, MessageCircle, Plus, UserPlus, Users } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Segmentos, Selector, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { actualizar } from '../../db/repo';
import type { Clase, Interesado } from '../../db/types';
import { anotarInteresado, descartar, horarioCorto, horarioDe, marcarContactado, registrarComoAlumno } from '../../domain/interesados';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { waLink } from '../../domain/reportes';
import { fechaCorta } from '../../domain/fechas';

type Filtro = 'nuevos' | 'contactados';

/**
 * Interesados (de la página pública o anotados en recepción), juntos por la clase que les interesa.
 * "Avisar a todos" cuando se abre un grupo: un WhatsApp por persona, marcando a quién ya se le escribió.
 */
export function PantallaInteresados() {
  const { academia, esDueno } = useSesion();
  const nav = useNavigate();
  const avisar = useAvisos();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const [filtro, setFiltro] = useState<Filtro>('nuevos');
  const [anotar, setAnotar] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<{ clase: Clase | null; lista: Interesado[] } | null>(null);
  const todos = useLiveQuery(() => db.interesados.filter((i) => !i.deletedAt && (i.estado === 'nuevo' || i.estado === 'contactado')).toArray(), [], []);
  // quién invitó a cada uno (enlace de invitación del portal de un alumno)
  const invitaron = useLiveQuery(async () => {
    const ids = [...new Set(todos.flatMap((i) => (i.invitoAlumnoId ? [i.invitoAlumnoId] : [])))];
    return new Map((await db.alumnos.bulkGet(ids)).flatMap((a) => (a ? [[a.id, a] as const] : [])));
  }, [todos]);
  const lista = todos.filter((i) => (filtro === 'nuevos' ? i.estado === 'nuevo' : i.estado === 'contactado')).sort((a, b) => b.createdAt - a.createdAt);
  const interesado = todos.find((i) => i.id === seleccion);
  // agrupados por clase (las que ya no existen, como "cualquiera")
  const grupos = new Map<string, Interesado[]>();
  for (const i of lista) {
    const k = i.claseId && clases.some((c) => c.id === i.claseId) ? i.claseId : '';
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  }
  const claseDe = (id: string) => clases.find((c) => c.id === id) ?? null;
  const nombreDe = (c: Clase | null) => (c ? nombreClase(c, disciplinas) : 'Cualquier clase');
  const msjInteresado = (i: Interesado) => {
    const c = i.claseId ? claseDe(i.claseId) : null;
    return armarMensaje(plantilla(academia, 'interesado'), { nombre: i.nombre.split(' ')[0], academia: academia.nombre, clase: c ? nombreClase(c, disciplinas) : 'baile' });
  };

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <Link to="/alumnos" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a alumnos">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Interesados</h1>
        <Boton variante="secundario" onClick={() => setAnotar(true)}>
          <Plus size={18} /> Anotar
        </Boton>
      </div>
      {esDueno && !academia.slug && (
        <Link to="/ajustes/pagina" className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-600">
          <Globe size={20} className="shrink-0" />
          <span>
            <b>Publica tu página</b> para que la gente se inscriba sola desde Facebook.
          </span>
        </Link>
      )}
      <Segmentos<Filtro>
        opciones={[
          { valor: 'nuevos', texto: `Nuevos (${todos.filter((i) => i.estado === 'nuevo').length})` },
          { valor: 'contactados', texto: `Contactados (${todos.filter((i) => i.estado === 'contactado').length})` },
        ]}
        valor={filtro}
        onChange={setFiltro}
      />

      {lista.length === 0 ? (
        <Tarjeta className="mt-4">
          <Vacio icono={<Megaphone size={32} />} titulo={filtro === 'nuevos' ? 'Sin interesados nuevos' : 'Nadie por aquí'} texto="Quien se inscribe en tu página pública aparece aquí para que le escribas." />
        </Tarjeta>
      ) : (
        [...grupos.entries()].map(([claseId, gente]) => {
          const c = claseId ? claseDe(claseId) : null;
          return (
            <section key={claseId || 'cualquiera'} className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className="text-xs font-bold tracking-wider text-ink-500 uppercase">
                  {nombreDe(c)}
                  {c && <span className="font-normal normal-case"> · {horarioCorto(c)}</span>} · {gente.length}
                </h2>
                {c && (
                  <button className="-mr-2 flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-600 active:bg-brand-50" onClick={() => setGrupo({ clase: c, lista: gente })}>
                    <Megaphone size={16} /> Avisar a todos
                  </button>
                )}
              </div>
              <Tarjeta className="divide-y divide-ink-100">
                {gente.map((i) => {
                  const wa = waLink(i.telefono, msjInteresado(i));
                  return (
                    <div key={i.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-semibold">{i.nombre}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {fechaCorta(new Date(i.createdAt).toISOString().slice(0, 10))}
                            {i.contactadoAt ? ` · se le escribió ${fechaCorta(new Date(i.contactadoAt).toISOString().slice(0, 10))}` : ''}
                          </span>
                        </span>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => { if (i.estado === 'nuevo') setSeleccion(i.id); }}
                            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ok-50 px-2.5 text-xs font-semibold text-ok-600"
                            aria-label={`Escribirle a ${i.nombre} por WhatsApp`}
                          >
                            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => setSeleccion(i.id)}
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-500 active:bg-ink-100"
                          aria-label={`Opciones de ${i.nombre}`}
                        >
                          <Ellipsis size={20} aria-hidden="true" />
                        </button>
                      </div>
                      {i.invitoAlumnoId && invitaron?.get(i.invitoAlumnoId) && (
                        <Link to={`/alumnos/${i.invitoAlumnoId}`} className="mt-1 inline-flex min-h-10 items-center gap-1 rounded-full bg-ok-50 px-3 text-xs font-semibold text-ok-600">
                          <Users size={13} aria-hidden="true" /> Lo invitó {invitaron.get(i.invitoAlumnoId)!.nombre}
                        </Link>
                      )}
                      {i.origen && (
                        <p className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-full bg-ink-50 px-3 text-xs font-semibold text-ink-700 ring-1 ring-ink-100">
                          Llegó por {i.origen}
                        </p>
                      )}
                      {i.mensaje && <p className="mt-1 rounded-lg bg-ink-50 px-2 py-1 text-sm text-ink-700">“{i.mensaje}”</p>}
                    </div>
                  );
                })}
              </Tarjeta>
            </section>
          );
        })
      )}

      <Hoja abierta={!!interesado} onCerrar={() => setSeleccion(null)} titulo={interesado?.nombre ?? ''}>
        {interesado && (
          <div className="space-y-3">
            {interesado.estado === 'nuevo' && (
              <>
                <p className="text-sm text-ink-500">Si ya enviaste el mensaje o hablaste con esta persona, marca el contacto.</p>
                <Boton bloque onClick={async () => {
                  await marcarContactado(interesado.id);
                  setSeleccion(null);
                }}><Check size={18} aria-hidden="true" /> Marcar como contactado</Boton>
              </>
            )}
            <Boton bloque variante="secundario" aria-label={`Registrar a ${interesado.nombre} como alumno`} onClick={async () => {
              const alumno = await registrarComoAlumno(interesado);
              avisar(`${interesado.nombre.split(' ')[0]} ya es alumno`);
              nav(`/alumnos/${alumno.id}`, { state: { recien: true } });
            }}><UserPlus size={18} aria-hidden="true" /> Registrar como alumno</Boton>
            <Boton bloque variante="fantasma" onClick={async () => {
              await descartar(interesado.id);
              setSeleccion(null);
              avisar('Quitado de la lista', 'ok', { texto: 'Deshacer', fn: () => actualizar('interesados', interesado.id, { estado: interesado.estado }).then(() => undefined) });
            }}>Ya no le interesa</Boton>
          </div>
        )}
      </Hoja>
      <Hoja abierta={anotar} onCerrar={() => setAnotar(false)} titulo="Anotar interesado">
        {anotar && <FormInteresado clases={clases} onHecho={() => setAnotar(false)} />}
      </Hoja>
      <Hoja abierta={!!grupo} onCerrar={() => setGrupo(null)} titulo={grupo ? `Abrimos grupo · ${nombreDe(grupo.clase)}` : ''}>
        {grupo && <AvisarGrupo clase={grupo.clase!} nombre={nombreDe(grupo.clase)} gente={grupo.lista} />}
      </Hoja>
    </div>
  );
}

/** Un WhatsApp por persona (WhatsApp no permite mandar a todos de golpe); se marca a quién ya se le escribió. */
function AvisarGrupo({ clase, nombre, gente }: { clase: Clase; nombre: string; gente: Interesado[] }) {
  const { academia } = useSesion();
  const [enviados, setEnviados] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Abre WhatsApp con el mensaje listo ({horarioDe(clase)}). Marca cada contacto después de enviarle el mensaje.
      </p>
      <Tarjeta className="divide-y divide-ink-100">
        {gente.map((i) => {
          const wa = waLink(i.telefono, armarMensaje(plantilla(academia, 'grupo'), { nombre: i.nombre.split(' ')[0], academia: academia.nombre, clase: nombre, horario: horarioDe(clase) }));
          const listo = enviados.has(i.id);
          return (
            <div
              key={i.id}
              className="flex items-center gap-2 px-3 py-2"
            >
              <span className="min-w-0 flex-1 break-words text-sm font-semibold">{i.nombre}</span>
              {wa && <a href={wa} target="_blank" rel="noreferrer" aria-label={`Escribirle a ${i.nombre} por WhatsApp`} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ok-600">
                <MessageCircle size={18} aria-hidden="true" />
              </a>}
              <button type="button" disabled={listo} onClick={async () => {
                await marcarContactado(i.id);
                setEnviados((anteriores) => new Set(anteriores).add(i.id));
              }} aria-label={`Marcar a ${i.nombre} como contactado`} className={cx('min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold', listo ? 'text-ok-600' : 'text-brand-600')}>
                {listo ? 'Contactado' : 'Marcar'}
              </button>
            </div>
          );
        })}
      </Tarjeta>
      <p className="text-center text-sm font-semibold text-ink-500">
        {enviados.size} de {gente.length} avisados
      </p>
    </div>
  );
}

function FormInteresado({ clases, onHecho }: { clases: Clase[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [claseId, setClaseId] = useState('');
  const [mensaje, setMensaje] = useState('');
  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Campo>
      <Campo etiqueta="WhatsApp">
        <Entrada inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <Campo etiqueta="Clase que le interesa">
        <Selector value={claseId} onChange={(e) => setClaseId(e.target.value)}>
          <option value="">Cualquiera / no sabe</option>
          {clases
            .filter((c) => c.activo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {nombreClase(c, disciplinas)} · {horarioCorto(c)}
              </option>
            ))}
        </Selector>
      </Campo>
      <Campo etiqueta="Nota (opcional)">
        <Entrada value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej. preguntó por el grupo de la mañana" />
      </Campo>
      <Boton
        grande
        bloque
        disabled={nombre.trim().length < 2 || telefono.replace(/\D/g, '').length < 10}
        onClick={async () => {
          try {
            await anotarInteresado({ nombre, telefono, claseId: claseId || null, mensaje });
            avisar('Anotado en interesados');
            onHecho();
          } catch (e) {
            avisar(e instanceof Error ? e.message : 'No se pudo anotar', 'error');
          }
        }}
      >
        Anotar
      </Boton>
    </div>
  );
}
