/**
 * Datos de ejemplo realistas para demo y pruebas: Calo Latino Studio con 6 semanas de historia.
 * Solo se incluye en builds con VITE_SEMILLA=1 (ver main.tsx). Se borra cuando la academia arranque en serio.
 */
import { db } from '../db/db';
import { guardar } from '../db/repo';
import type { Alumno, Asistencia, Clase, Corte, Fecha, GastoFijo, ID, Maestro, Membresia, MetodoPago, Pago, Pedido, Plan, Renta, Usuario } from '../db/types';
import { crearAcademia, hashPin } from '../domain/acceso';
import { generarCodigo } from '../domain/operaciones';
import { deFecha, hoy, sumarDias, sumarMeses } from '../domain/fechas';

const DIAS_HISTORIA = 42;

const NOMBRES = [
  'Ana López', 'Carlos Ruiz', 'Diana Pérez', 'Jorge Mendoza', 'Lucía Torres', 'Pedro Sánchez', 'Mariana Gómez', 'Luis Hernández',
  'Fernanda Castro', 'Ricardo Morales', 'Valeria Jiménez', 'Andrés Vargas', 'Sofía Ramírez', 'Miguel Ángel Flores', 'Daniela Ortiz', 'Javier Reyes',
  'Paola Gutiérrez', 'Héctor Aguilar', 'Gabriela Navarro', 'Roberto Medina', 'Karen Domínguez', 'Óscar Rojas', 'Alejandra Cruz', 'Emilio Vega',
  'Natalia Ríos', 'Arturo Salazar', 'Ximena Guerrero', 'Raúl Cortés', 'Brenda Campos', 'Iván Contreras', 'Claudia Estrada', 'Sergio Luna',
  'Mónica Figueroa', 'Tomás Herrera', 'Renata Delgado', 'Eduardo Silva', 'Itzel Ramos', 'Francisco Molina', 'Andrea Paredes', 'Diego Ibarra',
  'Lorena Fuentes', 'Alberto Peña', 'Carolina Ávila', 'Manuel Solís', 'Regina Lara', 'Julio Cervantes', 'Verónica Pacheco', 'Rodrigo Nájera',
];

