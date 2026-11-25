import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { nombreClase, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Segmentos } from '../../components/ui';
import type { Alumno, MetodoPago, Plan } from '../../db/types';
import { cobrarAdeudos, type Adeudo } from '../../domain/adeudos';
import { dinero } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';
import { METODOS } from '../../domain/planes';

/** Tarjeta en la ficha del alumno: qué clases debe y cobrarlas. */
export function TarjetaAdeudos({ alumno, adeudos, planes }: { alumno: Alumno; adeudos: Adeudo[]; planes: Plan[] }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const total = adeudos.reduce((s, a) => s + a.monto, 0);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);
  const tarjeta = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const tieneAdeudos = adeudos.length > 0;
  useEffect(() => {
    if (hash === '#adeudos' && tieneAdeudos) tarjeta.current?.focus();
  }, [hash, tieneAdeudos]);
  if (!adeudos.length) return null;
  return (
    <div id="adeudos" ref={tarjeta} tabIndex={-1} className="mt-4 space-y-3 rounded-2xl bg-bad-50 p-4">
      {hash === '#adeudos' && <p className="text-sm font-semibold text-ink-900">{alumno.nombre}</p>}
      <p className="flex items-center gap-2 font-bold text-bad-600">
        <Clock size={18} /> Debe {adeudos.length} {adeudos.length === 1 ? 'clase' : 'clases'} · {dinero(total)}
      </p>
      <ul className="space-y-0.5 text-sm text-ink-700">
        {adeudos.map((a) => (
          <li key={a.asistencia.id} className="flex justify-between gap-2">
            <span>
              {fechaCorta(a.asistencia.fecha)} · {nombreClase(a.clase, disciplinas)}
            </span>
            {adeudos.length > 1 && <span className="shrink-0 font-semibold">{dinero(a.monto)}</span>}
          </li>
        ))}
      </ul>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton
        bloque
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          try {
            const cobrado = await cobrarAdeudos({ adeudos, metodo, usuarioId: usuario.id, planes });
            avisar(`Adeudo cobrado · ${dinero(cobrado)}`);
          } catch {
            avisar('No se pudo guardar el cobro del adeudo. Inténtalo de nuevo.', 'error');
          } finally {
            setOcupado(false);
          }
        }}
      >
        Cobrar lo que debe · {dinero(total)}
      </Boton>
    </div>
  );
}
