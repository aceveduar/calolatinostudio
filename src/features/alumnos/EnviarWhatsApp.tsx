import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { usePlanes } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { db } from '../../db/db';
import type { Alumno } from '../../db/types';
import { dinero } from '../../domain/dinero';
import { fechaCorta, fechaLarga, hoy } from '../../domain/fechas';
import type { EstadoMembresia } from '../../domain/membresias';
import { MENSAJES, armarMensaje, plantilla, type ClaveMensaje } from '../../domain/mensajes';
import { waLink } from '../../domain/reportes';
import { enlacePortal } from '../../domain/portal';
import { asegurarPortal, regenerarPortal } from '../../domain/enlacePortal';
import { useAvisos } from '../../components/avisos';
import { useAdeudos } from '../../app/adeudos';
import { useEstadoSync } from '../../sync/engine';
import { Link } from 'react-router-dom';

/** Datos del alumno para llenar los mensajes. */
function useDatosMensaje(alumno: Alumno, estados: EstadoMembresia[]) {
  const { academia } = useSesion();
  const planes = usePlanes();
  const ultimoPlan = useLiveQuery(
    async () => {
      const pagos = (await db.pagos.where('alumnoId').equals(alumno.id).filter((p) => !p.anuladoAt && !p.deletedAt).toArray()).sort((a, b) => b.createdAt - a.createdAt);
      for (const p of pagos) {
        const m = await db.membresias.where('alumnoId').equals(alumno.id).filter((x) => x.pagoId === p.id && !x.anuladaAt && !x.deletedAt).first();
        if (m) return { pago: p, membresia: m };
      }
      return null;
    },
    [alumno.id],
  );
  const vigente = estados.filter((e) => e.vigente).sort((a, b) => (a.membresia.fin < b.membresia.fin ? 1 : -1))[0];
  const mem = vigente?.membresia ?? ultimoPlan?.membresia;
  return {
    academia,
    datos: {
      nombre: alumno.nombre.split(' ')[0],
      academia: academia.nombre,
      codigo: alumno.codigo,
      enlace: alumno.portal ? enlacePortal(alumno.portal) : undefined,
      plan: mem ? (planes.find((p) => p.id === mem.planId)?.nombre ?? 'plan').toLowerCase() : undefined,
      vence: mem ? fechaLarga(mem.fin) : undefined,
      vigencia: mem ? `${fechaCorta(mem.inicio)} al ${fechaCorta(mem.fin)}` : undefined,
      monto: ultimoPlan ? dinero(ultimoPlan.pago.monto) : undefined,
    },
    tienePlan: !!mem,
    tieneRecibo: !!ultimoPlan,
    vencido: !!mem && mem.fin < hoy(),
  };
}

/** Elegir qué mensaje mandar: se abre WhatsApp con el texto ya escrito. */
export function EnviarWhatsApp({ alumno, estados, onEnviado }: { alumno: Alumno; estados: EstadoMembresia[]; onEnviado: () => void }) {
  const { academia, datos, tienePlan, tieneRecibo, vencido } = useDatosMensaje(alumno, estados);
  const avisar = useAvisos();
  const { total: debe } = useAdeudos(alumno.id);
  // El enlace del portal se crea al abrir esta hoja, para que el mensaje ya lo lleve al tocarlo
  useEffect(() => {
    if (!alumno.portal) void asegurarPortal(alumno);
  }, [alumno]);
  // El portal lo abre la nube: si este equipo no respalda, el enlace (recién creado aquí) no abrirá.
  const { fase } = useEstadoSync();
  const sinNube = fase === 'desconectada' || fase === 'solo-local';
  const disponible: Record<ClaveMensaje, boolean> = { bienvenida: true, credencial: true, portal: !!alumno.portal, vence: tienePlan && !vencido, vencio: vencido, adeudo: debe > 0, extrañamos: true, recibo: tieneRecibo, interesado: false, grupo: false };

  return (
    <div className="space-y-2">
      {sinNube && (
        <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">
          {fase === 'desconectada' ? (
            <>
              Este equipo no está conectado a la nube: el enlace de su portal no abrirá hasta que{' '}
              <Link to="/ajustes/nube" className="underline">
                lo conectes
              </Link>
              .
            </>
          ) : (
            'Este equipo no usa la nube: el portal del alumno no está disponible.'
          )}
        </p>
      )}
      {MENSAJES.filter((m) => disponible[m.clave]).map((m) => {
        const texto = armarMensaje(plantilla(academia, m.clave), m.clave === 'adeudo' ? { ...datos, monto: dinero(debe) } : datos);
        const link = waLink(alumno.telefono, texto);
        return (
          <a
            key={m.clave}
            href={link ?? undefined}
            target="_blank"
            rel="noreferrer"
            onClick={onEnviado}
            className="flex items-center gap-3 rounded-2xl bg-superficie p-3 ring-1 ring-ink-100 active:bg-ink-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600">
              <MessageCircle size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{m.titulo}</span>
              <span className="line-clamp-2 block text-xs text-ink-500">{texto}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-300" />
          </a>
        );
      })}
      {alumno.portal && (
        <div className="flex gap-2 pt-1">
          <a
            href={enlacePortal(alumno.portal)}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-superficie text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-50"
          >
            <ExternalLink size={16} /> Abrir su portal
          </a>
          <button
            type="button"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-superficie text-sm font-semibold ring-1 ring-ink-100 active:bg-ink-50"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(enlacePortal(alumno.portal!));
                avisar('Enlace copiado');
              } catch {
                avisar('No se pudo copiar; usa “Abrir su portal” y copia la dirección', 'error');
              }
            }}
          >
            <Copy size={16} /> Copiar enlace
          </button>
        </div>
      )}
      {alumno.portal && (
        <button
          type="button"
          className="w-full px-1 pt-1 text-left text-xs font-semibold text-ink-500 underline-offset-2 active:underline"
          onClick={async () => {
            await regenerarPortal(alumno.id);
            avisar('Enlace nuevo creado: el anterior ya no funciona');
          }}
        >
          ¿Se compartió su enlace por error? Crear uno nuevo
        </button>
      )}
      <p className="px-1 pt-1 text-xs text-ink-500">Los textos se cambian en Ajustes → Mensajes de WhatsApp. La credencial con imagen se envía desde “Credencial con QR”.</p>
    </div>
  );
}
