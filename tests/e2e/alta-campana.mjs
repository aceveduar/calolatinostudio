import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origen = 'http://localhost:4173';
const token = '00000000-0000-4000-8000-000000000123';
const pase = 'AbCdEfGhJkLmNpQrStUvWxYz23';
const nombre = 'Alumno de prueba';
const browser = await chromium.launch({ channel: 'msedge' });
const recepcion = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const alumno = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const campana = { token, abierta: true, altas: 0, vence: new Date(Date.now() + 86400000).toISOString() };
let consultas = 0;
const recientes = [];

try {
  await recepcion.route('**/rest/v1/rpc/gestionar_alta_grupal', (r) => {
    const { p_accion } = r.request().postDataJSON();
    if (p_accion === 'conteo') consultas++;
    if (p_accion === 'cerrar') campana.abierta = false;
    return r.fulfill({ json: { ...campana, recientes: p_accion === 'estado' ? recientes : null } });
  });
  await alumno.route('**/rest/v1/rpc/estado_alta_grupal', (r) => r.fulfill({ json: { abierta: campana.abierta, nombre: 'Academia de prueba' } }));
  await alumno.route('**/rest/v1/rpc/registrar_alta_grupal', (r) => {
    if (!campana.abierta) return r.fulfill({ json: { estado: 'cerrada' } });
    campana.altas++;
    recientes.unshift({ id: 'alta-ficticia', nombre, alta: Date.now() });
    return r.fulfill({ json: { estado: 'lista', portal: pase } });
  });
  await alumno.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ json: {
    hoy: '2026-11-27', alumno: { nombre, codigo: 'QRDEMO' },
    academia: { nombre: 'Academia de prueba', color: '#0369a1' }, planes: [], clases: [], tienda: [],
  } }));

  // Las dos sesiones están en primer plano en sus respectivos equipos.
  await recepcion.addInitScript(() => Object.defineProperty(document, 'visibilityState', { get: () => 'visible' }));
  const monse = await recepcion.newPage();
  const formulario = await alumno.newPage();
  const formularioAbierto = await alumno.newPage();
  await monse.clock.install();
  await monse.goto(origen);
  await monse.waitForFunction(() => window.compasDev);
  await monse.evaluate(() => window.compasDev.sembrar());
  await monse.reload();
  const primeraConsulta = monse.waitForResponse((r) => r.url().endsWith('/gestionar_alta_grupal') && r.request().postDataJSON().p_accion === 'conteo');
  await monse.getByText('Monse', { exact: true }).click();
  for (const d of '1111') await monse.getByRole('button', { name: d, exact: true }).click();
  await primeraConsulta;
  const pestanaAlumnos = monse.getByRole('link', { name: 'Alumnos', exact: true });
  await pestanaAlumnos.waitFor();
  assert.equal(await pestanaAlumnos.getAttribute('aria-description'), null);
  const registro = monse.getByRole('link', { name: /Registro por enlace/ });

  for (const pagina of [formulario, formularioAbierto]) await pagina.goto(`${origen}/alta/${token}`);
  const crear = (pagina) => pagina.getByRole('button', { name: 'Crear mi pase' });
  const llenar = async (pagina, persona, celular) => {
    await pagina.getByLabel('Nombre completo').fill(persona);
    await pagina.getByLabel('Celular').fill(celular);
  };
  await llenar(formulario, nombre, '5500000001');
  await crear(formulario).click();
  await formulario.getByRole('heading', { name: 'Tu pase está listo' }).waitFor();
  await formulario.getByRole('link', { name: 'Abrir Mi pase' }).click();
  await formulario.getByRole('button', { name: 'Mostrar mi pase', exact: true }).waitFor();

  const antes = consultas;
  await monse.clock.fastForward(15_000);
  const conAlta = () => monse.locator('a[aria-description="1 alta nueva"]:visible');
  await conAlta().waitFor();
  assert.equal(consultas, antes + 1);
  console.log('1a) Entrada muestra el aviso en la pestaña Alumnos sin refrescar: OK');
  await monse.getByRole('link', { name: 'Caja', exact: true }).click();
  await conAlta().waitFor();
  await monse.setViewportSize({ width: 1280, height: 900 });
  await monse.locator('aside').locator('a[aria-description="1 alta nueva"]').waitFor();
  await pestanaAlumnos.click();
  await monse.getByRole('link', { name: 'Registro por enlace 1 alta nueva' }).waitFor();
  assert.equal(consultas, antes + 1);
  console.log('1b) Caja conserva el contador y Alumnos reutiliza la misma consulta: OK');

  await registro.click();
  await monse.getByRole('link', { name: new RegExp(nombre) }).waitFor();
  await monse.getByRole('button', { name: 'Marcar como vistas todas las altas nuevas' }).click();
  await conAlta().waitFor({ state: 'hidden' });
  console.log('1c) marcar como vistas limpia el contador de inmediato: OK');
  await monse.getByRole('button', { name: 'Cerrar registro', exact: true }).click();
  await monse.getByRole('button', { name: 'Confirmar cierre' }).click();
  await monse.getByText('Registro cerrado', { exact: true }).waitFor();
  await llenar(formularioAbierto, 'Otra persona de prueba', '5500000002');
  await crear(formularioAbierto).click();
  await formularioAbierto.getByText(/El registro por este enlace está cerrado/).waitFor();
  await formularioAbierto.reload();
  await formularioAbierto.getByText(/El registro por este enlace está cerrado/).waitFor();
  assert.equal(campana.altas, 1);
  console.log('2) cerrar bloquea también un formulario que ya estaba abierto: OK');

  await formulario.reload();
  await formulario.getByRole('button', { name: 'Mostrar mi pase', exact: true }).waitFor();
  console.log('3) el pase personal abre después del cierre: OK');
} finally {
  await browser.close();
}
