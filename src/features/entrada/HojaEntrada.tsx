import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Ticket, CalendarPlus, AlertTriangle } from 'lucide-react';
import { nombreClase, useDisciplinas, useEstadosDeAlumno, usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Etiqueta, Hoja, Segmentos } from '../../components/ui';
import type { Alumno, Clase, MetodoPago } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';
import { membresiaQueCubre, semaforoAlumno, textoDias } from '../../domain/membresias';
import { cobrarClaseSuelta, entrarConMembresia, yaEntroHoy } from '../../domain/operaciones';
import { METODOS, VenderPlan } from '../alumnos/VenderPlan';

/**
 * El corazón de recepción. Decide solo qué ofrecer:
 *  - tiene plan vigente → un botón verde "Dar entrada"
 *  - no tiene → "Cobrar $40" (la tarjeta de siempre) o vender mensualidad/paquete
 */
export function HojaEntrada({ alumno, clase, onCerrar }: { alumno: Alumno | null; clase: Clase | null; onCerrar: () => void }) {
  return (
    <Hoja abierta={!!alumno} onCerrar={onCerrar}>
      {alumno && <Contenido alumno={alumno} clase={clase} onCerrar={onCerrar} />}
    </Hoja>
  );
}

function Contenido({ alumno, clase, onCerrar }: { alumno: Alumno; clase: Clase | null; onCerrar: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const disciplinas = useDisciplinas();
  const planes = usePlanes();
  const estados = useEstadosDeAlumno(alumno.id);
  const yaEntro = useLiveQuery(() => (clase ? yaEntroHoy(alumno.id, clase.id) : false), [alumno.id, clase?.id]);
  const [vista, setVista] = useState<'principal' | 'vender'>('principal');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [ocupado, setOcupado] = useState(false);

  const cubre = clase ? membresiaQueCubre(estados, clase) : null;
  const suelta = planes.find((p) => p.activo && p.tipo === 'suelta');
  const sem = semaforoAlumno(estados);
  const nClase = nombreClase(clase ?? undefined, disciplinas);

  const ejecutar = async (fn: () => Promise<unknown>, msg: string) => {
    setOcupado(true);
    try {
      await fn();
      avisar(msg);
      onCerrar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Algo salió mal', 'error');
    } finally {
      setOcupado(false);
    }
  };

  const nombreCorto = alumno.nombre.split(' ')[0];

  return (
    <div>
      <div className="flex items-center gap-3 pb-4">
        <Avatar nombre={alumno.nombre} tam={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{alumno.nombre}</p>
          <div className="mt-1 flex items-center gap-2">
            <Etiqueta tono={sem.tono}>{sem.texto}</Etiqueta>
            {clase && <span className="truncate text-sm text-ink-500">→ {nClase}</span>}
          </div>
        </div>
      </div>

      {vista === 'vender' ? (
        <VenderPlan alumno={alumno} estados={estados} claseId={clase?.id} onHecho={onCerrar} />
      ) : !clase ? (
        <p className="rounded-2xl bg-warn-50 p-4 text-warn-600">Elige primero la clase en la pantalla de Entrada.</p>
      ) : yaEntro ? (
        <div className="rounded-2xl bg-ok-50 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 text-ok-600" size={36} />
          <p className="font-semibold text-ok-600">{nombreCorto} ya tiene entrada a {nClase} hoy.</p>
          <Boton variante="secundario" className="mt-4" onClick={onCerrar}>
            Cerrar
          </Boton>
        </div>
      ) : cubre ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-superficie p-4 ring-1 ring-ink-100">
            <p className="font-semibold">{planes.find((p) => p.id === cubre.membresia.planId)?.nombre ?? 'Plan'}</p>
            <p className="text-sm text-ink-500">
              Vence {fechaCorta(cubre.membresia.fin)} ({textoDias(cubre.diasRestantes)})
              {cubre.restantes !== null && ` · le quedan ${cubre.restantes} clases`}
            </p>
          </div>
          <Boton
            grande
            bloque
            variante="exito"
            disabled={ocupado}
            onClick={() =>
              ejecutar(
                () => entrarConMembresia({ alumnoId: alumno.id, claseId: clase.id, membresiaId: cubre.membresia.id, usuarioId: usuario.id }),
                `${nombreCorto} entró a ${nClase}`,
              )
            }
          >
            <CheckCircle2 size={22} /> Dar entrada
          </Boton>
        </div>
      ) : (
        <div className="space-y-3">
          {estados.some((e) => e.vigente) && (
            <p className="flex gap-2 rounded-2xl bg-warn-50 p-3 text-sm text-warn-600">
              <AlertTriangle size={18} className="shrink-0" /> Su plan actual no cubre esta clase.
            </p>
          )}
          {suelta && (
            <div className="space-y-3 rounded-2xl bg-superficie p-4 ring-1 ring-ink-100">
              <Segmentos opciones={METODOS} valor={metodo} onChange={setMetodo} />
              <Boton
                grande
                bloque
                disabled={ocupado}
                onClick={() =>
                  ejecutar(
                    () => cobrarClaseSuelta({ alumnoId: alumno.id, claseId: clase.id, plan: suelta, metodo, usuarioId: usuario.id }),
                    `${dinero(suelta.precio)} cobrados · ${nombreCorto} entró`,
                  )
                }
              >
                <Ticket size={22} /> Cobrar {suelta.nombre.toLowerCase()} {dinero(suelta.precio)}
              </Boton>
            </div>
          )}
          <Boton grande bloque variante="secundario" onClick={() => setVista('vender')}>
            <CalendarPlus size={20} /> Vender mensualidad o paquete
          </Boton>
        </div>
      )}
    </div>
  );
}
