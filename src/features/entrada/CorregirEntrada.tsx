import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, CalendarRange, Search, Trash2, UserRoundPen } from 'lucide-react';
import { nombreClase, useAlumnos, useClases, useDisciplinas } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Etiqueta, Segmentos, Tarjeta, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Asistencia, MetodoPago } from '../../db/types';
import { cambiarMetodoPago, cambiarPersona, moverDeClase, quitarEntrada } from '../../domain/correcciones';
import { dinero } from '../../domain/dinero';
import { horaDe } from '../../domain/fechas';
import { METODOS } from '../../domain/planes';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Vista = 'menu' | 'clase' | 'persona';

/** Todo lo que se puede corregir de una entrada, en un solo lugar. Cada acción se puede deshacer. */
export function CorregirEntrada({ asistencia, nombre, onHecho }: { asistencia: Asistencia; nombre: string; onHecho: () => void }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const clases = useClases();
  const disciplinas = useDisciplinas();
  const alumnos = useAlumnos();
  const pago = useLiveQuery(() => (asistencia.pagoId ? db.pagos.get(asistencia.pagoId) : undefined), [asistencia.pagoId]);
  const [vista, setVista] = useState<Vista>('menu');
  const [q, setQ] = useState('');
  const clase = clases.find((c) => c.id === asistencia.claseId);
  const n1 = nombre.split(' ')[0];

  const intentar = async (fn: () => Promise<void>) => {
    try {
      await fn();
      onHecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo corregir', 'error');
    }
  };

  const candidatos = useMemo(() => {
    const t = normalizar(q.trim());
    return alumnos.filter((a) => a.activo && a.id !== asistencia.alumnoId && (!t || normalizar(a.nombre).includes(t))).slice(0, 6);
  }, [q, alumnos, asistencia.alumnoId]);

  return (
    <div className="space-y-4">
      <Tarjeta className="flex items-center gap-3 p-3">
        <Avatar nombre={nombre} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{nombre}</p>
          <p className="text-sm text-ink-500">
            {nombreClase(clase, disciplinas)} · {horaDe(asistencia.createdAt)}
          </p>
        </div>
        {pago ? <Etiqueta tono="marca">{dinero(pago.monto)}</Etiqueta> : <Etiqueta tono="ok">Plan</Etiqueta>}
      </Tarjeta>

      {vista === 'menu' && (
        <>
          {pago && (
            <div>
              <p className="mb-1.5 px-1 text-sm font-medium text-ink-700">¿Cómo pagó?</p>
              <Segmentos<MetodoPago>
                opciones={METODOS}
                valor={pago.metodo}
                onChange={async (m) => {
                  const antes = await cambiarMetodoPago(pago.id, m);
                  avisar(`Ahora: ${m}`, 'ok', { texto: 'Deshacer', fn: () => cambiarMetodoPago(pago.id, antes).then(() => undefined) });
                }}
              />
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-superficie ring-1 ring-ink-100">
            <Opcion icono={<CalendarRange size={20} />} titulo="Era otra clase" sub="Pasarla a la clase correcta" onClick={() => setVista('clase')} />
            {pago && (
              <Opcion icono={<UserRoundPen size={20} />} titulo="Era otra persona" sub="El cobro pasa a quien sí llegó" onClick={() => setVista('persona')} />
            )}
          </div>

          <Boton
            bloque
            variante="peligro"
            onClick={() =>
              intentar(async () => {
                const deshacer = await quitarEntrada(asistencia, usuario.id);
                avisar(pago ? `Entrada quitada · devuelve ${dinero(pago.monto)}` : `Entrada de ${n1} quitada`, 'ok', { texto: 'Deshacer', fn: deshacer });
              })
            }
          >
            <Trash2 size={18} /> {pago ? `Quitar entrada y devolver ${dinero(pago.monto)}` : 'Quitar entrada (se le devuelve la clase)'}
          </Boton>
        </>
      )}

      {vista === 'clase' && (
        <div className="space-y-2">
          <p className="px-1 text-sm text-ink-500">¿A qué clase entró {n1}?</p>
          {clases
            .filter((c) => c.activo && c.id !== asistencia.claseId)
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
            .map((c) => (
              <Tarjeta
                key={c.id}
                onClick={() =>
                  intentar(async () => {
                    const origen = asistencia.claseId;
                    await moverDeClase(asistencia, c.id);
                    avisar(`${n1} pasó a ${nombreClase(c, disciplinas)}`, 'ok', {
                      texto: 'Deshacer',
                      fn: () => moverDeClase({ ...asistencia, claseId: c.id }, origen),
                    });
                  })
                }
                className="flex items-center justify-between p-4"
              >
                <span className="font-semibold">{nombreClase(c, disciplinas)}</span>
                <span className="text-sm text-ink-500">{c.horaInicio}</span>
              </Tarjeta>
            ))}
          <Boton bloque variante="fantasma" onClick={() => setVista('menu')}>
            Volver
          </Boton>
        </div>
      )}

      {vista === 'persona' && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={20} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿Quién era?"
              className="h-12 w-full rounded-xl bg-superficie pr-4 pl-11 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {candidatos.map((a) => (
            <Tarjeta
              key={a.id}
              onClick={() =>
                intentar(async () => {
                  const antes = asistencia.alumnoId;
                  await cambiarPersona(asistencia, a.id);
                  avisar(`Cobro pasado a ${a.nombre.split(' ')[0]}`, 'ok', antes
                    ? { texto: 'Deshacer', fn: () => cambiarPersona({ ...asistencia, alumnoId: a.id }, antes) }
                    : undefined);
                })
              }
              className="flex items-center gap-3 p-3"
            >
              <Avatar nombre={a.nombre} foto={a.foto} tam={36} />
              <span className="font-semibold">{a.nombre}</span>
            </Tarjeta>
          ))}
          <Boton bloque variante="fantasma" onClick={() => setVista('menu')}>
            Volver
          </Boton>
        </div>
      )}
    </div>
  );
}

function Opcion({ icono, titulo, sub, onClick }: { icono: React.ReactNode; titulo: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3.5 text-left last:border-0 active:bg-ink-50')}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icono}</span>
      <span className="flex-1">
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-sm text-ink-500">{sub}</span>
      </span>
      <ArrowRightLeft size={16} className="text-ink-300" />
    </button>
  );
}
