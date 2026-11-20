// Importar alumnos: desde un .xlsx real (hecho con openpyxl) y pegando celdas; vista previa, saltar repetidos,
// importar y deshacer.
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const XLSX = new URL('./archivos/alumnos.xlsx', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto('http://localhost:4173/');
await p.waitForFunction(() => !!window.compasDev);
await p.evaluate(() => window.compasDev.demoCompleta());
await p.reload();
await p.getByText('Dirección Calo', { exact: true }).click();
await p.keyboard.type('1234', { delay: 30 });
await p.waitForTimeout(1200);
const vivos = () => p.evaluate(async () => (await window.compasDev.db.alumnos.toArray()).filter((a) => !a.deletedAt).length);
const antes = await vivos();

await p.getByRole('link', { name: 'Alumnos' }).first().click();
const enlace = p.getByRole('link', { name: /Importar alumnos de Excel/ });
await enlace.scrollIntoViewIfNeeded();
await enlace.click();
await p.getByRole('heading', { name: 'Importar alumnos' }).waitFor();
await p.screenshot({ path: `${OUT}importar-1.png` });

// 1) Excel real
await p.locator('input[type=file]').setInputFiles(XLSX);
await p.getByText('alumnos nuevos para importar').waitFor({ timeout: 5000 });
await p.screenshot({ path: `${OUT}importar-2.png`, fullPage: true });
const texto = await p.locator('main').innerText();
console.log('1) lee el .xlsx: 4 nuevos:', ok(/\b4\s*alumnos nuevos para importar/.test(texto)));
console.log('   detecta Apellidos + Nombre(s) y arregla MAYÚSCULAS ("Valeria García Ramos"):', ok(texto.includes('Valeria García Ramos')));
console.log('   respeta "Renata de la Vega" y el celular guardado como número (55 4433 2211):', ok(texto.includes('Renata de la Vega') && texto.includes('55 4433 2211')));
console.log('   "+52 1 55 6677 8899" → 55 6677 8899; el repetido y la fila sin nombre se saltan:', ok(texto.includes('55 6677 8899') && /1 repetido en la lista/.test(texto) && /1 fila sin nombre/.test(texto)));
console.log('   avisa del teléfono raro (12345):', ok(/1 teléfono no tiene 10 dígitos/.test(texto)));
console.log('   las columnas quedaron bien elegidas:', ok((await p.getByLabel('Columna de WhatsApp').inputValue()) === '3' && (await p.getByLabel('Columna de Apellidos').inputValue()) === '1'));

await p.emulateMedia({ colorScheme: 'dark' });
await p.screenshot({ path: `${OUT}importar-2-oscuro.png` });
await p.emulateMedia({ colorScheme: 'light' });
const r = await revisarPagina(p);
console.log('   sin desbordes, botones con nombre y buen contraste:', ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
await p.getByRole('button', { name: 'Importar 4 alumnos' }).click();
await p.getByText('4 alumnos nuevos', { exact: true }).waitFor({ timeout: 8000 });
await p.screenshot({ path: `${OUT}importar-3.png` });
console.log('2) importa y quedan guardados:', ok((await vivos()) === antes + 4));

// 3) volver a importar el mismo archivo: ahora ya están todos
await p.getByRole('link', { name: 'Volver a alumnos' }).click();
await enlace.scrollIntoViewIfNeeded();
await enlace.click();
await p.locator('input[type=file]').setInputFiles(XLSX);
await p.getByText('No hay alumnos nuevos').waitFor({ timeout: 5000 });
console.log('3) el mismo archivo otra vez: "No hay alumnos nuevos" (los 4 + el repetido ya estaban):', ok(/5 ya estaban registrados/.test(await p.locator('main').innerText())));

// 4) pegar celdas (con uno que ya existe en la demo) y deshacer
const existente = await p.evaluate(async () => (await window.compasDev.db.alumnos.toArray()).find((a) => !a.deletedAt && a.telefono.length === 10));
await p.getByRole('button', { name: 'Cambiar archivo' }).click();
await p.getByPlaceholder(/Ana López/).fill(`${existente.nombre.toUpperCase()}\t${existente.telefono}\nCamila Rojas\t55 9988 7766\nIván Soto\t`);
await p.getByRole('button', { name: 'Ver vista previa' }).click();
await p.getByText('alumnos nuevos para importar').waitFor();
const t2 = await p.locator('main').innerText();
console.log('4) pegado sin encabezado: 2 nuevos y el de la demo (escrito en MAYÚSCULAS) se reconoce:', ok(/\b2\s*alumnos nuevos/.test(t2) && /1 ya estaba registrado/.test(t2)));
await p.getByRole('button', { name: 'Importar 2 alumnos' }).click();
await p.getByRole('button', { name: /Deshacer la importación/ }).click();
await p.getByText(/Se quitaron los 2 alumnos importados/).waitFor();
console.log('5) deshacer quita a los importados:', ok((await vivos()) === antes + 4));

console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