/** Aleatorio con semilla: los mismos datos en cada corrida. */
function generador(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export async function sembrar(): Promise<{ alumnos: number; pagos: number; asistencias: number }> {
  if (await db.academias.count()) throw new Error('Este navegador ya tiene una academia');
  const r = generador(20261113);
  const elige = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const dueno = await crearAcademia({ nombre: 'Calo Latino Studio', duenoNombre: 'Dirección Calo', pin: '1234' });
  const A = dueno.academiaId;
  const ahora = Date.now();
  const base = (ts: number) => ({ id: crypto.randomUUID() as ID, academiaId: A, createdAt: ts, updatedAt: ts, deletedAt: null });
  const tsDe = (f: Fecha, hhmm: string, minAntes = 0) => {
    const d = deFecha(f);
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m - minAntes, Math.floor(r() * 60));
    return d.getTime();
  };

  await guardar('academias', { ...(await db.academias.get(A))!, color: '#d6304a' });

  // ---------- equipo ----------
  const monse: Usuario = { ...base(ahora), nombre: 'Monse', rol: 'recepcion', pinHash: await hashPin('1111', A), activo: true };
  const nombresMaestros = ['Profe Luis Herrera', 'Profa Karla Méndez', 'Profe Iván Ruiz', 'Profa Daniela Soto'];
  const maestros: Maestro[] = nombresMaestros.map((nombre, i) => ({
    ...base(ahora),
    nombre,
    telefono: `55${String(41000000 + i * 1234567).slice(0, 8)}`,
    notas: i === 0 ? 'Director artístico' : '',
    activo: true,
  }));
  const [luis, karla, ivan, daniela] = maestros;

  // ---------- clases ----------
  const disciplinas = await db.disciplinas.toArray();
  const salsa = disciplinas.find((d) => d.nombre === 'Salsa')!;
  const bachata = disciplinas.find((d) => d.nombre === 'Bachata')!;
  const existentes = await db.clases.toArray();
  const asignar: Record<string, ID> = { [`${salsa.id}:0`]: luis.id, [`${salsa.id}:1`]: luis.id, [`${salsa.id}:2`]: ivan.id, [`${bachata.id}:0`]: karla.id };
  const clases: Clase[] = existentes.map((c) => ({ ...c, maestroId: asignar[`${c.disciplinaId}:${c.nivel}`] ?? null }));
  clases.push(
    { ...base(ahora), disciplinaId: bachata.id, nivel: '1', maestroId: karla.id, dias: [1, 3], horaInicio: '21:00', duracionMin: 60, activo: true },
    { ...base(ahora), disciplinaId: salsa.id, nivel: 'Lady Style', maestroId: daniela.id, dias: [6], horaInicio: '11:00', duracionMin: 90, activo: true },
  );

  const planes: Plan[] = await db.planes.toArray();
  const suelta = planes.find((p) => p.tipo === 'suelta')!;
  const mensual = planes.find((p) => p.tipo === 'mensual')!;
  const paquete = planes.find((p) => p.tipo === 'paquete')!;

  // ---------- alumnos ----------
  type Perfil = { alumno: Alumno; tipo: 'mensual' | 'paquete' | 'suelta'; clases: Clase[]; asiste: number };
  const pesoClase = (c: Clase) => (c.nivel === '0' ? 4 : c.nivel === '1' ? 3 : 2);
  const bolsa = clases.flatMap((c) => Array<Clase>(pesoClase(c)).fill(c));
  const perfiles: Perfil[] = NOMBRES.map((nombre, i) => {
    const alta = sumarDias(hoy(), -DIAS_HISTORIA - Math.floor(r() * 60));
    const alumno: Alumno = {
      ...base(tsDe(alta, '19:00')),
      nombre,
      telefono: r() < 0.75 ? `55${Math.floor(10000000 + r() * 89999999)}` : '',
      notas: i % 13 === 0 ? 'Viene con su pareja' : i % 17 === 0 ? 'Prefiere pagar por transferencia' : '',
      codigo: generarCodigo(),
      activo: i < NOMBRES.length - 2, // dos dados de baja
    };
    const x = r();
    const c1 = elige(bolsa);
    const c2 = r() < 0.35 ? elige(bolsa.filter((c) => c.id !== c1.id)) : null;
    return { alumno, tipo: x < 0.3 ? 'mensual' : x < 0.45 ? 'paquete' : 'suelta', clases: c2 ? [c1, c2] : [c1], asiste: 0.45 + r() * 0.45 };
  });

  // ---------- historia ----------
  const pagos: Pago[] = [];
  const asistencias: Asistencia[] = [];
  const membresias: (Membresia & { usadas: number })[] = [];
  const cortes: Corte[] = [];
  const metodo = (pTransfer: number): MetodoPago => {
    const x = r();
    return x < pTransfer ? 'transferencia' : x < pTransfer + 0.04 ? 'tarjeta' : 'efectivo';
  };
  const cobrar = (alumnoId: ID | null, plan: Plan, m: MetodoPago, fecha: Fecha, ts: number): Pago => {
    const p: Pago = { ...base(ts), alumnoId, planId: plan.id, concepto: plan.nombre, monto: plan.precio, metodo: m, usuarioId: monse.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null };
    pagos.push(p);
    return p;
  };
  const entrada = (alumnoId: ID | null, clase: Clase, fecha: Fecha, ts: number, extra: Partial<Asistencia>) => {
    const a: Asistencia = { ...base(ts), alumnoId, nombreVisitante: alumnoId ? null : 'Visitante', claseId: clase.id, fecha, membresiaId: null, pagoId: null, usuarioId: monse.id, anuladaAt: null, ...extra };
    asistencias.push(a);
    return a;
  };

  for (let d = DIAS_HISTORIA; d >= 1; d--) {
    const fecha = sumarDias(hoy(), -d);
    const dia = deFecha(fecha).getDay();
    for (const clase of clases.filter((c) => c.dias.includes(dia))) {
      for (const pf of perfiles.filter((x) => x.clases.includes(clase) && x.alumno.createdAt <= tsDe(fecha, '23:59'))) {
        if (!pf.alumno.activo && d < 14) continue; // los de baja dejaron de venir
        if (r() > pf.asiste) continue;
        const ts = tsDe(fecha, clase.horaInicio, 2 + Math.floor(r() * 20));
        const id = pf.alumno.id;
        let m = membresias.find((x) => x.alumnoId === id && !x.anuladaAt && x.inicio <= fecha && fecha <= x.fin && (x.clasesTotal === null || x.usadas < x.clasesTotal));
        if (!m && pf.tipo !== 'suelta') {
          const plan = pf.tipo === 'mensual' ? mensual : paquete;
          const p = cobrar(id, plan, metodo(0.3), fecha, ts);
          m = {
            ...base(ts), alumnoId: id, planId: plan.id, pagoId: p.id, disciplinaId: null, inicio: fecha,
            fin: plan.tipo === 'mensual' ? sumarDias(sumarMeses(fecha, 1), -1) : sumarDias(fecha, (plan.vigenciaDias ?? 30) - 1),
            clasesTotal: plan.tipo === 'mensual' ? null : plan.clases, anuladaAt: null, usadas: 0,
          };
          membresias.push(m);
        }
        if (m) {
          m.usadas++;
          entrada(id, clase, fecha, ts + 5000, { membresiaId: m.id });
        } else {
          const p = cobrar(id, suelta, metodo(pf.alumno.notas.includes('transferencia') ? 0.9 : 0.1), fecha, ts);
          entrada(id, clase, fecha, ts, { pagoId: p.id });
          if (r() < 0.03) {
            // error real corregido: se cobró dos veces y se anuló
            const dup = cobrar(id, suelta, 'efectivo', fecha, ts + 40_000);
            const anul = ts + 300_000;
            Object.assign(dup, { anuladoAt: anul, anuladoMotivo: 'Se cobró dos veces', anuladoPor: monse.id });
            entrada(id, clase, fecha, ts + 40_000, { pagoId: dup.id, anuladaAt: anul });
          }
        }
      }
      // visitantes sin nombre (la "tarjeta" de siempre)
      const visitantes = Math.floor(r() * 3);
      for (let v = 0; v < visitantes; v++) {
        const ts = tsDe(fecha, clase.horaInicio, Math.floor(r() * 15));
        const p = cobrar(null, suelta, 'efectivo', fecha, ts);
        entrada(null, clase, fecha, ts, { pagoId: p.id });
      }
    }
    // corte de caja del día
    const delDia = pagos.filter((p) => p.fecha === fecha && !p.anuladoAt);
    if (delDia.length) {
      const efectivo = delDia.filter((p) => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0);
      const otros = delDia.reduce((s, p) => s + p.monto, 0) - efectivo;
      const x = r();
      const dif = x < 0.85 ? 0 : x < 0.93 ? -2000 : x < 0.97 ? -4000 : 1000;
      cortes.push({
        ...base(tsDe(fecha, '22:30')), fecha, esperadoEfectivo: efectivo, contadoEfectivo: efectivo + dif, diferencia: dif, totalOtros: otros,
        usuarioId: monse.id, notas: dif < 0 ? 'Se dio cambio de más' : dif > 0 ? 'Sobró, no se registró una entrada' : '',
      });
    }
  }

  await db.transaction('rw', [db.usuarios, db.maestros, db.clases, db.alumnos, db.pagos, db.membresias, db.asistencias, db.cortes], async () => {
    await db.usuarios.put(monse);
    await db.maestros.bulkPut(maestros);
    await db.clases.bulkPut(clases);
    await db.alumnos.bulkPut(perfiles.map((p) => p.alumno));
    await db.pagos.bulkPut(pagos);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await db.membresias.bulkPut(membresias.map(({ usadas: _u, ...m }) => m));
    await db.asistencias.bulkPut(asistencias);
    await db.cortes.bulkPut(cortes);
  });
  return { alumnos: perfiles.length, pagos: pagos.length, asistencias: asistencias.length };
}

