/**
 * Correcciones: todo error de recepción tiene un camino para arreglarse.
 * Regla: nada se borra de verdad. Se anula (con quién y por qué) o se mueve,
 * y cada acción tiene su inversa para poder "Deshacer".
 */
import { db } from '../db/db';
import { actualizar, borrar, enTransaccion } from '../db/repo';
import type { Alumno, Asistencia, ID, MetodoPago } from '../db/types';
import { anularPago, generarCodigo } from './operaciones';
import { estadoMembresia, membresiaQueCubre } from './membresias';
import { claseEnFecha } from './clases';

/** Quita una entrada. Si se cobró, también anula el cobro (el dinero se devuelve y la caja cuadra). */
export async function quitarEntrada(a: Asistencia, usuarioId: ID, motivo = 'Entrada quitada'): Promise<() => Promise<void>> {
  if (a.pagoId) {
    const pagoId = a.pagoId;
    await anularPago(pagoId, motivo, usuarioId);
    return () => restaurarPago(pagoId);
  }
  await actualizar('asistencias', a.id, { anuladaAt: Date.now() });
  return () => actualizar('asistencias', a.id, { anuladaAt: null }).then(() => undefined);
}

/** Revierte una anulación: el cobro y lo que dependía de él vuelven a contar. */
export async function restaurarPago(pagoId: ID): Promise<void> {
  await enTransaccion(async () => {
    const pago = await db.pagos.get(pagoId);
    if (!pago?.anuladoAt) return;
    const cuando = pago.anuladoAt;
    await actualizar('pagos', pagoId, { anuladoAt: null, anuladoMotivo: null, anuladoPor: null });
    // solo lo que se anuló junto con este cobro
    const asis = await db.asistencias.where('pagoId').equals(pagoId).filter((a) => a.anuladaAt === cuando).toArray();
    for (const a of asis) await actualizar('asistencias', a.id, { anuladaAt: null });
    const mems = await db.membresias.where('pagoId').equals(pagoId).filter((m) => m.anuladaAt === cuando).toArray();
    for (const m of mems) await actualizar('membresias', m.id, { anuladaAt: null });
  });
}

export async function cambiarMetodoPago(pagoId: ID, metodo: MetodoPago): Promise<MetodoPago> {
  const antes = (await db.pagos.get(pagoId))!.metodo;
  await actualizar('pagos', pagoId, { metodo });
  return antes;
}

/** Se registró en la clase equivocada. */
export async function moverDeClase(a: Asistencia, claseId: ID): Promise<void> {
  await enTransaccion(async () => {
    const destino = await db.clases.get(claseId);
    const clase = destino && claseEnFecha(destino, a.fecha);
    if (!destino?.activo || destino.deletedAt || !clase) throw new Error('La clase elegida no está disponible para esa fecha.');
    if (a.membresiaId) {
      const membresia = await db.membresias.get(a.membresiaId);
      const otras = await db.asistencias.where('membresiaId').equals(a.membresiaId).filter((x) => x.id !== a.id).toArray();
      if (!membresia || !membresiaQueCubre([estadoMembresia(membresia, otras, a.fecha)], clase)) {
        throw new Error('Su plan no cubre esa clase. Quita esta entrada y regístrala en la clase correcta.');
      }
    }
    if (a.alumnoId) {
      const ya = await db.asistencias
        .where('[claseId+fecha]')
        .equals([claseId, a.fecha])
        .filter((x) => x.alumnoId === a.alumnoId && x.id !== a.id && !x.anuladaAt && !x.deletedAt)
        .count();
      if (ya) throw new Error('Ya tiene entrada en esa clase');
    }
    await actualizar('asistencias', a.id, { claseId });
  });
}

/**
 * Se cobró a la persona equivocada (o a un "sin nombre" que sí tenía registro).
 * Solo para entradas cobradas: el dinero se queda, cambia a quién se le atribuye.
 */
export async function cambiarPersona(a: Asistencia, alumnoId: ID): Promise<void> {
  if (!a.pagoId) throw new Error('Esta entrada usó un plan. Quítala y dale entrada a la persona correcta.');
  const ya = await db.asistencias
    .where('[claseId+fecha]')
    .equals([a.claseId, a.fecha])
    .filter((x) => x.alumnoId === alumnoId && !x.anuladaAt && !x.deletedAt)
    .count();
  if (ya) throw new Error('Esa persona ya tiene entrada en esta clase');
  await enTransaccion(async () => {
    await actualizar('asistencias', a.id, { alumnoId, nombreVisitante: null });
    await actualizar('pagos', a.pagoId!, { alumnoId });
  });
}

export async function resumenAlumno(id: ID) {
  const [pagos, asistencias, membresias] = await Promise.all([
    db.pagos.where('alumnoId').equals(id).count(),
    db.asistencias.where('alumnoId').equals(id).count(),
    db.membresias.where('alumnoId').equals(id).count(),
  ]);
  return { pagos, asistencias, membresias };
}

