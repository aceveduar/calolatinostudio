import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, MessageCircle, Share2 } from 'lucide-react';
import { waLink } from '../../domain/reportes';
import { armarMensaje, plantilla } from '../../domain/mensajes';
import { useAvisos } from '../../components/avisos';
import { Boton } from '../../components/ui';
import type { Academia, Alumno } from '../../db/types';
import { contenidoQR } from '../../domain/qr';

/** Credencial con QR: se muestra en pantalla y se comparte como imagen (WhatsApp, guardar, imprimir). */
export function CredencialQR({ alumno, academia }: { alumno: Alumno; academia: Academia }) {
  const avisar = useAvisos();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(contenidoQR(alumno.codigo), { margin: 1, width: 640, errorCorrectionLevel: 'M' }).then(setQr);
  }, [alumno.codigo]);

  const nombre1 = alumno.nombre.split(' ')[0];
  const texto = armarMensaje(plantilla(academia, 'credencial'), { nombre: nombre1, academia: academia.nombre, codigo: alumno.codigo });
  const wa = waLink(alumno.telefono, texto);
  const archivo = async () => {
    const blob = await credencialPNG(alumno, academia);
    return new File([blob], `credencial-${alumno.nombre.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
  };
  const descargar = (f: File) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  // Menú de compartir solo en pantallas táctiles (celular/tablet); en PC es más directo descargar y abrir el chat
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const puedeCompartirImagen = tactil && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] });

  /** Celular: menú de compartir con la imagen adjunta. PC: descarga la imagen y abre el chat del alumno. */
  const enviar = async () => {
    const f = await archivo();
    if (puedeCompartirImagen) {
      try {
        await navigator.share({ files: [f], text: texto });
      } catch {
        /* canceló */
      }
      return;
    }
    descargar(f);
    if (wa) {
      window.open(wa, '_blank', 'noopener');
      avisar('Imagen descargada: adjúntala en el chat de WhatsApp');
    } else avisar('Credencial descargada');
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-xs overflow-hidden rounded-3xl bg-white text-[#1c1a24] shadow-lg ring-1 ring-black/5">
        <div className="flex items-center gap-3 px-5 py-3 text-white" style={{ background: 'var(--marca)' }}>
          {academia.logo && <img src={academia.logo} alt="" className="h-9 w-9 rounded-lg bg-white/90 object-contain p-0.5" />}
          <span className="truncate font-bold">{academia.nombre}</span>
        </div>
        <div className="px-6 pt-5 pb-6 text-center">
          {qr ? <img src={qr} alt={`QR de ${alumno.nombre}`} className="mx-auto aspect-square w-full" /> : <div className="aspect-square w-full animate-pulse rounded-xl bg-[#ecebf1]" />}
          <p className="mt-3 text-xl font-extrabold">{alumno.nombre}</p>
          <p className="font-mono text-sm tracking-[0.3em] text-[#6b6778]">{alumno.codigo}</p>
        </div>
      </div>
      <p className="text-center text-sm text-ink-500">En recepción escanean este código para darle entrada o cobrarle.</p>
      <Boton grande bloque onClick={enviar}>
        <Share2 size={20} /> {puedeCompartirImagen ? 'Enviar imagen (WhatsApp…)' : wa ? 'Enviar por WhatsApp' : 'Descargar credencial'}
      </Boton>
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={async () => { descargar(await archivo()); avisar('Credencial descargada'); }}>
          <Download size={18} /> Descargar
        </Boton>
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer">
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
      {!alumno.telefono && <p className="text-center text-xs text-ink-500">Agrega su WhatsApp (✏️ en la ficha) para enviarle mensajes directo.</p>}
    </div>
  );
}

/** Dibuja la credencial como imagen para compartirla. */
async function credencialPNG(alumno: Alumno, academia: Academia): Promise<Blob> {
  const W = 720;
  const H = 960;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const marca = getComputedStyle(document.documentElement).getPropertyValue('--marca').trim() || '#d6304a';
  const fuente = getComputedStyle(document.body).fontFamily;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = marca;
  g.fillRect(0, 0, W, 130);
  let x = 48;
  if (academia.logo) {
    const logo = await cargarImagen(academia.logo);
    const s = Math.min(90 / logo.width, 90 / logo.height);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    g.roundRect(40, 20, 100, 100, 18);
    g.fill();
    g.drawImage(logo, 90 - (logo.width * s) / 2, 70 - (logo.height * s) / 2, logo.width * s, logo.height * s);
    x = 165;
  }
  g.fillStyle = '#ffffff';
  g.font = `800 40px ${fuente}`;
  g.textBaseline = 'middle';
  g.fillText(academia.nombre, x, 70, W - x - 40);
  const qr = await cargarImagen(await QRCode.toDataURL(contenidoQR(alumno.codigo), { margin: 1, width: 520 }));
  g.drawImage(qr, (W - 520) / 2, 170, 520, 520);
  g.fillStyle = '#1c1a24';
  g.textAlign = 'center';
  g.font = `800 48px ${fuente}`;
  g.fillText(alumno.nombre, W / 2, 760, W - 80);
  g.fillStyle = '#6e6a7c';
  g.font = `600 32px ui-monospace, monospace`;
  g.fillText(alumno.codigo.split('').join(' '), W / 2, 820);
  g.font = `500 26px ${fuente}`;
  g.fillText('Muéstrala en recepción para entrar', W / 2, 890);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