const PILAS = ['Alejandro', 'María', 'José', 'Guadalupe', 'Juan', 'Fernanda', 'Luis', 'Camila', 'Carlos', 'Valentina', 'Jesús', 'Ximena', 'Miguel', 'Daniela', 'Antonio', 'Paula',
  'Ángel', 'Regina', 'David', 'Sofía', 'Emiliano', 'Natalia', 'Santiago', 'Andrea', 'Mateo', 'Mariana', 'Gerardo', 'Abril', 'Omar', 'Elena', 'Adrián', 'Jimena', 'Hugo', 'Karla',
  'Marco', 'Leticia', 'Enrique', 'Patricia', 'Rubén', 'Silvia', 'Pablo', 'Rocío', 'Ernesto', 'Teresa', 'Gustavo', 'Liliana', 'Martín', 'Diana'];
const APELLIDOS = ['García', 'Martínez', 'Rodríguez', 'Hernández', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz',
  'Morales', 'Reyes', 'Ortiz', 'Jiménez', 'Ruiz', 'Álvarez', 'Mendoza', 'Castillo', 'Vázquez', 'Romero', 'Chávez', 'Aguilar', 'Herrera', 'Medina', 'Castro', 'Vargas', 'Guzmán'];

/**
 * Agrega alumnos con 6 semanas de historia a la academia que ya está en este teléfono
 * (normalmente la demo descargada de la nube) y los encola para subirlos.
 * Recalcula los cortes de caja de cada día para que sigan cuadrando.
 */
