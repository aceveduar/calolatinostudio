import { chromium } from 'playwright-core';

const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}c-${n}.png` });
const btn = (t) => page.getByRole('button', { name: t });
const pin = async (p) => { for (const d of p) await page.getByRole('button', { name: d, exact: true }).click(); };
const busca = page.getByPlaceholder(/Quién llegó|Buscar…/);
const ok = (c) => (c ? 'OK' : 'MAL');
const texto = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
const deshacer = () => page.getByRole('button', { name: 'Deshacer' }).click();
const espera = (ms = 300) => page.waitForTimeout(ms);
const adentro = async () => { await page.getByRole('button', { name: /^Adentro/ }).click(); await espera(); };
const cuenta = async () => Number((await page.getByRole('button', { name: /^Adentro/ }).innerText()).match(/\d+/)[0]);
const cerrarHoja = async () => { await page.keyboard.press('Escape'); await espera(); };
const caja = async () => {
  await page.getByRole('link', { name: 'Caja' }).click();
  const t = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
  await page.getByRole('link', { name: 'Entrada' }).click();
  await espera();
  return t;
};
const irSalsa1 = async () => {
  if (await page.getByRole('button', { name: /^Salsa 1/ }).count() === 0) await btn(/Elegir clase|Otra/).click();
  await page.getByRole('button', { name: /^Salsa 1/ }).first().click();
  await espera();
};

await page.goto('http://localhost:4173/');
await btn('Crear una academia nueva').click();
await page.getByPlaceholder('Ej. Academia Son de Barrio').fill('Academia Sabor');
await page.getByPlaceholder('Ej. Eduardo').fill('Monse');
await btn('Continuar').click();
await pin('482915');
await page.getByText('Repite tu PIN').waitFor();
await pin('482915');
await busca.waitFor();

// Alumno ya registrado (sin entrada hoy) para reasignar luego
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
await btn('Nuevo').click();
await page.getByPlaceholder('Nombre y apellido').fill('Jorge Mendoza');
await btn('Registrar alumno').click();
await btn('Ahora no').click(); // hoja nueva: mandarle su acceso
await page.getByRole('link', { name: 'Entrada' }).click();

await irSalsa1();
for (const n of ['Ana López', 'Carlos Ruiz']) {
  await busca.fill(n);
  await page.getByText(`Nuevo: ${n}`).click();
  await btn('Listo').click();
}
await btn(/sin nombre/).click();
await btn('Listo').click();
console.log('inicio, caja:', await caja());

// 0) Aviso de clase equivocada
await irSalsa1();
const aviso = await texto();
console.log('0) aviso clase que no es la de ahora/hoy:', ok(/no es clase de hoy|La clase de ahora es/.test(aviso)));
await shot('0-aviso-clase');

// 1) Método equivocado: Ana pagó por transferencia
await adentro();
await page.getByRole('button', { name: /Ana López/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Transferencia' }).click();
await espera();
await shot('1-corregir');
await cerrarHoja();
const c1 = await caja();
console.log('1) cambiar método:', c1, ok(c1.includes('Efectivo $80') && c1.includes('Transferencia $40')));

// 2) Clase equivocada + deshacer
await irSalsa1(); await adentro();
await page.getByRole('button', { name: /Carlos Ruiz/ }).click();
await btn(/Era otra clase/).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa 2/ }).click();
await espera();
const tras = await cuenta();
await deshacer();
await espera(500);
const despues = await cuenta();
console.log('2) mover de clase y deshacer:', `${tras} → ${despues}`, ok(tras === 2 && despues === 3));

// 3) "Sin nombre" en realidad era Jorge (registrado)
await page.getByRole('button').filter({ hasText: 'Visitante' }).filter({ hasText: '$40' }).click();
await btn(/Era otra persona/).click();
await page.getByPlaceholder('¿Quién era?').fill('jorge');
await page.getByRole('dialog').getByRole('button', { name: /Jorge Mendoza/ }).click();
await espera();
const t3 = await texto();
console.log('3) reasignar cobro a Jorge:', ok(t3.includes('Jorge Mendoza') && (await page.getByRole('button').filter({ hasText: 'Visitante' }).filter({ hasText: '$40' }).count()) === 0));

// 4) Quitar entrada (devuelve dinero) y deshacer
await page.getByRole('button', { name: /Carlos Ruiz/ }).click();
await btn(/Quitar entrada y devolver/).click();
await espera();
const sinCarlos = await cuenta();
await deshacer();
await espera(500);
console.log('4) quitar y deshacer:', `${sinCarlos} → ${await cuenta()}`, ok(sinCarlos === 2 && (await cuenta()) === 3));

// 5) Prevención de duplicados
await busca.fill('ana lopes');
await page.getByText('¿Es alguno de estos?').waitFor();
await shot('5-parecidos');
console.log('5) sugiere "Ana López" al escribir "ana lopes": OK');
// Se equivoca y crea el duplicado de todos modos (se cobra en otra clase para no chocar)
await page.getByText('Nuevo: Ana Lopes').click();
await btn('Listo').click();

// 6) Unir registros duplicados
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
await page.getByText('Ana Lopes').click();
await btn(/Unir registros/).click();
await page.getByRole('dialog').getByRole('button', { name: /Ana López/ }).click();
await page.getByRole('dialog').getByRole('button', { name: /Ana López/ }).first().click(); // quedarse con "Ana López"
await shot('6-unir');
await btn(/Unir en Ana/).click();
await espera(600);
const t6 = await texto();
await shot('6-ficha-unida');
console.log('6) unir registros + aviso de cobro doble:', ok(t6.includes('Ana López') && /Aparece 2 veces/.test(t6)));
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
const lista = await texto();
console.log('   duplicado retirado de la lista:', ok(!lista.includes('Ana Lopes')));

// 7) Anular el cobro doble con motivo rápido, y restaurar por error
await page.getByText('Ana López').click();
await page.getByRole('button', { name: /Clase suelta/ }).first().click();
await page.getByRole('button', { name: 'Se cobró dos veces' }).click();
await btn('Anular cobro').click();
await espera(500);
const t7 = await texto();
console.log('7a) anular cobro doble quita el aviso:', ok(!/Aparece 2 veces/.test(t7)));
console.log('    caja:', await caja());
await page.getByRole('link', { name: 'Caja' }).click();
await page.getByRole('button', { name: /Anulado/ }).first().click();
await btn(/Restaurar cobro/).click();
await espera(400);
const c7 = (await page.getByText('Total cobrado').locator('..').innerText()).replace(/\s+/g, ' ');
console.log('7b) restaurar cobro:', c7, ok(c7.includes('Total cobrado $160')));

// 8) Dar de baja + deshacer; ver dados de baja y reactivar
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
await page.getByText('Jorge Mendoza').click();
await btn('Dar de baja').click();
await espera();
await deshacer();
await espera(400);
const t8 = await texto();
console.log('8a) baja deshecha, Jorge sigue activo:', ok(t8.includes('Jorge Mendoza')));
await page.getByText('Jorge Mendoza').click();
await btn('Dar de baja').click();
await espera(3500);
await page.getByText(/Ver dados de baja/).click();
await page.getByText('Jorge Mendoza').click();
await btn('Reactivar').click();
await espera();
console.log('8b) reactivar desde dados de baja:', ok(!(await texto()).includes('Dado de baja')));

// 9) Monto tecleado de más
await btn('Vender plan').click();
await page.getByRole('dialog').locator('input[inputmode="decimal"]').fill('4000');
const t9 = await page.getByRole('dialog').innerText();
await shot('9-monto');
console.log('9) aviso de ceros de más:', ok(t9.includes('¿Se teclearon ceros de más?')));

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
