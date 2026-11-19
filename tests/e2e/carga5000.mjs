// Rendimiento con una academia muy grande: 5,000 alumnos, 3 sedes, 58 clases, 6 meses (~170 mil registros).
// Mide cada pantalla y, lo más importante, cuánto tarda un cobro en Entrada desde el toque. Falla si algo pasa de 2.5 s.
// PERFIL=1 / PERFIL_GASTOS=1: graba el perfil de CPU (al entrar y en Gastos) y muestra las funciones que más tardan.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LIMITE = 2500;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
await page.clock.install({ time: new Date('2026-11-18T19:05:00') }); // miércoles, a la hora de las clases

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
const t0 = Date.now();
const datos = await page.evaluate(async () => {
  const dev = window.compasDev;
  await dev.sembrar();
  for (const t of dev.db.tables.map((x) => x.name)) if (!['academias', 'usuarios', 'meta'].includes(t)) await dev.db.table(t).clear();
  const r = await dev.academiaGrande({ alumnos: 5000, meses: 6 });
  await dev.db.outbox.clear(); // academia local: no hay nube a la que subir
  return r;
});
console.log('datos:', JSON.stringify(datos), `(${Math.round((Date.now() - t0) / 1000)} s en generarse)`);
await page.reload();
let cdp = null;
if (process.env.PERFIL) {
  cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
}
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
const buscador = page.getByPlaceholder(/Quién llegó|Buscar…/);
await buscador.waitFor({ timeout: 60_000 });

const tiempos = {};
async function medir(nombre, accion, listo) {
  const inicio = Date.now();
  await accion();
  try {
    await page.waitForFunction(listo, null, { timeout: 20_000, polling: 50 });
    tiempos[nombre] = Date.now() - inicio;
  } catch {
    tiempos[nombre] = 99_999;
  }
}
const enMain = (re) => new Function(`return ${re}.test(document.querySelector('main')?.innerText ?? '')`);

// cobro en Entrada: tocar a alguien de la cuadrícula hasta que aparece en la cuenta
await page.locator('main .grid > button').first().waitFor({ timeout: 30_000 });
for (let i = 0; i < 3; i++) {
  const ficha = page.locator('main .grid > button', { hasNotText: 'Adentro' }).first();
  await medir(`Entrada: cobro con un toque (${i + 1})`, () => ficha.click(), () => !!document.querySelector('[aria-label^="Deshacer"]') || /Adentro/.test(document.querySelector('main .grid > button')?.innerText ?? ''));
  const listo = page.getByRole('button', { name: 'Listo' });
  if (await listo.isVisible().catch(() => false)) await listo.click();
  await page.waitForTimeout(300);
}
if (cdp) {
  await medir('Caja (perfil)', () => ir('/caja'), enMain(/efectivo/i));
  const { profile } = await cdp.send('Profiler.stop');
  const porNodo = new Map(profile.nodes.map((n) => [n.id, n]));
  const propio = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => { const n = porNodo.get(id); const k = `${n.callFrame.functionName || '(anónima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; propio.set(k, (propio.get(k) ?? 0) + (dt[i] ?? 0)); });
  console.log('perfil (ms propios):');
  for (const [k, v] of [...propio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log('  ', Math.round(v / 1000), k);
  await ir('/');
}
const nombre = await page.evaluate(async () => (await window.compasDev.db.alumnos.orderBy('nombre').filter((a) => !a.deletedAt && a.activo).first()).nombre);
await medir('Entrada: buscar alumno', () => buscador.fill(nombre.split(' ')[0].slice(0, 4)), new Function(`return (document.querySelector('main')?.innerText ?? '').includes(${JSON.stringify(nombre)})`));
await buscador.fill('');
for (const [n, ruta, re] of [
  ['Alumnos (lista de 5,000)', '/alumnos', /alumnos/i],
  ['Caja', '/caja', /efectivo/i],
  ['Pendientes', '/pendientes', /renovar|deben|extrañamos|todo al día/i],
  ['Listas del mes', '/alumnos/listas', /lista|grupo/i],
  ['Agenda', '/agenda', /hoy|lun|mar|mié/i],
  ['Más', '/mas', /pendientes/i],
]) {
  await medir(n, () => ir(ruta), enMain(re));
  await page.waitForTimeout(300);
}
const id = await page.evaluate(async (x) => (await window.compasDev.db.alumnos.where('nombre').equals(x).first()).id, nombre);
await medir('Ficha del alumno', () => ir(`/alumnos/${id}`), new Function(`return document.body.innerText.includes(${JSON.stringify(nombre)}) && /plan|clases/i.test(document.body.innerText)`));
// dirección
await ir('/');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await page.getByText('Dirección Calo', { exact: true }).click();
await page.keyboard.type('1234', { delay: 30 });
await buscador.waitFor();
for (const [n, ruta, re] of [
  ['Reportes', '/reportes', /ingresos/i],
  ['Gastos y lo que deja cada clase', '/reportes/gastos', /deja cada clase/i],
]) {
  const perfilar = process.env.PERFIL_GASTOS && ruta === '/reportes/gastos';
  const cdp2 = perfilar ? await page.context().newCDPSession(page) : null;
  if (cdp2) { await cdp2.send('Profiler.enable'); await cdp2.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp2.send('Profiler.start'); }
  await medir(n, () => ir(ruta), enMain(re));
  if (cdp2) {
    const { profile } = await cdp2.send('Profiler.stop');
    const porNodo = new Map(profile.nodes.map((x) => [x.id, x]));
    const propio = new Map();
    profile.samples.forEach((id, i) => { const x = porNodo.get(id); const k = `${x.callFrame.functionName || '(anónima)'} ${x.callFrame.url.split('/').pop()}:${x.callFrame.lineNumber}:${x.callFrame.columnNumber}`; propio.set(k, (propio.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0)); });
    console.log('perfil gastos (ms):');
    for (const [k, v] of [...propio.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('  ', Math.round(v / 1000), k);
  }
  await page.waitForTimeout(300);
}
await page.screenshot({ path: `${OUT}carga5000-gastos.png`, fullPage: true });

for (const [n, ms] of Object.entries(tiempos)) console.log(`${ms <= LIMITE ? 'OK ' : 'MAL'} ${n.padEnd(36)} ${ms === 99_999 ? 'no cargó' : `${ms} ms`}`);
const peor = Math.max(...Object.values(tiempos));
console.log(`peor: ${peor} ms:`, ok(peor <= LIMITE));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
