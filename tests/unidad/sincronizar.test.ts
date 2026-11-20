// Sincronización contra una nube simulada en memoria (no sale nada a internet).
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, unknown>;
const nube = vi.hoisted(() => ({
  tablas: new Map<string, Map<string, Record<string, unknown>>>(),
  envios: [] as { tabla: string; tipo: 'upsert' | 'update'; datos: Record<string, unknown> }[],
  reloj: 0,
  /** la nube rechaza los cambios (como una base sin esa tabla): quedan en la cola */
  rechazar: false,
  /** desde qué hora pidió cada bajada (para revisar el traslape) */
  consultas: [] as { tabla: string; desde: string }[],
  /** se llama al pedir cada página de la primera descarga (para cambiar la nube a media descarga) */
  alPaginar: null as null | ((tabla: string, pagina: number) => void),
  paginas: 0,
}));

vi.mock('../../src/sync/supabase', () => {
  const tabla = (t: string) => nube.tablas.get(t) ?? nube.tablas.set(t, new Map()).get(t)!;
  const sello = () => new Date(Date.UTC(2026, 10, 18) + ++nube.reloj).toISOString();
  const from = (t: string) => {
    const q: Record<string, unknown> & { filtros: [string, unknown][]; desde?: string; hasta?: string; desdeFecha?: string; antesFecha?: string; orden?: [string, boolean]; rango?: [number, number]; limite?: number; cuenta?: boolean } = { filtros: [] };
    // consulta normal (sin gt): filtra por academia y "hasta", ordena, y corta por rango o límite; con head, solo cuenta
    const leer = () => {
      const [col, v] = q.filtros.find(([c]) => c === 'academia_id' || c === 'id' || c === 'alumno_id') ?? [];
      let filas = [...tabla(t).values()].filter(
        (f) => (col ? f[col] === v : true) && (!q.hasta || (f.server_updated_at as string) <= q.hasta) && (!q.desdeFecha || (f.fecha as string) >= q.desdeFecha) && (!q.antesFecha || (f.fecha as string) < q.antesFecha),
      );
      if (q.cuenta) return { data: null, count: filas.length, error: null };
      if (q.orden) filas = filas.sort((a, b) => ((a[q.orden![0]] as string) < (b[q.orden![0]] as string) ? -1 : 1) * (q.orden![1] ? 1 : -1));
      if (q.rango) {
        nube.alPaginar?.(t, nube.paginas++);
        filas = filas.slice(q.rango[0], q.rango[1] + 1);
      } else if (q.limite) filas = filas.slice(0, q.limite);
      return { data: filas, error: null };
    };
    let accion: () => { data?: unknown; error: null; count?: number } = leer;
    Object.assign(q, {
      upsert(filas: Fila[]) {
        accion = () => {
          for (const f of filas) {
            nube.envios.push({ tabla: t, tipo: 'upsert', datos: f });
            tabla(t).set(f.id as string, { ...f, server_updated_at: sello() });
          }
          return { error: null };
        };
        return q;
      },
      update(datos: Fila) {
        accion = () => {
          if (nube.rechazar) return { data: null, error: { message: 'Could not find the table public.alumnos' } } as never;
          const id = q.filtros.find(([c]) => c === 'id')?.[1] as string;
          const fila = tabla(t).get(id);
          nube.envios.push({ tabla: t, tipo: 'update', datos });
          if (fila) tabla(t).set(id, { ...fila, ...datos, server_updated_at: sello() });
          return { data: fila ? [{ id }] : [], error: null };
        };
        return q;
      },
      select(_c?: string, o?: { count?: string; head?: boolean }) {
        if (o?.head) q.cuenta = true;
        return q;
      },
      lte(_c: string, v: string) {
        q.hasta = v;
        return q;
      },
      gte(_c: string, v: string) {
        q.desdeFecha = v;
        return q;
      },
      lt(_c: string, v: string) {
        q.antesFecha = v;
        return q;
      },
      range(a: number, b: number) {
        q.rango = [a, b];
        return q;
      },
      eq(c: string, v: unknown) {
        q.filtros.push([c, v]);
        return q;
      },
      gt(_c: string, v: string) {
        q.desde = v;
        nube.consultas.push({ tabla: t, desde: v });
        accion = () => ({ data: [...tabla(t).values()].filter((f) => (f.server_updated_at as string) > q.desde!).sort((a, b) => ((a.server_updated_at as string) < (b.server_updated_at as string) ? -1 : 1)), error: null });
        return q;
      },
      order(c: string, o?: { ascending?: boolean }) {
        q.orden = [c, o?.ascending !== false];
        return q;
      },
      limit(n: number) {
        q.limite = n;
        return q;
      },
      then(res: (v: unknown) => void) {
        res(accion());
      },
    });
    return q;
  };
  return {
    supabase: { from, rpc: async () => ({ data: 20261118, error: null }), auth: { getSession: async () => ({ data: { session: {} } }), signInWithPassword: async () => ({ data: { session: {} }, error: null }), signUp: async () => ({ data: { session: {} }, error: null }) } },
    nubeConfigurada: true,
    baseTieneColumna: async () => true,
  };
});

