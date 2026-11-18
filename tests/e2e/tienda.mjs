import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
for (const [modo, vp, movil] of [['movil', { width: 390, height: 844 }, true], ['pc', { width: 1366, height: 768 }, false]]) {
  const page = await (await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: movil, hasTouch: movil, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') }); // viernes con clases: la prueba no depende del día en que se corre
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  console.log(modo, 'tienda demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); return window.compasDev.agregarTiendaDemo(); })));
  await page.reload();
  await page.getByText('Monse', { exact: true }).click();
  for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
  await page.waitForTimeout(600);
  // alumno que paga clase
  await page.locator('main button').filter({ hasText: /Paga$/ }).first().click();
  await page.waitForTimeout(300);
  // tienda: 2 aguas, 1 galleta, 1 barrita y quitar la barrita
  await page.getByRole('button', { name: 'Tienda', exact: true }).click();
  const dlg = page.getByRole('dialog');
  const antes = await dlg.getByRole('button', { name: /Agregar Barrita/ }).innerText();
  await dlg.getByRole('button', { name: /Agregar Agua 600 ml/ }).click();
  await dlg.getByRole('button', { name: /Agregar Agua 600 ml/ }).click();
  await dlg.getByRole('button', { name: /Agregar Galletas/ }).click();
  await dlg.getByRole('button', { name: /Agregar Barrita/ }).click();
  await page.waitForTimeout(400);
  const despues = await dlg.getByRole('button', { name: /Agregar Barrita/ }).innerText();
  console.log(modo, 'existencias bajan al vender (Barrita):', antes.match(/Quedan \d+|Agotado/)?.[0], '→', despues.match(/Quedan \d+|Agotado/)?.[0]);
  await page.screenshot({ path: `${OUT}tienda-${modo}-hoja.png` });
  await dlg.getByRole('button', { name: 'Quitar un Barrita' }).click();
  await page.waitForTimeout(300);
  await dlg.getByRole('button', { name: /^Listo · cuenta/ }).click();
  await page.waitForTimeout(400);
  const cuenta = (await page.locator(movil ? 'body' : 'aside.sticky.top-6').innerText()).replace(/\s+/g, ' ');
  console.log(modo, 'cuenta: clase + Agua ×2 + Galletas = $85:', ok(/Agua 600 ml\s*×2\s*\$30/.test(cuenta) && /Galletas\s*\$15/.test(cuenta) && /\$85/.test(cuenta) && !/Barrita/.test(cuenta)));
  await page.locator('button', { hasText: /^\$100$/ }).click();
  await page.getByText('Cambio $15').waitFor({ timeout: 3000 });
  console.log(modo, 'cambio de $100: $15: OK');
  await page.screenshot({ path: `${OUT}tienda-${modo}-cuenta.png` });
  await page.getByRole('button', { name: 'Listo', exact: true }).click();
  await page.getByRole('link', { name: 'Caja' }).first().click();
  const caja = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
  console.log(modo, 'caja separa:', caja, ok(/Clases \$40 · Tienda \$45/.test(caja)));
  await page.screenshot({ path: `${OUT}tienda-${modo}-caja.png`, fullPage: true });
}
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