export async function ampliar(cuantos = 140, asisteMin = 0.5, asisteMax = 0.9): Promise<{ alumnos: number; pagos: number; asistencias: number; cortes: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  const A = academia.id;
  const r = generador(Date.now() % 100000);
  const elige = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const base = (ts: number) => ({ id: crypto.randomUUID() as ID, academiaId: A, createdAt: ts, updatedAt: ts, deletedAt: null });
  const tsDe = (f: Fecha, hhmm: string, minAntes = 0) => {
    const d = deFecha(f);
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m - minAntes, Math.floor(r() * 60));
    return d.getTime();
  };

  const recepcion = (await db.usuarios.filter((u) => u.rol === 'recepcion' && !u.deletedAt).first()) ?? (await db.usuarios.toCollection().first())!;
  const clases = await db.clases.filter((c) => c.activo && !c.deletedAt).toArray();
  const planes = await db.planes.filter((p) => p.activo && !p.deletedAt).toArray();
  const suelta = planes.find((p) => p.tipo === 'suelta')!;
  const mensual = planes.find((p) => p.tipo === 'mensual')!;
  const paquete = planes.find((p) => p.tipo === 'paquete')!;
  const usados = new Set((await db.alumnos.toArray()).map((a) => a.nombre));

  const peso = (c: Clase) => (c.nivel === '0' ? 3 : c.nivel === '1' ? 3 : 2);
  const bolsa = clases.flatMap((c) => Array<Clase>(peso(c)).fill(c));
  const nuevos: { alumno: Alumno; tipo: 'mensual' | 'paquete' | 'suelta'; clases: Clase[]; asiste: number }[] = [];
  while (nuevos.length < cuantos) {
    const nombre = `${elige(PILAS)} ${elige(APELLIDOS)}${r() < 0.4 ? ' ' + elige(APELLIDOS) : ''}`;
    if (usados.has(nombre)) continue;
    usados.add(nombre);
    // 15% se inscribieron en el último mes (para que "Alumnos nuevos" tenga datos)
    const alta = r() < 0.15 ? sumarDias(hoy(), -1 - Math.floor(r() * 35)) : sumarDias(hoy(), -DIAS_HISTORIA - Math.floor(r() * 90));
    const c1 = elige(bolsa);
    const c2 = r() < 0.35 ? elige(bolsa.filter((c) => c.id !== c1.id)) : null;
    const x = r();
    nuevos.push({
      alumno: { ...base(tsDe(alta, '19:00')), nombre, telefono: r() < 0.8 ? `55${Math.floor(10000000 + r() * 89999999)}` : '', notas: '', codigo: generarCodigo(), activo: r() > 0.03 },
      tipo: x < 0.3 ? 'mensual' : x < 0.45 ? 'paquete' : 'suelta',
      clases: c2 ? [c1, c2] : [c1],
      asiste: asisteMin + r() * (asisteMax - asisteMin),
    });
  }

  const pagos: Pago[] = [];
  const asistencias: Asistencia[] = [];
  const membresias: (Membresia & { usadas: number })[] = [];
  const metodo = (pt: number): MetodoPago => {
    const x = r();
    return x < pt ? 'transferencia' : x < pt + 0.04 ? 'tarjeta' : 'efectivo';
  };
  const pago = (alumnoId: ID, plan: Plan, m: MetodoPago, fecha: Fecha, ts: number): Pago => {
    const p: Pago = { ...base(ts), alumnoId, planId: plan.id, concepto: plan.nombre, monto: plan.precio, metodo: m, usuarioId: recepcion.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null };
    pagos.push(p);
    return p;
  };
  for (let d = DIAS_HISTORIA; d >= 1; d--) {
    const fecha = sumarDias(hoy(), -d);
    const dia = deFecha(fecha).getDay();
    for (const clase of clases.filter((c) => c.dias.includes(dia))) {
      for (const pf of nuevos.filter((x) => x.clases.includes(clase))) {
        if ((!pf.alumno.activo && d < 14) || r() > pf.asiste || pf.alumno.createdAt > tsDe(fecha, '23:59')) continue;
        const ts = tsDe(fecha, clase.horaInicio, 2 + Math.floor(r() * 25));
        const id = pf.alumno.id;
        let m = membresias.find((x) => x.alumnoId === id && x.inicio <= fecha && fecha <= x.fin && (x.clasesTotal === null || x.usadas < x.clasesTotal));
        if (!m && pf.tipo !== 'suelta') {
          const plan = pf.tipo === 'mensual' ? mensual : paquete;
          const p = pago(id, plan, metodo(0.3), fecha, ts);
          m = {
            ...base(ts), alumnoId: id, planId: plan.id, pagoId: p.id, disciplinaId: null, inicio: fecha,
            fin: plan.tipo === 'mensual' ? sumarDias(sumarMeses(fecha, 1), -1) : sumarDias(fecha, (plan.vigenciaDias ?? 30) - 1),
            clasesTotal: plan.tipo === 'mensual' ? null : plan.clases, anuladaAt: null, usadas: 0,
          };
          membresias.push(m);
        }
        const a: Asistencia = { ...base(ts + 5000), alumnoId: id, nombreVisitante: null, claseId: clase.id, fecha, membresiaId: null, pagoId: null, usuarioId: recepcion.id, anuladaAt: null };
        if (m) {
          m.usadas++;
          a.membresiaId = m.id;
        } else {
          a.pagoId = pago(id, suelta, metodo(0.12), fecha, ts).id;
        }
        asistencias.push(a);
      }
    }
  }

  // Cortes: recalcular lo esperado con todos los cobros del día, conservando la diferencia que hubo
  const cortes: Corte[] = [];
  for (const fecha of [...new Set(pagos.map((p) => p.fecha))]) {
    const todos = [...(await db.pagos.where('fecha').equals(fecha).toArray()), ...pagos.filter((p) => p.fecha === fecha)].filter((p) => !p.anuladoAt && !p.deletedAt);
    const efectivo = todos.filter((p) => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0);
    const otros = todos.reduce((s, p) => s + p.monto, 0) - efectivo;
    const previo = (await db.cortes.where('fecha').equals(fecha).toArray())[0];
    cortes.push(
      previo
        ? { ...previo, esperadoEfectivo: efectivo, contadoEfectivo: efectivo + previo.diferencia, totalOtros: otros, updatedAt: Date.now() }
        : { ...base(tsDe(fecha, '22:30')), fecha, esperadoEfectivo: efectivo, contadoEfectivo: efectivo, diferencia: 0, totalOtros: otros, usuarioId: recepcion.id, notas: '' },
    );
  }

  const ahora = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mems = membresias.map(({ usadas: _u, ...m }) => m);
  await db.transaction('rw', [db.alumnos, db.pagos, db.membresias, db.asistencias, db.cortes, db.outbox], async () => {
    await db.alumnos.bulkPut(nuevos.map((n) => n.alumno));
    await db.pagos.bulkPut(pagos);
    await db.membresias.bulkPut(mems);
    await db.asistencias.bulkPut(asistencias);
    await db.cortes.bulkPut(cortes);
    await db.outbox.bulkAdd([
      ...nuevos.map((n) => ({ table: 'alumnos' as const, id: n.alumno.id, at: ahora })),
      ...pagos.map((x) => ({ table: 'pagos' as const, id: x.id, at: ahora })),
      ...mems.map((x) => ({ table: 'membresias' as const, id: x.id, at: ahora })),
      ...asistencias.map((x) => ({ table: 'asistencias' as const, id: x.id, at: ahora })),
      ...cortes.map((x) => ({ table: 'cortes' as const, id: x.id, at: ahora })),
    ]);
  });
  return { alumnos: nuevos.length, pagos: pagos.length, asistencias: asistencias.length, cortes: cortes.length };
}

