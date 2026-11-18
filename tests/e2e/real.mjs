import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
for (const [P, vp] of [['m', { width: 390, height: 844 }], ['pc', { width: 1440, height: 900 }]]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: P === 'm' ? 2 : 1, isMobile: P === 'm', locale: 'es-MX' })).newPage();
  await page.goto('http://localhost:4173/a/calo-latino');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}real-${P}-1.png` });
  await page.locator('#ubicacion').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}real-${P}-2.png` });
}
await browser.close();
