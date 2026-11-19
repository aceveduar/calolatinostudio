import { useState } from 'react';
import { CheckCircle2, Copy, MessageCircle, Trash2 } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Tarjeta } from '../../components/ui';
import { borrarErrores, erroresRecientes, reporteErrores } from '../../app/errores';
import { useEstadoSync } from '../../sync/engine';

const NUBE: Record<string, string> = {
  'solo-local': 'sin nube',
  desconectada: 'desconectada',
  'sin-red': 'sin internet',
  sincronizando: 'sincronizando',
  'al-dia': 'al día',
  error: 'con error',
};

function equipo(): string {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'navegador';
  const app = matchMedia('(display-mode: standalone)').matches ? 'instalada' : 'en navegador';
  return `${so} · ${nav} · ${app}`;
}

/** Ajustes → Ayuda y errores: qué ha fallado en ESTE equipo y mandarlo a soporte con un toque. */
export function AyudaErrores() {
  const { academia } = useSesion();
  const { fase } = useEstadoSync();
  const avisar = useAvisos();
  const [errores, setErrores] = useState(erroresRecientes);
  const [confirmar, setConfirmar] = useState(false);
  const texto = reporteErrores(errores, { version: __APP_VERSION__, academia: academia.nombre, nube: NUBE[fase] ?? fase, equipo: equipo() });

  return (
    <div className="space-y-4">
      <p className="text-ink-500">Si algo no funciona como esperabas, manda este reporte a soporte: lleva la versión de la app, el tipo de equipo y los últimos errores. No incluye datos de alumnos ni de dinero.</p>

      {errores.length === 0 ? (
        <Tarjeta className="flex items-center gap-3 p-4">
          <CheckCircle2 size={22} className="shrink-0 text-ok-600" aria-hidden="true" />
          <span>
            <b className="block">Todo en orden</b>
            <span className="text-sm text-ink-500">No hay errores anotados en este equipo.</span>
          </span>
        </Tarjeta>
      ) : (
        <Tarjeta className="divide-y divide-ink-100">
          {errores.map((e, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-xs text-ink-500">
                {new Date(e.at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                {e.veces && e.veces > 1 ? ` · ${e.veces} veces` : ''} · {e.donde}
              </p>
              <p className="mt-0.5 font-medium break-words">{e.mensaje}</p>
            </div>
          ))}
        </Tarjeta>
      )}

      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noreferrer"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#15803d] text-lg font-bold text-white active:scale-[0.98]"
      >
        <MessageCircle size={20} aria-hidden="true" /> Mandar a soporte por WhatsApp
      </a>
      <div className="grid grid-cols-2 gap-2">
        <Boton
          bloque
          variante="secundario"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              avisar('Reporte copiado');
            } catch {
              avisar('No se pudo copiar', 'error');
            }
          }}
        >
          <Copy size={18} /> Copiar
        </Boton>
        {errores.length > 0 &&
          (confirmar ? (
            <Boton
              bloque
              variante="peligro"
              onClick={() => {
                borrarErrores();
                setErrores([]);
                setConfirmar(false);
                avisar('Lista borrada');
              }}
            >
              <Trash2 size={18} /> Sí, borrar
            </Boton>
          ) : (
            <Boton bloque variante="secundario" onClick={() => setConfirmar(true)}>
              <Trash2 size={18} /> Borrar lista
            </Boton>
          ))}
      </div>
      <p className="text-center text-xs text-ink-500">Compás v{__APP_VERSION__} · {equipo()}</p>
    </div>
  );
}
