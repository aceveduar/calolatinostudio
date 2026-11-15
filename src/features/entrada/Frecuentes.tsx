import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { useAlumnos, useEstadosPorAlumno } from '../../app/datos';
import { Avatar, cx } from '../../components/ui';
import { db } from '../../db/db';
import type { Alumno, Clase, ID } from '../../db/types';
import { hoy, sumarDias } from '../../domain/fechas';
import { membresiaQueCubre } from '../../domain/membresias';

const MAX = 30;

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
  vinieronHoy,
  onToque,
  onOpciones,
}: {
  clase: Clase;
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
  const [ranking, setRanking] = useState<{ claseId: ID; enClase: Map<ID, number>; general: Map<ID, number> } | null>(null);
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
        if (vivo) setRanking({ claseId: clase.id, enClase, general });
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

  // Clase nueva o sin historial: mostrar a los más asiduos de la academia
  const historicos =
    lista.length >= 6
      ? lista
      : [
          ...lista,
          ...alumnos
            .filter((a) => a.activo && !lista.includes(a) && ranking.general.has(a.id))
            .sort((x, y) => (ranking.general.get(y.id) ?? 0) - (ranking.general.get(x.id) ?? 0))
            .slice(0, MAX - lista.length),
        ];
  // Al final, quienes ya vinieron hoy (otra clase o nuevos), en orden de llegada:
  // se agregan sin mover a nadie de su lugar.
  const enLista = new Set(historicos.map((a) => a.id));
  const porId = new Map(alumnos.map((a) => [a.id, a]));
  const mostrar = [...historicos, ...vinieronHoy.filter((id) => !enLista.has(id)).flatMap((id) => (porId.get(id)?.activo ? [porId.get(id)!] : []))];

  if (!mostrar.length) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
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
        <Avatar nombre={alumno.nombre} foto={alumno.foto} tam={48} />
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
