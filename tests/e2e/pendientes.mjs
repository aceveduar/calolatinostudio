// Pendientes (Monse), bienvenida al registrar y lo que deja cada clase (dirección). Todo local, sin nube.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ancho = process.argv[2] === 'pc' ? { width: 1366, height: 900 } : { width: 390, height: 844 };
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: ancho, deviceScaleFactor: 2, isMobile: ancho.width < 500, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
// por si acaso: ninguna subida sale
await page.route(/rest\/v1\//, (r) => r.fulfill({ status: 201, body: '[]' }));
const ok = (c) => (c ? 'OK' : 'MAL');
const P = ancho.width < 500 ? 'm' : 'pc';
const dlg = page.getByRole('dialog');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  await page.keyboard.type(pin, { delay: 30 });
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(() => window.compasDev.demoCompleta())));
await page.reload();
await entrar('Monse', '1111');

// 1) botón de pendientes en Entrada
const pill = page.getByRole('link', { name: /pendientes?: a quién escribir/ });
await pill.waitFor();
await page.waitForTimeout(800);
const nPill = Number((await pill.innerText()).match(/\d+/)[0]);
await page.screenshot({ path: `${OUT}pend-${P}-1-entrada.png` });
await pill.click();
await page.getByRole('heading', { name: 'Pendientes' }).waitFor();
await page.waitForTimeout(500);
let t = await txt();
console.log('1) Entrada → Pendientes con secciones:', ok(nPill > 0 && /Avisar que vence su plan · \d+/i.test(t) && /Deben clases · \d+/i.test(t)), nPill, (t.match(/(Avisar que vence su plan|Deben clases|Rentas por cobrar|Dejaron de venir) · \d+/gi) || []).join(' | '), (t.match(/\d+ interesados? nuevos?|\d+ pedidos? listos?|\d+ encargos? por pedir/g) || []).join(' | '));
await page.screenshot({ path: `${OUT}pend-${P}-2-lista.png`, fullPage: true });

// 2) WhatsApp con el texto de "vence" listo
const wa = page.getByRole('link', { name: /^Mandar WhatsApp a/ }).first();
const href = decodeURIComponent((await wa.getAttribute('href')) ?? '');
console.log('2) WhatsApp con el mensaje listo:', ok(/^https:\/\/wa\.me\/52\d{10}\?text=Hola .+ (vence|venció) el /.test(href)), href.slice(0, 110));

// 3) "ya le avisé" lo saca de la lista (y queda guardado en el alumno); deshacer lo regresa
const cuenta = async () => Number(((await txt()).match(/Avisar que vence su plan · (\d+)/i) || [0, 0])[1]);
const antes = await cuenta();
const nombre = (await page.getByRole('button', { name: /^Ya le avisé a/ }).first().getAttribute('aria-label')).replace('Ya le avisé a ', '');
await page.getByRole('button', { name: /^Ya le avisé a/ }).first().click();
await page.waitForTimeout(500);
const despues = await cuenta();
const guardado = await page.evaluate(async (n) => (await window.compasDev.db.alumnos.toArray()).find((a) => a.nombre === n)?.avisos, nombre);
const nDeshacer = await page.getByRole('button', { name: 'Deshacer' }).count();
await page.getByRole('button', { name: 'Deshacer' }).first().click();
await page.waitForTimeout(1200);
const tras = await page.evaluate(async (n) => (await window.compasDev.db.alumnos.toArray()).find((a) => a.nombre === n)?.avisos, nombre);
console.log('   deshacer:', nDeshacer, JSON.stringify(tras));
console.log('3) ya le avisé → sale, se guarda; deshacer lo regresa:', ok(despues === antes - 1 && guardado && Object.keys(guardado).some((k) => k.startsWith('vence:')) && (await cuenta()) === antes), antes, despues);

// 4) el WhatsApp también lo marca
const enlaceWa = page.getByRole('link', { name: /^Mandar WhatsApp a/ }).first();
await enlaceWa.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault())); // no salir a WhatsApp
await enlaceWa.click();
await page.waitForTimeout(800);
console.log('4) al mandar el WhatsApp también sale de la lista:', ok((await cuenta()) === antes - 1), await cuenta());

