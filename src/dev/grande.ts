/**
 * Academia GRANDE de prueba (solo compilaciones de prueba): ~5,000 alumnos en 3 sedes, 6 meses de historia.
 * Datos coherentes con las reglas de la app: cada entrada la cubre un plan vigente o se cobra como clase
 * suelta, los paquetes no pasan de sus clases, hay cortes diarios por sede, gastos y pagos a maestros cada mes,
 * ventas de tienda, fiados, eventos con boletos, rentas, apartados e interesados.
 * Escribe en la base del teléfono y lo deja en la cola: la sincronización normal lo sube a la nube.
 */
import { db, getMeta } from '../db/db';
import { hashPin } from '../domain/acceso';
import { PRINCIPAL } from '../domain/sedes';
import { aFecha, sumarDias } from '../domain/fechas';
import type { Alumno, Asistencia, Boleto, Clase, Corte, Disciplina, Evento, Gasto, GastoFijo, ID, Interesado, Maestro, Membresia, Pago, Pedido, Plan, Producto, Renta, Sede, SyncTable, Testimonio, Usuario } from '../db/types';

const NOMBRES = ['Ana', 'Luis', 'María', 'José', 'Sofía', 'Carlos', 'Valeria', 'Miguel', 'Camila', 'Jorge', 'Daniela', 'Diego', 'Fernanda', 'Andrés', 'Mariana', 'Ricardo', 'Lucía', 'Alejandro', 'Paola', 'Fernando', 'Gabriela', 'Javier', 'Ximena', 'Raúl', 'Andrea', 'Eduardo', 'Natalia', 'Óscar', 'Regina', 'Héctor', 'Renata', 'Iván', 'Jimena', 'Pablo', 'Karla', 'Sergio', 'Itzel', 'Roberto', 'Montserrat', 'Emilio', 'Alejandra', 'Hugo', 'Brenda', 'Adrián', 'Daniel', 'Teresa', 'Rocío', 'Arturo', 'Silvia', 'Gustavo', 'Liliana', 'Mateo', 'Elena', 'Santiago', 'Patricia', 'Martín', 'Leticia', 'Julio', 'Carolina', 'Ernesto'];
const APELLIDOS = ['López', 'García', 'Martínez', 'Hernández', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Díaz', 'Gutiérrez', 'Ruiz', 'Mendoza', 'Aguilar', 'Ortiz', 'Castillo', 'Moreno', 'Romero', 'Álvarez', 'Chávez', 'Rivera', 'Juárez', 'Domínguez', 'Herrera', 'Medina', 'Castro', 'Vargas', 'Guzmán', 'Velázquez', 'Ramos', 'Salazar', 'Soto'];
const DISCIPLINAS = [
  ['Salsa en línea', '#d13d51'],
  ['Salsa cubana', '#b06005'],
  ['Bachata', '#7c4ddb'],
  ['Contemporáneo', '#0b8278'],
  ['Urbano', '#1a7ab6'],
  ['Lady Style', '#d92776'],
  ['Cumbia', '#138645'],
  ['Ritmos latinos', '#3d3a48'],
] as const;
const PRODUCTOS: [string, string, number, number, 'consumo' | 'articulo'][] = [
  ['Agua 600 ml', '💧', 1500, 600, 'consumo'], ['Agua 1 L', '💧', 2200, 900, 'consumo'], ['Electrolit', '🧃', 3500, 2000, 'consumo'], ['Gatorade', '🥤', 3000, 1700, 'consumo'],
  ['Refresco', '🥤', 2500, 1200, 'consumo'], ['Café', '☕', 2500, 600, 'consumo'], ['Barra de granola', '🍫', 2000, 900, 'consumo'], ['Plátano', '🍌', 1000, 300, 'consumo'],
  ['Galletas', '🍪', 1800, 800, 'consumo'], ['Cacahuates', '🥜', 1500, 600, 'consumo'], ['Chicles', '🍬', 1000, 400, 'consumo'], ['Jugo', '🧃', 2500, 1100, 'consumo'],
  ['Playera Calo', '👕', 25000, 11000, 'articulo'], ['Playera dry-fit', '👕', 32000, 15000, 'articulo'], ['Sudadera', '🧥', 55000, 26000, 'articulo'], ['Toalla', '🧻', 12000, 5000, 'articulo'],
  ['Botella termo', '🍶', 18000, 7000, 'articulo'], ['Gorra', '🧢', 22000, 9000, 'articulo'], ['Zapatillas de baile', '👠', 120000, 70000, 'articulo'], ['Rodilleras', '🦵', 15000, 6500, 'articulo'],
  ['Calcetas antiderrapantes', '🧦', 9000, 3500, 'articulo'], ['Falda de práctica', '👗', 38000, 17000, 'articulo'], ['Leggins', '🩱', 30000, 13000, 'articulo'], ['Muñequeras', '🎽', 8000, 3000, 'articulo'],
];
const r = (() => {
  let s = 20261118;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();
const elige = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const entre = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const uid = () => crypto.randomUUID() as ID;
const codigoAlumno = (() => {
  const usados = new Set<string>();
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return () => {
    for (;;) {
      const c = Array.from({ length: 6 }, () => A[Math.floor(r() * A.length)]).join('');
      if (!usados.has(c)) return usados.add(c), c;
    }
  };
})();

export async function academiaGrande(p: { alumnos?: number; meses?: number } = {}): Promise<Record<string, number>> {
  const N = p.alumnos ?? 5000;
  const DIAS = Math.round((p.meses ?? 6) * 30.4);
  const A = (await getMeta<ID>('academiaId'))!;
  const usuarios = await db.usuarios.toArray();
  const dueno = usuarios.find((u) => u.rol === 'dueno')!;
  const recepcion = usuarios.find((u) => u.rol === 'recepcion') ?? dueno;
  const hoy = aFecha(new Date());
  const inicio = sumarDias(hoy, -DIAS);
  const ts = (f: string, hhmm = '12:00', min = 0) => new Date(`${f}T${hhmm}:00`).getTime() + min * 60_000;
  const base = (t: number) => ({ id: uid(), academiaId: A, createdAt: t, updatedAt: t, deletedAt: null });
  const filas: Partial<Record<SyncTable, object[]>> = {};
  const agrega = <T extends object>(t: SyncTable, x: T) => ((filas[t] ??= []).push(x), x);

  // sedes, salones, disciplinas, maestros
  const t0 = ts(sumarDias(inicio, -30));
  const sedes = ['Casa de Cultura', 'Plaza Centro'].map((nombre, i) => agrega<Sede>('sedes', { ...base(t0), nombre, color: ['#1a7ab6', '#138645'][i], activo: true }));
  const sedeIds: (ID | null)[] = [null, ...sedes.map((s) => s.id)];
  await db.academias.update(A, { sedePrincipal: 'Estudio Calo', salones: [{ id: uid(), nombre: 'Salón 2' }] });
  const disc = DISCIPLINAS.map(([nombre, color]) => agrega<Disciplina>('disciplinas', { ...base(t0), nombre, color }));
  const maestros = Array.from({ length: 18 }, (_, i) => agrega<Maestro>('maestros', { ...base(t0), nombre: `Profe ${NOMBRES[(i * 7) % NOMBRES.length]} ${APELLIDOS[(i * 11) % APELLIDOS.length]}`, telefono: `55${String(10000000 + i * 7919).slice(0, 8)}`, notas: '', activo: true }));
  for (const [i, m] of maestros.slice(0, 6).entries())
    agrega<Usuario>('usuarios', { ...base(t0), nombre: m.nombre, rol: 'maestro', maestroId: m.id, pinHash: await hashPin(String(500000 + i * 11111 + 3729), A), activo: true });

  // clases: por sede, de lunes a sábado, en la tarde (y sábado en la mañana)
  const clases: Clase[] = [];
  for (const [si, sedeId] of sedeIds.entries()) {
    const horas = si === 0 ? ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'] : ['16:00', '17:00', '18:00', '19:00', '20:00'];
    for (const [hi, h] of horas.entries())
      for (const dias of [[1, 3], [2, 4], [5]]) {
        const d = disc[(si * 3 + hi * 2 + dias[0]) % disc.length];
        clases.push(agrega<Clase>('clases', { ...base(t0), sedeId, disciplinaId: d.id, nivel: String((hi + dias[0]) % 4), maestroId: maestros[(si * 6 + hi + dias[0]) % maestros.length].id, dias, horaInicio: h, duracionMin: 60, activo: true }));
      }
    for (const h of si === 0 ? ['09:00', '10:30', '12:00'] : ['10:00', '11:30']) clases.push(agrega<Clase>('clases', { ...base(t0), sedeId, disciplinaId: elige(disc).id, nivel: '0', maestroId: elige(maestros).id, dias: [6], horaInicio: h, duracionMin: 90, activo: true }));
  }

  // planes (para todas las sedes)
  const plan = (nombre: string, tipo: Plan['tipo'], precio: number, clasesN: number | null, vigencia: number | null, grupos: number | null = null) =>
    agrega<Plan>('planes', { ...base(t0), nombre, tipo, precio, clases: clasesN, vigenciaDias: vigencia, disciplinaId: null, activo: true, sedeId: null, grupos });
  const suelta = plan('Clase suelta', 'suelta', 6000, 1, null);
  const m1 = plan('Mensual 1 clase', 'mensual', 30000, null, 30, 1);
  const m2 = plan('Mensual 2 clases', 'mensual', 45000, null, 30, 2);
  const libre = plan('Mensual ilimitado', 'mensual', 65000, null, 30);
  const p8 = plan('Paquete 8 clases', 'paquete', 40000, 8, 30);
  const p12 = plan('Paquete 12 clases', 'paquete', 54000, 12, 45);
  const beca = plan('Beca', 'mensual', 0, null, 180);
  void PRINCIPAL;

  // productos
  // cada producto en sus variantes (sabores, colores, tallas de niño): ~80 en la tienda
  const VARIANTES = { consumo: ['', ' natural', ' sabor fresa'], articulo: [' negra', ' blanca', ' roja'] } as const;
  const productos = PRODUCTOS.flatMap(([nombre, emoji, precio, costo, categoria], i) =>
    VARIANTES[categoria].map((v, j) => {
      const nom = categoria === 'articulo' && /Zapatillas|Rodilleras|Botella|Toalla|Muñequeras|Calcetas/.test(nombre) ? `${nombre}${['', ' (niños)', ' premium'][j]}` : `${nombre}${v}`;
      return agrega<Producto>('productos', { ...base(t0), nombre: nom.trim(), precio: precio + j * (categoria === 'articulo' ? 2000 : 0), costo, emoji, foto: null, categoria, descripcion: '', inventario: categoria === 'consumo' ? 150 : 20, inventarioAt: t0, alerta: categoria === 'consumo' ? 15 : 3, activo: true, enLinea: categoria === 'articulo', opciones: categoria === 'articulo' && /Playera|Sudadera|Leggins|Falda/.test(nombre) ? ['CH', 'M', 'G', 'XG'] : null, codigo: `750${String(1000000000 + i * 7703 + j * 31).slice(0, 10)}`, sobrePedido: nombre.startsWith('Zapatillas'), diasEntrega: nombre.startsWith('Zapatillas') ? 15 : null });
    }),
  );

  // alumnos: unos 2,700 vienen seguido; el resto se dio de baja o dejó de venir
  const alumnos: (Alumno & { _clases: Clase[]; _forma: 'm1' | 'm2' | 'libre' | 'p8' | 'p12' | 'suelta' | 'beca' | 'fiado'; _ritmo: number; _desde: string; _hasta: string })[] = [];
  for (let i = 0; i < N; i++) {
    const regular = i < N * 0.54;
    const desde = regular ? (r() < 0.75 ? inicio : sumarDias(inicio, entre(0, DIAS - 20))) : sumarDias(inicio, -entre(30, 900));
    const hasta = regular ? (r() < 0.9 ? hoy : sumarDias(inicio, entre(40, DIAS - 10))) : sumarDias(desde, entre(20, 200));
    const sede = r() < 0.6 ? 0 : r() < 0.6 ? 1 : 2;
    const suyas = clases.filter((c) => (c.sedeId ?? null) === sedeIds[sede]);
    const cuantas = r() < 0.55 ? 1 : 2;
    const mis = Array.from({ length: cuantas }, () => elige(suyas)).filter((c, j, xs) => xs.indexOf(c) === j);
    const x = r();
    const forma = x < 0.3 ? 'm1' : x < 0.5 ? 'm2' : x < 0.6 ? 'libre' : x < 0.72 ? 'p8' : x < 0.77 ? 'p12' : x < 0.95 ? 'suelta' : x < 0.98 ? 'beca' : 'fiado';
    const nombre = `${elige(NOMBRES)} ${elige(APELLIDOS)} ${r() < 0.6 ? elige(APELLIDOS) : ''}`.trim();
    const alta = ts(desde, '18:00');
    const a = { ...base(alta), nombre, telefono: r() < 0.93 ? `55${String(Math.floor(r() * 1e8)).padStart(8, '0')}` : '', notas: r() < 0.05 ? 'Lesión de rodilla: avisar al maestro' : '', codigo: codigoAlumno(), activo: regular || r() < 0.4, portal: null, foto: null, avisos: null, _clases: mis, _forma: forma, _ritmo: regular ? 0.6 + r() * 0.35 : 0.5, _desde: desde, _hasta: hasta } as (typeof alumnos)[number];
    alumnos.push(a);
  }
  for (const a of alumnos) {
    // solo los campos del alumno (los "_" son ayudas para generar su historia)
    const limpio = Object.fromEntries(Object.entries(a).filter(([k]) => !k.startsWith('_'))) as unknown as Alumno;
    agrega<Alumno>('alumnos', limpio);
  }

  // día por día: entradas, cobros, planes, tienda, cortes
  const precioDe = { m1, m2, libre, p8, p12, beca } as const;
  const vigente = new Map<ID, { m: Membresia; usadas: number }>();
  const efectivoDia = new Map<string, number>();
  const otrosDia = new Map<string, number>();
  const suma = (k: string, monto: number, metodo: Pago['metodo']) => (metodo === 'efectivo' ? efectivoDia : otrosDia).set(k, ((metodo === 'efectivo' ? efectivoDia : otrosDia).get(k) ?? 0) + monto);
  const metodoAl = (): Pago['metodo'] => (r() < 0.68 ? 'efectivo' : r() < 0.8 ? 'transferencia' : 'tarjeta');
  for (let d = 0; d <= DIAS; d++) {
    const fecha = sumarDias(inicio, d);
    const dow = new Date(`${fecha}T12:00:00`).getDay();
    for (const c of clases.filter((k) => k.dias.includes(dow))) {
      for (const a of alumnos) {
        if (!a._clases.includes(c) || fecha < a._desde || fecha > a._hasta || r() > a._ritmo) continue;
        const t = ts(fecha, c.horaInicio, -entre(1, 25));
        const sk = `${fecha}|${c.sedeId ?? ''}`;
        let membresiaId: ID | null = null;
        let pagoId: ID | null = null;
        let debe = false;
        if (a._forma === 'suelta' || a._forma === 'fiado') {
          if (a._forma === 'fiado' && r() < 0.15 && d > DIAS - 45) debe = true;
          else {
            const metodo = metodoAl();
            const pg = agrega<Pago>('pagos', { ...base(t), sedeId: c.sedeId ?? null, alumnoId: a.id, planId: suelta.id, concepto: 'Clase suelta', monto: suelta.precio, metodo, usuarioId: recepcion.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null });
            pagoId = pg.id;
            suma(sk, pg.monto, metodo);
          }
        } else {
          let v = vigente.get(a.id);
          const pl = precioDe[a._forma];
          const agotado = v && v.m.clasesTotal !== null && v.usadas >= v.m.clasesTotal;
          if (!v || v.m.fin < fecha || agotado) {
            const metodo = metodoAl();
            const pg = pl.precio > 0 ? agrega<Pago>('pagos', { ...base(t), sedeId: c.sedeId ?? null, alumnoId: a.id, planId: pl.id, concepto: pl.nombre, monto: pl.precio, metodo, usuarioId: recepcion.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null }) : null;
            if (pg) suma(sk, pg.monto, metodo);
            const m = agrega<Membresia>('membresias', { ...base(t), sedeId: null, alumnoId: a.id, planId: pl.id, pagoId: pg?.id ?? uid(), disciplinaId: null, inicio: fecha, fin: sumarDias(fecha, (pl.vigenciaDias ?? 30) - 1), clasesTotal: pl.clases, anuladaAt: null, claseIds: pl.grupos ? a._clases.slice(0, pl.grupos).map((k) => k.id) : null });
            v = { m, usadas: 0 };
            vigente.set(a.id, v);
          }
          v.usadas++;
          membresiaId = v.m.id;
        }
        agrega<Asistencia>('asistencias', { ...base(t), alumnoId: a.id, nombreVisitante: null, claseId: c.id, fecha, membresiaId, pagoId, usuarioId: recepcion.id, anuladaAt: null, ...(debe ? { debe: true } : {}) });
        // a veces compra algo en la tienda
        if (r() < 0.07) {
          const pr = elige(productos.filter((x) => x.categoria === 'consumo'));
          const metodo = r() < 0.85 ? 'efectivo' : 'transferencia';
          const cantidad = r() < 0.85 ? 1 : 2;
          const pg = agrega<Pago>('pagos', { ...base(t + 60_000), sedeId: c.sedeId ?? null, alumnoId: a.id, planId: null, productoId: pr.id, cantidad, costo: (pr.costo ?? 0) * cantidad, concepto: pr.nombre, monto: pr.precio * cantidad, metodo, usuarioId: recepcion.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null });
          suma(sk, pg.monto, metodo);
        }
      }
    }
    // corte de caja por sede, al cierre (no el de hoy: aún no se hace)
    if (fecha < hoy)
      for (const sedeId of sedeIds) {
        const sk = `${fecha}|${sedeId ?? ''}`;
        const esperado = efectivoDia.get(sk) ?? 0;
        if (!esperado) continue;
        const dif = r() < 0.9 ? 0 : (r() < 0.5 ? -1 : 1) * entre(1, 5) * 1000;
        agrega<Corte>('cortes', { ...base(ts(fecha, '22:15')), sedeId, fecha, esperadoEfectivo: esperado, contadoEfectivo: esperado + dif, diferencia: dif, totalOtros: otrosDia.get(sk) ?? 0, usuarioId: recepcion.id, notas: dif ? 'Revisar cambio' : '' });
      }
  }

  // gastos fijos y gastos de cada mes (renta, luz, agua, internet, limpieza y pagos a maestros)
  const fijos: GastoFijo[] = [];
  for (const sedeId of sedeIds)
    for (const [concepto, categoria, monto, dia] of [['Renta del local', 'renta', sedeId ? 1200000 : 2500000, 1], ['Luz', 'luz', 180000, 10], ['Agua', 'agua', 45000, 12], ['Internet', 'internet', 59900, 5], ['Limpieza', 'limpieza', 320000, 15]] as const)
      fijos.push(agrega<GastoFijo>('gastosFijos', { ...base(t0), sedeId, concepto, categoria, monto, dia, activo: true }));
  for (const m of maestros) fijos.push(agrega<GastoFijo>('gastosFijos', { ...base(t0), sedeId: null, concepto: `Pago ${m.nombre}`, categoria: 'maestros', monto: entre(25, 60) * 10000, dia: 15, activo: true, maestroId: m.id }));
  for (let mes = 0; mes <= Math.ceil(DIAS / 30); mes++) {
    for (const f of fijos) {
      const fecha = sumarDias(inicio, mes * 30 + f.dia);
      if (fecha > hoy) continue;
      agrega<Gasto>('gastos', { ...base(ts(fecha, '11:00')), sedeId: f.sedeId ?? null, concepto: f.concepto, categoria: f.categoria, monto: f.categoria === 'luz' ? Math.round(f.monto * (0.8 + r() * 0.5)) : f.monto, fecha, fijoId: f.id, maestroId: f.maestroId ?? null, metodo: 'transferencia', notas: '', usuarioId: dueno.id });
    }
    for (let k = 0; k < 6; k++) {
      const fecha = sumarDias(inicio, mes * 30 + entre(0, 29));
      if (fecha > hoy) continue;
      agrega<Gasto>('gastos', { ...base(ts(fecha, '13:00')), sedeId: elige(sedeIds), concepto: elige(['Papel y jabón', 'Foco', 'Reparación espejo', 'Bocina', 'Garrafones', 'Pintura']), categoria: 'otro', monto: entre(8, 120) * 1000, fecha, fijoId: null, metodo: 'efectivo', notas: '', usuarioId: dueno.id });
    }
  }

  // rentas del salón (maestros externos y eventos)
  for (let i = 0; i < 10; i++)
    agrega<Renta>('rentas', { ...base(t0), sedeId: elige(sedeIds), nombre: elige(['Yoga con Laura', 'Pilates Mariana', 'Zumba Kids', 'Tango Ernesto', 'Kickboxing', 'Teatro juvenil', 'Danza árabe', 'Jazz Carmen', 'Hip hop Leo', 'Folklor']), telefono: `55${entre(10000000, 99999999)}`, tipo: 'mensual', dias: [entre(1, 5)], horaInicio: elige(['08:00', '09:00', '13:00', '15:00']), duracionMin: 60 * entre(1, 2), desde: inicio, hasta: null, monto: entre(15, 40) * 10000, notas: '', activo: true, cobro: i % 3 === 0 ? 'hora' : 'fijo', tarifa: i % 3 === 0 ? 15000 : null });

  // eventos con boletos
  for (let i = 0; i < 8; i++) {
    const fecha = sumarDias(inicio, Math.round((DIAS + 40) * (i / 8)));
    const ev = agrega<Evento>('eventos', { ...base(ts(sumarDias(fecha, -30))), sedeId: null, salonId: null, nombre: ['Social de salsa', 'Noche de bachata', 'Baile de Día de Muertos', 'Posada Calo', 'Congreso infantil', 'Showcase de alumnos', 'Social de verano', 'Fiesta de aniversario'][i], fecha, horaInicio: '20:00', duracionMin: 240, cupo: 250, precio: entre(10, 25) * 1000, descripcion: 'Baile social con DJ', activo: true, rentaId: null });
    const vendidos = fecha <= hoy ? entre(120, 240) : entre(20, 90);
    for (let b = 0; b < vendidos; b++) {
      const a = r() < 0.7 ? elige(alumnos) : null;
      const t = ts(sumarDias(fecha, -entre(0, 20)), '19:00');
      const metodo = metodoAl();
      const pg = agrega<Pago>('pagos', { ...base(t), sedeId: null, alumnoId: a?.id ?? null, planId: null, eventoId: ev.id, cantidad: 1, concepto: `Boleto · ${ev.nombre}`, monto: ev.precio, metodo, usuarioId: recepcion.id, fecha: aFecha(new Date(t)), anuladoAt: null, anuladoMotivo: null, anuladoPor: null });
      agrega<Boleto>('boletos', { ...base(t), eventoId: ev.id, nombre: a?.nombre ?? `${elige(NOMBRES)} ${elige(APELLIDOS)}`, telefono: '', alumnoId: a?.id ?? null, pagoId: pg.id, codigo: codigoAlumno(), usadoAt: fecha <= hoy && r() < 0.9 ? ts(fecha, '20:30') : null, anuladoAt: null });
    }
  }

  // apartados de la tienda y encargos
  const enLinea = productos.filter((x) => x.enLinea);
  for (let i = 0; i < 300; i++) {
    const a = elige(alumnos.slice(0, Math.round(N * 0.54)));
    const pr = elige(enLinea);
    const t = ts(sumarDias(hoy, -entre(0, 60)), '12:00');
    const estado: Pedido['estado'] = pr.sobrePedido ? elige(['pendiente', 'pedido', 'llego', 'entregado'] as const) : elige(['pendiente', 'entregado', 'entregado', 'cancelado'] as const);
    agrega<Pedido>('pedidos', { ...base(t), alumnoId: a.id, productoId: pr.id, opcion: pr.opciones?.length ? elige(pr.opciones) : null, cantidad: 1, precio: pr.precio, estado, pagoId: null, nota: pr.sobrePedido ? `Número ${entre(22, 27)}` : null });
  }

  // interesados de la página pública
  for (let i = 0; i < 400; i++) {
    const t = ts(sumarDias(hoy, -entre(0, 120)), '21:00');
    agrega<Interesado>('interesados', { ...base(t), nombre: `${elige(NOMBRES)} ${elige(APELLIDOS)}`, telefono: `55${entre(10000000, 99999999)}`, claseId: r() < 0.8 ? elige(clases).id : null, mensaje: r() < 0.3 ? '¿Necesito ir con pareja?' : '', estado: elige(['nuevo', 'contactado', 'contactado', 'inscrito', 'descartado'] as const), contactadoAt: r() < 0.6 ? t + 86_400_000 : null, alumnoId: null });
  }

  // testimonios desde el portal (unos por revisar, otros ya revisados)
  for (let i = 0; i < 40; i++) {
    const a = alumnos[Math.floor(r() * N * 0.54)];
    const t = ts(sumarDias(hoy, -entre(0, 90)), '22:00');
    const estado = i < 12 ? 'pendiente' : i < 32 ? 'aprobado' : 'rechazado';
    agrega<Testimonio>('testimonios', { ...base(t), alumnoId: a.id, texto: elige(['Llegué sin saber nada y ahora no me pierdo un social.', 'Los maestros tienen mucha paciencia, súper recomendado.', 'Mi momento favorito de la semana, el ambiente es increíble.', 'Bajé de peso y gané amigos. ¡Gracias!', 'Empecé con mi pareja y ahora bailamos en las fiestas familiares.']), estado, revisadoAt: estado === 'pendiente' ? null : t + 86_400_000, revisadoPor: estado === 'pendiente' ? null : dueno.id });
  }

  // guardar en el teléfono y dejar todo en la cola para subir
  const cuenta: Record<string, number> = {};
  for (const [t, xs] of Object.entries(filas) as [SyncTable, { id: ID }[]][]) {
    for (let i = 0; i < xs.length; i += 5000) {
      const lote = xs.slice(i, i + 5000);
      await db.transaction('rw', db.table(t), db.outbox, async () => {
        await db.table(t).bulkAdd(lote);
        await db.outbox.bulkAdd(lote.map((x) => ({ table: t, id: x.id, at: Date.now() })));
      });
    }
    cuenta[t] = xs.length;
  }
  await db.outbox.add({ table: 'academias', id: A, at: Date.now() });
  return cuenta;
}
