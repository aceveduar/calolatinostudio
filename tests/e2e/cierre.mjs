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
const listo = page.getByRole('button', { name: 'Cerrar cuenta', exact: true });

// 1) alumno con plan: sin dinero, la cuenta se cierra sola
await page.locator('main button').filter({ hasText: /^.*Plan$/ }).first().click();
await page.getByText(/con su (plan|beca)/).waitFor({ timeout: 3000 });
const cuentaAtras = page.locator('[data-cierre-solo]');
const habia = (await cuentaAtras.count()) === 1;
await page.screenshot({ path: `${OUT}cierre-plan.png` });
await page.clock.runFor(3000);
await page.waitForTimeout(300);
console.log('1) con plan: barrita de cuenta atrás y se cierra sin tocar Listo:', ok(habia && (await listo.count()) === 0));

// 2) alguien que paga: espera Listo (para ver el total y dar cambio)
await page.locator('main button').filter({ hasText: /Cobrar \$[\d,]+$/ }).first().click();
await page.getByText('Efectivo a recibir').waitFor({ timeout: 3000 });
await page.clock.runFor(6000);
await page.waitForTimeout(300);
console.log('2) si hay que cobrar, la cuenta NO se cierra sola:', ok((await listo.count()) === 1));

// 3) mixto: uno paga y otro con plan → sigue esperando Listo
await page.locator('main button').filter({ hasText: /Plan$/ }).first().click();
await page.clock.runFor(4000);
await page.waitForTimeout(300);
console.log('3) pareja mixta (uno paga, otro con plan): sigue esperando Listo:', ok((await listo.count()) === 1));
await listo.click();

// 4) con plan, pero recepción toca la cuenta: el cierre se detiene (p. ej. para agregarle un agua con calma)
await page.locator('main button').filter({ hasText: /Plan$/ }).nth(1).click();
await cuentaAtras.waitFor({ timeout: 3000 });
await page.getByText(/con su (plan|beca)/).click();
await page.clock.runFor(5000);
await page.waitForTimeout(300);
console.log('4) al tocar la cuenta deja de cerrarse sola y se quita la barrita:', ok((await listo.count()) === 1 && (await cuentaAtras.count()) === 0));

// 5) tocar su nombre en la cuenta abre sus opciones (el camino visible a "mantén presionado")
await page.getByRole('button', { name: /^Opciones de / }).first().click();
await page.getByRole('button', { name: /Vender mensualidad o paquete/ }).waitFor({ timeout: 3000 }).catch(() => {});
await page.screenshot({ path: `${OUT}cierre-opciones.png` });
console.log('5) tocar su nombre en la cuenta abre sus opciones:', ok((await page.getByRole('button', { name: /Vender mensualidad o paquete/ }).count()) === 1));
await page.keyboard.press('Escape');
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