/** Alumno registrado dos veces: pasa todo su historial al correcto y retira el duplicado. */
/** Devuelve cuántas entradas quedaron repetidas (misma clase, mismo día): probable cobro doble a revisar. */
export async function fusionarAlumnos(duplicadoId: ID, correctoId: ID): Promise<number> {
  if (duplicadoId === correctoId) return 0;
  await enTransaccion(async () => {
    for (const p of await db.pagos.where('alumnoId').equals(duplicadoId).toArray()) await actualizar('pagos', p.id, { alumnoId: correctoId });
    for (const a of await db.asistencias.where('alumnoId').equals(duplicadoId).toArray()) await actualizar('asistencias', a.id, { alumnoId: correctoId });
    for (const m of await db.membresias.where('alumnoId').equals(duplicadoId).toArray()) await actualizar('membresias', m.id, { alumnoId: correctoId });
    const dup = await db.alumnos.get(duplicadoId);
    const ok = await db.alumnos.get(correctoId);
    if (dup && ok) {
      // conservar datos que el correcto no tenga
      await actualizar('alumnos', correctoId, {
        telefono: ok.telefono || dup.telefono,
        notas: [ok.notas, dup.notas].filter(Boolean).join(' · '),
      });
    }
    await borrar('alumnos', duplicadoId);
  });
  const asis = await db.asistencias.where('alumnoId').equals(correctoId).filter((a) => !a.anuladaAt && !a.deletedAt).toArray();
  const vistos = new Set<string>();
  let repetidas = 0;
  for (const a of asis) {
    const k = `${a.claseId}|${a.fecha}`;
    if (vistos.has(k)) repetidas++;
    vistos.add(k);
  }
  return repetidas;
}

// ---------- prevención de duplicados ----------

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function distancia(a: string, b: string): number {
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = v[0];
    v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return v[b.length];
}

/** Nombres parecidos (errores de dedo, sin acento, apellido incompleto) para evitar duplicados. */
export function parecidos<T extends { nombre: string }>(nombre: string, lista: T[], max = 3): T[] {
  const n = normalizar(nombre);
  if (n.length < 3) return [];
  const [pila, ape] = n.split(' ');
  return lista
    .map((x) => {
      const m = normalizar(x.nombre);
      const [p2, a2] = m.split(' ');
      const d = distancia(n, m);
      const mismoPila = pila === p2 && (!ape || !a2 || a2.startsWith(ape.slice(0, 3)) || ape.startsWith(a2.slice(0, 3)));
      const puntaje = d <= Math.max(1, Math.floor(n.length / 6)) ? d : mismoPila ? 3 : 99;
      return { x, puntaje };
    })
    .filter((r) => r.puntaje < 99)
    .sort((a, b) => a.puntaje - b.puntaje)
    .slice(0, max)
    .map((r) => r.x);
}

/**
 * Alumnos que ya tienen ese teléfono (últimos 10 dígitos). El teléfono NO identifica a nadie: es normal que se
 * repita (una mamá con dos hijos, una pareja); solo sirve para avisar por si es la misma persona dada de alta dos veces.
 */
export function mismoTelefono<T extends { id: string; telefono: string }>(telefono: string, lista: T[], excluirId?: string): T[] {
  const t = telefono.replace(/\D/g, '').slice(-10);
  if (t.length < 10) return [];
  return lista.filter((a) => a.id !== excluirId && a.telefono.replace(/\D/g, '').slice(-10) === t);
}

/**
 * Derecho de cancelación (aviso de privacidad, derechos ARCO): el alumno pide que se borren sus datos.
 * Se quitan su nombre, teléfono, foto, notas, enlace del portal y su código QR (el anterior deja de servir),
 * y queda dado de baja. Sus pagos y entradas se quedan sin nombre, para que la caja y los reportes cuadren.
 * También se limpian sus datos en boletos e interesados.
 */
export const NOMBRE_ANONIMO = 'Alumno anónimo';

export async function reactivarAlumno(id: ID): Promise<Alumno> {
  return db.transaction('rw', db.alumnos, db.outbox, async () => {
    const alumno = await db.alumnos.get(id);
    if (!alumno || alumno.deletedAt || alumno.nombre === NOMBRE_ANONIMO) {
      throw new Error('Esta ficha ya no está disponible');
    }
    return alumno.activo ? alumno : actualizar('alumnos', id, { activo: true });
  });
}

export async function anonimizarAlumno(id: ID): Promise<void> {
  await enTransaccion(async () => {
    await actualizar('alumnos', id, { nombre: NOMBRE_ANONIMO, telefono: '', notas: '', foto: null, portal: null, avisos: null, codigo: generarCodigo(), activo: false });
    for (const b of await db.boletos.filter((x) => x.alumnoId === id).toArray()) await actualizar('boletos', b.id, { nombre: NOMBRE_ANONIMO, telefono: '' });
    for (const i of await db.interesados.filter((x) => x.alumnoId === id).toArray()) await actualizar('interesados', i.id, { nombre: NOMBRE_ANONIMO, telefono: '', mensaje: '' });
  });
}
