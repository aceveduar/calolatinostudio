import { useLiveQuery } from 'dexie-react-hooks';
import { useClases } from '../../app/datos';
import { Seccion, Tarjeta } from '../../components/ui';
import { db } from '../../db/db';
import { dinero } from '../../domain/dinero';
import { hoy } from '../../domain/fechas';
import { mesDe, nombreMes, rangoMes, sumarMes } from '../../domain/gastos';
import { claveSede } from '../../domain/sedes';

/**
 * Los últimos 12 meses: cuánto entró y cuántos alumnos distintos vinieron (la "matrícula").
 * Sirve para ver la curva del año (p. ej. diciembre baja) y comparar con el mismo mes.
 */
export function TendenciaAnual({ verSede }: { verSede: string }) {
  const clases = useClases();
  const actual = mesDe(hoy());
  const meses = Array.from({ length: 12 }, (_, i) => sumarMes(actual, i - 11));
  const filas = useLiveQuery(async () => {
    const desde = rangoMes(meses[0]).desde;
    const enSede = (s: string | null | undefined) => verSede === 'todas' || claveSede(s) === verSede;
    const sedeDeClase = new Map(clases.map((c) => [c.id, c.sedeId]));
    const [pagos, asis] = await Promise.all([db.pagos.where('fecha').aboveOrEqual(desde).toArray(), db.asistencias.where('fecha').aboveOrEqual(desde).toArray()]);
    return meses.map((mes) => {
      const ingresos = pagos.filter((p) => p.fecha.startsWith(mes) && !p.anuladoAt && !p.deletedAt && enSede(p.sedeId)).reduce((s, p) => s + p.monto, 0);
      const alumnos = new Set(asis.filter((a) => a.fecha.startsWith(mes) && a.alumnoId && !a.anuladaAt && !a.deletedAt && enSede(sedeDeClase.get(a.claseId))).map((a) => a.alumnoId)).size;
      return { mes, ingresos, alumnos };
    });
  }, [actual, verSede, clases]);
  if (!filas) return null;
  const conDatos = filas.filter((f) => f.ingresos || f.alumnos);
  if (conDatos.length < 2) return null; // con un solo mes no hay curva que ver
  const maxI = Math.max(1, ...filas.map((f) => f.ingresos));
  const maxA = Math.max(1, ...filas.map((f) => f.alumnos));
  const primero = filas.findIndex((f) => f.ingresos || f.alumnos);

  return (
    <Seccion titulo="Últimos 12 meses">
      <Tarjeta className="overflow-x-auto p-2">
        <table className="w-full text-sm">
          <caption className="sr-only">Ingresos y alumnos distintos por mes</caption>
          <thead>
            <tr className="text-xs text-ink-500">
              <th className="px-2 py-1 text-left font-semibold">Mes</th>
              <th className="px-2 py-1 text-left font-semibold">Ingresos</th>
              <th className="px-2 py-1 text-right font-semibold">Alumnos</th>
            </tr>
          </thead>
          <tbody>
            {filas.slice(Math.max(0, primero)).map((f) => (
              <tr key={f.mes} className={f.mes === actual ? 'font-semibold' : ''}>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className="capitalize">{nombreMes(f.mes).replace(' de ', ' ').replace(/(\w{3})\w*/, '$1')}</span>
                  {f.mes === actual && <span className="ml-1 text-[10px] font-normal text-ink-500">en curso</span>}
                </td>
                <td className="w-full px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 min-w-[2px] rounded-full bg-brand-500" style={{ width: `${(f.ingresos / maxI) * 100}%`, opacity: f.mes === actual ? 0.55 : 1 }} />
                    <span className="shrink-0 text-xs tabular-nums">{dinero(f.ingresos)}</span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 rounded-full bg-ink-300" style={{ width: `${Math.max(2, (f.alumnos / maxA) * 40)}px` }} />
                    {f.alumnos}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </Seccion>
  );
}
