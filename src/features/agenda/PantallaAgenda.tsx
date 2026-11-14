import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, useRentas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Seccion, Segmentos, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { actualizar, borrar, crear } from '../../db/repo';
import type { Clase, Disciplina, Fecha, MetodoPago, Renta, TipoRenta } from '../../db/types';
import { TODO_EL_DIA, bloquesDelDia, cobrarRenta, cobrosDelMes, diaSemana, empalmes, horaTexto, huecos, rangoHora, type Empalme } from '../../domain/agenda';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { DIAS_CORTOS, deFecha, fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import { mesDe, nombreMes, rangoMes, type Mes } from '../../domain/gastos';
import { waLink } from '../../domain/reportes';
import { METODOS } from '../alumnos/VenderPlan';

const COLOR_RENTA = '#7c4ddb';
const lunesDe = (f: Fecha) => sumarDias(f, -((diaSemana(f) + 6) % 7));
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "Mar y Jue" */
function textoDias(dias: number[]): string {
  const orden = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d)).map((d) => DIAS_CORTOS[d]);
  return orden.length <= 1 ? (orden[0] ?? '') : `${orden.slice(0, -1).join(', ')} y ${orden[orden.length - 1]}`;
}

export function describirRenta(r: Renta): string {
  const hora = r.duracionMin >= TODO_EL_DIA.duracionMin ? 'todo el día' : rangoHora(r.horaInicio, r.duracionMin);
  if (r.tipo === 'evento') return `${DIAS_CORTOS[diaSemana(r.desde)]} ${fechaCorta(r.desde)} · ${hora}`;
  return `${textoDias(r.dias)} ${hora}${r.hasta ? ` · hasta ${fechaCorta(r.hasta)}` : ''}`;
}

