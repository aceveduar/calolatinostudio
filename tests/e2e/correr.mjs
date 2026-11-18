// Corre todas las pruebas de pantalla (o las que se nombren) y da un resumen.
//   npm run test:e2e              → todas
//   npm run test:e2e -- web tienda → solo esas
//   npm run test:e2e -- --sin-build → reutiliza la compilación anterior
//
// Seguridad: compila la app apuntando a una nube FALSA (prueba.invalid), así ninguna
// prueba puede escribir en la nube real aunque se le olvide bloquear la red.
// Requiere Microsoft Edge instalado (lo usa playwright-core con channel 'msedge').
import { spawn, spawnSync } from 'node:child_process';
import { leerEncabezados, servir } from './servidor.mjs';
import { readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const SALIDA = 'dist-prueba';
const PUERTO = 4173;
const LIMITE_MS = 6 * 60_000; // eventos tarda ~3 min
// Ayudantes que no son pruebas por sí mismos
const NO_SON_PRUEBAS = new Set(['correr.mjs']);

const args = process.argv.slice(2);
const sinBuild = args.includes('--sin-build');
const pedidas = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\.mjs$/, ''));
const todas = readdirSync(AQUI).filter((f) => f.endsWith('.mjs') && !NO_SON_PRUEBAS.has(f)).map((f) => f.replace(/\.mjs$/, ''));
const suites = pedidas.length ? pedidas : todas;
mkdirSync(path.join(AQUI, 'salida'), { recursive: true });

const env = {
  ...process.env,
  VITE_SEMILLA: '1',
  VITE_SUPABASE_URL: 'https://prueba.invalid',
  VITE_SUPABASE_ANON_KEY: 'clave-de-prueba',
};

if (!sinBuild) {
  console.log('Compilando la app de prueba…');
  const b = spawnSync('npx', ['vite', 'build', '--outDir', SALIDA, '--emptyOutDir'], { cwd: RAIZ, env, stdio: 'inherit', shell: true });
  if (b.status !== 0) process.exit(1);
}

// Se sirve como Cloudflare Pages: con los encabezados de public/_headers (incluida la política de seguridad)
const servidor = await servir({ carpeta: path.join(RAIZ, SALIDA), puerto: PUERTO, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) }).catch((e) => {
  console.error(`No arrancó el servidor en el puerto ${PUERTO} (¿ya hay otro corriendo?): ${e.message}`);
  process.exit(1);
});

const resultados = [];
for (const s of suites) {
  const inicio = Date.now();
  const r = await correrSuite(s);
  const seg = Math.round((Date.now() - inicio) / 1000);
  const ok = (r.texto.match(/\bOK\b/g) || []).length;
  const mal = (r.texto.match(/\bMAL\b/g) || []).length;
  const errPagina = /errores:\s*\[/.test(r.texto);
  const paso = r.codigo === 0 && mal === 0 && !errPagina;
  resultados.push({ s, paso, ok, mal, seg });
  console.log(`${paso ? '✔' : '✘'} ${s.padEnd(14)} ${String(ok).padStart(3)} OK  ${mal} MAL  ${seg}s`);
  if (!paso) {
    const lineas = r.texto.split('\n').filter((l) => /MAL|Error|errores:|Timeout/.test(l)).slice(0, 8);
    for (const l of lineas) console.log('    ' + l.trim().slice(0, 200));
  }
}

servidor.cerrar();
const bloqueos = [...new Set(servidor.avisos)];
if (bloqueos.length) {
  console.log(`
✘ La política de seguridad (public/_headers) bloqueó ${bloqueos.length} cosa(s):`);
  for (const b of bloqueos.slice(0, 15)) console.log('    ' + b);
}
const fallidas = resultados.filter((r) => !r.paso);
console.log(`\n${resultados.length - fallidas.length}/${resultados.length} pruebas pasaron.` + (fallidas.length ? ` Fallaron: ${fallidas.map((r) => r.s).join(', ')}` : ''));
process.exit(fallidas.length || bloqueos.length ? 1 : 0);

function correrSuite(nombre) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [path.join(AQUI, nombre + '.mjs')], { cwd: AQUI, env });
    let texto = '';
    p.stdout.on('data', (d) => (texto += d));
    p.stderr.on('data', (d) => (texto += d));
    const t = setTimeout(() => {
      texto += '\nTimeout: la prueba tardó demasiado';
      p.kill();
    }, LIMITE_MS);
    p.on('close', (codigo) => {
      clearTimeout(t);
      res({ codigo: codigo ?? 1, texto });
    });
  });
}
