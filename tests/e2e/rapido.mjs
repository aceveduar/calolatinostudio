import { chromium } from 'playwright-core';

const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX', colorScheme: process.env.ESQUEMA || 'light' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
const shot = (n) => page.screenshot({ path: `${OUT}${process.env.ESQUEMA || 'light'}-${n}.png` });
const btn = (t) => page.getByRole('button', { name: t });
const pin = async (p) => { for (const d of p) await page.getByRole('button', { name: d, exact: true }).click(); };
const busca = page.getByPlaceholder(/Quién llegó|Buscar…/);
const listo = async () => { await btn('Listo').click(); await page.waitForTimeout(150); };
const billete = (txt) => page.locator('button', { hasText: new RegExp('^\\' + txt + '$') });
const filasCuenta = () => page.getByRole('button', { name: /^Deshacer / }).count();
const ok = (c) => (c ? 'OK' : 'MAL');

await page.goto('http://localhost:4173/');
await btn('Crear una academia nueva').click();
await page.getByPlaceholder('Ej. Academia Son de Barrio').fill('Academia Sabor');
await page.getByPlaceholder('Ej. Eduardo').fill('Monse');
await btn('Continuar').click();
await pin('482915');
await page.getByText('Repite tu PIN').waitFor();
await pin('482915');
await busca.waitFor();

await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa 1/ }).first().click();

// 1) Fila de alumnos nuevos, cada uno paga con $50 por separado
const nombres = ['Ana López', 'Carlos Ruiz', 'Diana Pérez', 'Jorge Mendoza', 'Lucía Torres', 'Pedro Sánchez'];
for (const n of nombres) {
  await busca.fill(n.toLowerCase());
  await page.getByText(`Nuevo: ${n}`).click();
  await page.getByText(n, { exact: true }).first().waitFor({ timeout: 5000 });
  await billete('$50').click();
  await page.getByText('Cambio $10').waitFor();
  const f = await filasCuenta();
  if (f !== 1) console.log('   cuenta con', f, 'filas: MAL');
  await listo();
}
console.log('1) 6 personas por separado, cada una con su cuenta y Listo: OK');
await shot('r1-individual');

// 2) Tocar a alguien que ya entró
await shot('r2-cuadricula');
await page.getByRole('button', { name: /Ana L\./ }).click();
await page.getByText('Ana ya está adentro').waitFor();
console.log('2) doble entrada bloqueada: OK');

// 3) Pareja sin nombre paga junta con $100
await btn(/sin nombre/).click();
await btn(/sin nombre/).click();
await page.getByText('Pagan juntos · 2').waitFor();
await billete('$100').click();
await page.getByText('Cambio $20').waitFor();
await shot('r3-cambio');
console.log('3) pareja junta, cambio $20: OK');

// 4) Sin tocar Listo, la cuenta no se cierra sola ni se reemplaza: junta lo nuevo
await page.waitForTimeout(25000);
const sigue = await filasCuenta();
await btn(/sin nombre/).click();
await page.waitForTimeout(200);
const f4 = await filasCuenta();
console.log('4) la cuenta sigue tras 25 s y junta hasta Listo:', `${sigue} → ${f4}`, ok(sigue === 2 && f4 === 3));

// 5) Se equivocó: deshacer
await btn('Deshacer Sin nombre').first().click();
await page.getByText('Se deshizo: Sin nombre').waitFor();
console.log('5) deshacer: OK');
await listo();

// 6) Otra clase: sugiere a los asiduos; un toque cobra; fue transferencia
await page.getByRole('button', { name: /cambiar de clase|Elegir clase/ }).first().click();
await page.getByRole('dialog').waitFor();
if (await page.getByRole('button', { name: 'Ver todas las clases' }).count()) await page.getByRole('button', { name: 'Ver todas las clases' }).click();
await page.getByRole('dialog').getByRole('button', { name: /Salsa 0/ }).first().click();
await page.getByRole('button', { name: /Diana P\./ }).click();
await page.getByText('Cobrar en efectivo').waitFor();
await btn('Pagó por transferencia').click();
await page.getByText(/por transferencia/).waitFor();
await shot('r4-transferencia');
await listo();
console.log('6) otra clase + transferencia: OK');

// 7) Mantener presionado abre opciones completas
const lucia = page.getByRole('button', { name: /Lucía T\./ });
// al centro de la pantalla: con la tarjeta de primeros pasos (academia nueva) la cuadrícula queda más abajo,
// y pegada al borde quedaba detrás de la barra de abajo (la presión caía en "Caja")
await lucia.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(200);
const box = await lucia.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(700);
await page.mouse.up();
await page.getByText(/Vender mensualidad o paquete/).waitFor();
await shot('r5-opciones');
console.log('7) mantener presionado: OK');
await page.keyboard.press('Escape');

// 8) Caja: 6×40 + 2×40 efectivo = 320; 40 transferencia
await page.getByRole('link', { name: 'Caja' }).click();
const total = await page.getByText('Total cobrado').locator('..').innerText();
const t = total.replace(/\s+/g, ' ');
console.log('8) caja:', t, ok(t.includes('Efectivo $320') && t.includes('Transferencia $40')));
await shot('r6-caja');

// 9) Color de la academia
await page.getByRole('link', { name: 'Más' }).first().click();
await page.getByText('Academia', { exact: true }).click();
await btn('Morado').click();
await page.waitForTimeout(300);
await shot('r7-color');
await page.getByRole('link', { name: 'Entrada' }).click();

await page.waitForTimeout(400);
await shot('r8-entrada-morado');
console.log('9) color academia: OK');

console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
