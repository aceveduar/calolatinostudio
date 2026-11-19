// Página para anuncios: se anota de dónde llegó cada interesado y hay aviso de privacidad.
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const datos = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar', ubicaciones: { principal: { direccion: 'Av. Juárez 10, Centro' } } },
  sedes: [], clases: [{ id: 'c1', clase: 'Salsa 0', color: '#d13d51', dias: [1, 3], hora: '19:00', duracion: 60, sede_id: null, precio: null }],
  planes: [], eventos: [], tienda: [],
};
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));
let inscrito = null;
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
await ctx.route('**/rest/v1/rpc/inscribir_interesado', (r) => ((inscrito = JSON.parse(r.request().postData())), r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })));
await page.goto('http://localhost:4173/a/calo-latino?utm_source=facebook&utm_campaign=navidad');
await page.getByRole('heading', { level: 1 }).waitFor();
// navegar dentro de la página no pierde el origen
await page.evaluate(() => history.replaceState(null, '', '/a/calo-latino#inscribete'));
await page.locator('#inscribete input').first().fill('Rosa Anuncio');
await page.locator('#inscribete input[inputmode=tel]').fill('5511113333');
await page.locator('#inscribete button[type=submit]').click();
await page.waitForTimeout(800);
console.log('1) quien llega de un anuncio queda anotado con su origen:', ok(inscrito?.p_origen === 'facebook · navidad'), JSON.stringify(inscrito?.p_origen));

// 2) aviso de privacidad desde el formulario
await page.reload();
await page.getByRole('heading', { level: 1 }).waitFor();
await page.locator('#inscribete').scrollIntoViewIfNeeded();
await page.locator('#inscribete').getByRole('button', { name: 'Aviso de privacidad' }).click();
const aviso = page.getByRole('dialog', { name: 'Aviso de privacidad' });
await aviso.waitFor();
const t = await aviso.innerText();
await page.screenshot({ path: `${OUT}aviso-privacidad.png` });
console.log('2a) el aviso abre desde el formulario, con academia, domicilio y derechos ARCO:', ok(/Calo Latino Studio, con domicilio en Av\. Juárez 10, Centro/.test(t) && /ARCO/.test(t) && /5512345678/.test(t)));
await page.keyboard.press('Escape');
console.log('2b) Esc lo cierra:', ok(!(await aviso.isVisible())));
console.log('2c) también está en el pie de la página:', ok((await page.locator('footer').getByRole('button', { name: 'Aviso de privacidad' }).count()) === 1));
const r = await revisarPagina(page);
console.log('2d) sin desbordes ni botones sin nombre:', ok(!r.ancho && !r.sinNombre.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre }));

// 3) recepción ve de dónde llegó
const p3 = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' })).newPage();
p3.on('pageerror', (e) => errores.push(e.message));
await p3.goto('http://localhost:4173/');
await p3.waitForFunction(() => !!window.compasDev);
await p3.evaluate(() => window.compasDev.demoCompleta());
await p3.evaluate(async () => {
  const db = window.compasDev.db;
  const i = (await db.interesados.toArray()).find((x) => x.estado === 'nuevo');
  await window.compasDev.actualizar('interesados', i.id, { origen: 'facebook · navidad' });
});
await p3.reload();
await p3.getByText('Monse', { exact: true }).click();
for (const d of '1111') await p3.getByRole('button', { name: d, exact: true }).click();
await p3.waitForTimeout(600);
await p3.evaluate(() => { history.pushState(null, '', '/alumnos/interesados'); dispatchEvent(new PopStateEvent('popstate')); });
await p3.getByText('Llegó por facebook · navidad').waitFor({ timeout: 5000 }).catch(() => {});
console.log('3) en Interesados se ve "Llegó por facebook · navidad":', ok((await p3.getByText('Llegó por facebook · navidad').count()) === 1));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
