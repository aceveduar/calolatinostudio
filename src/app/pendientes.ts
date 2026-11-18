/** Los pendientes del día (para la pantalla y para el número en Entrada y en "Más"). */
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useClases, usePedidosPendientes, usePlanes } from './datos';
import { useContadores } from './contadores';
import { db } from '../db/db';
import { hoy, sumarDias } from '../domain/fechas';
import { mesDe, rangoMes, sumarMes } from '../domain/gastos';
import { deudores, porExtranar, porRenovar, rentasPorCobrar } from '../domain/pendientes';

/** Lee de la base lo necesario para calcular los pendientes. */
async function cargar(dia: string) {
  const inicioMesPasado = rangoMes(sumarMes(mesDe(dia), -1)).desde;
  const desde = [sumarDias(dia, -90), inicioMesPasado].sort()[0];
  const [mems, alumnos, asistencias, fiados, rentas, pagosRenta] = await Promise.all([
    db.membresias.where('fin').aboveOrEqual(sumarDias(dia, -7)).toArray(),
    db.alumnos.toArray(),
    db.asistencias.where('fecha').aboveOrEqual(desde).toArray(),
    // lo fiado puede ser de hace meses
    db.asistencias.where('deuda').equals(1).toArray(),
    db.rentas.toArray(),
    db.pagos.where('fecha').aboveOrEqual(inicioMesPasado).filter((p) => !!p.rentaId).toArray(),
  ]);
  return { mems, alumnos, asistencias, fiados, rentas, pagosRenta };
}

/**
 * Todo lo pendiente de hoy, para la pantalla y para el número en Entrada y en "Más".
 * `vivo`: se recalcula con cada cambio (pantalla de Pendientes). Si no, cada minuto y al volver a la app:
 * en Entrada no debe frenar los cobros (cada venta volvería a leer cientos de registros).
 */
export function usePendientes(vivo = true) {
  const dia = hoy();
  const clases = useClases();
  const planes = usePlanes();
  const porEntregar = usePedidosPendientes().length;
  const { interesados, encargos: porPedir } = useContadores();
  const enVivo = useLiveQuery(() => (vivo ? cargar(dia) : undefined), [dia, vivo]);
  const [foto, setFoto] = useState<Awaited<ReturnType<typeof cargar>>>();
  useEffect(() => {
    if (vivo) return;
    let activo = true;
    const leer = () => void cargar(dia).then((d) => activo && setFoto(d));
    leer();
    const t = setInterval(leer, 60_000);
    const alVolver = () => document.visibilityState === 'visible' && leer();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      activo = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [dia, vivo]);
  const datos = vivo ? enVivo : foto;

  return useMemo(() => {
    if (!datos) return null;
    const porId = new Map(datos.alumnos.map((a) => [a.id, a]));
    const renovar = porRenovar({ mems: datos.mems, alumnos: porId, planes, hoy: dia });
    const deben = deudores({ asistencias: datos.fiados, alumnos: porId, clases, planes });
    const extranar = porExtranar({ asistencias: datos.asistencias, alumnos: porId, hoy: dia });
    const rentas = rentasPorCobrar({ rentas: datos.rentas, pagos: datos.pagosRenta, asistencias: datos.asistencias, clases, hoy: dia });
    const total = renovar.length + deben.length + extranar.length + rentas.length + interesados + porEntregar + porPedir;
    return { renovar, deben, extranar, rentas, interesados, porEntregar, porPedir, total };
  }, [datos, planes, clases, dia, interesados, porEntregar, porPedir]);
}
