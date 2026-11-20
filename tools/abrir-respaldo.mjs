// Abre un respaldo automático (.compas) y lo deja como .json.gz, listo para "Restaurar un respaldo" en la app.
// Uso: COMPAS_LLAVE='la frase' node tools/abrir-respaldo.mjs respaldo-2026-11-23.compas
import { gunzipSync } from 'node:zlib';
import { scryptSync, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [archivo] = process.argv.slice(2);
const { COMPAS_LLAVE } = process.env;
if (!archivo || !COMPAS_LLAVE) throw new Error('Uso: COMPAS_LLAVE=... node tools/abrir-respaldo.mjs <archivo.compas>');
const b = readFileSync(archivo);
if (b.subarray(0, 7).toString() !== 'COMPAS1') throw new Error('No es un respaldo de Compás');
const sal = b.subarray(7, 23);
const iv = b.subarray(23, 35);
const etiqueta = b.subarray(35, 51);
const d = createDecipheriv('aes-256-gcm', scryptSync(COMPAS_LLAVE, sal, 32), iv);
d.setAuthTag(etiqueta);
let gz;
try {
  gz = Buffer.concat([d.update(b.subarray(51)), d.final()]);
} catch {
  throw new Error('La llave no es correcta (o el archivo está dañado)');
}
const r = JSON.parse(gunzipSync(gz).toString());
const salida = archivo.replace(/\.compas$/, '') + '.json.gz';
writeFileSync(salida, gz);
const n = Object.values(r.datos).reduce((a, x) => a + x.length, 0);
console.log(`Listo: ${n.toLocaleString('es-MX')} registros (${r.exportado}) → ${salida}. Restáuralo en la app: Más → Nube y respaldo → Restaurar un respaldo.`);
