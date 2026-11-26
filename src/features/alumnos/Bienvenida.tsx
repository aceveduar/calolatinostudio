import { useEffect } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton } from '../../components/ui';
import type { Alumno } from '../../db/types';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { enlacePortal } from '../../domain/portal';
import { asegurarPortal } from '../../domain/enlacePortal';
import { waLink } from '../../domain/reportes';

/**
 * Justo después de dar de alta a un alumno: mandarle en un toque su acceso
 * (credencial con QR, su plan, sus clases y dónde poner su foto).
 */
export function Bienvenida({ alumno, onCerrar }: { alumno: Alumno; onCerrar: () => void }) {
  const { academia } = useSesion();
  const avisar = useAvisos();
  useEffect(() => {
    if (!alumno.portal) void asegurarPortal(alumno);
  }, [alumno]);
  const nombre1 = alumno.nombre.split(' ')[0];
  const enlace = alumno.portal ? enlacePortal(alumno.portal) : null;
  const texto = enlace ? armarMensaje(plantilla(academia, 'portal'), { nombre: nombre1, academia: academia.nombre, codigo: alumno.codigo, enlace }) : '';
  const link = enlace ? waLink(alumno.telefono, texto) : null;

  return (
    <div className="space-y-4">
      <p className="text-ink-700">
        Comparte su pase para que pueda mostrar el <b>QR en recepción</b>, consultar su plan y agregar su foto.
      </p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            onCerrar();
          }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ok-600 text-lg font-bold text-white shadow-sm active:brightness-95"
        >
          <MessageCircle size={22} aria-hidden="true" /> Abrir WhatsApp
        </a>
      ) : (
        <>
          {enlace && <p className="rounded-xl bg-warn-50 px-3 py-2 text-sm font-medium text-warn-600">No tiene teléfono registrado. Copia el enlace y mándaselo como prefieras.</p>}
          <Boton
            grande
            bloque
            disabled={!enlace}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(texto);
                avisar('Mensaje con su enlace copiado');
                onCerrar();
              } catch {
                avisar('No se pudo copiar', 'error');
              }
            }}
          >
            <Copy size={20} /> {enlace ? 'Copiar mensaje con su enlace' : 'Preparando su enlace…'}
          </Boton>
        </>
      )}
      <Boton bloque variante="fantasma" onClick={onCerrar}>
        Ahora no
      </Boton>
      <p className="px-1 text-xs text-ink-500">Puedes hacerlo después desde <b>Compartir pase</b> en su ficha.</p>
    </div>
  );
}
