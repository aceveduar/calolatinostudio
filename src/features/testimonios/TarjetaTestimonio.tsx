import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Quote } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Tarjeta } from '../../components/ui';
import type { Alumno, Testimonio } from '../../db/types';
import { fechaCorta } from '../../domain/fechas';
import { nombrePublico } from '../../domain/nombres';
import { noPublicar, publicarTestimonio, volverAPendiente } from '../../domain/testimonios';

/**
 * Un testimonio por revisar: el texto, quién lo escribió y cómo se verá en la página, con Publicar / No publicar.
 * `conFicha`: enlazar a la ficha del alumno (el maestro no tiene fichas).
 */
export function TarjetaTestimonio({ t, alumno, conFicha = true }: { t: Testimonio; alumno: Alumno | undefined; conFicha?: boolean }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const [ocupado, setOcupado] = useState(false);
  const nombre = alumno?.nombre ?? 'Alumno';
  const accion = async (fn: () => Promise<unknown>, ok: string, deshacer?: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await fn();
      avisar(ok, 'ok', deshacer ? { texto: 'Deshacer', fn: () => deshacer().then(() => undefined) } : undefined);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo', 'error');
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center gap-3">
        {alumno && conFicha ? (
          <Link to={`/alumnos/${alumno.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar nombre={nombre} foto={alumno.foto} tam={40} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{nombre}</span>
              <span className="block text-xs text-ink-500">Escribió el {fechaCorta(new Date(t.createdAt).toISOString().slice(0, 10))}</span>
            </span>
          </Link>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar nombre={nombre} foto={alumno?.foto} tam={40} />
            <span className="truncate font-semibold">{nombre}</span>
          </span>
        )}
      </div>
      <blockquote className="mt-3 flex gap-2 rounded-2xl bg-ink-50 p-3 text-[15px] leading-relaxed">
        <Quote size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
        <span>{t.texto}</span>
      </blockquote>
      {t.estado === 'pendiente' ? (
        <>
          <p className="mt-2 text-xs text-ink-500">
            En la página aparecerá como <b className="text-ink-700">{nombrePublico(nombre)}</b> (sin apellido completo).
          </p>
          <div className="mt-3 flex gap-2">
            <Boton variante="secundario" disabled={ocupado} onClick={() => accion(() => noPublicar(t, usuario.id), 'No se publicará', () => volverAPendiente(t))}>
              No publicar
            </Boton>
            <Boton className="flex-1" disabled={ocupado} onClick={() => accion(() => publicarTestimonio(t, usuario.id), 'Publicado en tu página')}>
              Publicar
            </Boton>
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs font-semibold text-ink-500">
          {t.estado === 'aprobado' ? 'Publicado' : 'Oculto: no se publicó'}
          {t.revisadoAt ? ` · ${fechaCorta(new Date(t.revisadoAt).toISOString().slice(0, 10))}` : ''}
        </p>
      )}
    </Tarjeta>
  );
}
