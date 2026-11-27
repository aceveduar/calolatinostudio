import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCheck, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../app/sesion';
import { Boton, Encabezado, Tarjeta } from '../../components/ui';
import { sincronizar } from '../../sync/engine';
import { supabase } from '../../sync/supabase';
import { actualizarConteoDeCampana, altasNuevas, marcarAltasVistas, type Campana } from './seguimientoAlta';

export function CampanaAlta() {
  const { academia, usuario } = useSesion();
  const [campana, setCampana] = useState<Campana | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [avisoAltas, setAvisoAltas] = useState('');
  const [nuevas, setNuevas] = useState(0);
  const [actualizado, setActualizado] = useState<number | null>(null);
  const opcionesEnlace = useRef<HTMLDetailsElement>(null);
  const campoEnlace = useRef<HTMLInputElement>(null);

  const gestionar = useCallback(async (accion: 'estado' | 'abrir' | 'cerrar') => {
    setCargando(true);
    setError('');
    setAviso('');
    setAvisoAltas('');
    try {
      if (!supabase) {
        setError('Vincula este equipo a la nube de la academia para habilitar el registro por enlace.');
        return;
      }
      const { data, error } = await supabase.rpc('gestionar_alta_grupal', { p_academia: academia.id, p_accion: accion })
        .abortSignal(AbortSignal.timeout(12_000));
      if (error) {
        setError(error.code === 'PGRST202' ? 'El registro por enlace aún no está habilitado en la base de datos.'
          : ['42501', 'PGRST301'].includes(error.code) ? 'Abre la sesión de la academia en un equipo vinculado para gestionar el enlace.'
            : 'No pudimos consultar el registro. Revisa tu conexión e inténtalo de nuevo.');
        return;
      }
      const actual = data as Campana | null;
      actualizarConteoDeCampana(academia.id, actual);
      setCampana((anterior) => actual && anterior?.token === actual.token && !actual.recientes
        ? { ...actual, recientes: anterior.recientes } : actual);
      setNuevas(actual ? altasNuevas(actual, academia.id, usuario.id) : 0);
      setActualizado(Date.now());
      setConfirmar(false);
      if (accion === 'cerrar') setAviso('Registro cerrado. Los pases que ya se crearon siguen funcionando.');
      if (accion === 'estado') void sincronizar();
    } catch {
      setError('No pudimos consultar el registro. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  }, [academia.id, usuario.id]);

  useEffect(() => { void gestionar('estado'); }, [gestionar]);

  const enlace = campana?.abierta ? new URL(`/alta/${campana.token}`, location.origin).href : '';
  const fecha = campana ? new Date(campana.vence).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : '';

  async function copiarMensaje() {
    const mensaje = `Hola, alumnos de ${academia.nombre}. Regístrense antes del ${fecha} para crear su pase personal. Entren con su nombre y celular. Este enlace es para el grupo de la academia, por favor no lo reenvíen.\n\n${enlace}`;
    try {
      await navigator.clipboard.writeText(mensaje);
      setAviso('Mensaje copiado. Pégalo en el grupo de WhatsApp.');
    } catch {
      if (opcionesEnlace.current) opcionesEnlace.current.open = true;
      campoEnlace.current?.focus();
      setAviso('Copia el enlace seleccionado y pégalo en WhatsApp.');
    }
  }

  function marcarVistas() {
    if (!campana) return;
    if (marcarAltasVistas(campana, academia.id, usuario.id)) {
      setNuevas(0);
      setAvisoAltas('Altas marcadas como vistas en este navegador.');
    } else {
      setAvisoAltas('Este navegador no pudo guardar las altas vistas.');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-8">
      <Link to="/alumnos" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-600"><ArrowLeft size={16} aria-hidden="true" /> Alumnos</Link>
      <div className="-mx-4"><Encabezado titulo="Registro por enlace" /></div>
      <Tarjeta className="space-y-4 p-5">
        {error && !campana && <p role="alert" className="text-sm text-brand-600">{error}</p>}
        {cargando && <p role="status" className="text-sm text-ink-600">Consultando el registro…</p>}
        {!error && campana?.abierta && (
          <>
            <div className="space-y-1">
              <p className={campana.altas >= 1000 ? 'font-bold text-warn-600' : 'font-bold text-ok-600'}>{campana.altas >= 1000 ? 'Cupo alcanzado' : 'Registro abierto'}</p>
              <p className="text-sm text-ink-600">Cierra el <time dateTime={new Date(campana.vence).toISOString()}>{fecha}</time></p>
            </div>
            {campana.altas < 1000 && (
              <div className="space-y-1">
                <Boton bloque disabled={cargando} onClick={() => void copiarMensaje()}><Copy size={16} aria-hidden="true" /> Copiar mensaje para WhatsApp</Boton>
                <details ref={opcionesEnlace} className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold text-brand-600 [&::-webkit-details-marker]:hidden">
                    Ver enlace y formulario
                    <ChevronRight size={16} className="group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <label className="block text-sm font-semibold">
                    Enlace para alumnos
                    <input ref={campoEnlace} readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-xl bg-ink-50 p-3 font-normal" />
                  </label>
                  <a href={enlace} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-600 underline">Ver formulario del alumno</a>
                </details>
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
                <Boton variante="secundario" disabled={cargando} onClick={() => setConfirmar(true)}>Cerrar registro</Boton>
              </div>
            )}
          </>
        )}
        {!error && !cargando && !campana?.abierta && (
          <div className="space-y-3">
            <p className="font-bold">Registro cerrado</p>
            <p className="text-sm text-ink-600">Abre el registro para compartir un enlace en WhatsApp. Cada alumno recibe su pase al registrarse.</p>
            <Boton bloque onClick={() => void gestionar('abrir')}>Abrir registro por 7 días</Boton>
          </div>
        )}
        {error && !campana && <Boton variante="secundario" disabled={cargando} onClick={() => void gestionar('estado')}>Reintentar</Boton>}
        {aviso && <p role="status" className="text-sm font-semibold">{aviso}</p>}
      </Tarjeta>
      {campana && (
        <Tarjeta className="mt-4 space-y-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-extrabold">Altas recientes</h2>
              {nuevas > 0 && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-600">
                  {nuevas.toLocaleString('es-MX')} {nuevas === 1 ? 'nueva' : 'nuevas'}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-600">
              {campana.altas.toLocaleString('es-MX')} {campana.altas === 1 ? 'alta' : 'altas'} en esta campaña
            </p>
            {actualizado !== null && (
              <p className="mt-1 text-xs text-ink-600">
                Última consulta{' '}
                <time dateTime={new Date(actualizado).toISOString()}>
                  {new Date(actualizado).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </time>
              </p>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-warn-600">{error} Mostramos el último conteo disponible.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" className="min-h-11 gap-1.5 px-2.5 text-sm" aria-label={error ? 'Reintentar consulta de altas' : 'Actualizar altas'} disabled={cargando} onClick={() => void gestionar('estado')}><RefreshCw size={14} aria-hidden="true" /> {error ? 'Reintentar' : 'Actualizar'}</Boton>
            {!error && nuevas > 0 && campana.recientes && (
              <Boton variante="fantasma" className="min-h-11 gap-1.5 px-2.5 text-sm" aria-label="Marcar como vistas todas las altas nuevas" disabled={cargando} onClick={marcarVistas}>
                <CheckCheck size={14} aria-hidden="true" /> Marcar como vistas
              </Boton>
            )}
          </div>
          {avisoAltas && <p role="status" className="text-sm font-semibold">{avisoAltas}</p>}
          {campana.recientes?.length ? (
            <ul className="divide-y divide-ink-100">
              {campana.recientes.map((alta) => (
                <li key={alta.id}>
                  <Link to={`/alumnos/${alta.id}`} className="flex min-h-12 items-center justify-between gap-2 py-2">
                    <span className="min-w-0 break-words">
                      <span className="block text-sm font-semibold">{alta.nombre}</span>
                      <time dateTime={new Date(alta.alta).toISOString()} className="block text-xs text-ink-600">
                        {new Date(alta.alta).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </time>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-ink-500" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">{campana.altas ? 'Actualiza para consultar las altas recientes.' : 'Aquí aparecerán los alumnos que se registren.'}</p>
          )}
        </Tarjeta>
      )}
    </div>
  );
}
