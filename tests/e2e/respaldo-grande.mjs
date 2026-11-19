// Respaldo con mucho volumen (5,000 alumnos, ~170 mil registros): descargarlo y restaurarlo en un teléfono vacío.
// Mide tiempo, tamaño y memoria, y revisa que no se pierda ni un registro.
import { chromium } from 'playwright-core';
import { statSync } from 'node:fs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const memoria = (page) => page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6));
const conteos = (page) => page.evaluate(async () => Object.fromEntries(await Promise.all(window.compasDev.db.tables.filter((t) => !['outbox', 'meta'].includes(t.name)).map(async (t) => [t.name, await t.count()]))));

// 1) teléfono con la academia grande: descargar el respaldo
const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', acceptDownloads: true });
const p1 = await ctx1.newPage();
p1.on('pageerror', (e) => errores.push(e.message));
await p1.goto('http://localhost:4173/');
await p1.waitForFunction(() => !!window.compasDev);
await p1.evaluate(async () => {
  const dev = window.compasDev;
  await dev.sembrar();
  for (const t of dev.db.tables.map((x) => x.name)) if (!['academias', 'usuarios', 'meta'].includes(t)) await dev.db.table(t).clear();
  await dev.academiaGrande({ alumnos: 5000, meses: 6 });
  await dev.db.outbox.clear();
});
const antes = await conteos(p1);
await p1.reload();
await p1.getByText('Dirección Calo', { exact: true }).click();
await p1.keyboard.type('1234', { delay: 30 });
await p1.getByPlaceholder(/Quién llegó|Buscar…/).waitFor({ timeout: 60_000 });
await p1.evaluate(() => { history.pushState(null, '', '/ajustes/nube'); dispatchEvent(new PopStateEvent('popstate')); });
const boton = p1.getByRole('button', { name: /Descargar respaldo/ });
await boton.waitFor();
const m0 = await memoria(p1);
let t = Date.now();
const [descarga] = await Promise.all([p1.waitForEvent('download', { timeout: 120_000 }), boton.click()]);
const archivo = `${OUT}respaldo-grande.json.gz`;
await descarga.saveAs(archivo);
const seg = (Date.now() - t) / 1000;
const mb = statSync(archivo).size / 1e6;
console.log(`1) descargar respaldo: ${seg.toFixed(1)} s, ${mb.toFixed(1)} MB, memoria ${m0} → ${await memoria(p1)} MB:`, ok(seg < 20 && mb < 25));
await ctx1.close();

// 2) teléfono nuevo, vacío: restaurar
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX' });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errores.push(e.message));
await p2.goto('http://localhost:4173/');
await p2.waitForFunction(() => !!window.compasDev);
await p2.locator('input[type=file][accept*="json"]').setInputFiles(archivo);
await p2.getByRole('button', { name: 'Restaurar', exact: true }).waitFor({ timeout: 60_000 });
t = Date.now();
await p2.getByRole('button', { name: 'Restaurar', exact: true }).click();
await p2.getByText(/Respaldo restaurado|registros recuperados|Quién eres/).first().waitFor({ timeout: 300_000 });
const segR = (Date.now() - t) / 1000;
const despues = await conteos(p2);
const faltan = Object.entries(antes).filter(([k, v]) => despues[k] !== v);
console.log(`2) restaurar en un teléfono vacío: ${segR.toFixed(1)} s:`, ok(segR < 60));
console.log('3) no se perdió ningún registro:', ok(faltan.length === 0), faltan.length ? JSON.stringify(faltan.map(([k, v]) => [k, v, despues[k]])) : `${Object.values(despues).reduce((a, b) => a + b, 0)} registros`);
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
