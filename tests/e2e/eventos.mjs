import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pc = process.argv[2] === 'pc';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: pc ? { width: 1366, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !pc, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ir = async (r) => { await page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await page.waitForTimeout(400); };
const ok = (c) => (c ? 'OK' : 'MAL');
const P = pc ? 'pc' : 'm';
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarEventosDemo(); })));
await page.reload();
await entrar('Dirección Calo', '1234');
await ir('/agenda');
await page.getByRole('link', { name: /Eventos/ }).click();
await page.getByText('Próximos', { exact: false }).first().waitFor();
await page.waitForTimeout(400);
let t = await txt();
console.log('1) lista: Navidad próximo, Muertos pasado y lleno:', ok(/Baile de Navidad .{0,60}23 de 60 boletos/.test(t) && /Fiesta de Día de Muertos .{0,60}50 de 50 boletos Lleno/.test(t)));
await page.screenshot({ path: `${OUT}eventos-${P}-1.png`, fullPage: true });

// 2) Día de Muertos: cifras y utilidad
await page.getByRole('button', { name: /Fiesta de Día de Muertos/ }).click();
await page.getByText(/Gastos del evento/i).waitFor();
t = await txt();
console.log('2) muertos: 50/50, 46 entraron, $7,500 − $1,800 = $5,700:', ok(/Boletos 50 \/ 50 cupo lleno/.test(t) && /Entraron 46 de 50/.test(t) && /Ingresos \$7,500/.test(t) && /Utilidad \$5,700/.test(t)));
await page.screenshot({ path: `${OUT}eventos-${P}-2-muertos.png`, fullPage: true });

// 3) nuevo evento encima de una clase → bloqueado; a otra hora sí
await page.getByRole('link', { name: 'Volver a eventos' }).click();
await page.getByRole('button', { name: /Nuevo/ }).click();
const lunes = new Date(); lunes.setDate(lunes.getDate() + ((8 - lunes.getDay()) % 7 || 7));
await dlg.getByPlaceholder(/Baile de Navidad/).fill('Taller de verano');
await dlg.locator('input[type="date"]').fill(local(lunes));
await dlg.locator('input[type="time"]').fill('19:00');
await dlg.getByPlaceholder('Sin límite').fill('3');
await dlg.getByPlaceholder('$').fill('100');
await page.waitForTimeout(200);
const bloqueado = (await dlg.getByText(/El salón ya está ocupado/).count()) === 1 && (await dlg.getByRole('button', { name: 'Crear evento' }).isDisabled());
await dlg.locator('input[type="time"]').fill('14:00');
await page.waitForTimeout(200);
const enPagina0 = await dlg.getByRole('switch', { name: /página pública/ }).getAttribute('aria-checked');
await dlg.getByRole('switch', { name: /portal de los alumnos/ }).click();
await dlg.getByRole('button', { name: 'Crear evento' }).click();
await page.getByText(/Evento creado/).waitFor();
console.log('3) evento sobre una clase se bloquea; a otra hora se crea:', ok(bloqueado));
const ev = await page.evaluate(async () => (await window.compasDev.db.eventos.toArray()).find((e) => e.nombre === 'Taller de verano'));
console.log('3b) se decide dónde se anuncia (por defecto en todos lados; aquí, no en el portal):', ok(enPagina0 === 'true' && ev.enPagina === true && ev.enPortal === false));

// 4) vender con cupo
await page.getByRole('button', { name: /Vender boleto/ }).click();
await dlg.getByPlaceholder('A nombre de…').fill('Lucía Prueba');
await dlg.getByRole('button', { name: 'Uno más' }).click();
await dlg.getByRole('button', { name: /Cobrar \$200/ }).click();
await page.getByText(/2 boletos vendidos/).waitFor();
await page.getByRole('button', { name: /Vender boleto/ }).click();
const maxUno = await dlg.getByRole('button', { name: 'Uno más' }).isDisabled();
await dlg.getByPlaceholder('A nombre de…').fill('Pedro Prueba');
await dlg.getByRole('button', { name: /Cobrar \$100/ }).click();
await page.getByText(/1 boleto vendido/).waitFor();
await page.waitForTimeout(300);
t = await txt();
console.log('4) cupo: no deja pasar de 3 y se llena:', ok(maxUno && /Boletos 3 \/ 3 cupo lleno/.test(t) && (await page.getByRole('button', { name: 'Cupo lleno' }).isDisabled())));

// 5) entrada y gasto
const buscarBoleto = page.getByRole('textbox', { name: 'Buscar boleto por nombre o código' });
await buscarBoleto.fill('Sin coincidencias');
await page.getByText('Ningún boleto coincide con la búsqueda.').waitFor();
await buscarBoleto.fill('Pedro');
await page.getByRole('button', { name: 'Dar entrada a Pedro Prueba' }).click();
await page.getByRole('button', { name: 'Entró · quitar entrada de Pedro Prueba' }).waitFor();
await buscarBoleto.clear();
await page.getByRole('button', { name: '+ Gasto' }).click();
await dlg.getByPlaceholder(/Decoración/).fill('Botanas');
await dlg.getByPlaceholder('$').fill('50');
await dlg.getByRole('button', { name: /Registrar \$50/ }).click();
await page.waitForTimeout(400);
t = await txt();
console.log('5) entrada marcada y utilidad $300 − $50:', ok(/Entraron 1 de 3/.test(t) && /Utilidad \$250/.test(t)));
await page.screenshot({ path: `${OUT}eventos-${P}-3-nuevo.png`, fullPage: true });

// 6) cancelar una venta libera lugares
await page.getByRole('button', { name: /^Lucía Prueba \(1\/2\)/ }).click();
await dlg.getByRole('button', { name: /Cancelar esta venta/ }).click();
await dlg.getByRole('button', { name: 'Confirmar cancelación de venta' }).click();
await page.waitForTimeout(400);
t = await txt();
console.log('6) cancelar venta libera 2 lugares:', ok(/Boletos 1 \/ 3 quedan 2/.test(t) && /Ingresos \$100/.test(t)));

// 7) caja: eventos aparte
await page.getByRole('link', { name: 'Caja' }).first().click();
await page.waitForTimeout(400);
t = await txt();
console.log('7) caja con eventos aparte:', ok(/Eventos \$[\d,]+/.test(t)), (t.match(/Eventos \$[\d,]+/) || [])[0]);

// 8) en la agenda aparece como evento propio
await ir('/agenda');
await page.getByRole('button', { name: 'Semana siguiente' }).click();
await page.waitForTimeout(300);
t = await txt();
console.log('8) agenda muestra el evento propio:', ok(/Taller de verano Evento\b/.test(t)));
await page.getByRole('button', { name: /Taller de verano/ }).first().click();
await page.getByText(/Gastos del evento/i).waitFor();
console.log('   tocarlo abre el evento: OK');

// 9) recepción vende pero no crea
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Monse', '1111');
await ir('/agenda/eventos');
await page.getByText('Próximos').first().waitFor();
const sinNuevo = (await page.getByRole('button', { name: /Nuevo/ }).count()) === 0;
await page.getByRole('button', { name: /Baile de Navidad/ }).click();
await page.getByText(/Gastos del evento/i).waitFor();
console.log('9) recepción vende, no crea:', ok(sinNuevo && (await page.getByRole('button', { name: /Vender boleto/ }).count()) === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
