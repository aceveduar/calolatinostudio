import { useState } from 'react';
import { Boton, Campo, Entrada } from '../../components/ui';
import { actualizar, crear } from '../../db/repo';
import type { Alumno } from '../../db/types';
import { generarCodigo } from '../../domain/operaciones';

export function FormAlumno({
  alumno,
  nombreInicial = '',
  onGuardado,
}: {
  alumno?: Alumno;
  nombreInicial?: string;
  onGuardado: (a: Alumno) => void;
}) {
  const [nombre, setNombre] = useState(alumno?.nombre ?? nombreInicial);
  const [telefono, setTelefono] = useState(alumno?.telefono ?? '');
  const [notas, setNotas] = useState(alumno?.notas ?? '');

  const guardar = async () => {
    const datos = { nombre: nombre.trim().replace(/\s+/g, ' '), telefono: telefono.replace(/\D/g, ''), notas: notas.trim() };
    const a = alumno
      ? await actualizar('alumnos', alumno.id, datos)
      : await crear('alumnos', { ...datos, codigo: generarCodigo(), activo: true });
    onGuardado(a);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <Campo etiqueta="Nombre completo">
        <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" required />
      </Campo>
      <Campo etiqueta="WhatsApp (opcional)" ayuda="Para mandarle recordatorios de pago.">
        <Entrada type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="10 dígitos" />
      </Campo>
      <Campo etiqueta="Notas (opcional)">
        <Entrada value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. viene con su pareja" />
      </Campo>
      <Boton grande bloque type="submit" disabled={!nombre.trim()}>
        {alumno ? 'Guardar cambios' : 'Registrar alumno'}
      </Boton>
    </form>
  );
}
