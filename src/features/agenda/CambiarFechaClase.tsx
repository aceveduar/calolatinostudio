import { useState } from 'react';
import { nombreClase, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { nombreSede, useSedes } from '../../app/sedes';
import { Boton, Campo, Entrada, Selector } from '../../components/ui';
import { db, getMeta } from '../../db/db';
import { actualizar, enTransaccion } from '../../db/repo';
import type { Clase, ExcepcionClase } from '../../db/types';
import { bloquesDelDia } from '../../domain/agenda';
import { clasesDelDia } from '../../domain/clases';
import { deFecha, hoy, minutosDelDia } from '../../domain/fechas';
import { baseTieneColumna } from '../../sync/supabase';

export function CambiarFechaClase({ clases, fechaInicial, claseInicial, onListo }: { clases: Clase[]; fechaInicial: string; claseInicial?: Clase; onListo: () => void }) {
  const { academia } = useSesion();
  const disciplinas = useDisciplinas();
  const sedes = useSedes();
  const [fecha, setFecha] = useState(fechaInicial);
  const [id, setId] = useState(claseInicial?.id ?? '');
  const [accion, setAccion] = useState('cancelar');
  const [hora, setHora] = useState(claseInicial?.horaInicio ?? '');
  const [sede, setSede] = useState(claseInicial?.sedeId ?? '');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const candidatas = fecha ? clases.filter((c) => c.activo && c.dias.includes(deFecha(fecha).getDay())) : [];
  const clase = candidatas.find((c) => c.id === id);
  const excepcion = clase?.excepciones?.[fecha];

  async function guardar() {
    if (!clase || guardando) return;
    setGuardando(true);
    setError('');
    try {
      if (await getMeta<boolean>('nubeVinculada') && !await baseTieneColumna('clases', 'excepciones')) {
        throw new Error('Actualiza la base de datos para guardar cambios de una sola fecha.');
      }
      await enTransaccion(async () => {
        const actual = await db.clases.get(clase.id);
        if (!actual?.activo || actual.deletedAt || fecha < hoy() || !actual.dias.includes(deFecha(fecha).getDay())) {
          throw new Error('Elige una fecha vigente de la clase.');
        }
        if (await db.asistencias.where('[claseId+fecha]').equals([actual.id, fecha]).filter((a) => !a.deletedAt && !a.anuladaAt).first()) {
          throw new Error('Esta fecha ya tiene entradas registradas.');
        }
        const cambio: ExcepcionClase | null = accion === 'restaurar' ? null : accion === 'cancelar' ? { cancelada: true }
          : { hora, sede: sede || null, salon: !sede && !actual.sedeId ? actual.salonId ?? null : null };
        if (!cambio || !('cancelada' in cambio)) {
          const inicio = minutosDelDia(cambio?.hora ?? actual.horaInicio);
          const fin = inicio + actual.duracionMin;
          const destino = cambio ? cambio.sede : actual.sedeId ?? null;
          const salon = cambio ? cambio.salon : actual.salonId ?? null;
          const choca = (a: number, b: number) => inicio < b && a < fin;
          const otras = clasesDelDia(await db.clases.toArray(), deFecha(fecha)).filter((c) => c.id !== actual.id);
          if (!Number.isFinite(inicio) || fin > 1440) throw new Error('Elige una hora válida dentro del día.');
          if (otras.some((c) => ((c.sedeId ?? null) === destino && (destino || (c.salonId ?? null) === salon)
            || actual.maestroId && actual.maestroId === c.maestroId) && choca(minutosDelDia(c.horaInicio), minutosDelDia(c.horaInicio) + c.duracionMin))) {
            throw new Error('Ese horario coincide con otra clase del salón o del maestro.');
          }
          if (!destino) {
            const rentas = await db.rentas.toArray();
            if (bloquesDelDia(fecha, [], rentas, salon).some((b) => choca(b.inicio, b.fin))) {
              throw new Error('El salón ya está apartado a esa hora.');
            }
          }
        }
        const cambios = { ...actual.excepciones };
        if (cambio) cambios[fecha] = cambio;
        else delete cambios[fecha];
        await actualizar('clases', actual.id, { excepciones: cambios });
      });
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta="Fecha">
        <Entrada type="date" min={hoy()} value={fecha} onChange={(e) => { setFecha(e.target.value); setId(''); setAccion('cancelar'); }} />
      </Campo>
      <Campo etiqueta="Clase">
        <Selector value={id} onChange={(e) => {
          const c = candidatas.find((x) => x.id === e.target.value);
          const actual = c?.excepciones?.[fecha];
          setId(e.target.value);
          setAccion('cancelar');
          setHora(actual && !('cancelada' in actual) ? actual.hora : c?.horaInicio ?? '');
          setSede((actual && !('cancelada' in actual) ? actual.sede : c?.sedeId) ?? '');
        }}>
          <option value="">Elige una clase</option>
          {candidatas.map((c) => <option key={c.id} value={c.id}>{nombreClase(c, disciplinas)} · {c.horaInicio} · {nombreSede(c.sedeId, sedes, academia)}</option>)}
        </Selector>
      </Campo>
      {excepcion && <p className="text-sm text-warn-600">{'cancelada' in excepcion ? 'Esta fecha está cancelada.' : `Esta fecha se cambió a las ${excepcion.hora} en ${nombreSede(excepcion.sede, sedes, academia)}.`}</p>}
      <Campo etiqueta="Qué quieres hacer">
        <Selector value={accion} onChange={(e) => setAccion(e.target.value)}>
          <option value="cancelar">Cancelar esta fecha</option>
          <option value="mover">Cambiar hora o sede</option>
          {excepcion && <option value="restaurar">Volver al horario habitual</option>}
        </Selector>
      </Campo>
      {accion === 'mover' && (
        <>
          <Campo etiqueta="Hora nueva"><Entrada type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
          <Campo etiqueta="Sede">
            <Selector value={sede} onChange={(e) => setSede(e.target.value)}>
              <option value="">{nombreSede(null, sedes, academia)}</option>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Selector>
          </Campo>
        </>
      )}
      {error && <p role="alert" className="text-sm text-bad-600">{error}</p>}
      <Boton bloque disabled={!clase || fecha < hoy() || guardando || (accion === 'mover' && !hora)} onClick={() => void guardar()}>
        {guardando ? 'Guardando…' : 'Guardar solo esta fecha'}
      </Boton>
    </div>
  );
}
