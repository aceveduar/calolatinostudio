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
}));

vi.mock('../../src/sync/supabase', () => {
  const tabla = (t: string) => nube.tablas.get(t) ?? nube.tablas.set(t, new Map()).get(t)!;
  const sello = () => new Date(Date.UTC(2026, 10, 18) + ++nube.reloj).toISOString();
  const from = (t: string) => {
    const q: Record<string, unknown> & { filtros: [string, unknown][]; desde?: string } = { filtros: [] };
    let accion: () => { data?: unknown; error: null } = () => ({ error: null });
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
      select: () => q,
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
      order: () => q,
      limit: () => q,
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
const { sincronizar, vincularAcademia } = await import('../../src/sync/engine');

beforeEach(async () => {
  vi.stubGlobal('navigator', { onLine: true });
  await Promise.all(db.tables.map((t) => t.clear()));
  nube.tablas.clear();
  nube.envios.length = 0;
  nube.rechazar = false;
  nube.consultas.length = 0;
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
    await alta();
    await sincronizar(); // sube el alta y la baja (cambio nuevo) → la próxima revisa traslape
    const desdeDe = () => nube.consultas.filter((c) => c.tabla === 'alumnos').at(-1)!.desde;
    const cursor = (await db.meta.get('cursor:alumnos'))!.value as string;
    await sincronizar();
    expect(new Date(desdeDe()).getTime()).toBe(new Date(cursor).getTime() - 120_000);
    await sincronizar(); // ya sin cambios nuevos: desde el cursor exacto
    expect(desdeDe()).toBe(cursor);
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
