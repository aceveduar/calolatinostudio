// Demo para enseñar: agrega a la academia REAL alumnos con ~6 semanas de asistencias, cobros, planes y cortes,
// sobre sus clases y precios reales (no crea clases ni maestros). Si no hay mensualidad o paquete, crea unos
// de ejemplo. Se sube con la sincronización normal. Para quitarla: supabase/vaciar-movimiento.sql.
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/demo-mes.mjs [alumnos]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../e2e/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { COMPAS_DEMO_CORREO: CORREO, COMPAS_DEMO_CLAVE: CLAVE } = process.env;
if (!CORREO || !CLAVE) throw new Error('Faltan COMPAS_DEMO_CORREO y COMPAS_DEMO_CLAVE');
const ALUMNOS = Number(process.argv[2] ?? 80);

console.log('Compilando…');
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
console.log('Bajando la academia…');
await page.getByText('Alberto', { exact: true }).waitFor({ timeout: 300_000 });
await page.waitForFunction(() => !!window.compasDev);
const [clases, demoPrevia] = await page.evaluate(async () => [
  await window.compasDev.db.clases.count(),
  await window.compasDev.db.pagos.count(),
]);
if (!clases || demoPrevia > 0) {
  console.log(clases ? `Ya hay ${demoPrevia} cobros: parece que la demo ya se generó. No se hizo nada.` : 'La academia no tiene clases. No se hizo nada.');
  await browser.close();
  servidor.cerrar();
  process.exit(1);
}
const cuenta = await page.evaluate((n) => window.compasDev.ampliar(n, 0.5, 0.9, { crearPlanes: true }), ALUMNOS);
console.log('Generado:', JSON.stringify(cuenta));
const t = Date.now();
for (;;) {
  const quedan = await page.evaluate(async () => {
    await window.compasDev.sincronizar();
    return window.compasDev.db.outbox.count();
  });
  process.stdout.write(`\rSubiendo… faltan ${quedan}   `);
  if (quedan === 0) break;
}
console.log(`\nSubido a la nube en ${Math.round((Date.now() - t) / 1000)} s. Recarga la app para verlo.`);
await browser.close();
servidor.cerrar();
