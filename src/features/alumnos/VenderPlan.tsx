import { useMemo, useState } from 'react';
import { usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Segmentos, cx } from '../../components/ui';
import type { Alumno, ID, MetodoPago, Plan } from '../../db/types';
import { aCentavos, aPesosTexto, dinero } from '../../domain/dinero';
import { fechaCorta, hoy, sumarDias } from '../../domain/fechas';
import type { EstadoMembresia } from '../../domain/membresias';
import { calcularFin, venderPlan } from '../../domain/operaciones';

export const METODOS: { valor: MetodoPago; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'tarjeta', texto: 'Tarjeta' },
];

export function describirPlan(p: Plan): string {
  if (p.tipo === 'mensual') return 'Clases ilimitadas por un mes';
  if (p.tipo === 'paquete') return `${p.clases} clases · vigencia ${p.vigenciaDias} días`;
  return 'Una clase';
}

/** Venta de mensualidad o paquete. Si el alumno tiene un plan vigente, propone empezar al terminar (renovación). */
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
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const planes = usePlanes().filter((p) => p.activo && p.tipo !== 'suelta');
  const [planId, setPlanId] = useState<ID | null>(null);
  const plan = planes.find((p) => p.id === planId) ?? planes[0];
  const [montoTxt, setMontoTxt] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);

  const vigenteMismoTipo = useMemo(
    () => estados.filter((e) => e.vigente && e.membresia.planId === plan?.id).sort((a, b) => (a.membresia.fin < b.membresia.fin ? 1 : -1))[0],
    [estados, plan?.id],
  );
  const inicio = vigenteMismoTipo ? sumarDias(vigenteMismoTipo.membresia.fin, 1) : hoy();

  if (!plan) return <p className="py-6 text-center text-ink-500">No hay mensualidades ni paquetes activos. Créalos en Ajustes → Planes.</p>;

  const monto = montoTxt === null ? plan.precio : aCentavos(montoTxt);

  const cobrar = async () => {
    setOcupado(true);
    try {
      await venderPlan({ alumnoId: alumno.id, plan, monto, metodo, inicio, usuarioId: usuario.id, entrarAClaseId: claseId });
      avisar(`${plan.nombre} cobrada · ${dinero(monto)}`);
      onHecho();
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
            <span className="text-lg font-bold">{dinero(p.precio)}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-superficie p-4 text-sm ring-1 ring-ink-100">
        <p>
          Vigencia: <b>{fechaCorta(inicio)}</b> al <b>{fechaCorta(calcularFin(plan, inicio))}</b>
        </p>
        {vigenteMismoTipo && <p className="mt-1 text-ink-500">Renovación: empieza cuando termine su plan actual.</p>}
      </div>

      <Campo etiqueta="Monto cobrado" ayuda="Cámbialo solo si hay descuento.">
        <Entrada inputMode="decimal" value={montoTxt ?? aPesosTexto(plan.precio)} onChange={(e) => setMontoTxt(e.target.value)} />
      </Campo>
      {monto > plan.precio && (
        <p className="-mt-3 rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          Ojo: {dinero(monto)} es más que el precio del plan ({dinero(plan.precio)}). ¿Se teclearon ceros de más?
        </p>
      )}
      {monto > 0 && monto < plan.precio * 0.5 && (
        <p className="-mt-3 rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          Descuento de más de la mitad. Revisa que sea correcto.
        </p>
      )}
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton grande bloque onClick={cobrar} disabled={ocupado || monto <= 0}>
        Cobrar {dinero(monto)}
        {claseId && inicio <= hoy() ? ' y dar entrada' : ''}
      </Boton>
    </div>
  );
}
