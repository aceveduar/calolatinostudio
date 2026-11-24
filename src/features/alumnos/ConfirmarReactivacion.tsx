import { useRef, useState } from 'react';
import { useAvisos } from '../../components/avisos';
import { Boton } from '../../components/ui';
import type { Alumno } from '../../db/types';
import { reactivarAlumno } from '../../domain/correcciones';

export function ConfirmarReactivacion({ alumno, onConfirmado, onCancelar }: {
  alumno: Alumno;
  onConfirmado: (alumno: Alumno) => void;
  onCancelar: () => void;
}) {
  const avisar = useAvisos();
  const enCurso = useRef(false);
  const [guardando, setGuardando] = useState(false);

  const reactivar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    try {
      const ficha = await reactivarAlumno(alumno.id);
      avisar(`Se reactivó a ${ficha.nombre}`);
      onConfirmado(ficha);
    } catch {
      avisar('No se pudo reactivar la ficha. Vuelve a buscar al alumno.', 'error');
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700"><strong>{alumno.nombre}</strong> está dado de baja. Al reactivar su ficha se conserva su historial y su código QR.</p>
      <Boton bloque type="button" disabled={guardando} onClick={reactivar}>Reactivar ficha</Boton>
      <Boton bloque type="button" variante="secundario" disabled={guardando} onClick={onCancelar}>Cancelar</Boton>
    </div>
  );
}
