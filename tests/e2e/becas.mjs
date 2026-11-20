import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') }); // viernes con clases: la prueba no depende del día en que se corre
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (ruta) => page.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, ruta);
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarBecasDemo(); })));
await page.reload();
await entrar('Dirección Calo', '1234');

// 1) crear una beca desde Ajustes
await ir('/ajustes/planes');
await page.getByRole('button', { name: /Nuevo plan/ }).first().click();
await page.getByRole('dialog').getByRole('button', { name: 'Beca', exact: true }).click();
await page.getByRole('dialog').getByPlaceholder('Beca').fill('Beca deportiva');
const vig = await page.getByRole('dialog').getByRole('textbox').nth(1).inputValue();
await page.screenshot({ path: `${OUT}beca-1-form.png` });
await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(400);
const planesTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('1) beca creada (vigencia por defecto 180):', ok(vig === '180' && /Beca deportiva Clases ilimitadas por 180 días, sin costo/.test(planesTxt)), vig);

// 2) dar beca a un alumno sin plan
await ir('/alumnos');
await page.getByText('158 días').first().waitFor(); // estados cargados
await page.getByRole('button', { name: 'Sin plan', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('main .divide-y button').first().click();
await page.getByRole('button', { name: /Vender plan/ }).waitFor(); // que ya esté en la ficha del alumno
const nombre = (await page.locator('main h1, main h2').first().innerText()).trim();
await page.getByRole('button', { name: /Vender plan/ }).click();
await page.getByRole('dialog').getByRole('button', { name: /Beca deportiva/ }).click();
const hayMonto = await page.getByRole('dialog').getByText('Monto cobrado').count();
await page.screenshot({ path: `${OUT}beca-2-dar.png` });
await page.getByRole('dialog').getByRole('button', { name: /^Dar beca/ }).click();
await page.getByText(/Beca registrada hasta/).waitFor();
console.log('2) dar beca sin monto ni método:', ok(hayMonto === 0), nombre);

// 3) filtro Becados
await ir('/alumnos');
await page.getByRole('button', { name: 'Becados' }).click();
await page.waitForTimeout(300);
const becados = await page.locator('main .divide-y button').count();
console.log('3) filtro becados = 9:', ok(becados === 9), becados);

// 4) caja: la beca aparece sin costo y no suma
await ir('/caja');
await page.waitForTimeout(400);
const caja = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
console.log('4) caja muestra "Beca deportiva · sin costo":', ok(/Beca deportiva · sin costo \$0/.test(caja)));

// 5) reportes
await page.getByRole('link', { name: 'Reportes' }).click();
await page.getByText(/Becas · \d+ activas/).waitFor();
const rep = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const sec = await page.getByText(/Becas · \d+ activas/).locator('..');
await sec.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}beca-3-reportes.png` });
console.log('5) reportes: becas activas y asistencias:', ok(/Becas · 9 activas/i.test(rep) && /\d+ asistencias de becados/.test(rep)), rep.match(/Becas · .{0,140}/i)?.[0]);
const venceBeca = /Vencen esta semana[^]*?Beca ·/.test(rep.split('Dejaron de venir')[0].split('Vencen esta semana')[1] ?? '');
console.log('   las becas no salen en "Vencen esta semana":', ok(!venceBeca));

// 6) el becado entra sin pagar (Entrada)
await page.getByRole('link', { name: 'Entrada' }).click();
if (await page.getByText('Hoy no hay clases programadas').count()) {
  await page.getByRole('button', { name: /Elegir clase/ }).click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
}
await page.getByPlaceholder(/Quién llegó|Buscar…/).fill(nombre.split(' ').slice(0, 2).join(' '));
await page.waitForTimeout(400);
// nombre + inicial del apellido: evita tocar a otro alumno con el mismo nombre
await page.locator('main button').filter({ hasText: (() => { const [n, ap] = nombre.trim().split(/\s+/); return new RegExp(ap ? `${n} ${ap[0]}` : n); })() }).first().click();
await page.waitForTimeout(400);
const hoja = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('6) becado: entrada sin cobro:', ok(hoja.includes(nombre) && /Entra con su beca · se cierra solo/.test(hoja) && hoja.includes(nombre + " Beca") && !/\$\d+ Listo/.test(hoja)));
await page.getByRole('button', { name: 'Listo', exact: true }).click();
await page.screenshot({ path: `${OUT}beca-4-entrada.png` });
await page.keyboard.press('Escape');

// 7) recepción no puede dar becas
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Monse', '1111');
await ir('/alumnos');
await page.getByText(/\d+ días/).first().waitFor();
await page.getByRole('button', { name: 'Sin plan', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('main .divide-y button').nth(1).click();
await page.getByRole('button', { name: /Vender plan/ }).click();
await page.waitForTimeout(300);
console.log('7) recepción no ve becas al vender:', ok((await page.getByRole('dialog').getByText(/Beca/).count()) === 0));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