/** Agenda del salón: qué está ocupado cada día de la semana, huecos libres y cobro de rentas. */
export function PantallaAgenda() {
  const { academia, esDueno, usuario } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const rentas = useRentas();
  const [lunes, setLunes] = useState(lunesDe(hoy()));
  const [editar, setEditar] = useState<Renta | 'nueva' | null>(null);
  const [cobrar, setCobrar] = useState<Renta | null>(null);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const estaSemana = lunes === lunesDe(hoy());
  // El mes de los cobros: el de la semana que se ve (el jueves decide si la semana cruza de mes)
  const mes: Mes = mesDe(sumarDias(lunes, 3));
  const { desde, hasta } = rangoMes(mes);
  const pagos = useLiveQuery(() => db.pagos.where('rentaId').above('').toArray(), [], []);
  const cobros = cobrosDelMes(rentas, pagos, mes);
  const pendiente = cobros.filter((c) => !c.pago).reduce((s, c) => s + c.renta.monto, 0);
  const cobrado = cobros.filter((c) => c.pago).reduce((s, c) => s + c.pago!.monto, 0);
  const otras = rentas.filter((r) => !cobros.some((c) => c.renta.id === r.id));

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4">
        <Encabezado
          titulo="Agenda del salón"
          sub={nombreSede(null, sedes, academia)}
          accion={
            esDueno && (
              <Boton onClick={() => setEditar('nueva')}>
                <Plus size={18} /> Apartar
              </Boton>
            )
          }
        />
      </div>

      <div className="mb-3 flex items-center justify-between rounded-2xl bg-superficie p-1 ring-1 ring-ink-100">
        <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">
          <ChevronLeft />
        </button>
        <button className="rounded-xl px-4 py-2.5 font-semibold disabled:text-ink-900" disabled={estaSemana} onClick={() => setLunes(lunesDe(hoy()))}>
          {fechaCorta(dias[0])} – {fechaCorta(dias[6])}
          {!estaSemana && <span className="ml-2 text-sm text-brand-600">Esta semana</span>}
        </button>
        <button className="rounded-xl p-2.5 active:bg-ink-100" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">
          <ChevronRight />
        </button>
      </div>

      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-ink-500">
        <span className="h-3 w-3 rounded bg-[#7c4ddb]/20 ring-1 ring-[#7c4ddb]/40" /> Renta del salón
      </p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {dias.map((f) => (
          <Dia key={f} fecha={f} clases={clases} rentas={rentas} disciplinas={disciplinas} onRenta={esDueno ? (r) => setEditar(r) : undefined} />
        ))}
      </div>

      <Seccion titulo={`Rentas de ${nombreMes(mes).toLowerCase()}`}>
        {cobros.length === 0 ? (
          <Tarjeta>
            <Vacio icono={<CalendarDays size={32} />} titulo="Sin rentas este mes" texto={esDueno ? 'Toca “Apartar” para rentar el salón por mes o para un evento.' : undefined} />
          </Tarjeta>
        ) : (
          <>
            <p className="mb-2 px-1 text-sm text-ink-500">
              Cobrado <b className="text-ink-900">{dinero(cobrado)}</b>
              {pendiente > 0 && (
                <>
                  {' '}· por cobrar <b className="text-warn-600">{dinero(pendiente)}</b>
                </>
              )}
            </p>
            <Tarjeta className="divide-y divide-ink-100">
              {cobros.map(({ renta: r, pago }) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={esDueno ? () => setEditar(r) : undefined}>
                    <span className="block truncate font-semibold">
                      {r.nombre} {r.tipo === 'evento' && <Etiqueta tono="marca">Evento</Etiqueta>}
                    </span>
                    <span className="block truncate text-xs text-ink-500">{describirRenta(r)}</span>
                  </button>
                  {pago ? (
                    <span className="flex items-center gap-1 text-right">
                      <Check size={16} className="text-ok-600" />
                      <span className="font-bold">{dinero(pago.monto)}</span>
                    </span>
                  ) : esDueno ? (
                    <Boton variante="secundario" onClick={() => setCobrar(r)}>
                      Cobrar {dinero(r.monto)}
                    </Boton>
                  ) : (
                    <Etiqueta tono="pronto">Por cobrar</Etiqueta>
                  )}
                </div>
              ))}
            </Tarjeta>
          </>
        )}
      </Seccion>

      {esDueno && otras.length > 0 && (
        <Seccion titulo="Otras rentas">
          <Tarjeta className="divide-y divide-ink-100">
            {otras.map((r) => (
              <button key={r.id} onClick={() => setEditar(r)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50', (!r.activo || (r.hasta && r.hasta < desde)) && 'opacity-50')}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.nombre}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {describirRenta(r)}
                    {r.desde > hasta ? ` · empieza ${fechaCorta(r.desde)}` : ' · terminó'}
                  </span>
                </span>
                <span className="font-bold">{dinero(r.monto)}</span>
              </button>
            ))}
          </Tarjeta>
        </Seccion>
      )}

      <Hoja abierta={!!editar} onCerrar={() => setEditar(null)} titulo={editar === 'nueva' ? 'Apartar el salón' : 'Renta del salón'}>
        {editar && <FormRenta key={editar === 'nueva' ? 'n' : editar.id} renta={editar === 'nueva' ? null : editar} clases={clases} rentas={rentas} disciplinas={disciplinas} onHecho={() => setEditar(null)} />}
      </Hoja>
      <Hoja abierta={!!cobrar} onCerrar={() => setCobrar(null)} titulo={cobrar ? `Cobrar renta · ${cobrar.nombre}` : ''}>
        {cobrar && <FormCobro key={cobrar.id} renta={cobrar} mes={mes} usuarioId={usuario.id} onHecho={() => setCobrar(null)} />}
      </Hoja>
    </div>
  );
}

function Dia({ fecha, clases, rentas, disciplinas, onRenta }: { fecha: Fecha; clases: Clase[]; rentas: Renta[]; disciplinas: Disciplina[]; onRenta?: (r: Renta) => void }) {
  const bloques = bloquesDelDia(fecha, clases, rentas);
  const libres = huecos(bloques);
  const esHoy = fecha === hoy();
  return (
    <Tarjeta className={cx('p-3', esHoy && 'ring-2 ring-brand-500')}>
      <p className="mb-1.5 flex items-center gap-2 px-1 font-bold">
        {DIAS_LARGOS[diaSemana(fecha)]} {deFecha(fecha).getDate()}
        {esHoy && <Etiqueta tono="marca">Hoy</Etiqueta>}
      </p>
      {bloques.length === 0 && <p className="px-1 text-sm text-ink-500">Sin clases ni rentas</p>}
      <div className="space-y-1">
        {bloques.map((b, i) => {
          const r = b.renta;
          const color = r ? COLOR_RENTA : colorClase(b.clase, disciplinas);
          const contenido = (
            <>
              <span className="w-[5.6rem] shrink-0 text-xs font-semibold text-ink-500 tabular-nums">{r && r.duracionMin >= TODO_EL_DIA.duracionMin ? 'Todo el día' : `${horaTexto(b.inicio)}–${horaTexto(b.fin)}`}</span>
              <span className="h-4 w-1 shrink-0 rounded-full" style={{ background: color }} />
              <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-tight font-semibold break-words">{r ? r.nombre : nombreClase(b.clase, disciplinas)}</span>
              {r?.tipo === 'evento' && <span className="shrink-0 text-[11px] font-bold text-[#7c4ddb]">Evento</span>}
            </>
          );
          return r && onRenta ? (
            <button key={i} onClick={() => onRenta(r)} className="flex w-full items-center gap-2 rounded-lg bg-[#7c4ddb]/8 px-1.5 py-1 text-left active:bg-[#7c4ddb]/15">
              {contenido}
            </button>
          ) : (
            <div key={i} className={cx('flex items-center gap-2 rounded-lg px-1.5 py-1', r && 'bg-[#7c4ddb]/8')}>
              {contenido}
            </div>
          );
        })}
      </div>
      {libres.length > 0 && (
        <p className="mt-1.5 px-1 text-xs text-ok-600">
          Libre: {libres.map(([a, b]) => `${horaTexto(a)}–${horaTexto(b)}`).join(' · ')}
        </p>
      )}
    </Tarjeta>
  );
}

