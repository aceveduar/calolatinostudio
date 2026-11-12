import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { useAlumnos, useEstadosPorAlumno } from '../../app/datos';
import { Avatar, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID } from '../../db/types';
import { hoy, sumarDias } from '../../domain/fechas';
import { membresiaQueCubre } from '../../domain/membresias';

const MAX = 24;

/** Nombre corto para la cuadrícula: "Ana López" → "Ana L." */
export function nombreCorto(n: string): string {
  const [a, b] = n.trim().split(/\s+/);
  return b ? `${a} ${b[0]}.` : a;
}

/**
 * Los alumnos que suelen venir a esta clase, en un orden que no cambia durante el día
 * (memoria muscular: Monse aprende dónde está cada quien).
 * Toque = entrada/cobro rápido · mantener presionado = todas las opciones.
 */
export function Frecuentes({
  clase,
  adentro,
  onToque,
  onOpciones,
}: {
  clase: Clase;
  adentro: Set<ID>;
  onToque: (a: Alumno) => void;
  onOpciones: (a: Alumno) => void;
}) {
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();

  const ranking = useLiveQuery(
    async () => {
      const desde = sumarDias(hoy(), -56);
      const asis = await db.asistencias.where('fecha').aboveOrEqual(desde).filter((a) => !!a.alumnoId && !a.anuladaAt && !a.deletedAt).toArray();
      const enClase = new Map<ID, number>();
      const general = new Map<ID, number>();
      for (const a of asis) {
        general.set(a.alumnoId!, (general.get(a.alumnoId!) ?? 0) + 1);
        if (a.claseId === clase.id) enClase.set(a.alumnoId!, (enClase.get(a.alumnoId!) ?? 0) + 1);
      }
      return { enClase, general };
    },
    [clase.id],
  );

  if (!ranking) return null;

  const lista = alumnos
    .filter((a) => a.activo && (ranking.enClase.has(a.id) || adentro.has(a.id)))
    .sort((x, y) => (ranking.enClase.get(y.id) ?? 0) - (ranking.enClase.get(x.id) ?? 0) || x.nombre.localeCompare(y.nombre))
    .slice(0, MAX);

  // Clase nueva o sin historial: mostrar a los más asiduos de la academia
  const mostrar =
    lista.length >= 6
      ? lista
      : [
          ...lista,
          ...alumnos
            .filter((a) => a.activo && !lista.includes(a) && ranking.general.has(a.id))
            .sort((x, y) => (ranking.general.get(y.id) ?? 0) - (ranking.general.get(x.id) ?? 0))
            .slice(0, MAX - lista.length),
        ];

  if (!mostrar.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {mostrar.map((a) => {
        const entro = adentro.has(a.id);
        const plan = !!membresiaQueCubre(estados.get(a.id) ?? [], clase);
        return (
          <Ficha key={a.id} alumno={a} entro={entro} plan={plan} onToque={() => onToque(a)} onOpciones={() => onOpciones(a)} />
        );
      })}
    </div>
  );
}

function Ficha({ alumno, entro, plan, onToque, onOpciones }: { alumno: Alumno; entro: boolean; plan: boolean; onToque: () => void; onOpciones: () => void }) {
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
        entro ? 'bg-ok-50 ring-ok-600/20' : 'bg-superficie ring-ink-100',
      )}
    >
      <span className={cx('relative', entro && 'opacity-50')}>
        <Avatar nombre={alumno.nombre} tam={48} />
        {entro && (
          <span className="absolute -right-1 -bottom-1 flex h-6 w-6 animate-pop items-center justify-center rounded-full bg-ok-600 text-white ring-2 ring-ok-50">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="w-full truncate px-1 text-center text-sm leading-tight font-semibold">{nombreCorto(alumno.nombre)}</span>
      <span className={cx('text-[11px] font-bold', entro ? 'text-ok-600' : plan ? 'text-ok-600' : 'text-brand-600')}>
        {entro ? 'Adentro' : plan ? 'Plan' : 'Paga'}
      </span>
    </button>
  );
}
