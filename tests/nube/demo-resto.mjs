// Lo que le falta a la demo sobre la academia REAL: maestros de prueba con su usuario (PIN 5555, 6666, 7777, 8888),
// gastos con pago a maestros, becas, rentas del salón, eventos con boletos y testimonios del portal por aprobar.
// Ojo: los eventos se ven en la página pública. Para quitarlo: supabase/vaciar-movimiento.sql
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/demo-resto.mjs [testimonios]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../e2e/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { COMPAS_DEMO_CORREO: CORREO, COMPAS_DEMO_CLAVE: CLAVE } = process.env;
if (!CORREO || !CLAVE) throw new Error('Faltan COMPAS_DEMO_CORREO y COMPAS_DEMO_CLAVE');

console.log('Compilando…');
spawnSync('npx', ['vite', 'build', '--outDir', 'dist-nube', '--emptyOutDir'], { cwd: RAIZ, env: { ...process.env, VITE_SEMILLA: '1' }, stdio: 'ignore', shell: true });
const servidor = await servir({ carpeta: path.join(RAIZ, 'dist-nube'), puerto: 4174, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ locale: 'es-MX' })).newPage();
page.on('pageerror', (e) => console.log('error:', e.message));
const salir = async (msg) => {
  console.log(msg);
  await browser.close();
  servidor.cerrar();
  process.exit(1);
};
await page.goto('http://localhost:4174/');
await page.getByRole('button', { name: /Conectar a mi academia/ }).click();
await page.locator('input[type=email]').fill(CORREO);
await page.locator('input[autocomplete="current-password"]').fill(CLAVE);
await page.getByRole('button', { name: 'Entrar' }).click();
console.log('Bajando la academia…');
await page.getByText('Alberto', { exact: true }).waitFor({ timeout: 300_000 });
await page.waitForFunction(() => !!window.compasDev && !!window.compasDemoExtra);
const [academias, slug] = await page.evaluate(async () => {
  const d = window.compasDev.db;
  return [await d.academias.count(), (await d.academias.toCollection().first())?.slug];
});
if (academias !== 1 || slug !== 'calo-latino') await salir(`En este equipo no quedó solo Calo Latino Studio (${academias} academias, enlace ${slug}). No se hizo nada.`);

let r;
try {
  // "testimonios": solo esos (si lo demás ya se subió)
  r = await page.evaluate((solo) => (solo === 'testimonios' ? window.compasDemoExtra.agregarTestimoniosDemo() : window.compasDemoExtra.agregarRestoDemo()), process.argv[2] ?? '');
} catch (e) {
  await salir(`No se generó: ${e.message}`);
}
console.log('Generado:', JSON.stringify(r));
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
