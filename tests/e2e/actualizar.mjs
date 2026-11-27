// Llega una versión nueva de la app a media venta: no se recarga mientras haya una cuenta abierta.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: process.env.COMPAS_NAVEGADOR ?? 'msedge' });
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
await page.waitForFunction(() => !!window.compasDev);
// 0) recién abierta (nadie cobrando): se pone al día sola, sin aviso
await page.evaluate(() => window.compasDev.simularActualizacion());
console.log('0) al abrir la app con versión nueva, se actualiza sola:', ok(await aplicada()));
await page.evaluate(() => { window.__actualizada = false; });
await page.waitForTimeout(8000); // ya pasó el arranque: de aquí en adelante se espera a un momento seguro
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
await busca.waitFor();
await page.waitForFunction(() => !!window.compasDev);
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa/ }).first().click();

await page.evaluate(() => window.compasDev.simularActualizacion());
await busca.fill('visitante prueba');
await page.getByText('Nuevo: visitante prueba', { exact: false }).click();
await btn('Listo').waitFor();
await page.getByText('Puedes actualizar al terminar la cuenta.').waitFor();
console.log('1a) con una cuenta abierta se oculta la acción de actualizar:', ok((await btn('Actualizar').count()) === 0));
await segundoPlano();
console.log('1) con una cuenta abierta no se actualiza:', ok(!(await aplicada())));
await btn('Listo').click();
await btn('Actualizar').waitFor();
await page.waitForTimeout(200);
await segundoPlano();
await page.waitForFunction(() => !!window.__actualizada);
console.log('2) ya sin cuenta abierta, se actualiza al salir:', ok(await aplicada()));
await btn('Reintentar').waitFor({ timeout: 15000 });
await page.evaluate(() => { window.__actualizada = false; });
await btn('Reintentar').click();
await page.getByText('Actualizando…', { exact: true }).waitFor();
await page.waitForFunction(() => !!window.__actualizada);
console.log('3) si la página no se recarga, permite reintentar y muestra el progreso:', ok(await aplicada()));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
