import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { nombreClase, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Segmentos } from '../../components/ui';
import type { Alumno, MetodoPago } from '../../db/types';
import { cobrarAdeudos } from '../../domain/adeudos';
import { dinero } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';
import { METODOS } from '../../domain/planes';
import { useAdeudos } from '../../app/adeudos';

/** Tarjeta en la ficha del alumno: qué clases debe y cobrarlas. */
export function TarjetaAdeudos({ alumno }: { alumno: Alumno }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const { adeudos, total, planes } = useAdeudos(alumno.id);
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
      <p className="flex items-center gap-2 font-bold text-bad-600">
        <Clock size={18} /> Debe {adeudos.length} {adeudos.length === 1 ? 'clase' : 'clases'} · {dinero(total)}
      </p>
      <ul className="space-y-0.5 text-sm text-bad-600">
        {adeudos.map((a) => (
          <li key={a.asistencia.id} className="flex justify-between">
            <span>
              {fechaCorta(a.asistencia.fecha)} · {nombreClase(a.clase, disciplinas)}
            </span>
            <span className="font-semibold">{dinero(a.monto)}</span>
          </li>
        ))}
      </ul>
      <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
      <Boton
        grande
        bloque
        disabled={ocupado}
        onClick={async () => {
          setOcupado(true);
          try {
            const cobrado = await cobrarAdeudos({ adeudos, metodo, usuarioId: usuario.id, planes });
            avisar(`Adeudo cobrado · ${dinero(cobrado)}`);
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