/** Más horarios para la demo (una academia de ~600 alumnos tiene más clases). Sube por el outbox. */
export async function agregarClasesDemo(): Promise<number> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  const disc = await db.disciplinas.toArray();
  const maestros = await db.maestros.toArray();
  const m = (n: string) => maestros.find((x) => x.nombre.includes(n))?.id ?? null;
  const ahora = Date.now();
  const crearDisc = async (nombre: string, color: string) =>
    disc.find((d) => d.nombre === nombre) ?? (await guardar('disciplinas', { id: crypto.randomUUID(), academiaId: academia.id, nombre, color, createdAt: ahora, updatedAt: ahora, deletedAt: null }));
  const salsa = await crearDisc('Salsa', '#e8445a');
  const bachata = await crearDisc('Bachata', '#7c4ddb');
  const cumbia = await crearDisc('Cumbia', '#d97706');
  const kizomba = await crearDisc('Kizomba', '#0d9488');
  const nuevas: [string, string, string | null, number[], string][] = [
    [salsa.id, '3', m('Iván'), [1, 3], '21:00'],
    [salsa.id, '0', m('Luis'), [6], '12:30'],
    [bachata.id, '2', m('Karla'), [2, 4], '21:00'],
    [bachata.id, '0', m('Karla'), [6], '13:30'],
    [cumbia.id, '0', m('Daniela'), [5], '19:00'],
    [kizomba.id, '0', m('Iván'), [5], '20:00'],
  ];
  const existentes = await db.clases.toArray();
  let n = 0;
  for (const [disciplinaId, nivel, maestroId, dias, horaInicio] of nuevas) {
    if (existentes.some((c) => c.disciplinaId === disciplinaId && c.nivel === nivel && c.horaInicio === horaInicio)) continue;
    await guardar('clases', { id: crypto.randomUUID(), academiaId: academia.id, disciplinaId, nivel, maestroId, dias, horaInicio, duracionMin: 60, activo: true, createdAt: ahora, updatedAt: ahora, deletedAt: null });
    n++;
  }
  return n;
}

const PRODUCTOS_DEMO: { nombre: string; emoji: string; precio: number; categoria: 'consumo' | 'articulo'; inventario: number | null; peso: number }[] = [
  { nombre: 'Agua 600 ml', emoji: '💧', precio: 1500, categoria: 'consumo', inventario: 48, peso: 10 },
  { nombre: 'Electrolit', emoji: '⚡', precio: 3500, categoria: 'consumo', inventario: 24, peso: 5 },
  { nombre: 'Refresco', emoji: '🥤', precio: 2000, categoria: 'consumo', inventario: 24, peso: 4 },
  { nombre: 'Galletas', emoji: '🍪', precio: 1500, categoria: 'consumo', inventario: 30, peso: 4 },
  { nombre: 'Barrita', emoji: '🍫', precio: 2500, categoria: 'consumo', inventario: 6, peso: 3 },
  { nombre: 'Dulces', emoji: '🍬', precio: 500, categoria: 'consumo', inventario: null, peso: 4 },
  { nombre: 'Playera Calo', emoji: '👕', precio: 25000, categoria: 'articulo', inventario: 15, peso: 0.4 },
  { nombre: 'Gorra Calo', emoji: '🧢', precio: 20000, categoria: 'articulo', inventario: 10, peso: 0.3 },
  { nombre: 'Zapatillas de baile', emoji: '👟', precio: 120000, categoria: 'articulo', inventario: 4, peso: 0.1 },
];

/** Tienda de ejemplo: productos y 6 semanas de ventas en los días con clase; recalcula los cortes. */
export async function agregarTiendaDemo(): Promise<{ productos: number; ventas: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  if (await db.productos.filter((p) => !p.deletedAt).count()) throw new Error('Ya hay productos');
  const A = academia.id;
  const r = generador(424242);
  const ahora = Date.now();
  const base = (ts: number) => ({ id: crypto.randomUUID() as ID, academiaId: A, createdAt: ts, updatedAt: ts, deletedAt: null });
  const recepcion = (await db.usuarios.filter((u) => u.rol === 'recepcion' && !u.deletedAt).first()) ?? (await db.usuarios.toCollection().first())!;
  const inicio = new Date(sumarDias(hoy(), -DIAS_HISTORIA)).getTime();
  const productos = PRODUCTOS_DEMO.map((p) => ({
    ...base(inicio),
    nombre: p.nombre, emoji: p.emoji, precio: p.precio, categoria: p.categoria, foto: null, descripcion: '',
    // existencias contadas hace 3 días, para que el "quedan" reste solo lo reciente
    inventario: p.inventario, inventarioAt: p.inventario === null ? null : new Date(sumarDias(hoy(), -3)).getTime(),
    alerta: p.categoria === 'consumo' ? 6 : 2, activo: true, enLinea: p.categoria === 'articulo',
  }));
  const bolsa = PRODUCTOS_DEMO.flatMap((p, i) => Array(Math.ceil(p.peso * 10)).fill(i) as number[]);
  const clases = await db.clases.filter((c) => c.activo && !c.deletedAt).toArray();
  const ventas: Pago[] = [];
  for (let d = DIAS_HISTORIA; d >= 1; d--) {
    const fecha = sumarDias(hoy(), -d);
    const dia = deFecha(fecha).getDay();
    for (const c of clases.filter((x) => x.dias.includes(dia))) {
      const n = 3 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) {
        const prod = productos[bolsa[Math.floor(r() * bolsa.length)]];
        const fechaD = deFecha(fecha);
        const [h, m] = c.horaInicio.split(':').map(Number);
        fechaD.setHours(h, m + 50 + Math.floor(r() * 20), Math.floor(r() * 60));
        const ts = fechaD.getTime();
        const cantidad = r() < 0.15 ? 2 : 1;
        const metodo: MetodoPago = r() < 0.12 ? 'transferencia' : 'efectivo';
        ventas.push({ ...base(ts), alumnoId: null, planId: null, productoId: prod.id, cantidad, concepto: prod.nombre, monto: prod.precio * cantidad, metodo, usuarioId: recepcion.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null });
      }
    }
  }
  // Cortes: el efectivo esperado ahora incluye la tienda
  const cortes: Corte[] = [];
  for (const fecha of [...new Set(ventas.map((v) => v.fecha))]) {
    const todos = [...(await db.pagos.where('fecha').equals(fecha).toArray()), ...ventas.filter((v) => v.fecha === fecha)].filter((p) => !p.anuladoAt && !p.deletedAt);
    const efectivo = todos.filter((p) => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0);
    const otros = todos.reduce((s, p) => s + p.monto, 0) - efectivo;
    const previo = (await db.cortes.where('fecha').equals(fecha).toArray())[0];
    if (previo) cortes.push({ ...previo, esperadoEfectivo: efectivo, contadoEfectivo: efectivo + previo.diferencia, totalOtros: otros, updatedAt: ahora });
  }
  await db.transaction('rw', [db.productos, db.pagos, db.cortes, db.outbox], async () => {
    await db.productos.bulkPut(productos);
    await db.pagos.bulkPut(ventas);
    await db.cortes.bulkPut(cortes);
    await db.outbox.bulkAdd([
      ...productos.map((x) => ({ table: 'productos' as const, id: x.id, at: ahora })),
      ...ventas.map((x) => ({ table: 'pagos' as const, id: x.id, at: ahora })),
      ...cortes.map((x) => ({ table: 'cortes' as const, id: x.id, at: ahora })),
    ]);
  });
  return { productos: productos.length, ventas: ventas.length };
}

