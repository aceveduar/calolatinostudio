// Respaldo automático de la nube (lo corre GitHub cada semana; ver .github/workflows/respaldo.yml).
// Baja TODA la academia (incluido el historial que ya no está en los teléfonos), con el mismo formato que
// "Descargar respaldo" de la app (se restaura con "Restaurar un respaldo"), comprimido y CIFRADO con una llave
// que solo tiene la academia: aunque alguien viera el archivo, sin la llave no puede leerlo.
//
// Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, COMPAS_CORREO, COMPAS_CLAVE (cuenta de la academia),
//            COMPAS_LLAVE (frase para cifrar; guárdala en un lugar seguro: sin ella no se puede abrir).
// Para abrirlo: node tools/abrir-respaldo.mjs <archivo.compas> (pide la misma llave).
import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'node:zlib';
import { randomBytes, scryptSync, createCipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { VITE_SUPABASE_URL: URL_NUBE, VITE_SUPABASE_ANON_KEY: CLAVE_PUBLICA, COMPAS_CORREO, COMPAS_CLAVE, COMPAS_LLAVE } = process.env;
for (const [k, v] of Object.entries({ VITE_SUPABASE_URL: URL_NUBE, VITE_SUPABASE_ANON_KEY: CLAVE_PUBLICA, COMPAS_CORREO, COMPAS_CLAVE, COMPAS_LLAVE })) if (!v) throw new Error(`Falta la variable ${k}`);
if (COMPAS_LLAVE.length < 16) throw new Error('COMPAS_LLAVE debe tener al menos 16 caracteres');

// las mismas tablas que sincroniza la app (se leen de src/db/types.ts para no repetir la lista)
const tipos = readFileSync(path.join(RAIZ, 'src/db/types.ts'), 'utf-8');
const lista = tipos.slice(tipos.indexOf('export const SYNC_TABLES'));
const TABLAS = [...lista.slice(lista.indexOf('= [') + 3, lista.indexOf('];')).matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
if (TABLAS.length < 10) throw new Error('No se pudo leer la lista de tablas');
const aSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const aCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const nube = createClient(URL_NUBE, CLAVE_PUBLICA, { auth: { persistSession: false } });
const { error: e1 } = await nube.auth.signInWithPassword({ email: COMPAS_CORREO, password: COMPAS_CLAVE });
if (e1) throw new Error(`No se pudo entrar: ${e1.message}`);
const { data: m } = await nube.from('miembros').select('academia_id').limit(1).maybeSingle();
if (!m) throw new Error('La cuenta no tiene academia');

const datos = {};
let total = 0;
for (const t of TABLAS) {
  const filas = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await nube.from(aSnake(t)).select('*').eq(t === 'academias' ? 'id' : 'academia_id', m.academia_id).order('id').range(i, i + 999);
    if (error) throw new Error(`${t}: ${error.message}`);
    for (const f of data) filas.push(Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'server_updated_at').map(([k, v]) => [aCamel(k), v])));
    if (data.length < 1000) break;
  }
  datos[t] = filas;
  total += filas.length;
}
await nube.auth.signOut({ scope: 'local' });

const json = Buffer.from(JSON.stringify({ version: 1, exportado: new Date().toISOString(), datos }));
const gz = gzipSync(json);
// cifrado: AES-256-GCM con una llave derivada de la frase (scrypt). Formato: "COMPAS1" + sal(16) + iv(12) + etiqueta(16) + datos
const sal = randomBytes(16);
const iv = randomBytes(12);
const llave = scryptSync(COMPAS_LLAVE, sal, 32);
const c = createCipheriv('aes-256-gcm', llave, iv);
const cifrado = Buffer.concat([c.update(gz), c.final()]);
const archivo = Buffer.concat([Buffer.from('COMPAS1'), sal, iv, c.getAuthTag(), cifrado]);
mkdirSync(path.join(RAIZ, 'respaldos'), { recursive: true });
const nombre = path.join(RAIZ, 'respaldos', `respaldo-${new Date().toISOString().slice(0, 10)}.compas`);
writeFileSync(nombre, archivo);
console.log(`Respaldo listo: ${total.toLocaleString('es-MX')} registros, ${(archivo.length / 1048576).toFixed(1)} MB cifrados → ${path.basename(nombre)}`);
