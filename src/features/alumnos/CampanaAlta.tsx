import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../app/sesion';
import { Boton, Encabezado, Tarjeta } from '../../components/ui';
import { sincronizar } from '../../sync/engine';
import { supabase } from '../../sync/supabase';

interface Campana {
  token: string;
  vence: string;
  altas: number;
  abierta: boolean;
}

export function CampanaAlta() {
  const { academia } = useSesion();
  const [campana, setCampana] = useState<Campana | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const gestionar = useCallback(async (accion: 'estado' | 'abrir' | 'cerrar') => {
    setCargando(true);
    setError('');
    setAviso('');
    try {
      if (!supabase) {
        setError('Vincula este equipo a la nube de la academia para habilitar el registro por enlace.');
        return;
      }
      const { data, error } = await supabase.rpc('gestionar_alta_grupal', { p_academia: academia.id, p_accion: accion });
      if (error) {
        setError(error.code === 'PGRST202' ? 'El registro por enlace aún no está habilitado en la base de datos.'
          : ['42501', 'PGRST301'].includes(error.code) ? 'Abre la sesión de la academia en un equipo vinculado para gestionar el enlace.'
            : 'No pudimos consultar el registro. Revisa tu conexión e inténtalo de nuevo.');
        return;
      }
      setCampana(data as Campana | null);
      setConfirmar(false);
      if (accion === 'cerrar') setAviso('Registro cerrado. Los pases que ya se crearon siguen funcionando.');
      if (accion === 'estado') void sincronizar();
    } catch {
      setError('No pudimos consultar el registro. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [academia.id]);

  useEffect(() => { void gestionar('estado'); }, [gestionar]);

  const enlace = campana?.abierta ? new URL(`/alta/${campana.token}`, location.origin).href : '';
  const fecha = campana ? new Date(campana.vence).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '';

  async function copiarMensaje() {
    const mensaje = `Hola, alumnos de ${academia.nombre}. Regístrense antes del ${fecha} para crear su pase personal. Entren con su nombre y celular. Este enlace es para el grupo de la academia, por favor no lo reenvíen.\n\n${enlace}`;
    try {
      await navigator.clipboard.writeText(mensaje);
      setAviso('Mensaje copiado. Pégalo en el grupo de WhatsApp.');
    } catch {
      setAviso('Selecciona y copia el enlace del campo de abajo.');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-8">
      <Link to="/alumnos" className="mt-4 inline-block text-sm font-semibold text-brand-600">← Alumnos</Link>
      <div className="-mx-4"><Encabezado titulo="Registro por enlace" /></div>
      <Tarjeta className="space-y-4 p-5">
        <p className="text-sm text-ink-600">Comparte un solo enlace en el grupo de WhatsApp. Cada alumno se registra y recibe su pase al momento.</p>
        {error && <p role="alert" className="text-sm text-brand-600">{error}</p>}
        {cargando && <p role="status" className="text-sm text-ink-600">Consultando el registro…</p>}
        {!error && campana?.abierta && (
          <>
            <div>
              <p className="font-bold">{campana.altas >= 1000 ? 'Cupo alcanzado' : 'Registro abierto'}</p>
              <p className="text-sm text-ink-600">Cierra el {fecha} · {campana.altas} altas en esta campaña</p>
            </div>
            {campana.altas < 1000 && (
              <div className="space-y-2">
                <Boton disabled={cargando} onClick={() => void copiarMensaje()}>Copiar mensaje para WhatsApp</Boton>
                <label className="block text-sm font-semibold">
                  Enlace para alumnos
                  <input readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-xl bg-brand-50 p-3 font-normal" />
                </label>
                <a href={enlace} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 underline">Ver formulario del alumno</a>
              </div>
            )}
            {confirmar ? (
              <div className="space-y-2 rounded-xl bg-brand-50 p-3">
                <p className="text-sm">El enlace dejará de aceptar altas. Quienes ya tienen pase podrán seguir usándolo.</p>
                <div className="flex flex-wrap gap-2">
                  <Boton disabled={cargando} onClick={() => void gestionar('cerrar')}>Confirmar cierre</Boton>
                  <Boton variante="secundario" disabled={cargando} onClick={() => setConfirmar(false)}>Cancelar</Boton>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" disabled={cargando} onClick={() => void gestionar('estado')}>Actualizar conteo</Boton>
                <Boton variante="secundario" disabled={cargando} onClick={() => setConfirmar(true)}>Cerrar registro</Boton>
              </div>
            )}
          </>
        )}
        {!error && !cargando && !campana?.abierta && (
          <Boton onClick={() => void gestionar('abrir')}>Abrir registro por 7 días</Boton>
        )}
        {error && <Boton variante="secundario" disabled={cargando} onClick={() => void gestionar('estado')}>Reintentar</Boton>}
        {aviso && <p role="status" className="text-sm font-semibold">{aviso}</p>}
      </Tarjeta>
    </div>
  );
}