// 5) en "Más" aparece con su número
await page.getByRole('link', { name: 'Más' }).first().click();
const tile = page.locator('main a[href="/pendientes"]');
await tile.waitFor();
await page.waitForFunction(() => /\d/.test(document.querySelector('main a[href="/pendientes"]')?.textContent ?? ''));
console.log('5) Más → mosaico Pendientes con número:', ok(/Pendientes\s*\d+|\d+\s*Pendientes/.test((await tile.innerText()).replace(/\s+/g, ' '))), (await tile.innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}pend-${P}-3-mas.png` });

// 6) alta de alumno → hoja para mandarle su acceso
await page.getByRole('link', { name: 'Alumnos' }).first().click();
await page.getByRole('button', { name: /Nuevo/ }).first().click();
await dlg.getByPlaceholder('Nombre y apellido').fill('Lucía Prueba');
await dlg.getByPlaceholder('10 dígitos').fill('5512340000');
await dlg.getByRole('button', { name: 'Registrar alumno' }).click();
await page.getByText('¡Lucía ya es alumno!').waitFor();
const acceso = page.getByRole('link', { name: 'Mandar por WhatsApp' });
await acceso.waitFor();
const hrefA = decodeURIComponent(await acceso.getAttribute('href'));
console.log('6) al registrarla sale "Mandar por WhatsApp" con su portal:', ok(/wa\.me\/525512340000/.test(hrefA) && /\/p\/[A-Za-z0-9]{26}/.test(hrefA) && /poner tu foto/.test(hrefA)));
await page.screenshot({ path: `${OUT}pend-${P}-4-bienvenida.png` });
await dlg.getByRole('button', { name: 'Ahora no' }).click();
await page.waitForTimeout(400);
await page.reload();
await page.getByText('Lucía Prueba').first().waitFor().catch(() => {});
await page.waitForTimeout(800);
const reabre = await page.getByText('¡Lucía ya es alumno!').count();
console.log('   al recargar no vuelve a salir:', ok(reabre === 0));

// 7) desde Interesados también
await page.goto('http://localhost:4173/');
await entrar('Monse', '1111').catch(() => {});
await ir('/alumnos/interesados');
await page.getByRole('button', { name: /^Registrar a .+ como alumno/ }).first().click();
await page.getByText(/ya es alumno!$/).waitFor();
console.log('7) registrar interesado → misma hoja:', 'OK');
await page.keyboard.press('Escape');

// 8) dirección: lo que deja cada clase
await page.getByRole('button', { name: /cambiar usuario/i }).first().click().catch(async () => { await page.getByRole('link', { name: 'Más' }).first().click(); await page.getByRole('button', { name: /Bloquear/ }).click(); });
await entrar('Dirección Calo', '1234');
await ir('/reportes');
await page.getByRole('link', { name: '¿Cuánto deja cada una?' }).click();
await page.getByText(/Lo que deja cada clase/i).waitFor();
await page.waitForTimeout(500);
t = await txt();
const seccion = t.split(/Lo que deja cada clase/i)[1].split(/Gastos registrados/i)[0];
console.log('8) por clase: entra, maestro y ganancia:', ok(/Entra \$[\d,]+/.test(seccion) && /maestro ~?\$[\d,]+/.test(seccion) && !/\.\d\d/.test(seccion) && /\(renta \$[\d,]+\)/.test(seccion)), seccion.slice(0, 400));
await page.getByText(/Lo que deja cada clase/i).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}pend-${P}-5-clases.png` });

// 9) registrar un pago a maestro eligiendo al maestro
await page.getByRole('button', { name: /Registrar gasto/ }).click();
await dlg.getByRole('button', { name: /Maestros/ }).click();
await dlg.getByPlaceholder('$').fill('500');
await dlg.locator('select').first().selectOption({ label: 'Profa Karla Méndez' });
await dlg.getByRole('button', { name: /^Registrar \$500/ }).click();
await page.waitForTimeout(500);
const g = await page.evaluate(async () => (await window.compasDev.db.gastos.toArray()).find((x) => x.monto === 50000 && x.categoria === 'maestros'));
const karla = await page.evaluate(async () => (await window.compasDev.db.maestros.toArray()).find((m) => /Karla/.test(m.nombre))?.id);
t = await txt();
console.log('9) pago a Karla guardado con su maestro y restado de sus clases:', ok(g?.maestroId === karla && /Karla Méndez .{0,140}maestro ~?\$[\d,]+/.test(t.split(/Lo que deja cada clase/i)[1])));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
