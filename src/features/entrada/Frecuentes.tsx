import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useAlumnos, useEstadosPorAlumno } from '../../app/datos';
import { Avatar, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { hoy, sumarDias } from '../../domain/fechas';
import { membresiaQueCubre } from '../../domain/membresias';
import { nombresSinRepetir } from '../../domain/nombres';

const MAX = 30;

/**
 * Los alumnos que suelen venir a esta clase, en un orden que no cambia mientras se cobra
 * (memoria muscular: Monse aprende dónde está cada quien, y un toque nunca cae en otra persona).
 * Solo en momentos seguros (al abrir la Entrada o cambiar de clase) quienes ya entraron pasan al final.
 * Toque = entrada/cobro rápido · mantener presionado = todas las opciones.
 */
export function Frecuentes({
  clase,
  precioClase,
  adentro,
  vinieronHoy,
  onToque,
  onOpciones,
}: {
  clase: Clase;
  precioClase?: number;
  adentro: Set<ID>;
  /** alumnos con entrada hoy en cualquier clase, en orden de llegada */
  vinieronHoy: ID[];
  onToque: (a: Alumno) => void;
  onOpciones: (a: Alumno) => void;
}) {
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();

  // Ranking con la historia ANTERIOR a hoy, calculado una vez por clase (no en vivo):
  // así el orden no se mueve mientras se cobra y no se recorre el historial en cada toque.
  const [ranking, setRanking] = useState<{ claseId: ID; enClase: Map<ID, number>; general: Map<ID, number>; yaAdentro: Set<ID> } | null>(null);
  // quiénes estaban adentro al abrir: esos van al final; los que se marcan después se quedan en su lugar
  const adentroAhora = useRef(adentro);
  adentroAhora.current = adentro;
  useEffect(() => {
    let vivo = true;
    const dia = hoy();
    void db.asistencias
      .where('fecha')
      .between(sumarDias(dia, -56), dia, true, false)
      .filter((a) => !!a.alumnoId && !a.anuladaAt && !a.deletedAt)
      .toArray()
      .then((asis) => {
        const enClase = new Map<ID, number>();
        const general = new Map<ID, number>();
        for (const a of asis) {
          general.set(a.alumnoId!, (general.get(a.alumnoId!) ?? 0) + 1);
          if (a.claseId === clase.id) enClase.set(a.alumnoId!, (enClase.get(a.alumnoId!) ?? 0) + 1);
        }
        if (vivo) setRanking({ claseId: clase.id, enClase, general, yaAdentro: new Set(adentroAhora.current) });
      });
    return () => {
      vivo = false;
    };
  }, [clase.id]);

  if (!ranking || ranking.claseId !== clase.id) return null;

  const lista = alumnos
    .filter((a) => a.activo && ranking.enClase.has(a.id))
    .sort((x, y) => (ranking.enClase.get(y.id) ?? 0) - (ranking.enClase.get(x.id) ?? 0) || x.nombre.localeCompare(y.nombre))
    .slice(0, MAX);

  // Quien tiene un plan que cubre esta clase es de los que más seguro llegan, aunque aún no tenga historial
  // (p. ej. los primeros días, con los planes que ya traían): después de los que ya vienen, por nombre.
  const conPlan = alumnos
    .filter((a) => a.activo && !ranking.enClase.has(a.id) && !!membresiaQueCubre(estados.get(a.id) ?? [], clase))
    .slice(0, Math.max(0, MAX - lista.length));
  const base = [...lista, ...conPlan];
  // Clase nueva o sin historial: mostrar a los más asiduos de la academia
  const historicos =
    base.length >= 6
      ? base
      : [
          ...base,
          ...alumnos
            .filter((a) => a.activo && !base.includes(a) && ranking.general.has(a.id))
            .sort((x, y) => (ranking.general.get(y.id) ?? 0) - (ranking.general.get(x.id) ?? 0))
            .slice(0, MAX - base.length),
        ];
  // Al final, quienes ya vinieron hoy (otra clase o nuevos), en orden de llegada:
  // se agregan sin mover a nadie de su lugar.
  const enLista = new Set(historicos.map((a) => a.id));
  const porId = new Map(alumnos.map((a) => [a.id, a]));
  const todos = [...historicos, ...vinieronHoy.filter((id) => !enLista.has(id)).flatMap((id) => (porId.get(id)?.activo ? [porId.get(id)!] : []))];
  const mostrar = [...todos.filter((a) => !ranking.yaAdentro.has(a.id)), ...todos.filter((a) => ranking.yaAdentro.has(a.id))];

  // hay alumnos pero nadie con historial ni plan para esta clase (los primeros días): decir qué hacer
  if (!mostrar.length)
    return alumnos.length ? (
      <p className="rounded-2xl bg-superficie px-4 py-5 text-center text-sm text-ink-500 ring-1 ring-ink-100">
        Aquí aparecen solos quienes suelen venir a esta clase o tienen plan para ella.
        <br />
        Mientras tanto, escribe arriba el nombre de quien llegó.
      </p>
    ) : null;
  // dos "Camila R." en la cuadrícula: se distinguen con el apellido completo
  const etiquetas = nombresSinRepetir(mostrar);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
      {mostrar.map((a) => {
        const entro = adentro.has(a.id);
        const plan = !!membresiaQueCubre(estados.get(a.id) ?? [], clase);
        const accion = entro ? 'Adentro' : plan ? 'Plan'
          : precioClase === undefined ? 'Sin tarifa' : `Cobrar ${dinero(precioClase)}`;
        return (
          <Ficha key={a.id} alumno={a} etiqueta={etiquetas.get(a.id) ?? a.nombre} entro={entro} plan={plan} accion={accion} onToque={() => onToque(a)} onOpciones={() => onOpciones(a)} />
        );
      })}
    </div>
  );
}

function Ficha({ alumno, etiqueta, entro, plan, accion, onToque, onOpciones }: { alumno: Alumno; etiqueta: string; entro: boolean; plan: boolean; accion: string; onToque: () => void; onOpciones: () => void }) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const largo = useRef(false);

  const inicio = () => {
    largo.current = false;
    t.current = setTimeout(() => {
      largo.current = true;
      navigator.vibrate?.(15);
      onOpciones();
    }, 450);
  };
  const fin = () => clearTimeout(t.current);

  return (
    <button
      onPointerDown={inicio}
      onPointerUp={fin}
      onPointerLeave={fin}
      onPointerCancel={fin}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => !largo.current && onToque()}
      className={cx(
        'relative flex flex-col items-center gap-1.5 rounded-2xl px-1 pt-3 pb-2.5 ring-1 transition select-none active:scale-95 [-webkit-touch-callout:none]',
        entro ? 'bg-ok-50/60 ring-ok-600/15' : 'bg-superficie ring-ink-100',
      )}
    >
      <span className={cx('relative', entro && 'opacity-50')}>
        <Avatar nombre={alumno.nombre} foto={alumno.foto} tam={48} />
        {entro && (
          <span className="absolute -right-1 -bottom-1 flex h-6 w-6 animate-pop items-center justify-center rounded-full bg-ok-600 text-white ring-2 ring-ok-50">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </span>
      {/* hasta 2 renglones: si se agrega el apellido para distinguir, que no se corte justo esa parte */}
      <span className={cx('line-clamp-2 w-full px-1 text-center text-sm leading-tight font-semibold break-words', entro && 'text-ink-500')}>{etiqueta}</span>
      <span className={cx('text-center text-[11px] font-bold', entro || plan ? 'text-ok-600' : 'text-brand-600')}>
        {accion}
      </span>
    </button>
  );
}
