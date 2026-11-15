import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronLeft, ChevronRight, PartyPopper, Plus } from 'lucide-react';
import { colorClase, nombreClase, useClases, useDisciplinas, useMaestros, useRentas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Encabezado, Entrada, Etiqueta, Hoja, Seccion, Segmentos, Selector, Tarjeta, Vacio, cx } from '../../components/ui';
import { db } from '../../db/db';
import { actualizar, borrar, crear } from '../../db/repo';
import type { Clase, CobroRenta, Disciplina, Fecha, ID, MetodoPago, Renta, Salon, TipoRenta } from '../../db/types';
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
  const fin = r.hasta ? ` · hasta ${fechaCorta(r.hasta)}` : '';
  if (r.cobro === 'alumno') return `${dinero(r.tarifa ?? 0)} por alumno en sus clases${fin}`;
  return `${textoDias(r.dias)} ${hora}${r.cobro === 'hora' ? ` · ${dinero(r.tarifa ?? 0)} la hora` : ''}${fin}`;
}

/** Agenda del salón: qué está ocupado cada día de la semana, huecos libres y cobro de rentas. */
export function PantallaAgenda() {
  const { academia, esDueno, usuario } = useSesion();
  const sedes = useSedes();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const rentas = useRentas();
  const [lunes, setLunes] = useState(lunesDe(hoy()));
  // 'nueva' | una renta | { extraDe } = hora extra (ensayo) de un maestro que ya renta
  const [editar, setEditar] = useState<Renta | 'nueva' | { extraDe: Renta } | null>(null);
  const [cobrar, setCobrar] = useState<{ renta: Renta; monto: number } | null>(null);
  const [meta, setMeta] = useState(false);
  const salones = academia.salones ?? [];
  // salón que se ve (null = principal); con un solo salón se ve todo
  const [salon, setSalon] = useState<ID | null>(null);
  const [gestionSalones, setGestionSalones] = useState(false);
  const nombreSalon = (id: ID | null | undefined) => (id ? (salones.find((x) => x.id === id)?.nombre ?? 'Salón') : 'Salón principal');
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes]);
  const estaSemana = lunes === lunesDe(hoy());
  // El mes de los cobros: el de la semana que se ve (el jueves decide si la semana cruza de mes)
  const mes: Mes = mesDe(sumarDias(lunes, 3));
  const { desde, hasta } = rangoMes(mes);
  const pagos = useLiveQuery(() => db.pagos.where('rentaId').above('').toArray(), [], []);
  // asistencias del mes: para la comisión por alumno
  const asistencias = useLiveQuery(() => db.asistencias.where('fecha').between(desde, hasta, true, true).toArray(), [desde, hasta], []);
  const cobros = cobrosDelMes(rentas, pagos, mes, { asistencias, clases });
  const pendiente = cobros.filter((c) => !c.pago).reduce((s, c) => s + c.monto, 0);
  const metaMes = (academia.metaDiaria ?? 0) * Number(hasta.slice(8));
  const esMesActual = mes === mesDe(hoy());
  const cobrado = cobros.filter((c) => c.pago).reduce((s, c) => s + c.pago!.monto, 0);
  const otras = rentas.filter((r) => !r.eventoId && !cobros.some((c) => c.renta.id === r.id));
  const nav = useNavigate();
  // tocar un bloque: evento de la academia → su pantalla; renta → editarla (dirección)
  const abrirBloque = (r: Renta) => (r.eventoId ? nav(`/agenda/eventos/${r.eventoId}`) : esDueno ? setEditar(r) : undefined);

  return (
    <div className="px-4 pb-8">
      <div className="-mx-4">
        <Encabezado
          titulo="Agenda"
          sub={`Salón · ${nombreSede(null, sedes, academia)}`}
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

      {(
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Link to="/agenda/eventos" className="flex shrink-0 items-center gap-1.5 rounded-full bg-superficie px-4 py-2 text-sm font-semibold ring-1 ring-ink-100">
            <PartyPopper size={16} className="text-brand-600" /> Eventos
          </Link>
          {salones.length > 0 &&
            [null, ...salones.map((x) => x.id)].map((id) => (
              <button
                key={id ?? 'principal'}
                onClick={() => setSalon(id)}
                className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1', salon === id ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
              >
                {nombreSalon(id)}
              </button>
            ))}
          {esDueno && (
            <button onClick={() => setGestionSalones(true)} className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-brand-600 ring-1 ring-ink-100">
              {salones.length ? 'Salones…' : '+ Otro salón'}
            </button>
          )}
        </div>
      )}
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-ink-500">
        <span className="h-3 w-3 rounded bg-[#7c4ddb]/20 ring-1 ring-[#7c4ddb]/40" /> Renta del salón
      </p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {dias.map((f) => (
          <Dia key={f} fecha={f} clases={clases} rentas={rentas} disciplinas={disciplinas} salonId={salones.length ? salon : undefined} onRenta={abrirBloque} />
        ))}
      </div>

      {(metaMes > 0 || esDueno) && (
        <MetaRentas metaMes={metaMes} metaDiaria={academia.metaDiaria ?? 0} total={cobrado + pendiente} cobrado={cobrado} mes={mes} onEditar={esDueno ? () => setMeta(true) : undefined} />
      )}

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
              {cobros.map(({ renta: r, pago, monto, detalle }) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={esDueno ? () => setEditar(r) : undefined}>
                    <span className="block truncate font-semibold">
                      {r.nombre} {r.tipo === 'evento' && <Etiqueta tono="marca">Evento</Etiqueta>}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {describirRenta(r)}
                      {salones.length > 0 && r.cobro !== 'alumno' && ` · ${nombreSalon(r.salonId)}`}
                    </span>
                    {r.cobro && r.cobro !== 'fijo' && r.tipo === 'mensual' && (
                      <span className="block truncate text-xs font-semibold text-ink-700">
                        {esMesActual && !pago && r.cobro === 'alumno' ? 'Va en ' : r.cobro === 'hora' ? 'Este mes: ' : ''}
                        {detalle} = {dinero(monto)}
                      </span>
                    )}
                  </button>
                  {pago ? (
                    <span className="flex items-center gap-1 text-right">
                      <Check size={16} className="text-ok-600" />
                      <span className="font-bold">{dinero(pago.monto)}</span>
                    </span>
                  ) : esDueno ? (
                    <Boton variante="secundario" onClick={() => setCobrar({ renta: r, monto })}>
                      Cobrar {dinero(monto)}
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

      <Hoja abierta={!!editar} onCerrar={() => setEditar(null)} titulo={editar === 'nueva' ? 'Apartar el salón' : editar && 'extraDe' in editar ? `Hora extra · ${editar.extraDe.nombre}` : 'Renta del salón'}>
        {editar && (
          <FormRenta
            key={editar === 'nueva' ? 'n' : 'extraDe' in editar ? `x${editar.extraDe.id}` : editar.id}
            renta={editar === 'nueva' || 'extraDe' in editar ? null : editar}
            extraDe={editar !== 'nueva' && 'extraDe' in editar ? editar.extraDe : undefined}
            clases={clases}
            rentas={rentas}
            disciplinas={disciplinas}
            salonInicial={salon}
            onHecho={() => setEditar(null)}
            onHoraExtra={(r) => setEditar({ extraDe: r })}
          />
        )}
      </Hoja>
      <Hoja abierta={!!cobrar} onCerrar={() => setCobrar(null)} titulo={cobrar ? `Cobrar renta · ${cobrar.renta.nombre}` : ''}>
        {cobrar && <FormCobro key={cobrar.renta.id} renta={cobrar.renta} monto={cobrar.monto} mes={mes} usuarioId={usuario.id} onHecho={() => setCobrar(null)} />}
      </Hoja>
      <Hoja abierta={gestionSalones} onCerrar={() => setGestionSalones(false)} titulo="Salones del estudio">
        {gestionSalones && <FormSalones clases={clases} rentas={rentas} onHecho={() => setGestionSalones(false)} />}
      </Hoja>
      <Hoja abierta={meta} onCerrar={() => setMeta(false)} titulo="Meta diaria de rentas">
        {meta && <FormMeta onHecho={() => setMeta(false)} />}
      </Hoja>
    </div>
  );
}

function Dia({ fecha, clases, rentas, disciplinas, salonId, onRenta }: { fecha: Fecha; clases: Clase[]; rentas: Renta[]; disciplinas: Disciplina[]; salonId?: ID | null; onRenta?: (r: Renta) => void }) {
  const bloques = bloquesDelDia(fecha, clases, rentas, salonId);
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
              {r?.tipo === 'evento' && <span className="shrink-0 text-[11px] font-bold text-[#7c4ddb]">{r.eventoId ? 'Evento propio' : 'Evento'}</span>}
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

function FormRenta({
  renta,
  extraDe,
  clases,
  rentas,
  disciplinas,
  salonInicial,
  onHecho,
  onHoraExtra,
}: {
  renta: Renta | null;
  /** hora extra (ensayo) de un maestro que ya renta: evento corto con sus datos */
  extraDe?: Renta;
  clases: Clase[];
  rentas: Renta[];
  disciplinas: Disciplina[];
  salonInicial: ID | null;
  onHecho: () => void;
  onHoraExtra: (r: Renta) => void;
}) {
  const avisar = useAvisos();
  const maestros = useMaestros();
  const { academia } = useSesion();
  const salones = academia.salones ?? [];
  const [salonId, setSalonId] = useState<ID | null>(renta ? (renta.salonId ?? null) : extraDe ? (extraDe.salonId ?? null) : salonInicial);
  const [tipo, setTipo] = useState<TipoRenta>(extraDe ? 'evento' : (renta?.tipo ?? 'mensual'));
  const [nombre, setNombre] = useState(renta?.nombre ?? extraDe?.nombre ?? '');
  const [telefono, setTelefono] = useState(renta?.telefono ?? extraDe?.telefono ?? '');
  const [cobro, setCobro] = useState<CobroRenta>(renta?.cobro ?? 'fijo');
  const [tarifa, setTarifa] = useState(renta?.tarifa ? aPesosTexto(renta.tarifa) : '');
  const [maestroId, setMaestroId] = useState<string>(renta?.maestroId ?? extraDe?.maestroId ?? '');
  const [dias, setDias] = useState<number[]>(renta?.tipo === 'mensual' ? renta.dias : []);
  const [fecha, setFecha] = useState<Fecha>(renta?.tipo === 'evento' ? renta.desde : hoy());
  const [todoDia, setTodoDia] = useState(!!renta && renta.duracionMin >= TODO_EL_DIA.duracionMin);
  const [hora, setHora] = useState(renta?.horaInicio ?? '20:00');
  const [duracion, setDuracion] = useState(String(renta?.duracionMin ?? 60));
  const [desde, setDesde] = useState<Fecha>(renta?.tipo === 'mensual' ? renta.desde : hoy());
  const [hasta, setHasta] = useState<Fecha | ''>(renta?.tipo === 'mensual' ? (renta.hasta ?? '') : '');
  const [monto, setMonto] = useState(renta ? aPesosTexto(renta.monto) : extraDe ? '100' : '');
  const [notas, setNotas] = useState(renta?.notas ?? (extraDe ? 'Hora extra (ensayo)' : ''));
  const [ocupado, setOcupado] = useState(false);

  const evento = tipo === 'evento';
  // Por alumno: no aparta horario propio (sus clases ya están en el horario); se cobra por cada alumno que llega
  const porAlumno = !evento && cobro === 'alumno';
  const horario = evento && todoDia ? TODO_EL_DIA : { horaInicio: hora, duracionMin: Math.max(15, Number(duracion) || 60) };
  const tarifaC = aCentavos(tarifa);
  const datos = {
    tipo,
    nombre: nombre.trim(),
    telefono: telefono.replace(/\D/g, ''),
    dias: evento ? [diaSemana(fecha)] : porAlumno ? [] : [...dias].sort(),
    ...horario,
    desde: evento ? fecha : desde,
    hasta: evento ? fecha : hasta || null,
    monto: evento || cobro === 'fijo' ? aCentavos(monto) : 0,
    notas: notas.trim(),
    activo: true,
    // solo se mandan si no es cuota fija (o si cambió de esquema), para no depender de columnas nuevas
    ...(!evento && cobro !== 'fijo' ? { cobro, tarifa: tarifaC, maestroId: porAlumno ? maestroId || null : null } : renta?.cobro ? { cobro: null, tarifa: null } : {}),
    ...(maestroId && !porAlumno && (extraDe || renta?.maestroId) ? { maestroId } : {}),
    ...(salonId ? { salonId } : renta?.salonId ? { salonId: null } : {}),
  };
  const choques = datos.dias.length && datos.horaInicio ? empalmes({ ...datos, id: renta?.id }, clases, rentas) : [];
  const fechasMal = !evento && datos.hasta !== null && datos.hasta < datos.desde;
  const sePasaDeMedianoche = !porAlumno && !(evento && todoDia) && Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) + horario.duracionMin > 24 * 60;
  const pagoListo = evento || cobro === 'fijo' ? datos.monto > 0 : tarifaC > 0 && (!porAlumno || !!maestroId);
  const listo = datos.nombre && (porAlumno || datos.dias.length) && pagoListo && !choques.length && !fechasMal && !sePasaDeMedianoche;
  // estimado por hora: horas que ocuparía en un mes típico (4.3 semanas)
  const horasMes = Math.round(((datos.dias.length * horario.duracionMin) / 60) * 4.3 * 10) / 10;

  const guardar = async () => {
    setOcupado(true);
    try {
      if (renta) await actualizar('rentas', renta.id, datos);
      else await crear('rentas', datos);
      avisar(renta ? 'Renta actualizada' : extraDe ? 'Hora extra apartada' : evento ? 'Evento apartado' : porAlumno ? 'Acuerdo guardado' : 'Horario apartado');
      onHecho();
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {!renta && !extraDe && (
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

      {!evento && (
        <Campo etiqueta="¿Cómo paga?" grupo>
          <Segmentos<CobroRenta>
            opciones={[
              { valor: 'fijo', texto: 'Cuota al mes' },
              { valor: 'hora', texto: 'Por hora' },
              { valor: 'alumno', texto: 'Por alumno' },
            ]}
            valor={cobro}
            onChange={setCobro}
          />
        </Campo>
      )}
      {porAlumno && (
        <>
          <Campo etiqueta="Maestro (sus clases en Compás)">
            <Selector value={maestroId} onChange={(e) => setMaestroId(e.target.value)}>
              <option value="">Elige al maestro</option>
              {maestros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </Selector>
          </Campo>
          <p className="-mt-2 px-1 text-xs text-ink-500">Se cuentan los alumnos que entran a sus clases cada mes. Sus clases deben estar dadas de alta con este maestro.</p>
        </>
      )}

      {!porAlumno && salones.length > 0 && (
        <Campo etiqueta="Salón">
          <Selector value={salonId ?? ''} onChange={(e) => setSalonId(e.target.value || null)}>
            <option value="">Salón principal</option>
            {salones.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
      )}

      {porAlumno ? null : evento ? (
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

      {!porAlumno && !(evento && todoDia) && (
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

      {evento || cobro === 'fijo' ? (
        <Campo etiqueta={evento ? 'Precio' : 'Cuota al mes'}>
          <Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="$" />
        </Campo>
      ) : (
        <Campo
          etiqueta={cobro === 'hora' ? 'Cuánto paga por hora' : 'Cuánto paga por alumno'}
          ayuda={cobro === 'hora' && horasMes > 0 && tarifaC > 0 ? `≈ ${horasMes} h al mes → ${dinero(Math.round(horasMes * tarifaC))}. Se cobra lo que de verdad usó cada mes.` : cobro === 'hora' ? 'Se cobra al final del mes según las horas que usó.' : 'Ej. $10 por cada alumno.'}
        >
          <Entrada inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="$" />
        </Campo>
      )}
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
        {renta ? 'Guardar cambios' : extraDe ? 'Apartar hora extra' : evento ? 'Apartar evento' : porAlumno ? 'Guardar acuerdo' : 'Apartar horario'}
      </Boton>
      {renta && renta.tipo === 'mensual' && renta.activo && (
        <Boton bloque variante="secundario" onClick={() => onHoraExtra(renta)}>
          <Plus size={18} /> Hora extra (ensayo) para {renta.nombre.split(' (')[0]}
        </Boton>
      )}
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

function FormCobro({ renta, monto: sugerido, mes, usuarioId, onHecho }: { renta: Renta; monto: number; mes: Mes; usuarioId: string; onHecho: () => void }) {
  const avisar = useAvisos();
  const { academia } = useSesion();
  const [monto, setMonto] = useState(aPesosTexto(sugerido));
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

/** Lo que dejan las rentas del mes contra la meta (p. ej. $500 al día para pagar la renta del local). */
function MetaRentas({ metaMes, metaDiaria, total, cobrado, mes, onEditar }: { metaMes: number; metaDiaria: number; total: number; cobrado: number; mes: Mes; onEditar?: () => void }) {
  if (!metaMes)
    return (
      <button onClick={onEditar} className="mt-4 w-full rounded-2xl bg-superficie p-4 text-left text-sm ring-1 ring-ink-100 active:bg-ink-50">
        <span className="font-semibold text-brand-600">Poner meta diaria de rentas</span>
        <span className="block text-ink-500">Por ejemplo $500 al día para que el salón se pague solo.</span>
      </button>
    );
  const pct = Math.min(100, Math.round((total / metaMes) * 100));
  return (
    <button onClick={onEditar} disabled={!onEditar} className="mt-4 w-full rounded-2xl bg-superficie p-4 text-left ring-1 ring-ink-100 active:bg-ink-50 disabled:active:bg-superficie">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold tracking-wider text-ink-500 uppercase">Meta de {nombreMes(mes).split(' ')[0]}</span>
        <span className="text-sm text-ink-500">
          {dinero(metaDiaria)} al día · {dinero(metaMes)}
        </span>
      </span>
      <span className="mt-1 block text-2xl font-extrabold">
        {dinero(total)} <span className="text-base font-semibold text-ink-500">({pct}%)</span>
      </span>
      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-ink-100">
        <span className="block h-full rounded-full bg-ok-600" style={{ width: `${Math.min(100, (cobrado / metaMes) * 100)}%` }} />
      </span>
      <span className="mt-1 block text-xs text-ink-500">
        Cobrado {dinero(cobrado)}
        {total > cobrado && ` · por cobrar ${dinero(total - cobrado)}`}
        {total < metaMes && ` · faltan ${dinero(metaMes - total)} para la meta`}
      </span>
    </button>
  );
}

function FormMeta({ onHecho }: { onHecho: () => void }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [txt, setTxt] = useState(academia.metaDiaria ? aPesosTexto(academia.metaDiaria) : '500');
  return (
    <div className="space-y-4">
      <Campo etiqueta="¿Cuánto deben dejar las rentas por día?" ayuda="Se multiplica por los días del mes. Sirve para ver si el salón se paga solo.">
        <Entrada inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="$" />
      </Campo>
      <Boton
        grande
        bloque
        onClick={async () => {
          const v = aCentavos(txt);
          await actualizar('academias', academia.id, { metaDiaria: v || null });
          avisar(v ? `Meta: ${dinero(v)} al día` : 'Sin meta');
          onHecho();
        }}
      >
        Guardar
      </Boton>
    </div>
  );
}

/** Salones del estudio: el principal siempre existe; aquí se agregan otros (p. ej. el de arriba). */
function FormSalones({ clases, rentas, onHecho }: { clases: Clase[]; rentas: Renta[]; onHecho: () => void }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [lista, setLista] = useState<Salon[]>(academia.salones ?? []);
  const [nuevo, setNuevo] = useState('');
  const enUso = (id: ID) => clases.some((c) => !c.deletedAt && c.salonId === id) || rentas.some((r) => !r.deletedAt && r.activo && r.salonId === id);
  const guardar = async () => {
    const limpia = lista.map((x) => ({ ...x, nombre: x.nombre.trim() })).filter((x) => x.nombre);
    const extra = nuevo.trim() ? [{ id: crypto.randomUUID(), nombre: nuevo.trim() }] : [];
    await actualizar('academias', academia.id, { salones: [...limpia, ...extra] });
    avisar('Salones guardados');
    onHecho();
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Cada salón tiene su propia agenda: una clase o renta solo choca con lo que está en el mismo salón.</p>
      <div className="rounded-xl bg-superficie px-4 py-3 font-medium text-ink-500 ring-1 ring-ink-100">Salón principal</div>
      {lista.map((x, i) => (
        <div key={x.id} className="flex gap-2">
          <Entrada value={x.nombre} onChange={(e) => setLista(lista.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)))} aria-label="Nombre del salón" />
          <Boton
            variante="fantasma"
            disabled={enUso(x.id)}
            onClick={() => setLista(lista.filter((_, j) => j !== i))}
            aria-label={`Quitar ${x.nombre}`}
          >
            <span className={enUso(x.id) ? 'text-ink-300' : 'text-bad-600'}>Quitar</span>
          </Boton>
        </div>
      ))}
      {lista.some((x) => enUso(x.id)) && <p className="text-xs text-ink-500">Un salón con clases o rentas no se puede quitar; muévelas primero.</p>}
      <Campo etiqueta="Agregar salón">
        <Entrada value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Ej. Salón de arriba" />
      </Campo>
      <Boton grande bloque onClick={guardar}>
        Guardar
      </Boton>
    </div>
  );
}
