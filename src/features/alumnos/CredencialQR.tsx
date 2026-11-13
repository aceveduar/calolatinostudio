import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2 } from 'lucide-react';
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

  const compartir = async () => {
    const blob = await credencialPNG(alumno, academia);
    const archivo = new File([blob], `credencial-${alumno.nombre.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: `Tu credencial de ${academia.nombre}`, text: `Hola ${alumno.nombre.split(' ')[0]}, esta es tu credencial de ${academia.nombre}. Muéstrala en recepción para entrar. 💃🕺` });
      } catch {
        /* canceló */
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = archivo.name;
    a.click();
    URL.revokeObjectURL(a.href);
    avisar('Credencial descargada');
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
          <p className="font-mono text-sm tracking-[0.3em] text-[#6e6a7c]">{alumno.codigo}</p>
        </div>
      </div>
      <p className="text-center text-sm text-ink-500">En recepción escanean este código para darle entrada o cobrarle.</p>
      <Boton grande bloque onClick={compartir}>
        {'share' in navigator ? <Share2 size={20} /> : <Download size={20} />} {'share' in navigator ? 'Enviar credencial' : 'Descargar credencial'}
      </Boton>
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
