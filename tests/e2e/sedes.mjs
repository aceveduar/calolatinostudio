import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
await page.clock.install({ time: new Date('2026-11-14T10:30:00') }); // sábado: hay clases en ambas sedes
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const main = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); return window.compasDev.agregarSedeDemo(); })));
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await page.getByRole('button', { name: 'Cobrar $60 sin nombre', exact: true }).waitFor();
let t = await main();
console.log('1) arranca en Estudio Calo con precio $60:', ok(t.includes('Estudio Calo') && t.includes('+$60')));
const claseActiva = page.getByRole('button', { name: /^Clase:/ }).first();
console.log('   clase activa del Estudio:', ok(!(await claseActiva.count()) || /Estudio Calo/.test(await claseActiva.getAttribute('aria-label'))));
await page.screenshot({ path: `${OUT}sede-1-estudio.png` });
if (await page.getByText('Hoy no hay clases programadas').count()) {
  await page.getByRole('button', { name: /Elegir clase/ }).click();
  await page.getByRole('dialog').getByRole('button').filter({ hasText: /\d{2}:\d{2}/ }).first().click();
  await page.waitForTimeout(300);
}
await page.getByRole('button', { name: /sin nombre/ }).click();
await page.getByText('Termina la cuenta para cambiar de sede.').waitFor();
console.log('   con una cuenta abierta no se cambia de sede:', ok(await page.getByRole('button', { name: 'Cambiar sede', exact: true }).isDisabled()));
await page.getByRole('button', { name: 'Listo', exact: true }).click();
// cambiar a Casa de Cultura
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').getByRole('button', { name: /Cambiar sede/ }).click();
await page.screenshot({ path: `${OUT}sede-2-elegir.png` });
await page.getByRole('dialog').getByRole('button', { name: /Casa de Cultura/ }).click();
await page.waitForTimeout(600);
t = await main();
console.log('2) en Casa de Cultura: precio $40 y solo sus clases:', ok(t.includes('Casa de Cultura') && t.includes('+$40') && /Lady Style|Salsa 0|Bachata 0/.test(t) && !/Cumbia/.test(t)));
await page.screenshot({ path: `${OUT}sede-3-cdc.png` });
await page.getByRole('button', { name: /sin nombre/ }).click();
await page.getByRole('button', { name: 'Listo', exact: true }).click();
// un alumno con mensualidad general entra sin pagar también aquí
await page.locator('main button').filter({ hasText: /Plan$/ }).first().click().catch(() => {});
await page.waitForTimeout(400);
const cuentaPlan = await page.locator('body').innerText();
console.log('3) mensualidad general sirve en Casa de Cultura:', ok(/Plan/.test(cuentaPlan)));
await page.getByRole('button', { name: 'Listo', exact: true }).click().catch(() => {});
// Caja de Casa de Cultura (Monse no ve "Todas")
await page.getByRole('link', { name: 'Caja' }).click();
let caja = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
console.log('4) caja Casa de Cultura = $40:', caja, ok(caja.includes('Total cobrado $40')));
console.log('   recepción no ve "Todas las sedes":', ok((await page.getByRole('button', { name: 'Todas las sedes' }).count()) === 0));
await page.getByRole('button', { name: 'Estudio Calo' }).click();
await page.waitForTimeout(400);
caja = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
console.log('5) caja Estudio = $60:', caja, ok(caja.includes('Total cobrado $60')));
// corte en Casa de Cultura
await page.getByRole('button', { name: 'Casa de Cultura' }).click();
await page.getByRole('button', { name: /Hacer corte/ }).click();
await page.getByRole('dialog').getByPlaceholder('0').last().fill('40'); // el primero es la feria
await page.getByRole('button', { name: 'Guardar corte' }).click();
await page.getByText(/Corte hecho/).waitFor();
await page.getByRole('button', { name: 'Estudio Calo' }).click();
await page.waitForTimeout(400);
console.log('6) el corte es por sede (Estudio sigue sin corte):', ok((await page.getByText(/Corte hecho/).count()) === 0));
// Dueño: todas y reportes por sede
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await page.getByText('Dirección Calo', { exact: true }).click();
for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByRole('link', { name: 'Caja' }).click();
await page.getByRole('button', { name: 'Todas las sedes' }).click();
await page.waitForTimeout(400);
caja = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
console.log('7) dueño ve todas = $100:', ok(caja.includes('Total cobrado $100')));
await page.getByRole('link', { name: 'Reportes' }).click();
await page.getByText('Por sede').waitFor();
await page.screenshot({ path: `${OUT}sede-4-reportes.png`, fullPage: true });
t = await main();
console.log('8) reportes por sede:', ok(/Estudio Calo \$[\d,]+/.test(t) && /Casa de Cultura \$[\d,]+/.test(t)));
await page.evaluate(() => { history.pushState(null, '', '/ajustes/sedes'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}sede-5-ajustes.png`, fullPage: true });

// 9) dos clases simultáneas y traslado cuando solo queda una sede con clase.
const clasesDePrueba = await page.evaluate(async () => {
  const { db } = window.compasDev;
  const casa = await db.sedes.toCollection().first();
  const clases = await db.clases.toArray();
  const estudio = clases.find((c) => !c.sedeId && c.activo);
  const cultura = clases.find((c) => c.sedeId === casa.id && c.activo);
  await db.meta.put({ key: 'sedeActual', value: null });
  await db.clases.bulkPut(clases.map((c) => c.id === estudio.id || c.id === cultura.id
    ? { ...c, dias: [6], horaInicio: '10:40', duracionMin: 60, curso: null }
    : { ...c, activo: false }));
  return { estudio: estudio.id, cultura: cultura.id, casa: casa.id };
});
await page.getByRole('link', { name: 'Entrada', exact: true }).click();
await page.getByRole('button', { name: /Clase: .*Estudio Calo/ }).waitFor();
const sugerencia = page.getByRole('button', { name: 'Cambiar a Casa de Cultura', exact: true });
console.log('9a) las clases simultáneas conservan la sede y permiten cambiar a mano:', ok((await sugerencia.count()) === 0
  && await page.getByRole('button', { name: 'Cambiar sede', exact: true }).isEnabled()));
await page.evaluate((id) => window.compasDev.db.clases.update(id, { activo: false }), clasesDePrueba.estudio);
await sugerencia.click();
await page.getByRole('button', { name: /Clase: .*Casa de Cultura/ }).waitFor();
await page.getByRole('button', { name: /Cobrar \$40 sin nombre/ }).click();
await page.getByRole('button', { name: 'Listo', exact: true }).click();
const registro = await page.evaluate(async (clase) => {
  const { db } = window.compasDev;
  const asistencias = await db.asistencias.where('[claseId+fecha]').equals([clase, '2026-11-14']).filter((a) => !!a.pagoId && !a.alumnoId).sortBy('createdAt');
  const asistencia = asistencias.at(-1);
  return asistencia && { clase: asistencia.claseId, sede: (await db.pagos.get(asistencia.pagoId))?.sedeId };
}, clasesDePrueba.cultura);
console.log('9b) el cambio sugerido abre esa clase y cobra en su sede:', ok(registro?.clase === clasesDePrueba.cultura && registro.sede === clasesDePrueba.casa));

// La sugerencia deja seleccionada la clase. Un cambio de horario debe reflejarse
// y una clase desactivada debe salir de Entrada aunque estuviera seleccionada.
await page.evaluate((id) => window.compasDev.db.clases.update(id, { horaInicio: '11:20' }), clasesDePrueba.cultura);
await page.getByRole('button', { name: /Clase: .*11:20.*Casa de Cultura/ }).waitFor();
await page.evaluate((id) => window.compasDev.db.clases.update(id, { activo: false }), clasesDePrueba.cultura);
await page.getByRole('button', { name: /Hoy no hay clases.*Elegir clase/ }).waitFor();
console.log('10) Entrada refleja la hora nueva y descarta la clase desactivada:', ok((await page.getByRole('button', { name: /^Clase:/ }).count()) === 0));

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