const { db, setMeta } = await import('../../src/db/db');
const { actualizar, crear } = await import('../../src/db/repo');
const { sincronizar, vincularAcademia, podar, historialAnterior, VENTANA_DIAS } = await import('../../src/sync/engine');
const { hoy, sumarDias } = await import('../../src/domain/fechas');

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  await Promise.all(db.tables.map((t) => t.clear()));
  nube.tablas.clear();
  nube.envios.length = 0;
  nube.rechazar = false;
  nube.consultas.length = 0;
  nube.alPaginar = null;
  nube.paginas = 0;
  await setMeta('academiaId', 'a1');
  await setMeta('nubeVinculada', true);
});

const alta = () => crear('alumnos', { nombre: 'Ana', telefono: '5511112222', activo: true } as never);

describe('sincronizar', () => {
  it('reconectar (sesión vencida) NO vuelve a subir todo el equipo: solo lo pendiente', async () => {
    await db.academias.put({ id: 'a1', nombre: 'Calo', moneda: 'MXN', createdAt: 0, updatedAt: 0, deletedAt: null });
    const viejo = await alta();
    await sincronizar();
    // otro teléfono corrige el teléfono del alumno; este equipo sigue con la versión vieja
    const fila = nube.tablas.get('alumnos')!.get(viejo.id)!;
    nube.tablas.get('alumnos')!.set(viejo.id, { ...fila, telefono: '5599998888' });
    nube.envios.length = 0;
    await vincularAcademia('demo@example.org', 'clave123', false);
    expect(nube.envios.filter((e) => e.tabla === 'alumnos')).toHaveLength(0);
    expect(nube.tablas.get('alumnos')!.get(viejo.id)!.telefono).toBe('5599998888');
  });

  it('la primera vez que se conecta una academia sí sube todo lo del equipo', async () => {
    await setMeta('nubeVinculada', false);
    await db.academias.put({ id: 'a1', nombre: 'Calo', moneda: 'MXN', createdAt: 0, updatedAt: 0, deletedAt: null });
    const al = await alta();
    await db.outbox.clear();
    await vincularAcademia('demo@example.org', 'clave123', true);
    expect(nube.tablas.get('alumnos')?.has(al.id)).toBe(true);
  });

  it('el traslape de 2 min se revisa una vez después de recibir cambios, no siempre', async () => {
    await setMeta('cursor:alumnos', '2000-01-01T00:00:00.000Z'); // un equipo que ya había bajado antes
    await alta();
    await sincronizar(); // sube el alta y la baja (cambio nuevo) → la próxima revisa traslape
    const desdeDe = () => nube.consultas.filter((c) => c.tabla === 'alumnos').at(-1)!.desde;
    const cursor = (await db.meta.get('cursor:alumnos'))!.value as string;
    await sincronizar();
    expect(new Date(desdeDe()).getTime()).toBe(new Date(cursor).getTime() - 120_000);
    await sincronizar(); // ya sin cambios nuevos: desde el cursor exacto
    expect(desdeDe()).toBe(cursor);
  });

  it('primera descarga en un equipo nuevo: por páginas a la vez, sin perder lo que cambia o se crea a media descarga', async () => {
    const T = (n: number) => new Date(Date.UTC(2026, 9, 1) + n).toISOString();
    const base = { academia_id: 'a1', telefono: '', notas: '', activo: true, created_at: 1, updated_at: 1, deleted_at: null };
    for (let i = 0; i < 2500; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      nube.tablas.set('alumnos', (nube.tablas.get('alumnos') ?? new Map()).set(id, { ...base, id, nombre: `Alumno ${i}`, codigo: `C${i}`, server_updated_at: T(i) }));
    }
    // a media descarga: alguien edita un alumno de la primera página y otro da de alta uno nuevo
    nube.alPaginar = (t, n) => {
      if (t !== 'alumnos' || n !== 1) return;
      const a = nube.tablas.get('alumnos')!;
      const id0 = '00000000-0000-4000-8000-000000000000';
      a.set(id0, { ...a.get(id0)!, nombre: 'Editado a media descarga', server_updated_at: T(99_999) });
      a.set('ffffffff-0000-4000-8000-000000000000', { ...base, id: 'ffffffff-0000-4000-8000-000000000000', nombre: 'Nuevo a media descarga', codigo: 'NUEVO', server_updated_at: T(100_000) });
    };
    await sincronizar();
    const locales = await db.alumnos.toArray();
    expect(locales).toHaveLength(2501);
    expect(locales.find((a) => a.codigo === 'C0')?.nombre).toBe('Editado a media descarga');
    expect(locales.some((a) => a.codigo === 'NUEVO')).toBe(true);
  });

  it('teléfono nuevo: de entradas y cobros baja solo los últimos 18 meses; lo viejo queda en la nube', async () => {
    const T = (n: number) => new Date(Date.UTC(2026, 9, 1) + n).toISOString();
    const base = { academia_id: 'a1', clase_id: 'c1', usuario_id: 'u1', alumno_id: 'al1', created_at: 1, updated_at: 1, deleted_at: null, anulada_at: null };
    const reciente = sumarDias(hoy(), -30);
    const vieja = sumarDias(hoy(), -VENTANA_DIAS - 30);
    const a = new Map<string, Record<string, unknown>>();
    a.set('r1', { ...base, id: 'r1', fecha: reciente, server_updated_at: T(1) });
    a.set('v1', { ...base, id: 'v1', fecha: vieja, server_updated_at: T(2) });
    nube.tablas.set('asistencias', a);
    await sincronizar();
    expect((await db.asistencias.toArray()).map((x) => x.id)).toEqual(['r1']);
  });

  it('una vez al día se quita del teléfono lo de hace más de 18 meses, solo si ya está en la nube', async () => {
    await setMeta('nubeVinculada', true);
    const vieja = sumarDias(hoy(), -VENTANA_DIAS - 10);
    const fila = (id: string, fecha: string) => ({ id, academiaId: 'a1', claseId: 'c1', usuarioId: 'u1', alumnoId: 'al1', fecha, membresiaId: null, pagoId: null, anuladaAt: null, createdAt: 1, updatedAt: 1, deletedAt: null });
    await db.asistencias.bulkPut([fila('vieja-subida', vieja), fila('vieja-pendiente', vieja), fila('reciente', hoy())] as never[]);
    await db.outbox.add({ table: 'asistencias', id: 'vieja-pendiente', at: 1 });
    expect(await podar()).toBe(1);
    expect((await db.asistencias.toArray()).map((x) => x.id).sort()).toEqual(['reciente', 'vieja-pendiente']);
    expect(await podar()).toBe(0); // ya se hizo hoy
  });

  it('el historial de hace más de 18 meses de un alumno se pide a la nube (sin guardarlo) y sin lo borrado o anulado', async () => {
    const base = { academia_id: 'a1', clase_id: 'c1', usuario_id: 'u1', created_at: 1, updated_at: 1, deleted_at: null, anulada_at: null, server_updated_at: 'x' };
    const vieja = sumarDias(hoy(), -VENTANA_DIAS - 30);
    const a = new Map<string, Record<string, unknown>>();
    a.set('v1', { ...base, id: 'v1', alumno_id: 'al1', fecha: vieja });
    a.set('v2', { ...base, id: 'v2', alumno_id: 'al1', fecha: vieja, anulada_at: 5 }); // anulada
    a.set('v3', { ...base, id: 'v3', alumno_id: 'otro', fecha: vieja }); // de otro alumno
    a.set('r1', { ...base, id: 'r1', alumno_id: 'al1', fecha: hoy() }); // reciente: ya está en el teléfono
    nube.tablas.set('asistencias', a);
    nube.tablas.set('pagos', new Map([['p1', { ...base, id: 'p1', alumno_id: 'al1', fecha: vieja, monto: 40000, deleted_at: 9 }]]));
    const r = await historialAnterior('al1');
    expect(r.asistencias.map((x) => x.id)).toEqual(['v1']);
    expect(r.asistencias[0].alumnoId).toBe('al1'); // llega en camelCase, como lo usa la app
    expect(r.pagos).toEqual([]); // borrado
    expect(await db.asistencias.count()).toBe(0); // no se guarda en el teléfono
  });

  it('en un equipo sin nube nunca se quita nada (ahí es la única copia)', async () => {
    await setMeta('nubeVinculada', false);
    await db.asistencias.put({ id: 'v', academiaId: 'a1', claseId: 'c1', usuarioId: 'u1', alumnoId: null, fecha: '2020-01-01', membresiaId: null, pagoId: null, anuladaAt: null, createdAt: 1, updatedAt: 1, deletedAt: null } as never);
    expect(await podar()).toBe(0);
    expect(await db.asistencias.count()).toBe(1);
  });

  it('lo que llega igual a como ya está no se reescribe', async () => {
    await alta();
    await sincronizar();
    await sincronizar();
    let escrituras = 0;
    const contar = () => void escrituras++;
    db.alumnos.hook('updating', contar);
    await db.meta.put({ key: 'traslape:alumnos', value: true }); // fuerza a volver a bajar lo mismo
    await sincronizar();
    db.alumnos.hook('updating').unsubscribe(contar);
    expect(escrituras).toBe(0);
  });

  it('el índice local de deudas nunca se sube', async () => {
    await crear('asistencias', { alumnoId: 'al1', nombreVisitante: null, claseId: 'c1', fecha: '2026-11-18', membresiaId: null, pagoId: null, usuarioId: 'u1', anuladaAt: null, debe: true } as never);
    await sincronizar();
    const enviado = nube.envios.find((e) => e.tabla === 'asistencias')!;
    expect(enviado.datos.debe).toBe(true);
    expect('deuda' in enviado.datos).toBe(false);
  });

  it('un alta sube completa y un cambio sube solo lo que cambió', async () => {
    const al = await alta();
    await sincronizar();
    expect(nube.envios.at(-1)).toMatchObject({ tipo: 'upsert', datos: { id: al.id, nombre: 'Ana', telefono: '5511112222' } });
    await actualizar('alumnos', al.id, { avisos: { adeudo: 5 } } as never);
    await sincronizar();
    const ultimo = nube.envios.at(-1)!;
    expect(ultimo.tipo).toBe('update');
    expect(Object.keys(ultimo.datos).sort()).toEqual(['avisos', 'updated_at']);
    expect(await db.outbox.count()).toBe(0);
  });

  it('el teléfono que estuvo sin red no regresa el teléfono viejo que otro corrigió', async () => {
    const al = await alta();
    await sincronizar();
    // otro teléfono corrige el número en la nube…
    const fila = nube.tablas.get('alumnos')!.get(al.id)!;
    nube.tablas.get('alumnos')!.set(al.id, { ...fila, telefono: '5599998888', server_updated_at: '2099-01-01T00:00:00.000Z' });
    // …mientras este, sin enterarse, marca que ya le avisó
    await actualizar('alumnos', al.id, { avisos: { adeudo: 5 } } as never);
    await sincronizar();
    const enNube = nube.tablas.get('alumnos')!.get(al.id)!;
    expect(enNube.telefono).toBe('5599998888');
    expect(enNube.avisos).toEqual({ adeudo: 5 });
    // y al bajar, este teléfono queda igual que la nube
    expect((await db.alumnos.get(al.id))?.telefono).toBe('5599998888');
  });

  it('un reloj adelantado no impide recibir los cambios de los demás', async () => {
    const al = await alta();
    await sincronizar();
    // este teléfono tiene la hora 1 día adelantada: su registro local "parece" más nuevo
    await db.alumnos.update(al.id, { updatedAt: Date.now() + 86_400_000 });
    const fila = nube.tablas.get('alumnos')!.get(al.id)!;
    nube.tablas.get('alumnos')!.set(al.id, { ...fila, nombre: 'Ana López', updated_at: Date.now(), server_updated_at: '2099-01-01T00:00:00.000Z' });
    await sincronizar();
    expect((await db.alumnos.get(al.id))?.nombre).toBe('Ana López');
  });

  it('lo que aún no sube no se pisa al bajar', async () => {
    const al = await alta();
    await sincronizar();
    const fila = nube.tablas.get('alumnos')!.get(al.id)!;
    nube.tablas.get('alumnos')!.set(al.id, { ...fila, nombre: 'Otro', server_updated_at: '2099-01-01T00:00:00.000Z' });
    await actualizar('alumnos', al.id, { nombre: 'Ana López' } as never);
    // la subida no se pudo (queda en la cola) pero la bajada sí corre: no debe borrar el cambio local
    nube.rechazar = true;
    await sincronizar();
    expect((await db.alumnos.get(al.id))?.nombre).toBe('Ana López');
    expect(await db.outbox.count()).toBe(1);
  });
});
