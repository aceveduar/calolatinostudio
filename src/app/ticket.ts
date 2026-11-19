/**
 * Ticket de compra como imagen (para mandarlo por WhatsApp después de cobrar un plan).
 * Parece un ticket de papel: logo, folio, fecha, alumno, lo que pagó, vigencia, total, sello "PAGADO"
 * y la orilla de abajo cortada. Solo datos de ese pago; nada de otros alumnos.
 */
import type { MetodoPago } from '../db/types';
import { dinero } from '../domain/dinero';
import { cargarImagen } from './compartirImagen';

export interface DatosTicket {
  academia: string;
  logo?: string | null;
  color?: string | null;
  /** id del pago: el folio son sus últimos 6 caracteres */
  pagoId: string;
  /** cuándo se cobró (ms) */
  at: number;
  alumno: string;
  codigo: string;
  concepto: string;
  /** "19 nov al 18 dic" */
  vigencia?: string;
  /** "8 clases" o "Clases ilimitadas" */
  clases?: string;
  metodo: MetodoPago;
  monto: number;
  atendio: string;
}

const METODO: Record<MetodoPago, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

export const folioDe = (pagoId: string) => pagoId.replace(/-/g, '').slice(-6).toUpperCase();

export function nombreArchivoTicket(t: Pick<DatosTicket, 'alumno' | 'pagoId'>) {
  return `ticket-${t.alumno.trim().split(/\s+/)[0].toLowerCase()}-${folioDe(t.pagoId)}.png`;
}

export async function ticketPNG(t: DatosTicket): Promise<Blob> {
  let logo: HTMLImageElement | null = null;
  if (t.logo) logo = await cargarImagen(t.logo).catch(() => null);
  // primera pasada en un lienzo alto para saber cuánto mide; la segunda, del tamaño justo
  const alto = pintar(document.createElement('canvas'), t, logo, 2400);
  const c = document.createElement('canvas');
  pintar(c, t, logo, alto);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

function pintar(c: HTMLCanvasElement, t: DatosTicket, logo: HTMLImageElement | null, H: number): number {
  const W = 720;
  const P = 56; // margen del papel
  const filas: [string, string][] = [['Alumno', t.alumno], ['Código', t.codigo.split('').join(' ')]];
  const detalle: [string, string][] = [];
  if (t.vigencia) detalle.push(['Vigencia', t.vigencia]);
  if (t.clases) detalle.push(['Incluye', t.clases]);
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const marca = t.color || getComputedStyle(document.documentElement).getPropertyValue('--marca').trim() || '#d6304a';
  const fuente = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const tinta = '#1c1a24';
  const gris = '#6e6a7c';

  // fondo y papel con orilla de abajo cortada en zigzag
  g.fillStyle = '#efeef3';
  g.fillRect(0, 0, W, H);
  const x0 = 36;
  const x1 = W - 36;
  const y0 = 36;
  const y1 = H - 56;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.12)';
  g.shadowBlur = 24;
  g.shadowOffsetY = 6;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y0);
  g.lineTo(x1, y1);
  const diente = 18;
  for (let x = x1; x > x0; x -= diente * 2) {
    g.lineTo(Math.max(x0, x - diente), y1 + 16);
    g.lineTo(Math.max(x0, x - diente * 2), y1);
  }
  g.closePath();
  g.fill();
  g.restore();
  // franja de color arriba
  g.fillStyle = marca;
  g.fillRect(x0, y0, x1 - x0, 12);

  let y = y0 + 64;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (logo) {
    const s = Math.min(110 / logo.width, 110 / logo.height);
    g.drawImage(logo, W / 2 - (logo.width * s) / 2, y - 30, logo.width * s, logo.height * s);
    y += 110;
  }
  g.fillStyle = tinta;
  g.font = `800 38px ${fuente}`;
  g.fillText(t.academia, W / 2, y, W - 2 * P - 40);
  y += 52;
  g.fillStyle = gris;
  g.font = `700 22px ${fuente}`;
  g.fillText('R E C I B O   D E   P A G O', W / 2, y);
  y += 38;
  const fecha = new Date(t.at);
  g.font = `500 24px ${fuente}`;
  g.fillText(
    `Folio ${folioDe(t.pagoId)} · ${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · ${fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`,
    W / 2,
    y,
  );
  y += 44;

  const punteada = () => {
    g.save();
    g.strokeStyle = '#cfccd8';
    g.lineWidth = 2;
    g.setLineDash([10, 10]);
    g.beginPath();
    g.moveTo(x0 + 28, y);
    g.lineTo(x1 - 28, y);
    g.stroke();
    g.restore();
    y += 42;
  };
  const fila = ([izq, der]: [string, string], fuerte = false) => {
    g.textAlign = 'left';
    g.fillStyle = gris;
    g.font = `500 26px ${fuente}`;
    g.fillText(izq, P + 10, y);
    g.textAlign = 'right';
    g.fillStyle = tinta;
    g.font = `${fuerte ? 800 : 600} 26px ${fuente}`;
    g.fillText(der, W - P - 10, y, W - 2 * P - 200);
    y += 46;
  };

  punteada();
  filas.forEach((f) => fila(f));
  y += 4;
  punteada();
  // el concepto, en grande, con su precio
  g.textAlign = 'left';
  g.fillStyle = tinta;
  g.font = `800 30px ${fuente}`;
  g.fillText(t.concepto, P + 10, y, W - 2 * P - 220);
  g.textAlign = 'right';
  g.fillText(dinero(t.monto), W - P - 10, y);
  y += 50;
  detalle.forEach((f) => fila(f));
  y += 4;
  punteada();
  // total
  g.textAlign = 'left';
  g.fillStyle = tinta;
  g.font = `800 34px ${fuente}`;
  g.fillText('TOTAL', P + 10, y + 6);
  g.textAlign = 'right';
  g.fillStyle = marca;
  g.font = `800 58px ${fuente}`;
  g.fillText(dinero(t.monto), W - P - 10, y + 4);
  y += 70;
  fila(['Pagado con', METODO[t.metodo]]);
  fila(['Atendió', t.atendio]);

  // sello "PAGADO", centrado en su propio espacio (no tapa ningún dato)
  y += 30;
  g.save();
  g.translate(W / 2, y + 20);
  g.rotate(-0.12);
  g.globalAlpha = 0.9;
  g.strokeStyle = '#15803d';
  g.fillStyle = '#15803d';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(-130, -42, 260, 84, 16);
  g.stroke();
  g.font = `900 48px ${fuente}`;
  g.textAlign = 'center';
  g.fillText('PAGADO', 0, 3);
  g.restore();
  y += 80;

  // despedida
  y += 18;
  g.textAlign = 'center';
  g.fillStyle = tinta;
  g.font = `700 28px ${fuente}`;
  g.fillText('¡Gracias por bailar con nosotros!', W / 2, y);
  y += 40;
  g.fillStyle = gris;
  g.font = `500 22px ${fuente}`;
  g.fillText('Muestra tu QR en recepción para entrar a clase', W / 2, y);
  // alto total: lo escrito + la orilla cortada + el fondo
  return Math.ceil(y + 40 + 16 + 56);
}
