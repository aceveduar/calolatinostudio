import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton } from '../../components/ui';
import { db, getMeta } from '../../db/db';
import type { Alumno } from '../../db/types';
import { asegurarPortal, regenerarPortal } from '../../domain/enlacePortal';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { enlacePortal } from '../../domain/portal';
import { waLink } from '../../domain/reportes';
import { sincronizar } from '../../sync/engine';

export function AccesoPaseAlumno({ alumno }: { alumno: Alumno }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [enlaceAnterior, setEnlaceAnterior] = useState<{ token: Alumno['portal'] } | null>(null);
  const respaldo = useLiveQuery(() => db.transaction('r', db.alumnos, db.meta, db.outbox, async () => ({
    token: (await db.alumnos.get(alumno.id))?.portal,
    vinculada: await getMeta<boolean>('nubeVinculada'),
    pendiente: !!await db.outbox.where('id').equals(alumno.id)
      .filter((o) => o.table === 'alumnos' && (!o.campos?.length || o.campos.includes('portal'))).first(),
  })), [alumno.id]);
  const enlace = alumno.portal ? enlacePortal(alumno.portal) : null;
  const texto = enlace ? armarMensaje(plantilla(academia, 'portal'), {
    nombre: alumno.nombre.split(' ')[0], academia: academia.nombre, codigo: alumno.codigo, enlace,
  }) : '';
  const whatsapp = enlace ? waLink(alumno.telefono, texto) : null;

  async function guardar(renovar: boolean) {
    setOcupado(true);
    try {
      const token = renovar ? await regenerarPortal(alumno.id) : await asegurarPortal(alumno);
      if (token !== alumno.portal) setEnlaceAnterior({ token: alumno.portal });
      setConfirmar(false);
    } catch {
      avisar('No se pudo guardar el enlace. Inténtalo de nuevo.', 'error');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      {!respaldo || respaldo.token !== alumno.portal || (enlaceAnterior && respaldo.token === enlaceAnterior.token)
        ? <p role="status" className="text-sm text-ink-600">Consultando el pase…</p>
        : !respaldo.vinculada ? (
          <p className="rounded-xl bg-warn-50 p-3 text-sm text-warn-600">
            <Link to="/ajustes/nube" className="font-semibold underline">Conecta este equipo a la nube</Link> para compartir el pase.
          </p>
        )
          : respaldo.pendiente ? (
            <div className="space-y-2 rounded-xl bg-warn-50 p-3 text-sm text-warn-600">
              <p role="status">El cambio del pase está guardado aquí y pendiente de sincronizar. Espera a que aparezca el botón de WhatsApp.</p>
              <Boton variante="secundario" onClick={() => void sincronizar()}>Reintentar sincronización</Boton>
            </div>
          ) : !enlace ? (
            <Boton disabled={ocupado} onClick={() => void guardar(false)}>{ocupado ? 'Creando…' : 'Crear enlace del pase'}</Boton>
          ) : confirmar ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-700">Cuando se sincronice el nuevo enlace, el anterior dejará de abrir el portal en línea. Después podrás enviar el nuevo por WhatsApp.</p>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" disabled={ocupado} onClick={() => setConfirmar(false)}>Cancelar</Boton>
                <Boton variante="peligro" disabled={ocupado} onClick={() => void guardar(true)}>{ocupado ? 'Renovando…' : 'Confirmar renovación'}</Boton>
              </div>
            </div>
          ) : (
            <>
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-4 font-bold text-white">
                  <MessageCircle size={19} aria-hidden="true" /> Enviar pase por WhatsApp
                </a>
              ) : <p className="text-sm text-ink-600">Agrega un celular a la ficha para preparar el mensaje de WhatsApp.</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Boton variante="secundario" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(enlace);
                    avisar('Enlace copiado');
                  } catch {
                    avisar('Abre el pase y copia la dirección del navegador.', 'error');
                  }
                }}><Copy size={16} aria-hidden="true" /> Copiar enlace</Boton>
                <a href={enlace} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-600">
                  <ExternalLink size={16} aria-hidden="true" /> Abrir pase
                </a>
              </div>
              <button type="button" onClick={() => setConfirmar(true)} className="min-h-11 text-left text-sm font-semibold text-ink-600 underline underline-offset-4">Renovar enlace del pase</button>
            </>
          )}
    </div>
  );
}
