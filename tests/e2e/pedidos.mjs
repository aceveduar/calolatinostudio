import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
const ok = (c) => (c ? 'OK' : 'MAL');
const body = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const dlg = page.getByRole('dialog');
const fila = (txt) => dlg.locator('div.divide-y > div').filter({ hasText: txt });
const entrar = async (nombre, pin) => {
  await page.getByText(nombre, { exact: true }).click();
  for (const d of pin) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();
};

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
console.log('demo:', JSON.stringify(await page.evaluate(async () => { await window.compasDev.sembrar(); await window.compasDev.agregarClasesDemo(); await window.compasDev.agregarTiendaDemo(); return window.compasDev.agregarPedidosDemo(); })));
await page.reload();
await entrar('Monse', '1111');

// 1) contador en el botón de tienda
await page.waitForTimeout(500);
// 2 apartados de la tienda + el encargo de zapatillas que ya llegó
console.log('1) botón Tienda avisa 3 por recoger:', ok((await page.getByRole('button', { name: 'Tienda, 3 apartados por recoger' }).count()) === 1));

// 2) lista de apartados
await page.getByRole('button', { name: /^Tienda/ }).click();
await dlg.getByText(/Apartados por recoger · 3/i).waitFor();
let t = await body();
const quedanAntes = Number((t.match(/Playera Calo \$250 Quedan (\d+)/) || [])[1]);
console.log('2) apartados con talla y alumno:', ok(/Playera Calo \(M\)/.test(t) && /Gorra Calo/.test(t)), 'playera disponibles:', quedanAntes);
await page.screenshot({ path: `${OUT}pedidos-1-tienda.png` });

// 3) entregar: se suma a la cuenta; deshacer lo devuelve
await fila('Playera Calo (M)').getByRole('button', { name: 'Entregar' }).click();
await page.waitForTimeout(500);
t = await body();
console.log('3) entregado y en la cuenta:', ok(/Apartados por recoger · 2/i.test(t) && /Playera Calo \(M\) \$250/.test(t)));
await dlg.getByRole('button', { name: /Listo · cuenta \$250/ }).click();
await page.getByRole('button', { name: /Quitar Playera Calo \(M\)|Deshacer Playera/ }).first().click();
await page.waitForTimeout(500);
console.log('4) deshacer reabre el apartado:', ok((await page.getByRole('button', { name: 'Tienda, 3 apartados por recoger' }).count()) === 1));

// 5) entregar de nuevo y cobrar → caja
await page.getByRole('button', { name: /^Tienda/ }).click();
await fila('Playera Calo (M)').getByRole('button', { name: 'Entregar' }).click();
await page.waitForTimeout(400);
await dlg.getByRole('button', { name: /Listo · cuenta/ }).click();
await page.getByRole('button', { name: 'Listo', exact: true }).click();
await page.getByRole('link', { name: 'Caja' }).click();
await page.waitForTimeout(500);
t = await body();
console.log('5) caja: venta de la playera a nombre del alumno:', ok(/Tienda \$250/.test(t) && /Playera Calo \(M\) · efectivo \$250/.test(t)));

// 6) cancelar la gorra
await page.getByRole('link', { name: 'Entrada' }).click();
await page.getByRole('button', { name: /^Tienda/ }).click();
await fila('Gorra Calo').getByRole('button', { name: /Cancelar apartado/ }).click();
await dlg.getByRole('button', { name: 'Cancelar', exact: true }).click();
await page.waitForTimeout(400);
t = await body();
console.log('6) cancelar apartado:', ok(/Apartados por recoger · 1/i.test(t) && !/Gorra Calo · /.test(t)));
await page.keyboard.press('Escape');
console.log('   contador en singular:', ok((await page.getByRole('button', { name: 'Tienda, 1 apartado por recoger' }).count()) === 1));

