// Portal del alumno: próximos eventos, tienda en carrusel y "Ten tu pase a un toque" (guardar en la pantalla de inicio).
import { chromium } from 'playwright-core';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const TOKEN = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const producto = (i) => ({ id: `00000000-0000-0000-0000-00000000000${i}`, nombre: `Playera ${i}`, precio: 25000, emoji: '👕', foto: null, descripcion: 'Algodón', opciones: ['CH', 'M', 'G'], disponibles: 5, sobre_pedido: false, dias_entrega: null });
const datos = {
  hoy: '2026-11-19',
  alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null },
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', slug: 'calo-latino' },
  planes: [],
  clases: [],
  tienda: [1, 2, 3, 4, 5, 6, 7, 8].map(producto),
  eventos: [
    { nombre: 'Social de salsa', fecha: '2026-11-21', hora: '21:00', precio: 15000, descripcion: 'Con DJ invitado', quedan: 12 },
    { nombre: 'Taller de giros', fecha: '2026-11-28', hora: '12:00', precio: 30000, descripcion: '', quedan: 0 },
    { nombre: 'Posada', fecha: '2026-12-19', hora: '20:00', precio: 0, descripcion: '', quedan: null },
    { nombre: 'Social de bachata', fecha: '2027-01-09', hora: '21:00', precio: 15000, descripcion: '', quedan: null },
  ],
};

const abrir = async (ua, d = datos) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX', userAgent: ua });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) }));
  await page.goto(`http://localhost:4173/p/${TOKEN}`);
  await page.getByText('Tu pase de entrada').waitFor();
  await page.waitForTimeout(300);
  return { ctx, page };
};

// 1) eventos
{
  const { ctx, page } = await abrir(ANDROID);
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const quiero = page.getByRole('link', { name: 'Quiero ir' });
  const texto = decodeURIComponent((await quiero.first().getAttribute('href')).split('text=')[1]);
  console.log("1a) próximos eventos con \"En 2 días\" y lugares que quedan:", ok(/Próximos eventos/i.test(t) && /Social de salsa ?En 2 días/.test(t) && /¡quedan 12!/.test(t)));
  console.log('1b) "Quiero ir" escribe por WhatsApp diciendo quién es y a qué evento:', ok(/Ana López \(código K7P2QX\)/.test(texto) && /Social de salsa \(sábado 21 de noviembre, 21:00\)/.test(texto)), texto);
  console.log('1c) agotado: sin botón; se ven 3 y "Ver 1 evento más":', ok(/Taller de giros.*Agotado/.test(t) && (await quiero.count()) === 2 && !/Social de bachata/.test(t) && (await page.getByRole('button', { name: 'Ver 1 evento más' }).count()) === 1));
  await page.getByRole('button', { name: 'Ver 1 evento más' }).click();
  console.log('1d) al tocar, aparece el resto:', ok((await page.getByText('Social de bachata').count()) === 1));
  await page.getByText('Próximos eventos').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}portal3-eventos.png` });

  // 2) tienda en carrusel
  const tienda = page.getByRole('list', { name: /Productos/ });
  await tienda.scrollIntoViewIfNeeded();
  const m = await tienda.evaluate((el) => ({ ancho: el.scrollWidth, visible: el.clientWidth, alto: el.getBoundingClientRect().height }));
  await page.screenshot({ path: `${OUT}portal3-tienda.png` });
  console.log('2a) 8 productos en una fila que se desliza (no 4 filas):', ok(m.ancho > m.visible * 2 && m.alto < 360), JSON.stringify(m));
  await tienda.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Apartar' }).last().click();
  console.log('2b) se puede apartar el último del carrusel:', ok((await page.getByText(/pagas .* al recoger|Elige talla/).count()) >= 1));
  await page.keyboard.press('Escape');
  const r = await revisarPagina(page);
  console.log('2c) nada se sale a lo ancho ni queda sin nombre:', ok(!r.ancho && !r.sinNombre.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre }));

  // 3) guardar en la pantalla de inicio (Android)
  const manifiesto = await page.evaluate(() => document.querySelector('link[rel=manifest]')?.getAttribute('href'));
  console.log('3a) su propio manifiesto (abre SU portal, no la app de la academia):', ok(manifiesto === `/p/${TOKEN}/manifiesto`), manifiesto);
  const tarjeta = page.getByText('Ten tu pase a un toque');
  console.log('3b) Android: "Ten tu pase a un toque" con cómo hacerlo:', ok((await tarjeta.count()) === 1 && (await page.getByText(/Agregar a la pantalla principal|Agregar a mi pantalla/).count()) >= 1));
  await page.getByRole('button', { name: 'Ahora no' }).click();
  await page.reload();
  await page.getByText('Tu pase de entrada').waitFor();
  console.log('3c) "Ahora no" se respeta al volver a entrar:', ok((await page.getByText('Ten tu pase a un toque').count()) === 0));
  await ctx.close();
}

// 4) iPhone: se explica con Compartir → Agregar a inicio
{
  const { ctx, page } = await abrir(IPHONE, { ...datos, eventos: [] });
  await page.screenshot({ path: `${OUT}portal3-iphone.png` });
  console.log('4a) iPhone: explica Compartir → "Agregar a inicio":', ok((await page.getByText(/Agregar a inicio/).count()) === 1));
  console.log('4b) sin eventos no aparece la sección:', ok((await page.getByText('Próximos eventos').count()) === 0));
  await ctx.close();
}

// 5) instalada (abierta desde la pantalla de inicio): ya no se ofrece
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'es-MX', userAgent: ANDROID });
  await ctx.addInitScript(() => {
    const original = window.matchMedia;
    window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : original(q));
  });
  const page = await ctx.newPage();
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await page.goto(`http://localhost:4173/p/${TOKEN}`);
  await page.getByText('Tu pase de entrada').waitFor();
  console.log('5) ya instalada: no vuelve a ofrecerlo:', ok((await page.getByText('Ten tu pase a un toque').count()) === 0));
  await ctx.close();
}
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
