// Tienda de la página pública: no se come la página (4 en celular, 8 en computadora y "Ver toda la tienda"),
// primero lo que tiene foto, y cada ficha permite consultar por WhatsApp.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { revisarPagina } from './revisar.mjs';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ok = (c) => (c ? 'OK' : 'MAL');
const FOTO = 'data:image/jpeg;base64,' + readFileSync(new URL('./archivos/foto.jpg', import.meta.url)).toString('base64');
const productos = Array.from({ length: 12 }, (_, i) => ({ nombre: i < 3 ? `Snack ${i + 1}` : `Playera ${i}`, precio: (i + 1) * 5000, emoji: '👕', foto: i < 3 ? null : FOTO, descripcion: '', opciones: [], sobre_pedido: i === 5 }));
const D = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6334a', logo: null, whatsapp: '5648141057', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar', preguntas: [] },
  sedes: [],
  clases: [],
  planes: [],
  eventos: [],
  tienda: productos,
};
const b = await chromium.launch({ channel: 'msedge' });
const errores = [];
for (const [n, vp, movil, esperados] of [['cel', { width: 390, height: 844 }, true, 4], ['pc', { width: 1280, height: 900 }, false, 8]]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'es-MX', ...(movil ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D) }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto('http://localhost:4173/a/calo-latino');
  const titulo = p.getByRole('heading', { name: 'Lleva tu estilo' });
  await titulo.waitFor({ timeout: 8000 });
  await titulo.scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  const visibles = () => p.locator('section:has(h2:text("Lleva tu estilo")) li:visible').count();
  const antes = await visibles();
  const tarjeta = p.getByRole('button', { name: /^Ver Playera 3,/ });
  await p.screenshot({ path: `${OUT}tiendapublica-${n}.png` });
  const primera = p.locator('section:has(h2:text("Lleva tu estilo")) li:visible button').first();
  console.log(`1) ${n}: se ven ${esperados} productos, primero los que tienen foto:`, ok(antes === esperados && /^Ver Playera/.test((await primera.getAttribute('aria-label')) ?? '')), antes);
  await tarjeta.click();
  const detalle = p.getByRole('dialog', { name: 'Playera 3' });
  const enlace = new URL(await detalle.getByRole('link', { name: 'Consultar por WhatsApp' }).getAttribute('href'));
  console.log(`2) ${n}: ficha con precio y consulta por WhatsApp:`, ok(
    enlace.hostname === 'wa.me' && enlace.pathname === '/525648141057' && enlace.searchParams.get('text')?.includes('Playera 3') &&
    await detalle.getByText('$200', { exact: true }).isVisible(),
  ));
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Ver toda la tienda (12)' }).click();
  await p.waitForTimeout(300);
  console.log(`3) ${n}: "Ver toda la tienda (12)" muestra los 12:`, ok((await visibles()) === 12));
  const sinFoto = p.getByRole('button', { name: /^Ver Snack 1,/ });
  console.log(`   ${n}: producto sin foto usa fondo neutro:`, ok(await sinFoto.getByText('Sin foto', { exact: true }).isVisible() && !(await sinFoto.innerText()).includes('👕')));
  const r = await revisarPagina(p);
  console.log(`4) ${n}: sin desbordes, botones con nombre y buen contraste:`, ok(!r.ancho && !r.sinNombre.length && !r.contraste?.length), JSON.stringify({ ancho: r.ancho, sinNombre: r.sinNombre, contraste: r.contraste }));
  await ctx.close();
}
console.log('errores:', errores.length ? errores : 'ninguno');
await b.close();
