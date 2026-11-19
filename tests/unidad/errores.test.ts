import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anotarError, borrarErrores, erroresRecientes, reporteErrores } from '../../src/app/errores';

describe('errores recientes de este equipo', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) });
    borrarErrores();
  });
  it('anota el último primero y cuenta los repetidos en lugar de llenar la lista', () => {
    anotarError(new Error('sin red'), 'sincronización');
    anotarError(new Error('sin red'), 'sincronización');
    anotarError(new Error('sin red'), 'sincronización');
    anotarError(new Error('pantalla rota'), '/caja');
    const e = erroresRecientes();
    expect(e.map((x) => x.mensaje)).toEqual(['pantalla rota', 'sin red']);
    expect(e[1].veces).toBe(3);
  });
  it('guarda solo los últimos 15 e ignora el aviso inofensivo de ResizeObserver', () => {
    for (let i = 0; i < 20; i++) anotarError(new Error(`e${i}`), 'x');
    anotarError(new Error('ResizeObserver loop completed with undelivered notifications.'), 'x');
    expect(erroresRecientes()).toHaveLength(15);
    expect(erroresRecientes()[0].mensaje).toBe('e19');
  });
  it('el reporte lleva versión, equipo y errores', () => {
    anotarError(new Error('falló'), '/entrada');
    const t = reporteErrores(erroresRecientes(), { version: '1.2.3', academia: 'Calo', nube: 'al día', equipo: 'Android · Chrome · instalada' });
    expect(t).toMatch(/^Compás v1\.2\.3 · Calo\nNube: al día · Android · Chrome · instalada/);
    expect(t).toMatch(/\/entrada: falló/);
  });
});
