import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, PartyPopper, Plus } from 'lucide-react';
import { useClases, useRentas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Hoja, Seccion, Selector, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Evento, ID } from '../../db/types';
import { diaSemana, empalmes, rangoHora } from '../../domain/agenda';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { boletoValido, crearEvento, actualizarEvento, type DatosEvento } from '../../domain/eventos';
import { fechaLarga, hoy } from '../../domain/fechas';
import { useDisciplinas, nombreClase } from '../../app/datos';

/** Eventos de la academia: próximos y pasados. La dirección los crea; recepción vende boletos y pasa la entrada. */
export function PantallaEventos() {
  const { esDueno } = useSesion();
  const nav = useNavigate();
  const [nuevo, setNuevo] = useState(false);
  const datos = useLiveQuery(async () => {
    const [eventos, boletos] = await Promise.all([db.eventos.filter((e) => !e.deletedAt).toArray(), db.boletos.toArray()]);
    return eventos.map((e) => ({ e, vendidos: boletos.filter((b) => b.eventoId === e.id && boletoValido(b)).length }));
  }, []);
  const dia = hoy();
  const proximos = (datos ?? []).filter((x) => x.e.fecha >= dia && x.e.activo).sort((a, b) => (a.e.fecha < b.e.fecha ? -1 : 1));
  const pasados = (datos ?? []).filter((x) => x.e.fecha < dia || !x.e.activo).sort((a, b) => (a.e.fecha < b.e.fecha ? 1 : -1));

  const Fila = ({ e, vendidos }: { e: Evento; vendidos: number }) => (
    <button onClick={() => nav(`/agenda/eventos/${e.id}`)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50', !e.activo && 'opacity-50')}>
      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <span className="text-[10px] font-bold uppercase">{new Date(e.fecha + 'T12:00').toLocaleDateString('es-MX', { month: 'short' })}</span>
        <span className="text-lg leading-none font-extrabold">{Number(e.fecha.slice(8))}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{e.nombre}</span>
        <span className="block truncate text-xs text-ink-500">
          {rangoHora(e.horaInicio, e.duracionMin)} · {dinero(e.precio)} · {vendidos}
          {e.cupo !== null ? ` de ${e.cupo}` : ''} boletos{!e.activo ? ' · cancelado' : ''}
        </span>
      </span>
      {e.cupo !== null && vendidos >= e.cupo && e.activo && <span className="rounded-full bg-bad-50 px-2 py-0.5 text-xs font-bold text-bad-600">Lleno</span>}
    </button>
  );

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <Link to="/agenda" className="-ml-2 rounded-full p-2 active:bg-ink-100" aria-label="Volver a la agenda">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Eventos</h1>
        {esDueno && (
          <Boton onClick={() => setNuevo(true)}>
            <Plus size={18} /> Nuevo
          </Boton>
        )}
      </div>
      <Seccion titulo="Próximos">
        {proximos.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<PartyPopper size={32} />} titulo="Sin eventos próximos" texto={esDueno ? 'Crea uno: fiesta, baile, taller… con cupo y boletos.' : undefined} />
          </Tarjeta>
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {proximos.map((x) => (
              <Fila key={x.e.id} {...x} />
            ))}
          </Tarjeta>
        )}
      </Seccion>
      {pasados.length > 0 && (
        <Seccion titulo="Pasados">
          <Tarjeta className="divide-y divide-ink-100">
            {pasados.map((x) => (
              <Fila key={x.e.id} {...x} />
            ))}
          </Tarjeta>
        </Seccion>
      )}
      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Nuevo evento">
        {nuevo && (
          <FormEvento
            evento={null}
            onHecho={(id) => {
              setNuevo(false);
              if (id) nav(`/agenda/eventos/${id}`);
            }}
          />
        )}
      </Hoja>
    </div>
  );
}

export function FormEvento({ evento, onHecho }: { evento: Evento | null; onHecho: (id?: ID) => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const salones = academia.salones ?? [];
  const clases = useClases();
  const rentas = useRentas();
  const disciplinas = useDisciplinas();
  const [nombre, setNombre] = useState(evento?.nombre ?? '');
  const [fecha, setFecha] = useState(evento?.fecha ?? hoy());
  const [hora, setHora] = useState(evento?.horaInicio ?? '19:00');
  const [duracion, setDuracion] = useState(String(evento?.duracionMin ?? 240));
  const [cupo, setCupo] = useState(evento?.cupo != null ? String(evento.cupo) : '');
  const [precio, setPrecio] = useState(evento ? aPesosTexto(evento.precio) : '');
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '');
  const [salonId, setSalonId] = useState<string>(evento?.salonId ?? '');
  const [ocupado, setOcupado] = useState(false);

  const duracionMin = Math.max(30, Number(duracion) || 240);
  const datos: DatosEvento = {
    nombre: nombre.trim(),
    fecha,
    horaInicio: hora,
    duracionMin,
    cupo: cupo ? Number(cupo) : null,
    precio: aCentavos(precio),
    descripcion: descripcion.trim(),
    salonId: salonId || null,
  };
  const choques = empalmes(
    { dias: [diaSemana(fecha)], horaInicio: hora, duracionMin, desde: fecha, hasta: fecha, id: evento?.rentaId ?? undefined, salonId: salonId || null },
    clases,
    rentas,
  );
  const pasaMedianoche = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + duracionMin > 24 * 60;
  const listo = datos.nombre && datos.precio >= 0 && !choques.length && !pasaMedianoche;

  const guardar = async () => {
    setOcupado(true);
    try {
      if (evento) {
        await actualizarEvento(evento, datos);
        avisar('Evento actualizado');
        onHecho();
      } else {
        const e = await crearEvento(datos);
        avisar('Evento creado: el salón queda apartado');
        onHecho(e.id);
      }
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <Campo etiqueta="Nombre">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Baile de Navidad" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha">
          <Entrada type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hora">
          <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Duración (min)">
          <Entrada inputMode="numeric" value={duracion} onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ''))} />
        </Campo>
        <Campo etiqueta="Cupo">
          <Entrada inputMode="numeric" value={cupo} onChange={(e) => setCupo(e.target.value.replace(/\D/g, ''))} placeholder="Sin límite" />
        </Campo>
        <Campo etiqueta="Boleto">
          <Entrada inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="$" />
        </Campo>
      </div>
      {salones.length > 0 && (
        <Campo etiqueta="Salón">
          <Selector value={salonId} onChange={(e) => setSalonId(e.target.value)}>
            <option value="">Salón principal</option>
            {salones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}
      <Campo etiqueta="Descripción (opcional)">
        <Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Concurso de disfraces, DJ en vivo" />
      </Campo>
      {choques.length > 0 && (
        <div className="rounded-xl bg-bad-50 px-3 py-2.5 text-sm text-bad-600">
          <p className="font-bold">El salón ya está ocupado ese {fechaLarga(fecha).split(',')[0]}:</p>
          <ul className="mt-1 list-disc pl-5">
            {choques.map((c, i) => (
              <li key={i}>{c.clase ? `Clase ${nombreClase(c.clase, disciplinas)} · ${rangoHora(c.clase.horaInicio, c.clase.duracionMin)}` : `${c.renta!.nombre} · ${rangoHora(c.renta!.horaInicio, c.renta!.duracionMin)}`}</li>
            ))}
          </ul>
        </div>
      )}
      {pasaMedianoche && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">El horario pasa de la medianoche: ajústalo para que termine antes.</p>}
      <Boton grande bloque onClick={guardar} disabled={ocupado || !listo}>
        {evento ? 'Guardar cambios' : 'Crear evento'}
      </Boton>
    </div>
  );
}
