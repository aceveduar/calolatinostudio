// Mide la velocidad real contra la nube de la demo (solo lee; no cambia datos).
//   COMPAS_DEMO_CORREO=… COMPAS_DEMO_CLAVE=… node tests/nube/velocidad.mjs
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../e2e/servidor.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(readFileSync(path.join(RAIZ, '.env'), 'utf-8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const { COMPAS_DEMO_CORREO: CORREO, COMPAS_DEMO_CLAVE: CLAVE } = process.env;
if (!CORREO || !CLAVE) throw new Error('Faltan COMPAS_DEMO_CORREO y COMPAS_DEMO_CLAVE');

const rpc = async (f, cuerpo) => {
  const t = performance.now();
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const texto = await r.text();
  return { ms: Math.round(performance.now() - t), kb: Math.round(texto.length / 1024), ok: r.ok };
};
const mejor = async (n, f) => {
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(await f());
  return xs.sort((a, b) => a.ms - b.ms)[Math.floor(n / 2)]; // mediana
};

spawnSync('npx', ['vite', 'build', '--outDir', 'dist-nube', '--emptyOutDir'], { cwd: RAIZ, env: { ...process.env, VITE_SEMILLA: '1' }, stdio: 'ignore', shell: true });
const servidor = await servir({ carpeta: path.join(RAIZ, 'dist-nube'), puerto: 4174, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ locale: 'es-MX' })).newPage();
await page.goto('http://localhost:4174/');
await page.getByRole('button', { name: /Conectar a mi academia/ }).click();
await page.locator('input[type=email]').fill(CORREO);
await page.locator('input[autocomplete="current-password"]').fill(CLAVE);
const t0 = performance.now();
await page.getByRole('button', { name: 'Entrar' }).click();
await page.getByText('Dirección Calo', { exact: true }).waitFor({ timeout: 300_000 });
const primera = Math.round(performance.now() - t0);
await page.getByText('Dirección Calo', { exact: true }).click();
for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForFunction(() => !!window.compasDev);
const conteo = await page.evaluate(async () => Object.fromEntries(await Promise.all(window.compasDev.db.tables.filter((t) => !['outbox', 'meta'].includes(t.name)).map(async (t) => [t.name, await t.count()]))));
const filas = Object.values(conteo).reduce((a, b) => a + b, 0);
const sync = await page.evaluate(async () => {
  const xs = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await window.compasDev.sincronizar();
    xs.push(performance.now() - t);
  }
  return Math.round(xs.sort((a, b) => a - b)[2]);
});
const token = await page.evaluate(async () => (await window.compasDev.db.alumnos.filter((a) => !!a.portal).first())?.portal);
await browser.close();
servidor.cerrar();

console.log(`Teléfono nuevo (baja todo): ${primera} ms para ${filas} registros`, JSON.stringify(conteo));
console.log(`Sincronización sin cambios (mediana de 5): ${sync} ms`);
const pp = await mejor(5, () => rpc('pagina_publica', { p_slug: 'calo-latino' }));
console.log(`Página pública (datos): ${pp.ms} ms, ${pp.kb} KB`);
if (token) {
  const po = await mejor(5, () => rpc('portal_alumno', { p_token: token }));
  console.log(`Portal del alumno (datos): ${po.ms} ms, ${po.kb} KB`);
}
const ins = await mejor(5, () => rpc('esquema_version', {}));
console.log(`Ida y vuelta mínima a la nube (esquema_version): ${ins.ms} ms`);
