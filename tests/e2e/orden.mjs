// Cuadrícula de Entrada: nada se mueve mientras se cobra; al volver a abrir, quien ya entró pasa al final.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
// nombres de la cuadrícula en orden (las fichas tienen "Paga", "Plan" o "Adentro")
const orden = () => page.locator('main .grid > button').evaluateAll((bs) => bs.map((b) => b.innerText.split('\n').find((l) => /\w+ \w\.|\w{3,}/.test(l) && !/^(Paga|Plan|Adentro)$/.test(l))));

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.ampliar(40); });
await page.reload();
await page.getByText('Monse', { exact: true }).click();
await page.keyboard.type('1111', { delay: 30 });
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await page.getByRole('button', { name: /Elegir clase|Otra/ }).click();
await page.getByRole('button', { name: /Salsa/ }).first().click();
await page.locator('main .grid > button').first().waitFor();
const antes = await orden();

// marca a los dos primeros (como si llegaran) y cierra cada cuenta
for (let i = 0; i < 2; i++) {
  await page.locator('main .grid > button').nth(i).click();
  await page.waitForTimeout(250);
  const listo = page.getByRole('button', { name: 'Listo' });
  if (await listo.isVisible()) await listo.click();
  await page.waitForTimeout(250);
}
const durante = await orden();
console.log('1) mientras se cobra nadie cambia de lugar:', ok(JSON.stringify(antes) === JSON.stringify(durante)), antes.slice(0, 3).join(', '));
const adentro = await page.locator('main .grid > button', { hasText: 'Adentro' }).count();
console.log('2) los marcados se ven como "Adentro":', ok(adentro === 2));

// momento seguro: salir y volver a la Entrada
await ir('/alumnos');
await page.waitForTimeout(400);
await ir('/');
await page.locator('main .grid > button').first().waitFor();
await page.waitForTimeout(800);
const despues = await orden();
console.log('3a) al volver sigue en la clase que eligió:', ok(despues.length === antes.length));
console.log('3b) al volver, quienes ya entraron pasan al final:', ok(despues.slice(-2).sort().join() === antes.slice(0, 2).sort().join() && despues[0] === antes[2]), JSON.stringify({ antes: antes.slice(0, 4), despues: despues.slice(0, 3), fin: despues.slice(-3), n: [antes.length, despues.length] }));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