/**
 * Sedes de ejemplo: la principal se llama "Estudio Calo" (clase suelta $60) y se agrega "Casa de Cultura"
 * ($40) con dos clases que ya tenían historia (sábados), para que los reportes por sede tengan datos.
 */
export async function agregarSedeDemo(): Promise<{ sede: string; clasesMovidas: number; pagosMovidos: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  if (await db.sedes.filter((s) => !s.deletedAt).count()) throw new Error('Ya hay sedes');
  const A = academia.id;
  const ahora = Date.now();
  const base = () => ({ id: crypto.randomUUID() as ID, academiaId: A, createdAt: ahora, updatedAt: ahora, deletedAt: null });
  const PRINCIPAL = '00000000-0000-4000-8000-000000000000';
  const cdc = { ...base(), nombre: 'Casa de Cultura', color: '#7c4ddb', activo: true };
  await guardar('sedes', cdc);
  await guardar('academias', { ...academia, sedePrincipal: 'Estudio Calo' });

  // Precios: Estudio $60, Casa de Cultura $40
  const suelta = (await db.planes.toArray()).find((p) => p.tipo === 'suelta' && !p.deletedAt);
  if (suelta) await guardar('planes', { ...suelta, nombre: 'Clase suelta', precio: 6000, sedeId: PRINCIPAL });
  await guardar('planes', { ...base(), nombre: 'Clase suelta Casa de Cultura', tipo: 'suelta', precio: 4000, clases: 1, vigenciaDias: null, disciplinaId: null, sedeId: cdc.id, activo: true });

  // Planes reales que platicó Calo:
  //  Estudio: bloque completo 8 clases $400, medio bloque 4 clases $200 (+ clase $60)
  //  Casa de Cultura: mensual 1 clase $300, 2 clases $450 (+ clase $40); recargo $10 por día de atraso
  for (const p of (await db.planes.toArray()).filter((x) => !x.deletedAt && x.tipo !== 'suelta' && x.precio > 0)) await guardar('planes', { ...p, activo: false });
  await guardar('planes', { ...base(), nombre: 'Bloque completo', tipo: 'paquete', precio: 40000, clases: 8, vigenciaDias: 30, disciplinaId: null, sedeId: PRINCIPAL, activo: true });
  await guardar('planes', { ...base(), nombre: 'Medio bloque', tipo: 'paquete', precio: 20000, clases: 4, vigenciaDias: 30, disciplinaId: null, sedeId: PRINCIPAL, activo: true });
  await guardar('planes', { ...base(), nombre: 'Mensual 1 clase', tipo: 'mensual', precio: 30000, clases: null, vigenciaDias: null, disciplinaId: null, sedeId: cdc.id, grupos: 1, activo: true });
  await guardar('planes', { ...base(), nombre: 'Mensual 2 clases', tipo: 'mensual', precio: 45000, clases: null, vigenciaDias: null, disciplinaId: null, sedeId: cdc.id, grupos: 2, activo: true });
  await guardar('academias', { ...(await db.academias.get(A))!, recargoDiario: 1000 });

  // Las clases de sábado temprano pasan a Casa de Cultura (con su historia)
  const clases = await db.clases.filter((c) => !c.deletedAt && c.activo && c.dias.includes(6) && c.horaInicio >= '10:00' && c.horaInicio <= '14:00').toArray();
  const ids = new Set(clases.map((c) => c.id));
  for (const c of clases) await guardar('clases', { ...c, sedeId: cdc.id });
  const asis = await db.asistencias.filter((a) => ids.has(a.claseId) && !!a.pagoId).toArray();
  const pagoIds = asis.map((a) => a.pagoId!);
  const pagos = (await db.pagos.bulkGet(pagoIds)).filter((p): p is Pago => !!p);
  await db.transaction('rw', [db.pagos, db.outbox], async () => {
    await db.pagos.bulkPut(pagos.map((p) => ({ ...p, sedeId: cdc.id, updatedAt: ahora })));
    await db.outbox.bulkAdd(pagos.map((p) => ({ table: 'pagos' as const, id: p.id, at: ahora })));
  });
  return { sede: cdc.nombre, clasesMovidas: clases.length, pagosMovidos: pagos.length };
}

