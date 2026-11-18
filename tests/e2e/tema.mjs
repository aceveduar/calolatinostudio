import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
for (const [P, vp, tema] of [['m', { width: 390, height: 844 }, 'light'], ['pc', { width: 1440, height: 900 }, 'light'], ['m', { width: 390, height: 844 }, 'dark'], ['pc', { width: 1440, height: 900 }, 'dark']]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: P === 'm' ? 2 : 1, isMobile: P === 'm', locale: 'es-MX', colorScheme: tema })).newPage();
  await page.goto('http://localhost:4173/a/calo-latino');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}t-${tema}-${P}-1.png` });
  for (const [n, sel] of [['2', '#horarios'], ['3', '#comunidad'], ['4', '#ubicacion']]) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, -70));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}t-${tema}-${P}-${n}.png` });
  }
  console.log(P, tema, 'alto', await page.evaluate(() => document.documentElement.scrollHeight));
}
await browser.close();
