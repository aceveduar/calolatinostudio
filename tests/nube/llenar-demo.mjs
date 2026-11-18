// Llena la demo de la NUBE con una academia grande (src/dev/grande.ts) y la sube con la sincronización normal.
// Antes, vaciar la demo con tests/nube/vaciar-demo.sql. Se niega si la demo todavía tiene alumnos.
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/llenar-demo.mjs [alumnos] [meses]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../e2e/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { COMPAS_DEMO_CORREO: CORREO, COMPAS_DEMO_CLAVE: CLAVE } = process.env;
if (!CORREO || !CLAVE) throw new Error('Faltan COMPAS_DEMO_CORREO y COMPAS_DEMO_CLAVE');
const ALUMNOS = Number(process.argv[2] ?? 5000);
const MESES = Number(process.argv[3] ?? 6);

spawnSync('npx', ['vite', 'build', '--outDir', 'dist-nube', '--emptyOutDir'], { cwd: RAIZ, env: { ...process.env, VITE_SEMILLA: '1' }, stdio: 'ignore', shell: true });
const servidor = await servir({ carpeta: path.join(RAIZ, 'dist-nube'), puerto: 4174, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ locale: 'es-MX' })).newPage();
page.on('pageerror', (e) => console.log('error:', e.message));
await page.goto('http://localhost:4174/');
await page.getByRole('button', { name: /Conectar a mi academia/ }).click();
await page.locator('input[type=email]').fill(CORREO);
await page.locator('input[autocomplete="current-password"]').fill(CLAVE);
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByText('Dirección Calo', { exact: true }).waitFor({ timeout: 300_000 });
await page.waitForFunction(() => !!window.compasDev);
const hay = await page.evaluate(() => window.compasDev.db.alumnos.count());
if (hay > 0) {
  console.log(`La demo todavía tiene ${hay} alumnos. Corre primero tests/nube/vaciar-demo.sql. No se generó nada.`);
  await browser.close();
  servidor.cerrar();
  process.exit(1);
}
let t = Date.now();
const cuenta = await page.evaluate(([n, m]) => window.compasDev.academiaGrande({ alumnos: n, meses: m }), [ALUMNOS, MESES]);
const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
console.log(`Generado en ${Math.round((Date.now() - t) / 1000)} s: ${total} registros`, JSON.stringify(cuenta));
t = Date.now();
for (;;) {
  const quedan = await page.evaluate(async () => {
    await window.compasDev.sincronizar();
    return window.compasDev.db.outbox.count();
  });
  process.stdout.write(`\rSubiendo… faltan ${quedan}   `);
  if (quedan === 0) break;
}
console.log(`\nSubido a la nube en ${Math.round((Date.now() - t) / 1000)} s.`);
await browser.close();
servidor.cerrar();