/** Becas de ejemplo: plan "Beca" ($0, 180 días) para 8 alumnos que vienen seguido; sus clases recientes pasan a la beca. */
export async function agregarBecasDemo(): Promise<{ becados: number; asistencias: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  if ((await db.planes.toArray()).some((p) => !p.deletedAt && p.tipo !== 'suelta' && p.precio === 0)) throw new Error('Ya hay becas');
  const dueno = (await db.usuarios.toArray()).find((u) => u.rol === 'dueno' && !u.deletedAt);
  if (!dueno) throw new Error('No hay usuario de dirección');
  const A = academia.id;
  const ahora = Date.now();
  const base = () => ({ id: crypto.randomUUID() as ID, academiaId: A, createdAt: ahora, updatedAt: ahora, deletedAt: null });
  const plan: Plan = { ...base(), nombre: 'Beca', tipo: 'paquete', precio: 0, clases: null, vigenciaDias: 180, disciplinaId: null, activo: true };
  await guardar('planes', plan);

  const hoyF = hoy();
  const recientes = await db.asistencias.where('fecha').aboveOrEqual(sumarDias(hoyF, -21)).filter((a) => !!a.alumnoId && !a.anuladaAt && !a.deletedAt).toArray();
  const veces = new Map<ID, number>();
  for (const a of recientes) veces.set(a.alumnoId!, (veces.get(a.alumnoId!) ?? 0) + 1);
  const elegidos = [...veces.entries()].sort((a, b) => b[1] - a[1]).slice(3, 11).map(([id]) => id);

  let movidas = 0;
  for (const [i, alumnoId] of elegidos.entries()) {
    // dos becas por terminar pronto para que se vea el aviso
    const inicio = sumarDias(hoyF, i < 2 ? -172 : -21);
    const pago: Pago = { ...base(), alumnoId, planId: plan.id, concepto: plan.nombre, monto: 0, metodo: 'efectivo', usuarioId: dueno.id, fecha: inicio, anuladoAt: null, anuladoMotivo: null, anuladoPor: null };
    await guardar('pagos', pago);
    const mem: Membresia = { ...base(), alumnoId, planId: plan.id, pagoId: pago.id, disciplinaId: null, inicio, fin: sumarDias(inicio, 179), clasesTotal: null, anuladaAt: null };
    await guardar('membresias', mem);
    for (const a of recientes.filter((x) => x.alumnoId === alumnoId && x.fecha >= inicio)) {
      if (a.pagoId) {
        const p = await db.pagos.get(a.pagoId);
        if (p) await guardar('pagos', { ...p, deletedAt: ahora });
      }
      await guardar('asistencias', { ...a, membresiaId: mem.id, pagoId: null });
      movidas++;
    }
  }
  return { becados: elegidos.length, asistencias: movidas };
}

/** Gastos de ejemplo: renta(s), luz, internet y garrafones de los últimos 2 meses y el actual (hasta hoy). */
export async function agregarGastosDemo(): Promise<{ fijos: number; gastos: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  if (await db.gastosFijos.filter((f) => !f.deletedAt).count()) throw new Error('Ya hay gastos fijos');
  const dueno = (await db.usuarios.toArray()).find((u) => u.rol === 'dueno' && !u.deletedAt);
  if (!dueno) throw new Error('No hay usuario de dirección');
  const A = academia.id;
  const base = () => {
    const ahora = Date.now();
    return { id: crypto.randomUUID() as ID, academiaId: A, createdAt: ahora, updatedAt: ahora, deletedAt: null };
  };
  const cdc = (await db.sedes.toArray()).find((s) => !s.deletedAt);
  const fijos: GastoFijo[] = [
    { ...base(), concepto: `Renta ${academia.sedePrincipal || 'estudio'}`, categoria: 'renta', monto: 550000, dia: 1, activo: true },
    { ...base(), concepto: 'Luz', categoria: 'luz', monto: 85000, dia: 15, activo: true },
    { ...base(), concepto: 'Internet', categoria: 'internet', monto: 49900, dia: 10, activo: true },
    ...(cdc ? [{ ...base(), sedeId: cdc.id, concepto: `Renta ${cdc.nombre}`, categoria: 'renta' as const, monto: 150000, dia: 5, activo: true }] : []),
  ];
  for (const f of fijos) await guardar('gastosFijos', f);
  const r = generador(7);
  const hoyF = hoy();
  let n = 0;
  for (let m = -2; m <= 0; m++) {
    const mes = sumarMeses(hoyF, m).slice(0, 7);
    for (const f of fijos) {
      const fecha = `${mes}-${String(f.dia).padStart(2, '0')}`;
      if (fecha > hoyF) continue;
      const monto = f.categoria === 'luz' ? Math.round((70000 + r() * 35000) / 100) * 100 : f.monto;
      await guardar('gastos', { ...base(), ...(f.sedeId ? { sedeId: f.sedeId } : {}), concepto: f.concepto, categoria: f.categoria, monto, fecha, fijoId: f.id, metodo: 'transferencia', notas: '', usuarioId: dueno.id });
      n++;
    }
    for (const dia of ['04', '18']) {
      const fecha = `${mes}-${dia}`;
      if (fecha > hoyF) continue;
      await guardar('gastos', { ...base(), concepto: 'Garrafones de agua', categoria: 'agua', monto: 15000, fecha, fijoId: null, metodo: 'efectivo', notas: '', usuarioId: dueno.id });
      n++;
    }
  }
  return { fijos: fijos.length, gastos: n };
}

