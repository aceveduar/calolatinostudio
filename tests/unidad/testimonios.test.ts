import { beforeEach, describe, expect, it } from 'vitest';
import { db, setMeta } from '../../src/db/db';
import { MAX_EN_PAGINA, conTestimonio, nombrePublico, noPublicar, paraPagina, publicarTestimonio, volverAPendiente } from '../../src/domain/testimonios';
import type { Testimonio } from '../../src/db/types';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await setMeta('academiaId', 'a1');
});

describe('testimonios', () => {
  it('en la página solo el nombre de pila y la inicial', () => {
    expect(nombrePublico('Ana López Pérez')).toBe('Ana L.');
    expect(nombrePublico('  rocío   díaz ')).toBe('rocío D.');
    expect(nombrePublico('Luis')).toBe('Luis');
  });

  it('el nuevo va primero, sin repetidos, sin los de ejemplo y con máximo', () => {
    const pagina = { frase: 'Hola', testimonios: [{ texto: 'Ejemplo: me encanta', nombre: 'X' }, { texto: 'Muy buen ambiente', nombre: 'B' }] };
    const r = conTestimonio(pagina, { texto: 'Aprendí desde cero', nombre: 'Ana L.' });
    expect(r.frase).toBe('Hola');
    expect(r.testimonios!.map((t) => t.texto)).toEqual(['Aprendí desde cero', 'Muy buen ambiente']);
    expect(conTestimonio(r, { texto: 'Muy buen ambiente', nombre: 'B' }).testimonios).toHaveLength(2);
    const muchos = Array.from({ length: 12 }, (_, i) => ({ texto: `t${i}`, nombre: 'N' }));
    expect(conTestimonio({ testimonios: muchos }, { texto: 'nuevo', nombre: 'N' }).testimonios).toHaveLength(MAX_EN_PAGINA);
  });

  it('publicar lo agrega a la página y lo marca aprobado; no publicar se puede deshacer', async () => {
    await db.academias.put({ id: 'a1', nombre: 'Calo', moneda: 'MXN', createdAt: 0, updatedAt: 0, deletedAt: null, pagina: { testimonios: [{ texto: 'Ejemplo: algo', nombre: 'X' }] } });
    await db.alumnos.put({ id: 'al1', academiaId: 'a1', createdAt: new Date('2025-03-01').getTime(), updatedAt: 0, deletedAt: null, nombre: 'Ana López', telefono: '', notas: '', codigo: 'K', activo: true });
    const t: Testimonio = { id: 't1', academiaId: 'a1', alumnoId: 'al1', texto: '  Me cambió la vida  ', estado: 'pendiente', revisadoAt: null, revisadoPor: null, createdAt: 0, updatedAt: 0, deletedAt: null };
    await db.testimonios.put(t);
    expect(paraPagina(t, { nombre: 'Ana López', createdAt: new Date('2025-03-01').getTime() }).detalle).toBe('En la academia desde 2025');
    await publicarTestimonio(t, 'u1');
    expect((await db.academias.get('a1'))!.pagina!.testimonios).toEqual([{ texto: 'Me cambió la vida', nombre: 'Ana L.', detalle: 'En la academia desde 2025' }]);
    expect((await db.testimonios.get('t1'))!.estado).toBe('aprobado');
    expect(await db.outbox.where('table').equals('academias').count()).toBe(1); // la página se sube a la nube
    await noPublicar(t, 'u1');
    expect((await db.testimonios.get('t1'))!.estado).toBe('rechazado');
    await volverAPendiente(t);
    expect((await db.testimonios.get('t1'))!.estado).toBe('pendiente');
  });
});
