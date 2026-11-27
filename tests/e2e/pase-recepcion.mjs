import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  channel: 'msedge',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
await ctx.addInitScript(() => {
  window.BarcodeDetector = class {
    static async getSupportedFormats() { return ['qr_code']; }
    async detect() {
      const rawValue = window.credencialDePrueba;
      window.credencialDePrueba = null;
      return rawValue ? [{ rawValue, cornerPoints: [] }] : [];
    }
  };
});
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (error) => errores.push(error.message));
await page.clock.install({ time: new Date('2026-11-14T10:30:00') });
await page.goto('http://localhost:4173/');
await page.waitForFunction(() => !!window.compasDev);
await page.evaluate(async () => {
  const dev = window.compasDev;
  await dev.sembrar();
  await dev.agregarClasesDemo();
  const primero = await dev.db.alumnos.toCollection().first();
  await dev.db.alumnos.add({
    ...primero, id: crypto.randomUUID(), codigo: 'QRDEMO', nombre: 'Alumno del escáner',
    activo: true, deletedAt: null, createdAt: Date.now(),
  });
});
await page.reload();
await page.getByText('Monse', { exact: true }).click();
for (const d of '1111') await page.getByRole('button', { name: d, exact: true }).click();
await page.getByRole('button', { name: /^Clase:/ }).waitFor();
const tarifa = await page.getByRole('button', { name: /^Cobrar \$.* sin nombre$/ }).getAttribute('aria-label');
const importe = tarifa.replace(/^Cobrar | sin nombre$/g, '');
await page.getByRole('button', { name: 'Escanear QR', exact: true }).click();
const lector = page.getByRole('dialog', { name: 'Escanear credencial' });
const leer = () => page.evaluate(() => { window.credencialDePrueba = 'COMPAS:QRDEMO'; });
await leer();
await lector.getByText(`Entrada registrada · ${importe}`, { exact: true }).waitFor();
const cuenta = lector.getByRole('button', { name: `Ver cuenta · ${importe}`, exact: true });
await cuenta.waitFor();
await lector.getByRole('button', { name: 'Escanear otro pase', exact: true }).click();
await page.clock.fastForward(6500);
await leer();
await lector.getByText('Ya está en esta clase. Sin nuevo cobro.', { exact: true }).waitFor();
await lector.getByText('En la cuenta · 1', { exact: true }).waitFor();
const registros = await page.evaluate(async () => {
  const { db } = window.compasDev;
  const alumno = await db.alumnos.where('codigo').equals('QRDEMO').first();
  return [
    await db.asistencias.where('alumnoId').equals(alumno.id).count(),
    await db.pagos.where('alumnoId').equals(alumno.id).count(),
  ];
});
console.log('1) el pase repetido conserva una sola entrada y un solo cobro:', registros.every((n) => n === 1) ? 'OK' : 'MAL');
await cuenta.click();
await lector.waitFor({ state: 'hidden' });
await page.getByText('Cobrar en efectivo', { exact: true }).waitFor();
console.log('2) Ver cuenta cierra la cámara y muestra el cobro de recepción: OK');
await page.getByRole('button', { name: 'Listo', exact: true }).click();
const tarjetaAdentro = page.getByRole('button', { name: /Alumno.*Adentro/ });
console.log('2a) el alumno escaneado queda fuera de Por llegar:', (await tarjetaAdentro.count()) === 0 ? 'OK' : 'MAL');
await page.getByRole('button', { name: /^Adentro · 1$/ }).click();
await page.getByText('Alumno del escáner', { exact: true }).waitFor();
console.log('2b) el alumno aparece en Adentro:', 'OK');
await page.setViewportSize({ width: 1366, height: 900 });
await page.getByRole('button', { name: 'Corregir entrada de Alumno del escáner' }).waitFor();
console.log('2c) en escritorio el alumno aparece solo en el panel de asistencia:', (await tarjetaAdentro.count()) === 0 && (await page.getByText('Alumno del escáner', { exact: true }).count()) === 1 ? 'OK' : 'MAL');
await page.setViewportSize({ width: 360, height: 780 });

const token = 'AbCdEfGhJkLmNpQrStUvWxYz23';
await ctx.route('**/rest/v1/rpc/estado_alta_grupal', (r) => r.fulfill({ json: { abierta: true, nombre: 'Calo de prueba' } }));
await ctx.route('**/rest/v1/rpc/registrar_alta_grupal', (r) => r.fulfill({ json: { estado: 'lista', portal: token } }));
await ctx.route('**/rest/v1/rpc/portal_alumno', (r) => r.fulfill({ json: {
  hoy: '2026-11-14', alumno: { nombre: 'Alumno de prueba', codigo: 'QRDEMO' },
  academia: { nombre: 'Calo de prueba', color: '#0369a1' }, planes: [], clases: [], tienda: [],
} }));
await page.goto('http://localhost:4173/alta/00000000-0000-4000-8000-000000000123');
await page.getByLabel('Nombre completo').fill('Alumno de prueba');
const celular = page.getByLabel('Celular', { exact: false });
await celular.fill('5500000000');
const numerico = (await celular.getAttribute('inputmode')) === 'numeric';
await page.getByRole('button', { name: 'Crear mi pase' }).click();
await page.getByRole('heading', { name: 'Tu pase está listo' }).waitFor();
await page.getByRole('link', { name: 'Abrir Mi pase' }).click();
await page.getByRole('button', { name: 'Mostrar mi pase', exact: true }).click();
const pase = page.getByRole('dialog', { name: 'Mi pase de entrada' });
await pase.getByRole('img', { name: 'Tu código QR' }).waitFor();
await pase.getByRole('button', { name: 'Listo' }).click();
await pase.waitFor({ state: 'hidden' });
console.log('3) el alta usa teclado numérico y abre el pase con su QR:', numerico ? 'OK' : 'MAL');
console.log('errores:', errores.length ? errores : 'ninguno');
await browser.close();
