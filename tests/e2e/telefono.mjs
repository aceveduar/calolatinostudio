// Teléfono compartido al dar de alta y aviso de WhatsApp en un equipo sin nube.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.waitForTimeout(600);
const ir = (r) => page.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, r);
const alguien = await page.evaluate(async () => (await window.compasDev.db.alumnos.toArray()).find((a) => a.activo && a.telefono.length === 10));

// 1) alta con un teléfono que ya existe: avisa, pero deja registrar
await ir('/alumnos');
await page.getByRole('button', { name: 'Nuevo' }).click();
await page.getByPlaceholder('Nombre y apellido').fill('Hermana Prueba');
await page.getByPlaceholder('10 dígitos').fill(alguien.telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'));
const formulario = page.getByRole('dialog', { name: 'Alumno nuevo' });
const coincidencia = formulario.getByText(alguien.nombre, { exact: true });
await coincidencia.waitFor();
await page.screenshot({ path: `${OUT}telefono-repetido.png` });
const registrarOtra = formulario.getByRole('button', { name: 'Registrar a otra persona' });
await registrarOtra.click();
const confirmar = formulario.getByRole('button', { name: 'Confirmar nueva ficha' });
await confirmar.waitFor();
const fichas = () => page.evaluate(() => window.compasDev.db.alumnos.where('nombre').equals('Hermana Prueba').toArray());
console.log('1a) muestra la ficha con el mismo teléfono:', ok(await coincidencia.isVisible()));
console.log('1b) la primera pulsación pide confirmación sin crear ficha:', ok((await fichas()).length === 0));
await page.getByPlaceholder('10 dígitos').fill('5500000001');
console.log('1c) cambiar el teléfono retira la coincidencia y la confirmación:', ok((await coincidencia.count()) === 0 && (await confirmar.count()) === 0));
await page.getByPlaceholder('10 dígitos').fill(alguien.telefono);
await registrarOtra.click();
await confirmar.click();
await page.getByRole('button', { name: 'Ahora no' }).click();
const [hermana] = await fichas();
console.log('1d) permite registrar a otra persona con el mismo teléfono:', ok(hermana?.telefono === alguien.telefono && hermana.id !== alguien.id));

// 2) hoja de WhatsApp en un equipo sin conectar a la nube
await ir(`/alumnos/${alguien.id}`);
await page.getByRole('button', { name: 'WhatsApp' }).click();
const sinNube = page.getByText(/no está conectado a la nube/);
await sinNube.waitFor({ timeout: 3000 }).catch(() => {});
await page.screenshot({ path: `${OUT}whatsapp-sin-nube.png` });
console.log('2) la hoja de WhatsApp avisa que el portal no abrirá sin nube:', ok((await sinNube.count()) === 1));

// 3) El alta puede reactivar la ficha previa desde una coincidencia.
await page.keyboard.press('Escape');
await page.evaluate((id) => window.compasDev.actualizar('alumnos', id, { activo: false }), alguien.id);
await ir('/alumnos');
await page.getByRole('button', { name: 'Nuevo' }).click();
await formulario.getByPlaceholder('Nombre y apellido').fill(alguien.nombre);
await formulario.getByText('De baja', { exact: true }).waitFor();
await formulario.getByRole('button', { name: 'Reactivar', exact: true }).click();
await formulario.getByRole('button', { name: 'Reactivar ficha' }).click();
await page.waitForURL(`**/alumnos/${alguien.id}`);
const reactivado = await page.evaluate((id) => window.compasDev.db.alumnos.get(id), alguien.id);
console.log('3) el alta recupera la ficha de baja:', ok(reactivado.activo && reactivado.codigo === alguien.codigo));

// 4) Una ficha archivada sale en la búsqueda de Entrada.
await page.evaluate((id) => window.compasDev.actualizar('alumnos', id, { createdAt: Date.now() - 200 * 86_400_000 }), hermana.id);
await page.getByRole('link', { name: 'Entrada', exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).fill('Hermana Prueba');
await page.getByRole('button', { name: /Hermana Prueba.*Archivado/ }).waitFor();
console.log('4) Entrada encuentra la ficha archivada: OK');
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
