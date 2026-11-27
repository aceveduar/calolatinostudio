import { useMemo, useRef, useState } from 'react';
import { useAlumnos } from '../../app/datos';
import { mismoTelefono, NOMBRE_ANONIMO, parecidos } from '../../domain/correcciones';
import { useAvisos } from '../../components/avisos';
import { Boton, Campo, Entrada, Etiqueta } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import type { Alumno } from '../../db/types';
import { generarCodigo } from '../../domain/operaciones';
import { consultaTelefono, digitosTelefono } from '../../domain/telefono';
import { ConfirmarReactivacion } from './ConfirmarReactivacion';

export function FormAlumno({
  alumno,
  nombreInicial = '',
  archivados,
  onGuardado,
}: {
  alumno?: Alumno;
  nombreInicial?: string;
  archivados?: ReadonlySet<string>;
  onGuardado: (a: Alumno, creado: boolean) => void;
}) {
  const [nombre, setNombre] = useState(alumno?.nombre ?? nombreInicial);
  const [telefono, setTelefono] = useState(alumno?.telefono ?? '');
  const [notas, setNotas] = useState(alumno?.notas ?? '');
  const alumnos = useAlumnos();
  const mismoTel = useMemo(() => mismoTelefono(telefono, alumnos, alumno?.id), [telefono, alumnos, alumno?.id]);
  const cambioTelefono = !!alumno && consultaTelefono(telefono) !== consultaTelefono(alumno.telefono);
  const telefonoCompartido = cambioTelefono && mismoTel.length > 0;
  const coincidencias = useMemo(() => {
    if (alumno) return [];
    const similares = parecidos(nombre, alumnos.filter((a) => a.nombre !== NOMBRE_ANONIMO));
    const porId = new Map([...similares, ...mismoTel].map((a) => [a.id, a]));
    return [...porId.values()];
  }, [alumno, alumnos, mismoTel, nombre]);
  const [porReactivar, setPorReactivar] = useState<Alumno | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enCurso = useRef(false);
  const avisar = useAvisos();
  const requiereConfirmacion = coincidencias.length > 0 || telefonoCompartido;
  const firma = JSON.stringify([nombre, telefono, (alumno ? mismoTel : coincidencias).map((a) => a.id)]);
  const porConfirmar = requiereConfirmacion && confirmacion === firma;

  const guardar = async () => {
    if (enCurso.current || !nombre.trim()) return;
    if (requiereConfirmacion && confirmacion !== firma) {
      setConfirmacion(firma);
      return;
    }
    enCurso.current = true;
    setGuardando(true);
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: digitosTelefono(telefono), notas: notas.trim() };
    try {
      const a = alumno
        ? await actualizar('alumnos', alumno.id, datos)
        : await crear('alumnos', { ...datos, codigo: generarCodigo(), activo: true });
      onGuardado(a, !alumno);
      if (cambioTelefono) {
        avisar(a.telefono ? 'Celular actualizado. Puedes reenviar su enlace desde Compartir pase.' : 'Celular quitado de la ficha.');
      }
    } catch {
      avisar('No se pudo guardar la ficha. Intenta de nuevo.', 'error');
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  };

  if (porReactivar) {
    return <ConfirmarReactivacion alumno={porReactivar} onConfirmado={(a) => onGuardado(a, false)} onCancelar={() => setPorReactivar(null)} />;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!porConfirmar) void guardar();
      }}
    >
      <Campo etiqueta="Nombre completo">
        <Entrada autoFocus value={nombre} onChange={(e) => { setNombre(e.target.value); setConfirmacion(null); }} placeholder="Nombre y apellido" required />
      </Campo>
      <Campo etiqueta="Celular o WhatsApp (opcional)" ayuda="Para compartir su pase y enviarle avisos.">
        <Entrada type="tel" inputMode="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); setConfirmacion(null); }} placeholder="10 dígitos" />
      </Campo>
      {telefonoCompartido && (
        <p className="-mt-2 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-600">
          Este celular ya aparece en la ficha de {mismoTel.slice(0, 3).map((a) => a.nombre).join(', ')}
          {mismoTel.length > 3 ? ` y ${mismoTel.length - 3} más` : ''}. Verifica el número antes de guardar.
        </p>
      )}
      {coincidencias.length > 0 && (
        <div className="space-y-2 rounded-xl bg-warn-50 p-3">
          <p className="text-sm font-semibold text-warn-600">¿Ya tiene ficha?</p>
          {coincidencias.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-superficie p-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold">{a.nombre}</p>
                <p className="text-xs text-ink-500">{[a.telefono, a.codigo].filter(Boolean).join(' · ')}</p>
                <Etiqueta tono={a.activo ? 'neutro' : 'pronto'}>{!a.activo ? 'De baja' : archivados?.has(a.id) ? 'Archivado' : 'Activo'}</Etiqueta>
              </div>
              <Boton type="button" variante="secundario" disabled={guardando} onClick={() => a.activo ? onGuardado(a, false) : setPorReactivar(a)}>
                {a.activo ? 'Usar ficha' : 'Reactivar'}
              </Boton>
            </div>
          ))}
        </div>
      )}
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. viene con su pareja" />
      </Campo>
      {porConfirmar && (
        <p role="status" className="text-sm text-warn-600">
          {alumno ? 'Confirma que las personas comparten este celular.' : 'Confirma que es otra persona antes de crear la ficha.'}
        </p>
      )}
      <Boton grande bloque type={porConfirmar ? 'button' : 'submit'} onClick={porConfirmar ? guardar : undefined} disabled={guardando || !nombre.trim()}>
        {alumno
          ? porConfirmar ? 'Confirmar celular compartido' : 'Guardar cambios'
          : coincidencias.length === 0 ? 'Registrar alumno' : porConfirmar ? 'Confirmar nueva ficha' : 'Registrar a otra persona'}
      </Boton>
    </form>
  );
}
