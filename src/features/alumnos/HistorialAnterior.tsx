import { useEffect, useState } from 'react';
import { CloudDownload } from 'lucide-react';
import { nombreClase, useClases, useDisciplinas } from '../../app/datos';
import { Boton, Cargando, Hoja, Seccion, Tarjeta } from '../../components/ui';
import type { Asistencia, ID, Pago } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { fechaCorta } from '../../domain/fechas';
import { historialAnterior } from '../../sync/engine';

const fechaLarga = (f: string) => `${fechaCorta(f)} ${f.slice(0, 4)}`;

/**
 * Las clases y pagos de un alumno de hace más de 18 meses: el teléfono ya no los guarda (para no llenarse),
 * así que se traen de la nube al abrir esta hoja. Solo para ver.
 */
export function HistorialAnterior({ abierta, onCerrar, alumnoId, nombre }: { abierta: boolean; onCerrar: () => void; alumnoId: ID; nombre: string }) {
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const [datos, setDatos] = useState<{ pagos: Pago[]; asistencias: Asistencia[] } | null>(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!abierta || datos) return;
    let vivo = true;
    setError('');
    historialAnterior(alumnoId)
      .then((d) => vivo && setDatos(d))
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : 'No se pudo traer el historial'));
    return () => {
      vivo = false;
    };
  }, [abierta, alumnoId, datos, intento]);

  const pagados = datos?.pagos.filter((p) => !p.anuladoAt) ?? [];

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Historial anterior">
      <p className="text-sm text-ink-500">De hace más de 18 meses. Este teléfono ya no lo guarda; se trae de la nube para verlo.</p>
      {error ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl bg-warn-50 p-4 text-sm font-medium text-warn-600">{error}</p>
          <Boton bloque variante="secundario" onClick={() => setIntento((n) => n + 1)}>
            <CloudDownload size={18} /> Intentar de nuevo
          </Boton>
        </div>
      ) : !datos ? (
        <Cargando texto="Trayendo de la nube…" />
      ) : datos.pagos.length === 0 && datos.asistencias.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-superficie p-4 text-sm text-ink-700 ring-1 ring-ink-100">{nombre} no tiene clases ni pagos de hace más de 18 meses.</p>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold">
            {datos.asistencias.length} {datos.asistencias.length === 1 ? 'clase' : 'clases'} · {pagados.length} {pagados.length === 1 ? 'pago' : 'pagos'} por {dinero(pagados.reduce((s, p) => s + p.monto, 0))}
          </p>
          {datos.pagos.length > 0 && (
            <Seccion titulo="Pagos">
              <Tarjeta className="divide-y divide-ink-100">
                {datos.pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-medium'}>
                      {p.concepto} <span className="text-ink-500">· {fechaLarga(p.fecha)}</span>
                    </span>
                    <span className={p.anuladoAt ? 'text-ink-300 line-through' : 'font-semibold'}>{dinero(p.monto)}</span>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}
          {datos.asistencias.length > 0 && (
            <Seccion titulo="Clases">
              <Tarjeta className="divide-y divide-ink-100">
                {datos.asistencias.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium">{nombreClase(clases.find((c) => c.id === a.claseId), disciplinas)}</span>
                    <span className="text-ink-500">{fechaLarga(a.fecha)}</span>
                  </div>
                ))}
              </Tarjeta>
            </Seccion>
          )}
        </>
      )}
    </Hoja>
  );
}