function textoEmpalme(e: Empalme, disciplinas: Disciplina[]): string {
  const dias = textoDias(e.dias);
  if (e.clase) return `Clase ${nombreClase(e.clase, disciplinas)} · ${dias} ${rangoHora(e.clase.horaInicio, e.clase.duracionMin)}`;
  const r = e.renta!;
  return `${r.tipo === 'evento' ? 'Evento' : 'Renta'} de ${r.nombre} · ${r.tipo === 'evento' ? fechaCorta(r.desde) : dias} ${rangoHora(r.horaInicio, r.duracionMin)}`;
}

function FormRenta({ renta, clases, rentas, disciplinas, onHecho }: { renta: Renta | null; clases: Clase[]; rentas: Renta[]; disciplinas: Disciplina[]; onHecho: () => void }) {
  const avisar = useAvisos();
  const [tipo, setTipo] = useState<TipoRenta>(renta?.tipo ?? 'mensual');
  const [nombre, setNombre] = useState(renta?.nombre ?? '');
  const [telefono, setTelefono] = useState(renta?.telefono ?? '');
  const [dias, setDias] = useState<number[]>(renta?.tipo === 'mensual' ? renta.dias : []);
  const [fecha, setFecha] = useState<Fecha>(renta?.tipo === 'evento' ? renta.desde : hoy());
  const [todoDia, setTodoDia] = useState(!!renta && renta.duracionMin >= TODO_EL_DIA.duracionMin);
  const [hora, setHora] = useState(renta?.horaInicio ?? '20:00');
  const [duracion, setDuracion] = useState(String(renta?.duracionMin ?? 60));
  const [desde, setDesde] = useState<Fecha>(renta?.tipo === 'mensual' ? renta.desde : hoy());
  const [hasta, setHasta] = useState<Fecha | ''>(renta?.tipo === 'mensual' ? (renta.hasta ?? '') : '');
  const [monto, setMonto] = useState(renta ? aPesosTexto(renta.monto) : '');
  const [notas, setNotas] = useState(renta?.notas ?? '');
  const [ocupado, setOcupado] = useState(false);

  const evento = tipo === 'evento';
  const horario = evento && todoDia ? TODO_EL_DIA : { horaInicio: hora, duracionMin: Math.max(15, Number(duracion) || 60) };
  const datos = {
    tipo,
    nombre: nombre.trim(),
    telefono: telefono.replace(/\D/g, ''),
    dias: evento ? [diaSemana(fecha)] : [...dias].sort(),
    ...horario,
    desde: evento ? fecha : desde,
    hasta: evento ? fecha : hasta || null,
    monto: aCentavos(monto),
    notas: notas.trim(),
    activo: true,
  };
  const choques = datos.dias.length && datos.horaInicio ? empalmes({ ...datos, id: renta?.id }, clases, rentas) : [];
  const fechasMal = !evento && datos.hasta !== null && datos.hasta < datos.desde;
  const sePasaDeMedianoche = !(evento && todoDia) && Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + horario.duracionMin > 24 * 60;
  const listo = datos.nombre && datos.dias.length && datos.monto > 0 && !choques.length && !fechasMal && !sePasaDeMedianoche;

  const guardar = async () => {
    setOcupado(true);
    try {
      if (renta) await actualizar('rentas', renta.id, datos);
      else await crear('rentas', datos);
      avisar(renta ? 'Renta actualizada' : evento ? 'Evento apartado' : 'Horario apartado');
      onHecho();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {!renta && (
        <Segmentos<TipoRenta>
          opciones={[
            { valor: 'mensual', texto: 'Horario fijo (mensual)' },
            { valor: 'evento', texto: 'Evento / un día' },
          ]}
          valor={tipo}
          onChange={setTipo}
        />
      )}
      <Campo etiqueta="¿Quién renta?">
        <Entrada value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={evento ? 'Ej. Taller de tango de Ana' : 'Ej. Profe Ana (Bachata)'} />
      </Campo>
      <Campo etiqueta="WhatsApp (opcional)">
        <Entrada inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Para mandarle su recibo" />
      </Campo>

      {evento ? (
        <>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          </Campo>
          <Segmentos<'dia' | 'horas'>
            opciones={[
              { valor: 'horas', texto: 'Unas horas' },
              { valor: 'dia', texto: 'Todo el día' },
            ]}
            valor={todoDia ? 'dia' : 'horas'}
            onChange={(v) => setTodoDia(v === 'dia')}
          />
        </>
      ) : (
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
      )}

      {!(evento && todoDia) && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Hora">
            <Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </Campo>
          <Campo etiqueta="Duración (min)">
            <Entrada inputMode="numeric" value={duracion} onChange={(e) => setDuracion(e.target.value.replace(/\D/g, ''))} />
          </Campo>
        </div>
      )}

      {!evento && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde">
            <Entrada type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta (opcional)">
            <Entrada type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
        </div>
      )}

      <Campo etiqueta={evento ? 'Precio' : 'Cuota al mes'}>
        <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Depósito, llaves, acuerdos…" />
      </Campo>

      {choques.length > 0 && (
        <div className="rounded-xl bg-bad-50 px-3 py-2.5 text-sm text-bad-600">
          <p className="font-bold">El salón ya está ocupado:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {choques.map((c, i) => (
              <li key={i}>{textoEmpalme(c, disciplinas)}</li>
            ))}
          </ul>
        </div>
      )}
      {fechasMal && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">La fecha “hasta” es antes de “desde”.</p>}
      {sePasaDeMedianoche && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">El horario pasa de la medianoche.</p>}

      <Boton grande bloque onClick={guardar} disabled={ocupado || !listo}>
        {renta ? 'Guardar cambios' : evento ? 'Apartar evento' : 'Apartar horario'}
      </Boton>
      {renta && renta.tipo === 'mensual' && renta.activo && (!renta.hasta || renta.hasta >= hoy()) && (
        <Boton
          bloque
          variante="secundario"
          onClick={async () => {
            await actualizar('rentas', renta.id, { hasta: hoy() < renta.desde ? renta.desde : hoy() });
            avisar(`${renta.nombre}: la renta termina hoy; el salón queda libre desde mañana`);
            onHecho();
          }}
        >
          Terminar renta (deja libre el horario)
        </Boton>
      )}
      {renta && (
        <Boton
          bloque
          variante="fantasma"
          onClick={async () => {
            await borrar('rentas', renta.id);
            avisar('Renta eliminada', 'ok', { texto: 'Deshacer', fn: () => actualizar('rentas', renta.id, { deletedAt: null }).then(() => undefined) });
            onHecho();
          }}
        >
          <span className="text-bad-600">Eliminar (fue un error)</span>
        </Boton>
      )}
    </div>
  );
}

function FormCobro({ renta, mes, usuarioId, onHecho }: { renta: Renta; mes: Mes; usuarioId: string; onHecho: () => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const [monto, setMonto] = useState(aPesosTexto(renta.monto));
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia');
  const [ocupado, setOcupado] = useState(false);
  const centavos = aCentavos(monto);
  const periodo = renta.tipo === 'evento' ? `el evento del ${fechaCorta(renta.desde)}` : `la renta del salón de ${nombreMes(mes).split(' ')[0].toLowerCase()}`;

  const cobrar = async () => {
    setOcupado(true);
    try {
      await cobrarRenta({ renta, mes, monto: centavos, metodo, usuarioId });
      const recibo = waLink(renta.telefono, `Hola ${renta.nombre.split(' ')[0]}, recibimos tu pago de ${dinero(centavos)} por ${periodo} en ${academia.nombre}. ¡Gracias!`);
      avisar(`Renta cobrada · ${dinero(centavos)}`, 'ok', recibo ? { texto: 'Enviar recibo', fn: () => void window.open(recibo, '_blank', 'noopener') } : undefined);
      onHecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo cobrar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        {describirRenta(renta)} · {renta.tipo === 'evento' ? 'evento' : nombreMes(mes)}
      </p>
      <Campo etiqueta="Monto" ayuda="Cámbialo si se acordó otra cantidad este mes.">
        <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
      </Campo>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <p className="text-xs text-ink-500">Entra a la caja de hoy como ingreso del estudio.</p>
      <Boton grande bloque onClick={cobrar} disabled={ocupado || centavos <= 0}>
        Cobrar {centavos > 0 ? dinero(centavos) : ''}
      </Boton>
    </div>
  );
}
