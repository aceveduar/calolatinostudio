// La cuenta de Entrada: si no hay dinero (entra con su plan) se cierra sola; si hay que cobrar, espera "Listo".
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
page.on('pageerror', (e) => errores.push(e.message));
await page.clock.install({ time: new Date('2026-11-18T19:05:00') });
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForTimeout(800);
const listo = page.getByRole('button', { name: 'Listo', exact: true });

// 1) alumno con plan: sin dinero, la cuenta se cierra sola
await page.locator('main button').filter({ hasText: /^.*Plan$/ }).first().click();
await page.getByText(/Entra con su plan · se cierra solo/).waitFor({ timeout: 3000 });
await page.screenshot({ path: `${OUT}cierre-plan.png` });
await page.clock.runFor(3000);
await page.waitForTimeout(300);
console.log('1) con plan: aviso "se cierra solo" y se cierra sin tocar Listo:', ok((await listo.count()) === 0));

// 2) alguien que paga: espera Listo (para ver el total y dar cambio)
await page.locator('main button').filter({ hasText: /Paga$/ }).first().click();
await page.getByText('Cobrar en efectivo').waitFor({ timeout: 3000 });
await page.clock.runFor(6000);
await page.waitForTimeout(300);
console.log('2) si hay que cobrar, la cuenta NO se cierra sola:', ok((await listo.count()) === 1));

// 3) mixto: uno paga y otro con plan → sigue esperando Listo
await page.locator('main button').filter({ hasText: /Plan$/ }).first().click();
await page.clock.runFor(4000);
await page.waitForTimeout(300);
console.log('3) pareja mixta (uno paga, otro con plan): sigue esperando Listo:', ok((await listo.count()) === 1));
await listo.click();
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
