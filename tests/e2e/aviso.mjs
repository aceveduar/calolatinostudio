import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-13T17:25:00') });
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.sembrar());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
const chips = await page.getByRole('dialog').getByRole('button').filter({ hasText: /\d{2}:\d{2}/ }).allInnerTexts();
await page.keyboard.press('Escape');
console.log('hora navegador:', await page.evaluate(() => new Date().toString()));
console.log('clases de hoy:', chips.map((c) => c.replace(/\s+/g, ' ')));
for (const n of ['Salsa 0', 'Salsa 1']) {
  await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: n }).first().click();
  await page.waitForTimeout(400);
  console.log(n, '→ aviso:', (await page.locator('main').innerText()).match(/La clase de ahora es [^.]+|no es clase de hoy/)?.[0] ?? 'ninguno');
}
await browser.close();
