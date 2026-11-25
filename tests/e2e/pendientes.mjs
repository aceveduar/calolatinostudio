// Pendientes (Monse), bienvenida al registrar y lo que deja cada clase (dirección). Todo local, sin nube.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ancho = process.argv[2] === 'pc' ? { width: 1366, height: 900 } : { width: 360, height: 780 };
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
const renovaciones = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Avisar que vence su plan/ }) });
console.log('   los adeudos se muestran antes que las renovaciones:', ok(
  (await page.getByRole('region', { name: 'Deben clases' }).boundingBox()).y < (await renovaciones.boundingBox()).y,
));
await page.screenshot({ path: `${OUT}pend-${P}-2-lista.png`, fullPage: true, animations: 'disabled' });

// 2) WhatsApp con el texto de "vence" listo
const wa = renovaciones.getByRole('link', { name: /^Mandar WhatsApp a/ }).first();
const href = decodeURIComponent((await wa.getAttribute('href')) ?? '');
console.log('2) WhatsApp con el mensaje listo:', ok(/^https:\/\/wa\.me\/52\d{10}\?text=Hola .+ (vence|venció) el /.test(href)), href.slice(0, 110));

// 3) "ya le avisé" lo saca de la lista (y queda guardado en el alumno); deshacer lo regresa
const cuenta = async () => Number(((await txt()).match(/Avisar que vence su plan · (\d+)/i) || [0, 0])[1]);
const antes = await cuenta();
const confirmarAviso = renovaciones.getByRole('button', { name: /^Ya le avisé a/ }).first();
const nombre = (await confirmarAviso.getAttribute('aria-label')).replace('Ya le avisé a ', '');
await confirmarAviso.click();
await page.waitForTimeout(500);
const despues = await cuenta();
const guardado = await page.evaluate(async (n) => (await window.compasDev.db.alumnos.toArray()).find((a) => a.nombre === n)?.avisos, nombre);
const nDeshacer = await page.getByRole('button', { name: 'Deshacer' }).count();
await page.getByRole('button', { name: 'Deshacer' }).first().click();
await page.waitForTimeout(1200);
const tras = await page.evaluate(async (n) => (await window.compasDev.db.alumnos.toArray()).find((a) => a.nombre === n)?.avisos, nombre);
console.log('   deshacer:', nDeshacer, JSON.stringify(tras));
console.log('3) ya le avisé → sale, se guarda; deshacer lo regresa:', ok(despues === antes - 1 && guardado && Object.keys(guardado).some((k) => k.startsWith('vence:')) && (await cuenta()) === antes), antes, despues);

// 4) abrir WhatsApp no confirma que se envió el mensaje
const enlaceWa = wa;
await enlaceWa.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault())); // no salir a WhatsApp
await enlaceWa.click();
await page.waitForTimeout(800);
console.log('4) al abrir WhatsApp conserva el pendiente hasta confirmar:', ok((await cuenta()) === antes), await cuenta());

// 5) en "Más" aparece con su número
await page.getByRole('link', { name: 'Más' }).first().click();
const menu = page.locator('main');
const enlacePendientes = menu.getByRole('link', { name: /^Pendientes/ });
const contadorPendientes = enlacePendientes.getByText(/^\d+$/, { exact: true });
await contadorPendientes.waitFor();
console.log('5) Más muestra el contador y respeta los accesos de recepción:', ok(
  Number(await contadorPendientes.innerText()) > 0
  && (await menu.getByText('Tu academia', { exact: true }).count()) === 0
  && (await menu.getByRole('link', { name: /^Agenda del salón/ }).count()) === 0,
));
await page.screenshot({ path: `${OUT}pend-${P}-3-mas.png` });

// 6) alta de alumno → hoja para mandarle su acceso
await page.getByRole('link', { name: 'Alumnos', exact: true }).first().click();
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
await page.getByRole('link', { name: 'Más', exact: true }).first().click();
const academiaMenu = menu.getByText('Tu academia', { exact: true });
const paginaPublica = menu.getByRole('link', { name: /^Página pública/ });
await academiaMenu.waitFor();
console.log('   Dirección ve Agenda y los ajustes empiezan plegados:', ok(
  await menu.getByRole('link', { name: /^Agenda del salón/ }).isVisible() && !(await paginaPublica.isVisible()),
));
await page.screenshot({ path: `${OUT}pend-${P}-mas-direccion.png`, animations: 'disabled' });
await academiaMenu.click();
await paginaPublica.waitFor();
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

// 10) Avisar conserva el adeudo y el acceso directo al cobro.
await ir('/pendientes');
const primerAdeudo = page.getByRole('link', { name: /Ver adeudo/ }).first();
await primerAdeudo.waitFor();
const fichaAdeudo = await primerAdeudo.getAttribute('href');
const enlaceAdeudo = page.locator(`a[href="${fichaAdeudo}"]`);
const filaAdeudo = enlaceAdeudo.locator('..');
const idAdeudo = fichaAdeudo.split('/').at(-1).split('#')[0];
const nombreAdeudo = await page.evaluate(async (id) => (await window.compasDev.db.alumnos.get(id)).nombre, idAdeudo);
await filaAdeudo.getByRole('button', { name: /^Ya le avisé a/ }).click();
await filaAdeudo.getByText('Avisado', { exact: true }).waitFor();
await enlaceAdeudo.click();
const tarjetaAdeudo = page.locator('#adeudos');
const cobrar = tarjetaAdeudo.getByRole('button', { name: /Cobrar lo que debe/ });
await tarjetaAdeudo.getByText(nombreAdeudo, { exact: true }).waitFor();
await cobrar.click();
await page.getByText(/Adeudo cobrado/).waitFor();
await ir('/pendientes');
await page.getByRole('heading', { name: 'Pendientes', exact: true }).waitFor();
console.log('10a) cobrar desde el adeudo directo lo retira de Pendientes:', ok((await enlaceAdeudo.count()) === 0));
await ir('/caja');
const sedeCaja = page.getByRole('combobox', { name: 'Sede de Caja' });
await page.getByText('Total cobrado').waitFor();
if (await sedeCaja.locator('option[value="todas"]').count()) await sedeCaja.selectOption('todas');
await page.getByRole('button').filter({ hasText: nombreAdeudo }).filter({ hasText: /fiada/ }).first().waitFor();
console.log('10b) el cobro queda en Caja con la persona y la clase fiada:', 'OK');

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
