import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' })).newPage();
await page.goto('http://localhost:4173/a/calo-latino');
await page.getByRole('heading', { level: 1 }).waitFor();
await page.waitForTimeout(800);
console.log('oferta:', await page.locator('header p', { hasText: 'Clase de prueba' }).innerText());
for (const [n, sel] of [['disc', '#clases'], ['tienda', 'text=Lleva tu estilo']]) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, -120));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}real2-${n}.png` });
}
await browser.close();
