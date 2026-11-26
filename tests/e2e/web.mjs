// Página oficial: la dirección llena el contenido y el visitante ve portada, ubicación, preguntas y redes. Sin nube.
import { chromium } from 'playwright-core';
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = DIR + 'salida/';
const ancho = process.argv[2] === 'pc' ? { width: 1366, height: 900 } : { width: 390, height: 844 };
const P = ancho.width < 500 ? 'm' : 'pc';
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: ancho, deviceScaleFactor: 2, isMobile: ancho.width < 500, hasTouch: true, locale: 'es-MX' });
const page = await ctx.newPage();
await page.clock.install({ time: new Date('2026-11-13T19:30:00') });
const errores = []; page.on('pageerror', (e) => errores.push(e.message));
await ctx.route(/rest\/v1\/(?!rpc\/pagina_publica)/, (r) => r.fulfill({ status: 201, body: '[]' })); // nada sale a la nube
await ctx.route(/maps\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<body style="background:#cde">mapa</body>' }));
const ok = (c) => (c ? 'OK' : 'MAL');
const ir = (r) => page.evaluate((x) => { history.pushState(null, '', x); dispatchEvent(new PopStateEvent('popstate')); }, r);

await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(() => window.compasDev.demoCompleta());
await page.reload();
await page.getByText('Dirección Calo', { exact: true }).click();
await page.keyboard.type('1234', { delay: 30 });
await page.getByPlaceholder(/Quién llegó|Buscar…/).waitFor();

// 1) editor del contenido
await ir('/ajustes/pagina');
// las secciones están plegadas (con su resumen): se abren para editarlas
const abrir = (t) => page.getByRole('button', { name: new RegExp('^' + t) }).click();
await page.getByText('Preguntas frecuentes').waitFor();
await abrir('Preguntas frecuentes');
await abrir('Portada');
await abrir('Dónde estamos');
await abrir('Redes sociales');
const sugeridas = await page.getByRole('textbox', { name: /^Pregunta \d/ }).count();
await page.locator('input[type=file][accept="image/*"]:not([multiple])').setInputFiles(DIR + 'archivos/foto.jpg');
await page.getByRole('img', { name: 'Foto de portada' }).waitFor();
await page.getByPlaceholder('Aprende a bailar salsa y bachata').fill('Ven a bailar salsa y bachata');
await page.getByPlaceholder(/Clases para todos los niveles/).fill('Clases desde cero, ambiente familiar y mucho sabor.');
await page.getByPlaceholder('Ej. Tu primera clase es gratis').fill('Tu primera clase es gratis');
await page.getByPlaceholder('Calle, número, colonia, ciudad').first().fill('Av. Juárez 123, Centro, Toluca, Méx.');
await page.getByPlaceholder(/Segundo piso/).first().fill('Segundo piso, junto a la farmacia');
await page.getByPlaceholder('@usuario').first().fill('@calolatino');
await abrir('Reglamentos');
await page.getByRole('button', { name: 'Agregar reglamento' }).click();
await page.getByRole('textbox', { name: 'Modalidad' }).fill('Salsa Casino');
await page.getByRole('textbox', { name: 'Texto del reglamento' }).fill('1. Asistencia\nLlega a tiempo.');
await page.getByRole('button', { name: 'Agregar reglamento' }).click();
await page.getByRole('textbox', { name: 'Modalidad' }).last().fill('Salsa en Línea');
await page.getByRole('textbox', { name: 'Texto del reglamento' }).last().fill('2. Pagos\nConsulta los bloques en recepción.');
await page.getByRole('button', { name: 'Guardar cambios' }).click();
await page.getByText('Página actualizada').waitFor();
const pag = await page.evaluate(async () => (await window.compasDev.db.academias.toArray())[0].pagina);
console.log('   guarda dos reglamentos independientes:', ok(pag.reglamentos?.length === 2 && pag.reglamentos[1].titulo === 'Salsa en Línea'));
console.log('1) contenido guardado (portada WebP ligera, frase, ubicación, 5 preguntas, redes):', ok(sugeridas === 5 && /^data:image\/(webp|jpeg)/.test(pag?.portada ?? '') && pag.portada.length < 200000 && pag.frase && pag.ubicaciones?.principal?.direccion && pag.preguntas?.length === 5 && pag.redes?.instagram), pag?.portada?.length);
console.log('   sin cambios → no hay botón de guardar (aparece solo al cambiar algo):', ok((await page.getByRole('button', { name: 'Guardar cambios' }).count()) === 0));

// 1b) clase por curso desde Clases y horarios
await ir('/ajustes/clases');
await page.locator('main button').filter({ hasText: /Salsa 1/ }).first().click();
const dlg = page.getByRole('dialog');
await dlg.getByRole('button', { name: 'Por curso' }).click();
await dlg.locator('input[type=date]').nth(0).fill('2026-11-02');
await dlg.locator('input[type=date]').nth(1).fill('2027-01-25');
await dlg.getByRole('button', { name: 'Guardar' }).click();
await page.waitForTimeout(500);
const curso = await page.evaluate(async () => {
  const ds = await window.compasDev.db.disciplinas.toArray();
  return (await window.compasDev.db.clases.toArray()).find((c) => c.nivel === '1' && ds.find((d) => d.id === c.disciplinaId)?.nombre === 'Salsa')?.curso;
});
console.log('1b) clase por curso guardada:', ok(curso?.inicio === '2026-11-02' && curso?.fin === '2027-01-25' && curso?.semanas === 2), JSON.stringify(curso));

// 2) la página como la ve un visitante (respuesta de la base simulada con lo guardado)
const datos = {
  academia: { nombre: 'Calo Latino Studio', color: '#d6304a', logo: null, whatsapp: '5512345678', sede_principal: 'Estudio Calo' },
  pagina: pag,
  sedes: [{ id: 'casa', nombre: 'Casa de Cultura', color: '#0f766e' }],
  clases: [
    { id: 'c1', clase: 'Salsa 0', color: '#e8445a', dias: [1, 3], hora: '19:00', duracion: 60, sede_id: null, precio: 6000, curso: { inicio: '2026-10-05', fin: '2026-12-21', semanas: 2 } },
    { id: 'c2', clase: 'Bachata 1', color: '#7c4ddb', dias: [2, 4], hora: '20:00', duracion: 60, sede_id: null, precio: null, curso: { inicio: '2026-11-23', fin: null, semanas: 2 } },
    { id: 'c3', clase: 'Lady Style', color: '#d6334a', dias: [6], hora: '11:00', duracion: 90, sede_id: null, precio: null,
      excepciones: { '2026-11-14': { hora: '12:30', sede_id: 'casa', nombre_sede: 'Casa de Cultura' } } },
    { id: 'c4', clase: 'Cumbia 1', color: '#0f766e', dias: [6], hora: '14:30', duracion: 60, sede_id: 'casa', precio: null },
  ],
  planes: [{ nombre: 'Clase suelta', tipo: 'suelta', precio: 6000, clases: 1, vigencia: 1, grupos: null, sede_id: null }, { nombre: 'Mensualidad', tipo: 'mensual', precio: 65000, clases: null, vigencia: 30, grupos: null, sede_id: null }],
  eventos: [],
  tienda: [
    { nombre: 'Playera Calo', precio: 25000, emoji: '👕', foto: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', descripcion: 'Algodón, con logo bordado al frente. Cuello redondo.', opciones: ['CH', 'M', 'G'], sobre_pedido: true },
    { nombre: 'Gorra Calo', precio: 20000, emoji: '🧢', foto: null, descripcion: 'Ajustable.', opciones: [], sobre_pedido: false },
  ],
};
await ctx.route('**/rest/v1/rpc/pagina_publica', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) }));
await page.goto('http://localhost:4173/a/calo-latino');
await page.getByRole('heading', { level: 1, name: 'Ven a bailar salsa y bachata' }).waitFor();
await page.waitForTimeout(600);
const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('2) portada con foto, frase, oferta y botones:', ok((await page.locator('header img').count()) >= 1 && /Tu primera clase es gratis/.test(t) && (await page.getByRole('link', { name: 'Tu primera clase' }).count()) === 1));
await page.screenshot({ path: `${OUT}web-${P}-1-portada.png` });
const sinMapa = (await page.locator('iframe[title^="Mapa"]').count()) === 0; // el mapa pesa: se carga al tocar
await page.getByRole('button', { name: 'Ver mapa' }).click();
const iframe = await page.locator('iframe[title^="Mapa"]').getAttribute('src');
if (!sinMapa) console.log('   MAL: el mapa cargó sin pedirlo');
const llegar = await page.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href');
console.log('3) dónde estamos: mapa y cómo llegar:', ok(/maps\.google\.com.*Ju%C3%A1rez/.test(iframe) && /google\.com\/maps\/dir\/.*destination=Av/.test(llegar) && /junto a la farmacia/.test(t)));
await page.getByText('¿Necesito ir con pareja?').click();
console.log('4) preguntas: se abren al tocar:', ok(await page.getByText(/vamos rotando/).isVisible()));
console.log('5) redes:', ok((await page.getByRole('link', { name: 'Instagram' }).getAttribute('href')) === 'https://instagram.com/calolatino'));
// botón fijo: aparece al bajar, se esconde en el formulario
await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await page.getByRole('heading', { name: 'Dónde estamos' }).evaluate((h) => h.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(700);
const barra = page.locator('a', { hasText: 'Quiero mi primera clase' });
const visibleAlBajar = await barra.evaluate((a) => getComputedStyle(a.closest('[aria-hidden]')).opacity === '1');
await page.screenshot({ path: `${OUT}web-${P}-2-medio.png` });
await page.locator('#inscribete').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
const ocultoEnForm = await barra.evaluate((a) => getComputedStyle(a.closest('[aria-hidden]')).opacity === '0');
console.log('6) botón fijo aparece al bajar y se esconde en el formulario:', ok(visibleAlBajar && ocultoEnForm));
await page.screenshot({ path: `${OUT}web-${P}-3-form.png` });
await page.evaluate(() => scrollTo(0, 0));
await page.getByRole('link', { name: 'Tu primera clase' }).click();
await page.waitForTimeout(800);
console.log('7) "Tu primera clase" lleva al formulario:', ok(await page.getByRole('heading', { name: 'Agenda tu primera clase' }).isVisible()));
await page.screenshot({ path: `${OUT}web-${P}-4-full.png`, fullPage: true });
// 8) cursos: a medio curso → lista de espera; grupo nuevo destacado
await page.getByRole('button', { name: 'Toda la semana' }).click();
await page.waitForTimeout(300);
const t2 = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('8) estados de los grupos:', ok(/Bachata 1: inicia el/.test(t2) && /Grupo en curso hasta el/.test(t2) && !/Lady Style\s*(Grupo|Empezó|Nuevo)/.test(t2)));
const sedeHorario = page.getByRole('combobox', { name: 'Sede', exact: true });
await sedeHorario.selectOption({ label: 'Casa de Cultura' });
const trasladada = page.getByRole('button', { name: /Solicitar lugar en Lady Style, sábado 12:30/ });
await trasladada.click();
console.log('8b) la clase trasladada se puede elegir desde su nueva sede:', ok(
  await page.getByText(/Lady Style · 12:30 · Casa de Cultura/).isVisible()
  && await page.locator('#inscribete select').inputValue() === 'c3',
));
await sedeHorario.selectOption({ label: 'Estudio Calo' });
let inscrito = null;
await ctx.route('**/rest/v1/rpc/inscribir_interesado', (r) => { inscrito = JSON.parse(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
await page.locator('#inscribete input').first().fill('Rosa Prueba');
await page.locator('#inscribete input[inputmode=numeric]').fill('5511112222');
await page.locator('#inscribete select').selectOption('c1');
const aviso = await page.getByText(/ya va a medio curso/).isVisible();
await page.getByRole('button', { name: 'Avísenme del siguiente grupo' }).click();
await page.getByText(/en cuanto abra el siguiente grupo de Salsa 0/).waitFor();
console.log('9) a medio curso: queda en lista de espera:', ok(aviso && inscrito?.p_clase === 'c1'));
await page.screenshot({ path: `${OUT}web-${P}-5-espera.png` });
const tarjeta = page.getByRole('button', { name: /Ver Playera Calo/ });
await tarjeta.click();
const detalle = page.getByRole('dialog', { name: 'Playera Calo' });
await detalle.getByText(datos.tienda[0].descripcion, { exact: true }).waitFor();
const consulta = detalle.getByRole('link', { name: 'Consultar por WhatsApp' });
await detalle.getByRole('button', { name: 'M', exact: true }).click();
const mensaje = new URL(await consulta.getAttribute('href')).searchParams.get('text');
console.log('10) tienda: detalle con foto ampliada, descripción y variante en WhatsApp:', ok(
  ctx.pages().length === 1 && await detalle.getByText('Sobre pedido. Pregunta por el plazo de entrega.', { exact: true }).isVisible() &&
  await detalle.locator('img').getAttribute('width') === '224' && mensaje.includes('Playera Calo (M)'),
));
await page.keyboard.press('Escape');
await tarjeta.click();
const mensajeNuevo = new URL(await consulta.getAttribute('href')).searchParams.get('text');
console.log('11) tienda: volver a abrir permite consultar sin variante:', ok(!mensajeNuevo.includes('(M)')));
await page.keyboard.press('Escape');
await page.getByRole('link', { name: 'Consultar reglamentos' }).click();
await page.getByRole('heading', { name: 'Reglamentos', exact: true }).waitFor();
await page.getByText('Salsa en Línea', { exact: true }).click();
console.log('12) consulta móvil: cada modalidad abre su propio texto:', ok(
  await page.getByText('Consulta los bloques en recepción.', { exact: false }).isVisible()
  && !await page.getByText('Llega a tiempo.', { exact: false }).isVisible(),
));
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
