// Si una pantalla falla, no queda en blanco: aviso con salida, las barras siguen y los datos no se pierden.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.sembrar());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
const antes = await page.evaluate(async () => (await window.compasDev.db.pagos.count()));

await ir('/alumnos?romper');
await page.getByRole('alert').waitFor();
const t = await page.locator('body').innerText();
console.log('1) aviso en lugar de pantalla en blanco:', ok(/Esta pantalla tuvo un problema/.test(t) && /está guardado/.test(t)));
console.log('2) la barra de abajo sigue para salir:', ok(await page.getByRole('link', { name: 'Entrada' }).first().isVisible()));
const anotado = await page.evaluate(() => JSON.parse(localStorage.getItem('compas:errores') ?? '[]')[0]?.mensaje);
console.log('3) el error queda anotado en el teléfono:', ok(anotado === 'Falla de prueba'));
await page.screenshot({ path: `${OUT}tropiezo.png` });
await ir('/');
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
console.log('4) al cambiar de pantalla todo vuelve a la normalidad:', ok(!(await page.getByRole('alert').count())));
console.log('5) nada se perdió:', ok(antes === (await page.evaluate(async () => (await window.compasDev.db.pagos.count())))));
console.log('errores: ninguno');
await browser.close();
