import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');

const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const DATOS = {
  hoy: '2026-11-14',
  alumno: { nombre: 'Ana López', codigo: 'K7P2QX' },
  academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null },
  planes: [
    { plan: 'Paquete 8 clases', tipo: 'paquete', beca: false, inicio: '2026-11-01', fin: '2026-11-30', clases: 8, usadas: 5, },
    { plan: 'Mensualidad', tipo: 'mensual', beca: false, inicio: '2026-12-01', fin: '2026-12-31', clases: null, usadas: 0 },
  ],
  clases: [
    { fecha: '2026-11-13', clase: 'Salsa 1', color: '#e8445a' },
    { fecha: '2026-11-11', clase: 'Bachata 0', color: '#7c4ddb' },
    { fecha: '2026-11-08', clase: 'Salsa 1', color: '#e8445a' },
  ],
  tienda: [
    { nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: null, descripcion: '' },
    { nombre: 'Agua', precio: 1500, emoji: '💧', foto: null, descripcion: '' },
  ],
};
let respuesta = DATOS;
let llamadas = 0;
let pendientes = 0;
let tokenPedido = null;
let soltar;
let inicioDemora;
const demoraIniciada = new Promise((resolve) => { inicioDemora = resolve; });
await ctx.route('**/rest/v1/rpc/portal_alumno', async (route) => {
  tokenPedido = JSON.parse(route.request().postData() || '{}').p_token;
  if (respuesta === 'caida') return route.abort();
  if (respuesta === 'lenta') {
    await new Promise((resolve) => {
      soltar = resolve;
      inicioDemora();
    });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DATOS) });
  }
  llamadas++;
  // enlace recién creado: la nube aún no lo conoce las primeras veces
  const r = pendientes > 0 ? (pendientes--, null) : respuesta;
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
});

// 1) portal con datos
await page.goto(`http://localhost:4173/p/${TOKEN}`);
await page.getByText('Tu pase de entrada').waitFor();
await page.waitForTimeout(500);
let t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('1) portal: QR, plan, clases, tienda:', ok(tokenPedido === TOKEN && /(días|tardes|noches), Ana/.test(t) && /5 de 8 clases usadas/.test(t) && (await page.getByRole('img', { name: 'Te quedan 3 clases' }).count()) === 1 && /Después sigue: Mensualidad/.test(t) && /Bachata 0/.test(t) && /Playera Calo/.test(t) && (await page.getByRole('button', { name: 'Mostrar mi pase en grande' }).count()) === 1));
await page.screenshot({ path: `${OUT}portal-1.png`, fullPage: true });

// 2) copia visible al actualizar, ante un fallo y sin internet.
respuesta = 'lenta';
await page.reload();
await page.getByRole('status').filter({ hasText: 'Actualizando…' }).waitFor();
console.log('2a) consulta lenta muestra Actualizando y deja ver el QR:', ok(await page.getByRole('button', { name: 'Mostrar mi pase en grande' }).isVisible()));
await demoraIniciada;
soltar();
await page.getByText(/Actualizando…/).waitFor({ state: 'hidden' });
respuesta = 'caida';
await page.reload();
await page.getByText('Tu pase de entrada').waitFor();
await page.getByText(/No pudimos actualizar/).waitFor();
t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('2b) fallo de consulta deja visible el pase guardado:', ok(!/Sin internet/.test(t) && /5 de 8 clases usadas/.test(t)));
respuesta = DATOS;
await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
await page.getByText(/Actualizando…|No pudimos actualizar/).waitFor({ state: 'hidden' });
await ctx.setOffline(true);
await page.getByText(/Sin internet/).waitFor();
console.log('2c) el navegador sin red conserva el pase:', ok(await page.getByRole('button', { name: 'Mostrar mi pase en grande' }).isVisible()));
const antesDeVolver = llamadas;
await ctx.setOffline(false);
await page.getByText(/Sin internet|Actualizando…/).waitFor({ state: 'hidden' });
console.log('2d) recupera la actualización al volver internet:', ok(llamadas > antesDeVolver));

// 3) enlace regenerado: ya no funciona y borra lo guardado
respuesta = null;
await page.reload();
await page.getByText('Este enlace ya no funciona').waitFor();
const guardado = await page.evaluate((tk) => localStorage.getItem('compas-portal:' + tk), TOKEN);
console.log('3) enlace viejo no funciona y no deja datos:', ok(guardado === null));

