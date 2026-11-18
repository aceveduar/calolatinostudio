import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarRentasDemo(); })));
await page.reload();
await page.getByText('Dirección Calo', { exact: true }).click();
for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await ir('/agenda');
await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor();

// 1) agregar el salón de arriba
await page.getByRole('button', { name: '+ Otro salón' }).click();
await dlg.getByPlaceholder('Ej. Salón de arriba').fill('Salón de arriba');
await dlg.getByRole('button', { name: 'Guardar', exact: true }).click();
await page.getByRole('button', { name: 'Salón de arriba', exact: true }).waitFor();
console.log('1) salón agregado (chips):', ok((await page.getByRole('button', { name: 'Salón principal', exact: true }).count()) === 1));

// 2) el salón de arriba empieza vacío
await page.getByRole('button', { name: 'Salón de arriba', exact: true }).click();
await page.waitForTimeout(300);
let t = await txt();
console.log('2) salón de arriba vacío:', ok(!/Jackson \(Salsa\)/.test(t.split(/Meta de|Rentas de/i)[0]) && /Sin clases ni rentas/.test(t)));

// 3) arriba se puede apartar a la misma hora que Jackson abajo (mar 16:00)
const apartar = async (nombre) => {
  await page.getByRole('button', { name: 'Apartar', exact: true }).click();
  await dlg.getByPlaceholder(/Profe Ana/).fill(nombre);
  await dlg.getByRole('button', { name: 'Mar', exact: true }).click();
  await dlg.locator('input[type="time"]').fill('16:00');
  await dlg.getByPlaceholder('$').fill('1500');
  await page.waitForTimeout(200);
};
await apartar('Profe Arriba');
const salonForm = await dlg.locator('select').first().inputValue();
const libreArriba = (await dlg.getByText('El salón ya está ocupado').count()) === 0;
await dlg.getByRole('button', { name: 'Apartar horario' }).click();
await page.getByText('Horario apartado').waitFor();
console.log('3) arriba no choca con abajo:', ok(libreArriba && salonForm !== ''));

// 4) abajo sigue bloqueado a esa hora
await page.getByRole('button', { name: 'Salón principal', exact: true }).click();
await apartar('Profe Abajo');
const bloqueado = (await dlg.getByText('El salón ya está ocupado').count()) === 1 && (await dlg.getByText(/Jackson/).count()) > 0;
console.log('4) abajo choca con Jackson:', ok(bloqueado));
await page.keyboard.press('Escape');

// 5) en la siguiente semana se ve la renta en arriba y no abajo
await page.getByRole('button', { name: 'Semana siguiente' }).click();
await page.waitForTimeout(300);
const abajo = (await txt()).split(/Meta de|Rentas de/i)[0];
await page.getByRole('button', { name: 'Salón de arriba', exact: true }).click();
await page.waitForTimeout(300);
const arriba = (await txt()).split(/Meta de|Rentas de/i)[0];
console.log('5) cada salón con su agenda:', ok(/Profe Arriba/.test(arriba) && !/Profe Arriba/.test(abajo) && /Jackson/.test(abajo) && !/Jackson/.test(arriba)));
await page.screenshot({ path: `${OUT}salones-1.png`, fullPage: true });

// 6) no se puede quitar un salón en uso
await page.getByRole('button', { name: 'Salones…' }).click();
console.log('6) salón en uso no se quita:', ok(await dlg.getByRole('button', { name: 'Quitar Salón de arriba' }).isDisabled()));
await page.keyboard.press('Escape');

// 7) la clase puede ir en el salón de arriba
await ir('/ajustes/clases');
await page.getByRole('button', { name: /Nueva clase/ }).click();
const conSalon = await dlg.getByText('Salón', { exact: true }).count();
console.log('7) clase con selector de salón:', ok(conSalon === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
