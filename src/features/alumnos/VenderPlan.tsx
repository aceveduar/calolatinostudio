import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { nombreClase, useClases, useDisciplinas, usePlanes } from '../../app/datos';
import { mismaSede, useSedeActual } from '../../app/sedes';
import { sirveEn } from '../../domain/sedes';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Interruptor, Segmentos, cx } from '../../components/ui';
import type { Alumno, ID, MetodoPago, Plan } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { DIAS_CORTOS, fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import { valorRestante, type EstadoMembresia } from '../../domain/membresias';
import { calcularFin, venderPlan } from '../../domain/operaciones';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { abrirTicket } from '../../app/ticketAbierto';
import { esBeca } from '../../domain/becas';
import { atrasoEnPlan } from '../../domain/adeudos';
import { METODOS, describirPlan } from '../../domain/planes';

/**
 * Venta de mensualidad, bloque o beca.
 *  - Si tiene un plan vigente del mismo tipo, la renovación empieza al terminar.
 *  - Mensual por clase (1 o 2 grupos): se eligen las clases que cubre.
 *  - Si su mensualidad venció hace poco: recargo por día de atraso y puede conservar su día de corte.
 *  - Si cambia a otro plan teniendo uno vigente: opción (apagada) de abonar lo que le quedaba; el anterior termina hoy.
 */
export function VenderPlan({
  alumno,
  estados,
  claseId,
  onHecho,
}: {
  alumno: Alumno;
  estados: EstadoMembresia[];
  claseId?: ID;
  onHecho: () => void;
}) {
  const { usuario, academia, esDueno } = useSesion();
  const avisar = useAvisos();
  const [sedeActual] = useSedeActual();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  // Sede de la venta: la de la clase a la que entra, o la de este equipo
  const sedeVenta = claseId ? (clases.find((c) => c.id === claseId)?.sedeId ?? null) : sedeActual;
  const todosPlanes = usePlanes();
  const planes = todosPlanes
    .filter((p) => p.activo && p.tipo !== 'suelta' && sirveEn(p.sedeId, sedeVenta) && (esDueno || !esBeca(p)))
    .sort((a, b) => Number(esBeca(a)) - Number(esBeca(b)) || a.precio - b.precio);
  const [planId, setPlanId] = useState<ID | null>(null);
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  // Al renovar un plan por clase, vienen marcadas las clases que ya tenía
  const clasesPrevias = (p: Plan | undefined): ID[] =>
    (p && estados.map((e) => e.membresia).filter((m) => m.planId === p.id && m.claseIds?.length).sort((a, b) => (a.fin < b.fin ? 1 : -1))[0]?.claseIds) || [];
  const inicialClases = (p: Plan | undefined): ID[] => {
    const previas = clasesPrevias(p);
    if (previas.length) return previas;
    return claseId ? [claseId] : [];
  };
  const [montoTxt, setMontoTxt] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);
  const [elegidas, setElegidas] = useState<ID[]>(() => inicialClases(plan));
  const [conRecargo, setConRecargo] = useState(true);
  const [conservarCorte, setConservarCorte] = useState(true);
  const [abonar, setAbonar] = useState(false);
  // cuánto pagó por cada plan que tiene (para saber cuánto vale lo que le queda)
  const pagoIds = estados.map((e) => e.membresia.pagoId);
  const pagados = useLiveQuery(
    async () => new Map((await db.pagos.bulkGet(pagoIds)).flatMap((p) => (p && !p.anuladoAt ? [[p.id, p.monto] as const] : []))),
    [pagoIds.join()],
    new Map<string, number>(),
  );

  const vigenteMismoTipo = useMemo(
    () => estados.filter((e) => e.vigente && e.membresia.planId === plan?.id).sort((a, b) => (a.membresia.fin < b.membresia.fin ? 1 : -1))[0],
    [estados, plan?.id],
  );
  const atraso = plan && !vigenteMismoTipo ? atrasoEnPlan(estados.map((e) => e.membresia), plan) : null;

  if (!plan) return <p className="py-6 text-center text-ink-500">No hay mensualidades ni paquetes activos. Créalos en Ajustes → Planes.</p>;

  // Paquete con clases contadas: el nuevo vale desde hoy (si se forma detrás y se le acaban las clases antes de
  // la fecha, se quedaría sin plan habiendo pagado). Al dar entrada se usa primero el que vence antes, así que
  // primero se gastan las clases que le quedaban. La mensualidad sí se forma detrás, para no encimar días.
  const juntoAlActual = !!vigenteMismoTipo && plan.tipo === 'paquete' && vigenteMismoTipo.restantes !== null;
  const inicio = vigenteMismoTipo && !juntoAlActual ? sumarDias(vigenteMismoTipo.membresia.fin, 1) : atraso && conservarCorte ? atraso.inicioConCorte : hoy();
  const beca = esBeca(plan);
  const recargo = atraso && conRecargo && academia.recargoDiario ? atraso.dias * academia.recargoDiario : 0;
  const base = montoTxt === null ? plan.precio : aCentavos(montoTxt);
  // cambio a otro plan teniendo uno vigente (no una renovación): lo que le queda de ese plan, por si se abona
  const cambio = beca || vigenteMismoTipo
    ? undefined
    : estados
        .filter((e) => e.vigente && e.membresia.planId !== plan.id)
        .map((e) => ({ e, valor: valorRestante(e, pagados.get(e.membresia.pagoId) ?? 0, hoy()), nombre: todosPlanes.find((x) => x.id === e.membresia.planId)?.nombre ?? 'plan' }))
        .filter((x) => x.valor > 0)
        .sort((a, b) => b.valor - a.valor)[0];
  const abono = cambio && abonar ? Math.min(cambio.valor, base + recargo) : 0;
  const monto = beca ? 0 : base + recargo - abono;
  // Clases que puede cubrir un plan por clase: las de esta sede (y su disciplina, si el plan es de una)
  const opcionesClase = plan.grupos
    ? clases.filter((c) => c.activo && mismaSede(c.sedeId, sedeVenta) && (!plan.disciplinaId || c.disciplinaId === plan.disciplinaId))
    : [];
  const faltanClases = !!plan.grupos && elegidas.length !== plan.grupos;
  // Solo da entrada hoy si el plan cubre la clase a la que llegó
  const daEntrada = !!claseId && inicio <= hoy() && (!plan.grupos || elegidas.includes(claseId));

  const cobrar = async () => {
    setOcupado(true);
    try {
      const { pago, membresia } = await venderPlan({
        alumnoId: alumno.id,
        plan,
        monto,
        metodo: beca ? 'efectivo' : metodo,
        inicio,
        usuarioId: usuario.id,
        entrarAClaseId: daEntrada ? claseId : undefined,
        sedeId: sedeVenta,
        claseIds: plan.grupos ? elegidas : undefined,
        recargo,
        abono: abono && cambio ? { membresiaId: cambio.e.membresia.id, plan: cambio.nombre } : undefined,
      });
      if (beca) {
        avisar(`Beca registrada hasta el ${fechaCorta(calcularFin(plan, inicio))}`);
        onHecho();
        return;
      }
      // Ticket de compra (imagen) y su mensaje: se ofrece en el aviso, sin estorbar al siguiente cobro
      const fin = calcularFin(plan, inicio);
      const mensaje = armarMensaje(plantilla(academia, 'recibo'), {
        nombre: alumno.nombre.split(' ')[0],
        academia: academia.nombre,
        monto: dinero(monto),
        plan: plan.nombre.toLowerCase(),
        vigencia: `${fechaCorta(inicio)} al ${fechaCorta(fin)}`,
        vence: fechaCorta(fin),
      });
      const ticket = {
        academia: academia.nombre,
        logo: academia.logo,
        color: academia.color,
        pagoId: pago.id,
        at: pago.createdAt,
        alumno: alumno.nombre,
        codigo: alumno.codigo,
        concepto: plan.nombre,
        vigencia: inicio === fin ? fechaCorta(inicio) : `${fechaCorta(inicio)} al ${fechaCorta(fin)}`,
        clases: plan.tipo === 'suelta' ? undefined : membresia.clasesTotal ? `${membresia.clasesTotal} ${membresia.clasesTotal === 1 ? 'clase' : 'clases'}` : 'Clases ilimitadas',
        metodo,
        monto,
        atendio: usuario.nombre,
      };
      avisar(`${plan.nombre} cobrada · ${dinero(monto)}`, 'ok', { texto: 'Enviar ticket', fn: () => abrirTicket({ ticket, telefono: alumno.telefono, mensaje }) });
      onHecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo cobrar', 'error');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {planes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPlanId(p.id);
              setMontoTxt(null);
              setElegidas(inicialClases(p));
            }}
            className={cx(
              'flex w-full items-center justify-between rounded-2xl bg-superficie p-4 text-left ring-1 transition',
              p.id === plan.id ? 'ring-2 ring-brand-500' : 'ring-ink-100',
            )}
          >
            <div>
              <p className="font-semibold">{p.nombre}</p>
              <p className="text-sm text-ink-500">{describirPlan(p)}</p>
            </div>
            {esBeca(p) ? <span className="rounded-full bg-ok-50 px-2.5 py-0.5 text-sm font-bold text-ok-600">Beca</span> : <span className="text-lg font-bold">{dinero(p.precio)}</span>}
          </button>
        ))}
      </div>

      {plan.grupos ? (
        <div role="group" aria-label="Clases que cubre">
          <p className="mb-1.5 px-1 text-sm font-medium text-ink-700">
            {plan.grupos === 1 ? '¿Qué clase toma?' : `¿Qué ${plan.grupos} clases toma?`}
            <span className="ml-1 text-ink-500">
              ({elegidas.length}/{plan.grupos})
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {opcionesClase.map((c) => {
              const sel = elegidas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={sel}
                  onClick={() =>
                    setElegidas(sel ? elegidas.filter((x) => x !== c.id) : plan.grupos === 1 ? [c.id] : elegidas.length < plan.grupos! ? [...elegidas, c.id] : elegidas)
                  }
                  className={cx('rounded-xl px-3 py-2 text-left text-sm ring-1', sel ? 'bg-brand-500 text-white ring-brand-500' : 'bg-superficie ring-ink-100')}
                >
                  <span className="block font-semibold">{nombreClase(c, disciplinas)}</span>
                  <span className={cx('block text-xs', sel ? 'text-white/80' : 'text-ink-500')}>
                    {[1, 2, 3, 4, 5, 6, 0].filter((d) => c.dias.includes(d)).map((d) => DIAS_CORTOS[d]).join(' ')} · {c.horaInicio}
                  </span>
                </button>
              );
            })}
          </div>
          {claseId && !faltanClases && !elegidas.includes(claseId) && (
            <p className="mt-2 text-sm text-warn-600">La clase de hoy no queda incluida: se cobra el plan pero no se le da entrada.</p>
          )}
        </div>
      ) : null}

      {atraso && !beca && (
        <div className="space-y-2 rounded-2xl bg-warn-50 p-4 text-sm text-warn-600">
          <p className="font-semibold">
            Su {plan.nombre.toLowerCase()} venció el {fechaCorta(atraso.membresia.fin)} · {atraso.dias} {atraso.dias === 1 ? 'día' : 'días'} de atraso
          </p>
          {!!academia.recargoDiario && (
            <Interruptor valor={conRecargo} onChange={setConRecargo} texto={`Recargo ${dinero(academia.recargoDiario)} por día: ${dinero(atraso.dias * academia.recargoDiario)}`} />
          )}
          <Interruptor valor={conservarCorte} onChange={setConservarCorte} texto={`Conservar su día de corte (desde el ${fechaCorta(atraso.inicioConCorte)})`} />
        </div>
      )}

      <div className="rounded-2xl bg-superficie p-4 text-sm ring-1 ring-ink-100">
        <p>
          Vigencia: <b>{fechaCorta(inicio)}</b> al <b>{fechaCorta(calcularFin(plan, inicio))}</b>
        </p>
        {vigenteMismoTipo &&
          (juntoAlActual ? (
            <p className="mt-1 text-ink-500">
              Vale desde hoy. Primero usa {vigenteMismoTipo.restantes === 1 ? 'la clase que le queda' : `las ${vigenteMismoTipo.restantes} clases que le quedan`} del paquete actual.
            </p>
          ) : (
            <p className="mt-1 text-ink-500">Renovación: empieza cuando termine su plan actual.</p>
          ))}
      </div>

      {beca ? (
        <>
          <p className="rounded-xl bg-ok-50 px-3 py-2 text-sm text-ok-600">{alumno.nombre.split(' ')[0]} entrará a sus clases sin pagar durante la vigencia. No se registra dinero en caja.</p>
          <BarraCobro>
            <Boton grande bloque onClick={cobrar} disabled={ocupado || faltanClases}>
              Dar beca{daEntrada ? ' y dar entrada' : ''}
            </Boton>
          </BarraCobro>
        </>
      ) : (
        <>
          <Campo etiqueta="Precio del plan" ayuda="Cámbialo solo si hay descuento.">
            <Entrada inputMode="decimal" value={montoTxt ?? aPesosTexto(plan.precio)} onChange={(e) => setMontoTxt(e.target.value)} />
          </Campo>
          {base > plan.precio && (
            <p className="-mt-3 rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
              Ojo: {dinero(base)} es más que el precio del plan ({dinero(plan.precio)}). ¿Se teclearon ceros de más?
            </p>
          )}
          {base > 0 && base < plan.precio * 0.5 && (
            <p className="-mt-3 rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">Descuento de más de la mitad. Revisa que sea correcto.</p>
          )}
          {cambio && (
            <div className="space-y-1.5 text-sm">
              <Interruptor valor={abonar} onChange={setAbonar} texto={`Abonar lo que le quedaba de su ${cambio.nombre.toLowerCase()}: ${dinero(cambio.valor)}`} />
              <p className="px-1 text-xs text-ink-500">
                {cambio.e.restantes !== null
                  ? `Le quedan ${cambio.e.restantes} de ${cambio.e.membresia.clasesTotal} clases.`
                  : `Le quedan ${cambio.e.diasRestantes} ${cambio.e.diasRestantes === 1 ? 'día' : 'días'}.`}{' '}
                {abonar ? `Su ${cambio.nombre.toLowerCase()} termina hoy y ese dinero se descuenta de este plan.` : 'Si lo abonas, ese plan termina hoy.'}
              </p>
            </div>
          )}
          <BarraCobro>
            <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
            <Boton grande bloque onClick={cobrar} disabled={ocupado || monto <= 0 || faltanClases}>
              {faltanClases ? (plan.grupos === 1 ? 'Elige la clase' : `Elige ${plan.grupos} clases`) : `Cobrar ${dinero(monto)}${recargo ? ' (con recargo)' : ''}${abono ? ' (con abono)' : ''}${daEntrada ? ' y dar entrada' : ''}`}
            </Boton>
          </BarraCobro>
        </>
      )}
    </div>
  );
}

/** Método de pago y botón de cobrar, siempre visibles abajo aunque la hoja sea larga (recargo, varias clases). */
function BarraCobro({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 -mx-5 space-y-3 border-t border-ink-100 bg-ink-50/95 px-5 pt-3 pb-4 backdrop-blur">{children}</div>;
}
