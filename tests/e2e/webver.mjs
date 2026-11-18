// Capturas del rediseño con datos reales de la demo (generados en el navegador, sin nube).
import { chromium } from 'playwright-core';
const OUT = new URL('./salida/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const browser = await chromium.launch({ channel: 'msedge' });
for (const [P, vp] of [['m', { width: 390, height: 844 }], ['pc', { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: P === 'm' ? 2 : 1, isMobile: P === 'm', hasTouch: P === 'm', locale: 'es-MX' });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
  await ctx.route(/rest\/v1\/(?!rpc\/pagina_publica)/, (r) => r.fulfill({ status: 201, body: '[]' }));
  await ctx.route(/maps\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="margin:0;background:linear-gradient(135deg,#e8eef3,#cfdde8);height:100vh"></body>' }));
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => !!window.compasDev);
  // arma la misma respuesta que daría la base, a partir de la demo local
  const datos = await page.evaluate(async () => {
    await window.compasDev.demoCompleta();
    const db = window.compasDev.db;
    const a = (await db.academias.toArray())[0];
    const ds = await db.disciplinas.toArray();
    const sedes = (await db.sedes.toArray()).filter((s) => !s.deletedAt && s.activo);
    const clases = (await db.clases.toArray()).filter((c) => !c.deletedAt && c.activo).map((k) => { const d = ds.find((x) => x.id === k.disciplinaId); return { id: k.id, clase: `${d?.nombre ?? 'Clase'} ${k.nivel}`.trim(), color: d?.color ?? null, dias: k.dias, hora: k.horaInicio, duracion: k.duracionMin, sede_id: k.sedeId ?? null, precio: k.precioSuelta ?? null, curso: k.curso ?? null }; });
    const planes = (await db.planes.toArray()).filter((x) => !x.deletedAt && x.activo && x.precio > 0).map((x) => ({ nombre: x.nombre, tipo: x.tipo, precio: x.precio, clases: x.clases, vigencia: x.vigenciaDias, grupos: x.grupos ?? null, sede_id: x.sedeId ?? null }));
    const eventos = (await db.eventos.toArray()).filter((e) => !e.deletedAt && e.activo && e.fecha >= '2026-11-13').map((e) => ({ nombre: e.nombre, fecha: e.fecha, hora: e.horaInicio, precio: e.precio, descripcion: e.descripcion, quedan: e.cupo }));
    const tienda = (await db.productos.toArray()).filter((p) => !p.deletedAt && p.activo && p.enLinea).map((p) => ({ nombre: p.nombre, precio: p.precio, emoji: p.emoji, foto: p.foto, descripcion: p.descripcion, opciones: p.opciones ?? [], sobre_pedido: !!p.sobrePedido }));
    return { academia: { nombre: a.nombre, color: a.color ?? null, logo: a.logo ?? null, whatsapp: a.whatsapp, sede_principal: a.sedePrincipal || 'Estudio Calo' }, pagina: a.pagina, sedes: sedes.map((s) => ({ id: s.id, nombre: s.nombre, color: s.color })), clases, planes, eventos, tienda };
  });
  await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
  await page.goto('http://localhost:4173/a/calo-latino');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}rd-${P}-1-portada.png` });
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  const paso = Math.round(vp.height * 0.9);
  for (let y = paso, i = 2; y < alto; y += paso, i++) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}rd-${P}-${String(i).padStart(2, '0')}.png` });
  }
  console.log(P, 'alto', await page.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close();
}
await browser.close();
