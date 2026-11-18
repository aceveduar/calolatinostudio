import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
for (const port of [5173, 4173]) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.goto(`http://localhost:${port}/p/x7BUpRTKkV2b5pDp8kBQQ6cynd`);
  await page.waitForTimeout(4000);
  console.log(port, '→', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160), errs.length ? 'ERR ' + errs.join(' | ').slice(0, 300) : '');
  await page.screenshot({ path: `${OUT}verportal-${port}.png` });
}
await browser.close();
