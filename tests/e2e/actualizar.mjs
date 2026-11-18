// Llega una versión nueva de la app a media venta: no se recarga mientras haya una cuenta abierta.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const btn = (t) => page.getByRole('button', { name: t });
const busca = page.getByPlaceholder(/Quién llegó|Buscar…/);
// simula que la app pasa a segundo plano (Monse se va a WhatsApp) y regresa
const segundoPlano = () =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
const aplicada = () => page.evaluate(() => !!window.__actualizada);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.sembrar());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
await busca.waitFor();
await page.waitForFunction(() => !!window.compasDev);
await btn(/Elegir clase|Otra/).click();
await page.getByRole('button', { name: /Salsa/ }).first().click();

await page.evaluate(() => window.compasDev.simularActualizacion());
await busca.fill('visitante prueba');
await page.getByText('Nuevo: visitante prueba', { exact: false }).click();
await btn('Listo').waitFor();
await segundoPlano();
console.log('1) con una cuenta abierta no se actualiza:', ok(!(await aplicada())));
await btn('Listo').click();
await page.waitForTimeout(200);
await segundoPlano();
console.log('2) ya sin cuenta abierta, se actualiza al salir:', ok(await aplicada()));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