// 3b) enlace recién creado en recepción: las primeras veces la nube aún no lo tiene; el portal reintenta y abre
await page.evaluate((tk) => localStorage.removeItem('compas-portal:' + tk), TOKEN);
respuesta = DATOS;
pendientes = 2;
llamadas = 0;
await page.reload();
await page.getByText('Tu pase de entrada').waitFor({ timeout: 15000 });
console.log('3b) enlace recién creado: reintenta y abre en vez de decir "ya no funciona":', ok(llamadas >= 3 && (await page.getByText('Este enlace ya no funciona').count()) === 0), llamadas);

// 4) sin plan / beca
await page.evaluate((tk) => localStorage.removeItem('compas-portal:' + tk), TOKEN);
respuesta = { ...DATOS, planes: [{ plan: 'Beca', tipo: 'paquete', beca: true, inicio: '2026-10-01', fin: '2027-03-29', clases: null, usadas: 30 }], tienda: [] };
await page.reload();
await page.getByText('Tu pase de entrada').waitFor();
t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('4) becado:', ok(/Beca Beca/.test(t) && !/En la academia/.test(t)));

// 5) token inválido no se trata como portal (va a la app)
await page.goto('http://localhost:4173/p/corto');
await page.waitForTimeout(800);
console.log('5) token corto no abre portal:', ok(!(await page.getByText('Tu pase de entrada').count())));

// 6) desde la ficha: guardar y recuperar el enlace personal
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => { await window.compasDev.sembrar(); });
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
await page.getByRole('link', { name: 'Alumnos', exact: true }).click();
await page.locator('main .divide-y button').first().click();
await page.evaluate(() => window.compasDev.db.meta.put({ key: 'nubeVinculada', value: true }));
const id = new URL(page.url()).pathname.split('/').at(-1);
const confirmarRespaldo = () => page.evaluate((alumnoId) => window.compasDev.db.outbox.where('id').equals(alumnoId).delete(), id);
await confirmarRespaldo();
await page.getByRole('button', { name: 'Compartir Mi pase' }).click();
const dlg = page.getByRole('dialog', { name: 'Compartir Mi pase' });
const crearEnlace = dlg.getByRole('button', { name: 'Crear enlace del pase' });
const enlace = dlg.getByRole('link', { name: 'Enviar pase por WhatsApp' });
await crearEnlace.or(enlace).waitFor();
if (await crearEnlace.isVisible()) {
  await crearEnlace.click();
  await dlg.getByText(/pendiente de sincronizar/).waitFor();
  await confirmarRespaldo();
}
await enlace.waitFor();
const href = decodeURIComponent(await enlace.getAttribute('href'));
const m = href.match(/\/p\/([A-Za-z0-9]{26})\b/);
console.log('6) mensaje con enlace personal de 26 caracteres:', ok(!!m), m?.[1]);
await page.screenshot({ path: `${OUT}portal-2-whats.png` });
// el mismo enlace al volver a abrir (no se regenera)
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Compartir Mi pase' }).click();
const href2 = decodeURIComponent(await enlace.getAttribute('href'));
console.log('   el enlace se conserva:', ok(href2.includes(m?.[1])));
const abrir = dlg.getByRole('link', { name: 'Abrir pase' });
const hrefAbrir = await abrir.getAttribute('href');
console.log('7) botón Abrir su portal con el mismo enlace:', ok(hrefAbrir?.endsWith('/p/' + m?.[1]) && (await page.getByRole('dialog').getByRole('button', { name: 'Copiar enlace' }).count()) === 1));
await dlg.getByRole('button', { name: 'Renovar enlace del pase' }).click();
await dlg.getByRole('button', { name: 'Cancelar' }).click();
if (await abrir.getAttribute('href') !== hrefAbrir) throw new Error('Cancelar cambió el enlace');
await dlg.getByRole('button', { name: 'Renovar enlace del pase' }).click();
await dlg.getByRole('button', { name: 'Confirmar renovación' }).click();
await dlg.getByText(/pendiente de sincronizar/).waitFor();
if (await enlace.count()) throw new Error('Se puede enviar antes del respaldo');
await confirmarRespaldo();
await enlace.waitFor();
console.log('8) renovación confirmada y envío tras resguardo:', ok(await abrir.getAttribute('href') !== hrefAbrir));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
