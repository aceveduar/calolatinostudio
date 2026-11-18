import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];

// 1) Medianoche y fin de turno (reloj simulado)
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  await page.clock.install({ time: new Date('2026-11-13T23:58:00') });
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  await page.evaluate(() => window.compasDev.sembrar());
  await page.reload();
  await page.getByText('Monse', { exact: true }).click();
  for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  const antes = await page.locator('main').innerText();
  await page.clock.fastForward('03:00');
  await page.waitForTimeout(1500);
  const despues = await page.locator('main').innerText();
  console.log('1a) antes de medianoche dice viernes 13:', ok(/viernes, 13/i.test(antes)));
  console.log('1b) después cambia solo a sábado 14:', ok(/sábado, 14/i.test(despues)));
  console.log('1c) y muestra las clases del sábado:', ok(/Lady Style/.test(despues) && !/Salsa 1\s*\n?\s*Lun/.test(despues)));
  await page.clock.fastForward('10:30:00');
  await page.waitForTimeout(1500);
  console.log('2) al cumplirse el turno de 10 h se bloquea:', ok((await page.getByText('¿Quién eres?').count()) > 0));
  await ctx.close();
}

// 2) Teclado en ventanas (PC)
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-MX' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  await page.evaluate(() => window.compasDev.sembrar());
  await page.reload();
  await page.getByText('Monse', { exact: true }).click();
  for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  const abridor = page.getByRole('button', { name: 'Escanear QR' });
  await abridor.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.waitForTimeout(300);
  let dentro = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    dentro &&= await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
  }
  console.log('3a) Tab se queda dentro de la ventana:', ok(dentro));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  console.log('3b) al cerrar, el foco vuelve al botón que la abrió:', ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Escanear QR')));
  // escribir en un campo de una ventana no pierde el foco
  await page.getByRole('button', { name: /Visitante con nombre/ }).click();
  await page.getByPlaceholder('Visitante').click();
  await page.keyboard.type('Pepe Grillo');
  console.log('3c) escribir dentro de la ventana no pierde el foco:', ok((await page.getByPlaceholder('Visitante').inputValue()) === 'Pepe Grillo'));
  await ctx.close();
}
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
