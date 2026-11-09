// Genera los íconos PNG de la PWA sin dependencias (rasterizado simple con supersampling).
// Uso: node scripts/generar-iconos.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FONDO = [232, 68, 90];
const BLANCO = [255, 255, 255];

function pixel(x, y) {
  // coordenadas normalizadas 0..64 (mismo diseño que src/components/Logo.tsx, sin esquinas: maskable)
  const cx = 32, cy = 32;
  const dx = x - cx, dy = y - cy;
  const r = Math.hypot(dx, dy);
  if (r <= 6) return BLANCO;
  if (Math.abs(r - 17) <= 2.5) {
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI + 30; // rotate(-30)
    ang = ((ang % 360) + 360) % 360;
    const arco = (70 / (2 * Math.PI * 17)) * 360; // trazo visible del dasharray
    if (ang <= arco) return BLANCO;
  }
  return FONDO;
}

function png(tam) {
  const SS = 4;
  const filas = [];
  for (let y = 0; y < tam; y++) {
    const fila = Buffer.alloc(1 + tam * 3);
    for (let x = 0; x < tam; x++) {
      let acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = pixel(((x + (sx + 0.5) / SS) / tam) * 64, ((y + (sy + 0.5) / SS) / tam) * 64);
          acc = acc.map((v, i) => v + c[i]);
        }
      acc.forEach((v, i) => (fila[1 + x * 3 + i] = Math.round(v / (SS * SS))));
    }
    filas.push(fila);
  }
  const crcTabla = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo, datos) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(datos.length);
    const td = Buffer.concat([Buffer.from(tipo), datos]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(filas))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [nombre, tam] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${nombre}`, import.meta.url), png(tam));
  console.log('ok', nombre);
}
