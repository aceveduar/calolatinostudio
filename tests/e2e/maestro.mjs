import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-18T19:10:00') }); // miércoles a la hora de clases: la prueba no depende del reloj
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const btn = (t) => page.getByRole('button', { name: t });
const entrarComo = async (quien, pin) => {
  await page.getByText(quien, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(700);
};
const bloquear = async () => { await page.getByRole('button', { name: /cambiar usuario/ }).first().click(); await page.getByText('¿Quién eres?').waitFor(); };

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.sembrar());
await page.reload();

// 1) Dueño da acceso a Profe Luis
await entrarComo('Dirección Calo', '1234');
await page.getByRole('link', { name: 'Más' }).first().click();
const usuarios = page.getByRole('link', { name: /^Usuarios y PIN/ });
if (!await usuarios.isVisible()) await page.getByText('Tu academia', { exact: true }).click();
await usuarios.click();
await btn('Nuevo usuario').click();
await page.getByRole('dialog').getByRole('button', { name: 'Maestro' }).click();
await page.getByRole('dialog').getByLabel('Ficha del maestro').selectOption({ label: 'Profe Luis Herrera' });
await page.getByPlaceholder('••••').fill('582736');
await page.screenshot({ path: `${OUT}m-0-alta-maestro.png` });
await btn('Guardar').click();
await page.getByText('Usuario guardado').waitFor();
console.log('1) acceso de maestro creado: OK');
await page.getByRole('button', { name: /Profe Luis Herrera/ }).click();
const fichaAcceso = page.getByRole('dialog').getByLabel('Ficha del maestro');
const vinculada = await fichaAcceso.inputValue();
await page.getByRole('dialog').getByRole('button', { name: 'Recepción' }).click();
const oculta = !await fichaAcceso.isVisible();
await page.getByRole('dialog').getByRole('button', { name: 'Maestro' }).click();
console.log('   ficha vinculada visible solo para Maestro:', ok(oculta && !!vinculada && await fichaAcceso.inputValue() === vinculada));
await page.keyboard.press('Escape');

// 2) Monse cobra en Salsa 0 (clase de Luis)
await bloquear();
await entrarComo('Monse', '1111');
console.log('2a) recepción empieza en Entrada:', ok(new URL(page.url()).pathname === '/'));
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /^Salsa 0/ }).first().click();
await page.waitForTimeout(400);
const fichas = page.locator('main button').filter({ hasText: /Paga|Plan/ });
for (let i = 0; i < 3; i++) { await fichas.nth(i).click(); await btn('Listo').click(); }
await page.getByPlaceholder(/Quién llegó|Buscar…/).fill('Pedro Nuevo');
await page.getByText('Nuevo: Pedro Nuevo').click();
await btn('Listo').click();
await btn(/sin nombre/).click();
await btn('Listo').click();
console.log('2) recepción dio 5 entradas en Salsa 0: OK');

// 3) Maestro entra
await bloquear();
await page.screenshot({ path: `${OUT}m-1-quien-eres.png` });
await entrarComo('Profe Luis Herrera', '582736');
await page.getByText('Quién llegó').waitFor();
// la clase de hoy del maestro puede ser otra: elegir Salsa 0 si hay varias
const chip = page.getByRole('button', { name: /^Salsa 0/ });
if (await chip.count()) await chip.first().click();
await page.waitForTimeout(600);
const texto = await page.locator('body').innerText();
await page.screenshot({ path: `${OUT}m-2-maestro.png`, fullPage: true });
console.log('3a) ve 5 en la lista:', ok(/\b5\b[\s\S]*alumnos/.test(texto)));
console.log('3b) marca "Primera clase" a Pedro:', ok(/Pedro Nuevo[\s\S]{0,40}Primera clase/.test(texto)));
console.log('3c) ningún $ en pantalla:', ok(!texto.includes('$')));
const nav = await page.locator('nav a, aside nav a').allInnerTexts();
console.log('3d) menú solo "Mis clases":', JSON.stringify(nav.filter(Boolean)), ok(!nav.join(' ').match(/Caja|Reportes|Ajustes|Alumnos/)));
await page.goto('http://localhost:4173/caja');
await page.getByText('Quién llegó').waitFor();
console.log('3e) /caja lo regresa a Mis clases:', ok(page.url().endsWith('/')));

// 4) En laptop
await page.setViewportSize({ width: 1366, height: 820 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}m-3-maestro-escritorio.png` });
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
