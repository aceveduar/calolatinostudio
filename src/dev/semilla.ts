/**
 * Datos de ejemplo realistas para demo y pruebas: Calo Latino Studio con 6 semanas de historia.
 * Solo se incluye en builds con VITE_SEMILLA=1 (ver main.tsx). Se borra cuando la academia arranque en serio.
 */
import { db } from '../db/db';
import { guardar } from '../db/repo';
import type { Alumno, Asistencia, Clase, Corte, Fecha, ID, Maestro, Membresia, MetodoPago, Pago, Plan, Usuario } from '../db/types';
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
