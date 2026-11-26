import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pc = process.argv[2] === 'pc';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: pc ? { width: 1366, height: 900 } : { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: !pc, hasTouch: true, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-18T19:10:00') }); // miércoles a la hora de clases: la prueba no depende del reloj
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ir = async (r) => { await page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r); await page.waitForTimeout(400); };
const ok = (c) => (c ? 'OK' : 'MAL');
const P = pc ? 'pc' : 'm';
const txt = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const verRentas = async () => { await page.getByRole('button', { name: 'Rentas y meta', exact: true }).click(); await page.waitForTimeout(300); };
const verSemana = async () => { await page.getByRole('button', { name: 'Semana', exact: true }).click(); await page.waitForTimeout(300); };
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarSedeDemo(); return window.compasDev.agregarRentasDemo(); })));
// una clase del estudio para provocar un empalme
const clase = await page.evaluate(() => new Promise((res) => { const q = indexedDB.open('compas'); q.onsuccess = () => { q.result.transaction('clases').objectStore('clases').getAll().onsuccess = (e) => { const c = e.target.result.find((x) => !x.deletedAt && x.activo && !x.sedeId); res({ dia: c.dias[0], hora: c.horaInicio }); }; }; }));
await page.reload();
await entrar('Dirección Calo', '1234');

// 1) agenda de la semana
await ir('/agenda');
await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor();
await page.waitForTimeout(400);
let t = await txt();
console.log('1) semana con clases, rentas y huecos libres:', ok(/Jackson \(Salsa\)/.test(t) && /Yoga con Laura/.test(t) && /Libre: /.test(t)));
const diasAnteriores = page.getByText('Días anteriores de esta semana', { exact: true });
console.log('   la semana abre en hoy y deja los días anteriores plegados:', ok(
  await page.getByText('Miércoles 18', { exact: false }).first().isVisible()
  && !(await page.getByText('Lunes 16', { exact: true }).isVisible()),
));
await page.screenshot({ path: `${OUT}agenda-${P}-1.png`, animations: 'disabled' });
await diasAnteriores.click();
await page.getByText('Lunes 16', { exact: true }).waitFor();
await diasAnteriores.click();

// 2) cobros del mes en Rentas y meta
await verRentas();
t = await txt();
console.log('2) Laura pagada, Jackson por cobrar:', ok(/Yoga con Laura .{0,60}\$3,000/.test(t) && /Cobrar \$3,200/.test(t)));
await page.getByRole('button', { name: 'Mes anterior' }).click();
await page.getByRole('heading', { name: /Rentas de octubre/i }).waitFor();
await page.getByRole('button', { name: 'Volver al mes actual', exact: true }).click();
await page.getByRole('heading', { name: /Rentas de noviembre/i }).waitFor();
console.log('   Rentas y meta navega por meses:', ok(!await page.getByRole('button', { name: 'Semana siguiente' }).count()));

// 3) apartar encima de una clase → bloqueado
const dlg = page.getByRole('dialog');
await page.getByRole('button', { name: 'Apartar', exact: true }).click();
await dlg.getByText('Escribe quién renta.', { exact: true }).waitFor();
await dlg.getByPlaceholder(/Profe Ana/).fill('Profe Beto (Salsa)');
await dlg.getByRole('button', { name: DIAS[clase.dia], exact: true }).click();
await dlg.locator('input[type="time"]').fill(clase.hora);
await dlg.getByPlaceholder('$').fill('2000');
await page.waitForTimeout(200);
const bloqueado = (await dlg.getByText('El salón ya está ocupado').count()) === 1 && (await dlg.getByRole('button', { name: 'Apartar horario' }).isDisabled());
await page.screenshot({ path: `${OUT}agenda-${P}-2-empalme.png` });
console.log('3) empalme con clase bloquea:', ok(bloqueado), JSON.stringify(clase));

// 4) a una hora libre sí se aparta
await dlg.locator('input[type="time"]').fill('13:00');
await page.waitForTimeout(200);
await dlg.getByRole('button', { name: 'Apartar horario' }).click();
await page.getByText('Horario apartado').waitFor();
await verSemana();
await page.getByRole('button', { name: 'Semana siguiente' }).click();
await page.waitForTimeout(300);
t = await txt();
console.log('4) horario libre apartado (aparece desde la semana próxima):', ok(/13:00–14:00 Profe Beto \(Salsa\)/.test(t)));
await page.getByRole('button', { name: /Esta semana/ }).click();

