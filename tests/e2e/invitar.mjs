// Invitar a un amigo: el alumno comparte desde su portal; el amigo ve de parte de quién viene y se inscribe;
// recepción ve quién lo invitó.
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const nuevo = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-MX' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errores.push(e.message));
  return { ctx, page };
};

// 1) portal: tarjeta para invitar
{
  const { ctx, page } = await nuevo();
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hoy: '2026-11-18', alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null }, academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, slug: 'calo-latino' }, planes: [], clases: [], tienda: [], invita: { de: 'a1b2c3d4', invitados: 3, inscritos: 1 } }) }),
  );
  await page.goto('http://localhost:4173/p/AbCdEfGhJkLmNpQrStUvWxYz23');
  await page.getByText('Invita a un amigo').waitFor();
  const wa = await page.getByRole('link', { name: 'Invitar por WhatsApp' }).getAttribute('href');
  const texto = decodeURIComponent(wa.split('text=')[1]);
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  console.log('1a) WhatsApp con su enlace de invitación (no su código ni su enlace secreto):', ok(/\/a\/calo-latino\?de=a1b2c3d4/.test(texto) && !/K7P2QX|AbCdEfGh/.test(texto)), texto);
  console.log('1b) ve a cuántos invitó:', ok(/Has invitado a 3 amigos · 1 ya se inscribió/.test(t)));
  console.log('1c) también puede compartir o copiar el enlace:', ok((await page.getByRole('button', { name: /Copiar enlace|Compartir de otra forma/ }).count()) === 1));
  await page.getByText('Invita a un amigo').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}invitar-portal.png` });
  await ctx.close();
}

// 2) página pública con invitación
const datos = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar' },
  sedes: [],
  clases: [{ id: 'c1', clase: 'Salsa 0', color: '#d13d51', dias: [1, 3], hora: '19:00', duracion: 60, sede_id: null, precio: null }],
  planes: [{ nombre: 'Clase suelta', tipo: 'suelta', precio: 6000, clases: 1, vigencia: 1, grupos: null, sede_id: null }],
  eventos: [],
  tienda: [],
};
for (const [n, url, esperado] of [
  ['con invitación', 'http://localhost:4173/a/calo-latino?de=A1B2C3D4', 'a1b2c3d4'],
  ['sin invitación', 'http://localhost:4173/a/calo-latino', undefined],
  ['con invitación inválida', 'http://localhost:4173/a/calo-latino?de=<script>', undefined],
]) {
  const { ctx, page } = await nuevo();
  let inscrito = null;
  let preguntoQuien = 0;
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await ctx.route('**/rest/v1/rpc/invitado_por', (r) => (preguntoQuien++, r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('Ana L.') })));
  await ctx.route('**/rest/v1/rpc/inscribir_interesado', (r) => {
    inscrito = JSON.parse(r.request().postData());
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(url);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(600);
  const banner = await page.getByText('Vienes de parte de Ana L.').count();
  if (esperado) await page.screenshot({ path: `${OUT}invitar-pagina.png` });
  await page.locator('#inscribete input').first().fill('Rosa Amiga');
  await page.locator('#inscribete input[inputmode=numeric]').fill('5511112222');
  await page.locator('#inscribete button[type=submit]').click();
  await page.waitForTimeout(800);
  const bien = esperado ? banner === 1 && inscrito?.p_de === esperado : banner === 0 && !('p_de' in (inscrito ?? {})) && preguntoQuien === 0;
  console.log(`2) ${n}: ${esperado ? '"Vienes de parte de Ana L." y se anota quién invitó' : 'sin aviso y sin mandar huella'}:`, ok(bien && !!inscrito), JSON.stringify(inscrito?.p_de ?? null));
  await ctx.close();
}

// 2b) enlace directo al horario (el del portal y los que se compartan): llega ahí, no a la portada
for (const h of ['#horarios', '#horario']) {
  const { ctx, page } = await nuevo();
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await page.goto(`http://localhost:4173/a/calo-latino${h}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(800);
  const y = await page.evaluate(() => document.getElementById('horarios').getBoundingClientRect().top);
  if (h === '#horarios') await page.screenshot({ path: `${OUT}enlace-horario.png` });
  console.log(`2b) /a/calo-latino${h} baja directo al horario:`, ok(Math.abs(y) < 120), Math.round(y));
  await ctx.close();
}

// 2c) alumno que llega desde SU portal (?yo=1): horarios sí, "primera clase" e inscripción no; puede volver
{
  const { ctx, page } = await nuevo();
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hoy: '2026-11-18', alumno: { nombre: 'Ana López', codigo: 'K7P2QX', foto: null }, academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, slug: 'calo-latino' }, planes: [], clases: [], tienda: [], horario: [] }) }));
  await page.goto('http://localhost:4173/p/AbCdEfGhJkLmNpQrStUvWxYz23');
  await page.getByRole('link', { name: /Ver el horario/ }).click();
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(800);
  const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const y = await page.evaluate(() => document.getElementById('horarios').getBoundingClientRect().top);
  await page.screenshot({ path: `${OUT}modo-alumno.png` });
  console.log('2c) desde su portal: ve el horario, sin "primera clase" ni inscripción:', ok(Math.abs(y) < 120 && !/primera clase|Inscríbete|Elige una clase para solicitar/i.test(t) && (await page.locator('#inscribete').count()) === 0 && (await page.getByRole('button', { name: /Solicitar lugar en/ }).count()) === 0), Math.round(y));
  await page.getByRole('button', { name: 'Volver a mi portal' }).first().click();
  await page.getByText('Tu pase de entrada').waitFor({ timeout: 5000 }).catch(() => {});
  console.log('2d) "Volver a mi portal" regresa a su portal:', ok(/\/p\/AbCdEf/.test(page.url())), page.url());
  await ctx.close();
}

// 3) recepción ve quién lo invitó
{
  const { page } = await nuevo();
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  await page.evaluate(() => window.compasDev.demoCompleta());
  await page.reload();
  await page.getByText('Monse', { exact: true }).click();
  for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
  await page.waitForTimeout(600);
  await page.evaluate(() => { history.pushState(null, '', '/alumnos/interesados'); dispatchEvent(new PopStateEvent('popstate')); });
  const chip = page.getByRole('link', { name: /Lo invitó/ }).first();
  await chip.waitFor({ timeout: 5000 }).catch(() => {});
  const n = await page.getByRole('link', { name: /Lo invitó/ }).count();
  await page.screenshot({ path: `${OUT}invitar-interesados.png`, fullPage: true });
  if (n) await chip.click();
  await page.waitForTimeout(500);
  console.log('3) Interesados muestra "Lo invitó …" y lleva a la ficha de quien invitó:', ok(n === 2 && /\/alumnos\/[0-9a-f-]{36}$/.test(page.url())), n);
}
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