// 7) dirección: producto en el portal con tallas
await page.getByRole('button', { name: /cambiar usuario/i }).first().click();
await entrar('Dirección Calo', '1234');
await page.evaluate(() => { history.pushState(null, '', '/ajustes/productos'); dispatchEvent(new PopStateEvent('popstate')); });
await page.getByText(/Playera Calo/).first().click();
const tallas = await dlg.getByPlaceholder('Ej. CH, M, G').inputValue();
console.log('7) ajustes: en el portal con tallas:', ok(tallas === 'CH, M, G, XG' && (await dlg.getByText('Mostrar en el portal de alumnos').count()) === 1), tallas);
await page.keyboard.press('Escape');

// ---------- portal (base simulada) ----------
const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const fotoPlayera = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const base = {
  hoy: '2026-11-14', alumno: { nombre: 'Ana López', codigo: 'K7P2QX' }, academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null },
  planes: [], clases: [],
  tienda: [
    { id: '11111111-1111-4111-8111-111111111111', nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: fotoPlayera, descripcion: 'Algodón, logo al frente', opciones: ['CH', 'M', 'G'], disponibles: 4 },
    { id: '22222222-2222-4222-8222-222222222222', nombre: 'Zapatillas', precio: 120000, emoji: '👟', foto: null, descripcion: '', opciones: [], disponibles: 0 },
  ],
  pedidos: [],
};
let datos = base;
let respuestaPedir = { ok: true };
let pedido = null;
await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
await ctx.route('**/rest/v1/rpc/portal_pedir', (r) => {
  pedido = JSON.parse(r.request().postData() || '{}');
  if (respuestaPedir.ok) datos = {
    ...base,
    pedidos: [
      { producto: 'Playera Calo', emoji: '👕', foto: fotoPlayera, opcion: pedido.p_opcion, cantidad: pedido.p_cantidad, precio: 25000, estado: 'pendiente', creado: Date.now() },
      { producto: 'Zapatillas', emoji: '👟', foto: null, opcion: null, cantidad: 1, precio: 120000, estado: 'pedido', creado: Date.now() - 1000 },
    ],
  };
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuestaPedir) });
});
await page.goto(`http://localhost:4173/p/${TOKEN}`);
await page.getByText('Tienda de la academia').waitFor();
const agotado = await page.getByRole('button', { name: 'Agotado' }).isDisabled();
await page.getByRole('button', { name: 'Apartar', exact: true }).first().click();
const pide = await dlg.getByRole('button', { name: 'Elige talla o color' }).isDisabled();
await dlg.getByRole('button', { name: 'M', exact: true }).click();
await dlg.getByRole('button', { name: 'Una más' }).click();
await page.screenshot({ path: `${OUT}pedidos-2-portal.png` });
// 8) error de existencias
respuestaPedir = { error: 'agotado', disponibles: 1 };
await dlg.getByRole('button', { name: /Apartar · pagas \$500/ }).click();
await dlg.getByText('Solo quedan 1.').waitFor();
console.log('8) portal: agotado deshabilitado, pide talla, error claro:', ok(agotado && pide));
// 9) apartar bien
respuestaPedir = { ok: true };
await dlg.getByRole('button', { name: /Apartar · pagas/ }).click();
await page.getByText(/¡Listo! Apartaste Playera Calo \(M\) ×2/).waitFor();
await page.waitForTimeout(500);
t = await body();
console.log('9) apartado enviado y en "Tus apartados":', ok(pedido.p_token === TOKEN && pedido.p_opcion === 'M' && pedido.p_cantidad === 2 && /Tus apartados y encargos Playera Calo · M ×2 Recógelo en recepción · \$500/i.test(t)));
const filaPlayera = page.getByRole('listitem').filter({ hasText: 'Playera Calo · M' });
const miniatura = filaPlayera.locator('img');
await miniatura.waitFor();
const filaZapatillas = page.getByRole('listitem').filter({ hasText: 'El proveedor lo está preparando' });
console.log('10) miniatura para la playera e ícono para el artículo sin foto:', ok(await miniatura.getAttribute('src') === fotoPlayera && (await filaZapatillas.innerText()).includes('👟')));
await page.screenshot({ path: `${OUT}pedidos-3-listo.png`, fullPage: true });
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