// 5) evento encima del taller de todo el día → bloqueado
await page.getByRole('button', { name: 'Apartar', exact: true }).click();
await dlg.getByRole('button', { name: 'Evento / un día' }).click();
await dlg.getByPlaceholder(/Taller/).fill('Ensayo XV años');
const domingo = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
await dlg.locator('input[type="date"]').fill(domingo);
await dlg.locator('input[type="time"]').fill('10:00');
await dlg.getByPlaceholder('$').fill('800');
await page.waitForTimeout(200);
const choca = await dlg.getByText(/Evento de Taller de tango/).count();
console.log('5) evento encima del taller bloquea:', ok(choca === 1 && (await dlg.getByRole('button', { name: 'Apartar evento' }).isDisabled())));
await page.keyboard.press('Escape');

// 6) cobrar a Ana en efectivo → entra a la caja
await verRentas();
await page.getByRole('button', { name: 'Cobrar $3,200' }).click();
await dlg.getByRole('button', { name: 'Efectivo', exact: true }).click();
await dlg.getByRole('button', { name: /^Cobrar \$3,200/ }).click();
await page.getByText(/Renta cobrada/).waitFor();
await page.getByRole('link', { name: 'Caja' }).first().click();
await page.waitForTimeout(500);
t = await txt();
console.log('6) caja: renta separada y con nombre:', ok(/Renta del salón \$3,200/.test(t) && /Jackson \(Salsa\) Renta del salón · efectivo \$3,200/.test(t)));

// 7) terminar la renta de Beto: la semana siguiente ya no aparece
await ir('/agenda');
await verRentas();
await page.getByRole('button', { name: /Profe Beto/ }).first().click(); // en "Rentas de…"
await dlg.getByRole('button', { name: /Terminar renta/ }).click();
await page.waitForTimeout(300);
await verSemana();
await page.getByRole('button', { name: 'Semana siguiente' }).click();
await page.waitForTimeout(300);
console.log('7) renta terminada libera el horario:', ok(!/Profe Beto/.test((await txt()).split(/Rentas de/i)[0])));

// 8) aviso al crear una clase encima de una renta
await page.evaluate(() => { history.pushState(null, '', '/ajustes/clases'); dispatchEvent(new PopStateEvent('popstate')); });
await page.getByRole('button', { name: /Nueva clase/ }).first().click();
await dlg.getByRole('button', { name: 'Mar', exact: true }).click();
await dlg.locator('input[type="time"]').fill('17:30');
await page.waitForTimeout(200);
console.log('8) clase encima de renta avisa:', ok((await dlg.getByText(/rentado a Jackson/).count()) === 1));
await page.keyboard.press('Escape');

// 9) recepción: ve la agenda, no aparta ni cobra
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Monse', '1111');
await ir('/agenda');
await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor();
await page.getByText(/Jackson/).first().waitFor({ timeout: 5000 }).catch(() => {});
t = await txt();
console.log('9) recepción solo ve:', ok(!(await page.getByRole('button', { name: 'Apartar', exact: true }).count()) && !/Cobrar \$/.test(t) && /Jackson/.test(t)));
await page.screenshot({ path: `${OUT}agenda-${P}-3-recepcion.png` });

// 10) por hora, por alumno y meta
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Dirección Calo', '1234');
await ir('/agenda');
await page.getByRole('heading', { name: 'Agenda', exact: true }).waitFor();
await page.waitForTimeout(500);
await verRentas();
t = await txt();
console.log('10) contemporáneo por hora:', ok(/Maestra de contemporáneo .{0,80}\d+ h × \$150 = \$[\d,]+/.test(t)), (t.match(/\d+ h × \$150 = \$[\d,]+/) || [])[0]);
console.log('11) bachata por alumno:', ok(/\(comisión\) .{0,80}\d+ alumnos? × \$10 = \$[\d,]+/.test(t)), (t.match(/\d+ alumnos? × \$10 = \$[\d,]+/) || [])[0]);
console.log('12) meta $500 al día:', ok(/Meta de \w+ \$500 al día/i.test(t)), (t.match(/Meta de .{0,90}/i) || [])[0]);
await page.screenshot({ path: `${OUT}agenda-${P}-4-meta.png`, fullPage: true });
// 13) hora extra de Jackson
await page.getByRole('button', { name: /^Jackson \(Salsa\) Mar y Jue/ }).first().click();
await dlg.getByRole('button', { name: /Hora extra \(ensayo\) para Jackson/ }).click();
const precioExtra = await dlg.getByPlaceholder('$').inputValue();
await dlg.locator('input[type="date"]').fill(await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
await dlg.locator('input[type="time"]').fill('14:00');
await page.waitForTimeout(200);
await dlg.getByRole('button', { name: 'Apartar hora extra' }).click();
await page.getByText('Hora extra apartada').waitFor();
console.log('13) hora extra con precio $100:', ok(precioExtra === '100'));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
