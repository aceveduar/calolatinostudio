import { useEffect, useState } from 'react';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import { Boton, Hoja } from '../../components/ui';
import { useAvisos } from '../../components/avisos';
import { descargarArchivo, enviarImagen, puedeCompartirImagen } from '../../app/compartirImagen';
import { nombreArchivoTicket, ticketPNG } from '../../app/ticket';
import { waLink } from '../../domain/reportes';
import { cerrarTicket, useTicketAbierto } from '../../app/ticketAbierto';

/** Ticket de compra después de cobrar un plan: se abre desde el aviso "Enviar ticket". */
export function HojaTicket() {
  const p = useTicketAbierto();
  const avisar = useAvisos();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  useEffect(() => {
    setArchivo(null);
    setVista(null);
    if (!p) return;
    let url: string | null = null;
    let vivo = true;
    void ticketPNG(p.ticket).then((blob) => {
      if (!vivo) return;
      const f = new File([blob], nombreArchivoTicket(p.ticket), { type: 'image/png' });
      url = URL.createObjectURL(blob);
      setArchivo(f);
      setVista(url);
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [p]);
  const cerrar = cerrarTicket;
  const compartir = puedeCompartirImagen();
  const wa = p ? waLink(p.telefono, p.mensaje) : null;

  return (
    <Hoja abierta={!!p} onCerrar={cerrar} titulo="Ticket de compra">
      {p && (
        <div className="space-y-4">
          <div className="mx-auto w-full max-w-[17rem]">
            {vista ? <img src={vista} alt={`Ticket de ${p.ticket.concepto} por ${p.ticket.alumno}`} className="w-full rounded-xl" /> : <div className="aspect-[3/5] w-full animate-pulse rounded-xl bg-ink-100" />}
          </div>
          <Boton
            grande
            bloque
            disabled={!archivo}
            onClick={async () => {
              if (!archivo) return;
              const r = await enviarImagen(archivo, p.mensaje, p.telefono);
              if (r === 'descargada-y-chat') avisar('Ticket descargado: adjúntalo en el chat de WhatsApp');
              else if (r === 'descargada') avisar('Ticket descargado');
              if (r !== 'cancelada') cerrar();
            }}
          >
            <Share2 size={20} /> {compartir ? 'Enviar ticket (WhatsApp…)' : wa ? 'Enviar ticket por WhatsApp' : 'Descargar ticket'}
          </Boton>
          <div className="grid grid-cols-2 gap-2">
            <Boton
              variante="secundario"
              disabled={!archivo}
              onClick={() => {
                if (!archivo) return;
                descargarArchivo(archivo);
                avisar('Ticket descargado');
              }}
            >
              <Download size={18} /> Descargar
            </Boton>
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" onClick={cerrar}>
                <Boton bloque variante="secundario">
                  <MessageCircle size={18} className="text-ok-600" /> Solo mensaje
                </Boton>
              </a>
            ) : (
              <Boton variante="secundario" disabled title="Agrega su WhatsApp en la ficha">
                <MessageCircle size={18} /> Sin WhatsApp
              </Boton>
            )}
          </div>
        </div>
      )}
    </Hoja>
  );
}
