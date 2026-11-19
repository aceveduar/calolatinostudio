// Página pública en computadora: fotos y testimonios se pueden recorrer con flechas (con mouse no se desliza).
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (c) => (c ? 'OK' : 'MAL');
const errores = [];
const foto = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420"><rect width="640" height="420" fill="${c}"/></svg>`)}`;
const datos = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', sede_principal: 'Estudio' },
  pagina: { frase: 'Ven a bailar', galeria: ['#d6304a', '#1a7ab6', '#138645', '#7c3aed', '#ea580c'].map(foto), testimonios: [1, 2, 3, 4].map((n) => ({ texto: `Testimonio número ${n}: llegué sin saber bailar y ahora no me pierdo un social.`, nombre: `Alumna ${n}` })) },
  sedes: [],
  clases: [{ id: 'c1', clase: 'Salsa 0', color: '#d13d51', dias: [1, 3], hora: '19:00', duracion: 60, sede_id: null, precio: null }],
  planes: [
    { nombre: 'Mensual 1 clase', tipo: 'mensual', precio: 30000, clases: null, vigencia: 30, grupos: 1, sede_id: null },
    { nombre: 'Mensual ilimitado', tipo: 'mensual', precio: 65000, clases: null, vigencia: 30, grupos: null, sede_id: null },
  ],
  eventos: [],
  tienda: [],
};
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errores.push(e.message));
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
await page.goto('http://localhost:4173/a/calo-latino');
await page.getByRole('heading', { level: 1 }).waitFor();
const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('1) planes mensuales explicados sin confusión ("Tu grupo fijo…", no "Una clase durante un mes"):', ok(/Tu grupo fijo, todas sus clases del mes/.test(t) && /Todas las clases que quieras/.test(t) && !/Una clase durante un mes/.test(t)));
for (const nombre of ['Fotos', 'Lo que dicen nuestros alumnos']) {
  const lista = page.getByRole('list', { name: nombre });
  await lista.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const mas = page.getByRole('button', { name: `${nombre}: ver más` });
  const antes = await page.getByRole('button', { name: `${nombre}: anteriores` }).count();
  const hayMas = await mas.isVisible();
  if (nombre === 'Fotos') await page.screenshot({ path: `${OUT}carrusel-pc.png` });
  const x0 = await lista.evaluate((el) => el.scrollLeft);
  await mas.click();
  await page.waitForTimeout(700);
  const x1 = await lista.evaluate((el) => el.scrollLeft);
  const atras = await page.getByRole('button', { name: `${nombre}: anteriores` }).isVisible();
  console.log(`2) ${nombre}: flecha "ver más" (y no "anteriores" al inicio); al tocarla avanza y aparece "anteriores":`, ok(antes === 0 && hayMas && x1 > x0 && atras), `${x0}→${x1}`);
}
// 3) con los datos ya en el HTML (como los manda Cloudflare): aparece sin pedirlos a la base
{
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'es-MX', serviceWorkers: 'block' });
  const p2 = await c2.newPage();
  p2.on('pageerror', (e) => errores.push(e.message));
  let pidio = 0;
  await c2.route('**/rest/v1/rpc/pagina_publica', (r) => (pidio++, r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) })));
  await c2.route('http://localhost:4173/a/calo-latino', async (r) => {
    const res = await r.fetch();
    const html = (await res.text()).replace('</head>', `<script id="pp-datos" type="application/json" data-slug="calo-latino">${JSON.stringify(datos)}</script></head>`);
    return r.fulfill({ response: res, body: html });
  });
  await p2.goto('http://localhost:4173/a/calo-latino');
  await p2.getByRole('heading', { level: 1 }).waitFor();
  console.log('3) con los datos en el HTML la página aparece sin pedirlos otra vez:', ok(pidio === 0), pidio);
  await c2.close();
}
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