/** Rentas de ejemplo del salón: dos horarios fijos mensuales y un evento de todo el día el próximo domingo. */
export async function agregarRentasDemo(): Promise<{ rentas: number; cobros: number }> {
  const { empalmes, TODO_EL_DIA } = await import('../domain/agenda');
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  if (await db.rentas.filter((r) => !r.deletedAt).count()) throw new Error('Ya hay rentas');
  const dueno = (await db.usuarios.toArray()).find((u) => u.rol === 'dueno' && !u.deletedAt);
  if (!dueno) throw new Error('No hay usuario de dirección');
  const A = academia.id;
  const base = () => {
    const ahora = Date.now();
    return { id: crypto.randomUUID() as ID, academiaId: A, createdAt: ahora, updatedAt: ahora, deletedAt: null };
  };
  const hoyF = hoy();
  const mesActual = hoyF.slice(0, 7);
  const mesPasado = sumarMeses(hoyF, -1).slice(0, 7);
  const domingo = sumarDias(hoyF, (7 - deFecha(hoyF).getDay()) % 7 || 7);
  const propuestas: Renta[] = [
    { ...base(), nombre: 'Profe Ana (Bachata)', telefono: '5512345678', tipo: 'mensual', dias: [2, 4], horaInicio: '17:00', duracionMin: 60, desde: `${mesPasado}-01`, hasta: null, monto: 240000, notas: '', activo: true },
    { ...base(), nombre: 'Yoga con Laura', telefono: '', tipo: 'mensual', dias: [1, 3, 5], horaInicio: '08:00', duracionMin: 60, desde: `${mesPasado}-01`, hasta: null, monto: 300000, notas: '', activo: true },
    { ...base(), nombre: 'Taller de tango', telefono: '', tipo: 'evento', dias: [0], ...TODO_EL_DIA, desde: domingo, hasta: domingo, monto: 250000, notas: 'Traen su sonido', activo: true },
  ];
  const clases = await db.clases.toArray();
  const hechas: Renta[] = [];
  for (const r of propuestas) {
    if (empalmes(r, clases, hechas).length) continue; // nunca dejar la demo con empalmes
    await guardar('rentas', r);
    hechas.push(r);
  }
  const cobro = (r: Renta, periodo: string, fecha: Fecha): Pago => ({
    ...base(), alumnoId: null, planId: null, rentaId: r.id, periodo, concepto: `Renta del salón · ${r.nombre}`, monto: r.monto, metodo: 'transferencia', usuarioId: dueno.id, fecha, anuladoAt: null, anuladoMotivo: null, anuladoPor: null,
  });
  let n = 0;
  for (const r of hechas.filter((x) => x.tipo === 'mensual')) {
    await guardar('pagos', cobro(r, mesPasado, `${mesPasado}-05`));
    n++;
  }
  const laura = hechas.find((x) => x.nombre.startsWith('Yoga'));
  if (laura && `${mesActual}-05` <= hoyF) {
    await guardar('pagos', cobro(laura, mesActual, `${mesActual}-05`));
    n++;
  }
  return { rentas: hechas.length, cobros: n };
}

/** Tienda en el portal: los artículos se muestran en línea (playera con tallas) y hay 2 apartados por recoger. */
export async function agregarPedidosDemo(): Promise<{ enLinea: number; pedidos: number }> {
  const academia = await db.academias.toCollection().first();
  if (!academia) throw new Error('No hay academia en este teléfono');
  const articulos = (await db.productos.toArray()).filter((p) => !p.deletedAt && p.categoria === 'articulo');
  if (!articulos.length) throw new Error('Primero agrega la tienda demo');
  const OPCIONES: Record<string, string[]> = { 'Playera Calo': ['CH', 'M', 'G', 'XG'], 'Zapatillas de baile': ['23', '24', '25', '26'] };
  for (const p of articulos) await guardar('productos', { ...p, enLinea: true, opciones: OPCIONES[p.nombre] ?? [], descripcion: p.nombre.startsWith('Playera') ? 'Algodón, logo al frente' : p.descripcion });
  const alumnos = (await db.alumnos.toArray()).filter((a) => !a.deletedAt && a.activo).slice(0, 2);
  const playera = articulos.find((p) => p.nombre.startsWith('Playera')) ?? articulos[0];
  const gorra = articulos.find((p) => p.nombre.startsWith('Gorra')) ?? articulos[0];
  const ahora = Date.now();
  const pedidos: Pedido[] = alumnos.map((a, i) => ({
    id: crypto.randomUUID(), academiaId: academia.id, createdAt: ahora - (i + 1) * 3600_000, updatedAt: ahora, deletedAt: null,
    alumnoId: a.id, productoId: (i === 0 ? playera : gorra).id, opcion: i === 0 ? 'M' : null, cantidad: 1, precio: (i === 0 ? playera : gorra).precio, estado: 'pendiente', pagoId: null,
  }));
  for (const p of pedidos) await guardar('pedidos', p);
  return { enLinea: articulos.length, pedidos: pedidos.length };
}

/** Fiados de ejemplo: a 4 alumnos su última clase pagada pasa a "debe" (para ver la libreta y los adeudos). */
export async function agregarFiadosDemo(): Promise<{ fiados: number }> {
  const desde = sumarDias(hoy(), -14);
  const pagadas = await db.asistencias.where('fecha').aboveOrEqual(desde).filter((a) => !!a.alumnoId && !!a.pagoId && !a.anuladaAt && !a.deletedAt).toArray();
  const porAlumno = new Map<ID, Asistencia>();
  for (const a of pagadas.sort((x, y) => (x.fecha < y.fecha ? 1 : -1))) if (!porAlumno.has(a.alumnoId!)) porAlumno.set(a.alumnoId!, a);
  const elegidas = [...porAlumno.values()].slice(0, 4);
  const ahora = Date.now();
  for (const a of elegidas) {
    const p = await db.pagos.get(a.pagoId!);
    if (p) await guardar('pagos', { ...p, deletedAt: ahora });
    await guardar('asistencias', { ...a, pagoId: null, debe: true });
  }
  return { fiados: elegidas.length };
}
