import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ancho = process.argv[2] === 'pc' ? { width: 1366, height: 900 } : { width: 390, height: 844 };
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: ancho, deviceScaleFactor: 2, isMobile: ancho.width < 500, hasTouch: true, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') }); // viernes con clases: la prueba no depende del día en que se corre
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const pesos = (s) => Number(s.replace(/[^0-9.-]/g, ''));
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarSedeDemo(); return window.compasDev.agregarGastosDemo(); })));
await page.reload();
await entrar('Dirección Calo', '1234');
const P = ancho.width < 500 ? 'm' : 'pc';

// 1) Reportes → tarjeta de utilidad
await page.getByRole('link', { name: 'Reportes' }).first().click();
await page.getByText(/Utilidad de /).waitFor();
await page.screenshot({ path: `${OUT}gasto-${P}-1-reportes.png` });
await page.getByRole('link', { name: /Utilidad de/ }).click();
await page.getByText('Gastos y utilidad').waitFor();
await page.waitForTimeout(400);
let t = await txt();
console.log('1) pantalla de gastos con fijos del mes:', ok(/Gastos fijos del mes/i.test(t) && /Registrar \$850/.test(t)), (t.match(/Utilidad .{0,60}/) || [''])[0]);
await page.screenshot({ path: `${OUT}gasto-${P}-2-mes.png`, fullPage: true });

// 2) registrar la luz con otro monto
const antes = pesos((await page.getByText(/^Utilidad /).locator('..').locator('p').nth(1).innerText()));
await page.getByRole('button', { name: 'Registrar $850' }).click();
const dlg = page.getByRole('dialog');
await dlg.getByRole('textbox').first().fill('912');
await page.screenshot({ path: `${OUT}gasto-${P}-3-luz.png` });
await dlg.getByRole('button', { name: /^Registrar \$912/ }).click();
await page.waitForTimeout(500);
const despues = pesos((await page.getByText(/^Utilidad /).locator('..').locator('p').nth(1).innerText()));
t = await txt();
console.log('2) luz registrada con $912 y la utilidad baja $912:', ok(!/Registrar \$850/.test(t) && /Luz Pagado el/.test(t) && Math.round(antes - despues) === 912), antes, despues);

// 3) gasto suelto en Casa de Cultura
await page.getByRole('button', { name: /Registrar gasto/ }).click();
await dlg.getByRole('button', { name: /Otro/ }).click();
await dlg.getByPlaceholder(/Garrafones/).fill('Bocina');
await dlg.getByPlaceholder('$').fill('1500');
await dlg.getByRole('button', { name: 'Efectivo', exact: true }).click();
await dlg.locator('select').selectOption({ label: 'Casa de Cultura' });
await dlg.getByRole('button', { name: /^Registrar \$1,500/ }).click();
await page.waitForTimeout(400);
t = await txt();
console.log('3) gasto suelto aparece en la lista:', ok(/Bocina .{0,40}efectivo · Casa de Cultura \$1,500/.test(t)));

// 4) filtro por sede
await page.getByRole('button', { name: 'Casa de Cultura', exact: true }).click();
await page.waitForTimeout(300);
t = await txt();
const lista = t.split(/Gastos registrados/i)[1] ?? '';
console.log('4) en Casa de Cultura solo sus gastos:', ok(/Bocina/.test(lista) && /Renta Casa de Cultura/.test(lista) && !/Internet/.test(lista)));
await page.getByRole('button', { name: 'Todas las sedes' }).click();

// 5) eliminar y deshacer
await page.getByRole('button', { name: /Bocina/ }).click();
await dlg.getByRole('button', { name: /Eliminar gasto/ }).click();
await page.waitForTimeout(300);
const sinBocina = !/Bocina/.test(await txt());
await page.getByRole('button', { name: 'Deshacer' }).click();
await page.waitForTimeout(400);
console.log('5) eliminar y deshacer:', ok(sinBocina && /Bocina/.test(await txt())));

// 6) nuevo gasto fijo
await page.getByRole('button', { name: 'Editar', exact: true }).click();
await dlg.getByRole('button', { name: /Nuevo gasto fijo/ }).click();
await dlg.getByRole('button', { name: /Maestros/ }).click();
await dlg.getByPlaceholder(/Maestros/).fill('Pago a Profe Luis');
await dlg.getByPlaceholder('$').fill('4000');
await dlg.getByRole('textbox').nth(2).fill('30');
await dlg.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
t = await txt();
console.log('6) gasto fijo nuevo pendiente (día 30 → 28):', ok(/Pago a Profe Luis Se paga el día 28/.test(t) && /Registrar \$4,000/.test(t)));

// 7) mes anterior: todos los fijos pagados
await page.getByRole('button', { name: 'Mes anterior' }).click();
await page.waitForTimeout(400);
t = await txt();
console.log('7) mes anterior: fijos pagados, sólo falta el nuevo:', ok((t.match(/Pagado el/g) || []).length >= 4 && (t.match(/Registrar \$/g) || []).length === 1 && /Registrar \$4,000/.test(t)));
await page.screenshot({ path: `${OUT}gasto-${P}-4-anterior.png`, fullPage: true });

// 8) recepción no entra
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Monse', '1111');
await page.evaluate(() => { history.pushState(null, '', '/reportes/gastos'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(400);
console.log('8) recepción no ve gastos:', ok(!(await page.getByText('Gastos y utilidad').count())));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
