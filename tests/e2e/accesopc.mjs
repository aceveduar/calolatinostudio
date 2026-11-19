// Entrada a la app en PC (pantalla grande): el botón de conectar junto a los campos, nombres completos
// en "¿Quién eres?" y el botón de pendientes con su palabra.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));

await page.goto('http://localhost:4173/mas');
await page.getByRole('button', { name: /Conectar a mi academia/ }).waitFor();
console.log('0) en un equipo sin academia, la dirección vuelve a "/" (no se queda en /mas):', ok(new URL(page.url()).pathname === '/'), page.url());
await page.getByRole('button', { name: /Conectar a mi academia/ }).click();
const clave = page.locator('input[type=password]');
await clave.waitFor();
const c = await clave.boundingBox();
const b = await page.getByRole('button', { name: 'Entrar' }).boundingBox();
await page.screenshot({ path: `${OUT}accesopc-conectar.png` });
console.log('1) en PC, "Entrar" queda junto a los campos (no hasta abajo):', ok(b.y - (c.y + c.height) < 160), Math.round(b.y - (c.y + c.height)));

await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.goto('http://localhost:4173/');
await page.getByText('¿Quién eres?').waitFor();
const cortados = await page.$$eval('button span.line-clamp-2', (els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
await page.screenshot({ path: `${OUT}accesopc-quien.png` });
console.log('2) "¿Quién eres?" muestra los nombres completos:', ok(cortados.length === 0), cortados);

await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
const chip = page.getByRole('link', { name: /pendientes?:/ });
await chip.waitFor({ timeout: 5000 }).catch(() => {});
const t = (await chip.count()) ? await chip.innerText() : '';
await page.screenshot({ path: `${OUT}accesopc-entrada.png` });
console.log('3) el botón de pendientes dice qué es:', ok(/pendiente/.test(t)), t.replace(/\s+/g, ' '));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
