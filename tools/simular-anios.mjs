// Simula una academia real con 2, 3 y 5 años de historial y mide lo que importa en un Android de gama media
// (procesador 4x más lento): espacio en el teléfono, abrir Entrada, cobrar, Alumnos, Reportes y una ficha.
// Todo local (nube falsa); no toca la nube real.  Uso: node tools/simular-anios.mjs
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerEncabezados, servir } from '../tests/e2e/servidor.mjs';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'dist-sim');
const r = spawnSync('npx', ['vite', 'build', '--outDir', CARPETA, '--emptyOutDir'], { cwd: RAIZ, env: { ...process.env, VITE_SEMILLA: '1', VITE_SUPABASE_URL: 'https://prueba.invalid', VITE_SUPABASE_ANON_KEY: 'clave-de-prueba' }, stdio: 'ignore', shell: true });
if (r.status !== 0) throw new Error('no se pudo compilar');
const servidor = await servir({ carpeta: CARPETA, puerto: 4176, encabezados: leerEncabezados(path.join(RAIZ, 'public', '_headers')) });
const b = await chromium.launch({ channel: 'msedge' });
const resultados = [];
// ~300 alumnos activos a la vez (550 en total, como los que van y vienen)
for (const anios of [2, 3, 5]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4176/');
  await p.waitForFunction(() => !!window.compasDev);
  const filas = await p.evaluate(async (meses) => {
    const dev = window.compasDev;
    await dev.sembrar();
    for (const t of dev.db.tables.map((x) => x.name)) if (!['academias', 'usuarios', 'meta'].includes(t)) await dev.db.table(t).clear();
    const r = await dev.academiaGrande({ alumnos: 550, meses });
    await dev.db.outbox.clear();
    return Object.values(r).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
  }, anios * 12);
  const espacioMB = await p.evaluate(async () => Math.round(((await navigator.storage.estimate()).usage ?? 0) / 1048576));
  await p.reload();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const ms = async (fn) => { const t = Date.now(); await fn(); return Date.now() - t; };
  const ir = (r) => p.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
  await p.getByText('Dirección', { exact: false }).first().click();
  const entrada = await ms(async () => { await p.keyboard.type('1234', { delay: 20 }); await p.locator('main button').filter({ hasText: /Paga|Plan/ }).first().waitFor({ timeout: 120000 }); });
  const cobro = await ms(async () => { await p.locator('main button').filter({ hasText: /Paga/ }).first().click(); await p.getByRole('button', { name: 'Listo', exact: true }).waitFor({ timeout: 60000 }); });
  await p.getByRole('button', { name: 'Listo', exact: true }).click();
  const alumnos = await ms(async () => { await ir('/alumnos'); await p.getByText(/activos/).first().waitFor({ timeout: 120000 }); await p.locator('main button').filter({ hasText: /días|Sin plan|clases|Archivado/ }).first().waitFor({ timeout: 120000 }); });
  const archivados = await p.evaluate(() => document.querySelector('main')?.innerText.match(/([\d,]+) archivados/)?.[1] ?? '0');
  const reportes = await ms(async () => { await ir('/reportes'); await p.getByText(/Vencen esta semana/).waitFor({ timeout: 120000 }); });
  const id = await p.evaluate(async () => (await window.compasDev.db.alumnos.toArray())[0].id);
  const ficha = await ms(async () => { await ir(`/alumnos/${id}`); await p.getByText('Últimas clases').waitFor({ timeout: 120000 }); });
  resultados.push({ años: anios, registros: filas, espacioMB, entrada_ms: entrada, cobro_ms: cobro, alumnos_ms: alumnos, archivados, reportes_ms: reportes, ficha_ms: ficha });
  console.log(JSON.stringify(resultados.at(-1)));
  await ctx.close();
}
await b.close();
servidor.cerrar();
console.table(resultados);
