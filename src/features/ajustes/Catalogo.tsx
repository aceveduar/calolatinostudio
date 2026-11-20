import { useState, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Boton, Hoja, Tarjeta } from '../../components/ui';
import { type ID } from '../../db/types';

/** Lista + hoja de edición: patrón común de todos los catálogos. */
export function Catalogo<T extends { id: ID }>({
  items,
  fila,
  titulo,
  form,
  textoNuevo,
  vacio,
  arriba,
}: {
  items: T[];
  fila: (x: T) => ReactNode;
  titulo: (x: T | null) => string;
  form: (x: T | null, cerrar: () => void) => ReactNode;
  textoNuevo: string;
  /** qué decir cuando aún no hay ninguno (en vez de una caja vacía) */
  vacio?: string;
  /** barra propia de arriba (recibe con qué abrir "Nuevo…"); si no hay, con más de 6 se repite el botón arriba */
  arriba?: (nuevo: () => void) => ReactNode;
}) {
  const [sel, setSel] = useState<T | null | 'nuevo'>(null);
  const cerrar = () => setSel(null);
  const actual = sel === 'nuevo' ? null : sel;
  const botonNuevo = (clase: string) => (
    <Boton bloque variante="secundario" className={clase} onClick={() => setSel('nuevo')}>
      <Plus size={18} /> {textoNuevo}
    </Boton>
  );
  return (
    <>
      {/* con muchos (la tienda, las clases) el botón de abajo quedaba lejísimos: también va arriba */}
      {arriba ? arriba(() => setSel('nuevo')) : items.length > 6 && botonNuevo('mb-3')}
      {items.length === 0 ? (
        vacio && <p className="rounded-2xl bg-superficie px-4 py-5 text-center text-sm text-ink-500 ring-1 ring-ink-100">{vacio}</p>
      ) : (
        <Tarjeta className="divide-y divide-ink-100">
          {items.map((x) => (
            <button key={x.id} onClick={() => setSel(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
              {fila(x)}
              {/* que se note que se puede tocar para editar */}
              <ChevronRight size={18} className="shrink-0 text-ink-300" aria-hidden="true" />
            </button>
          ))}
        </Tarjeta>
      )}
      {botonNuevo('mt-3')}
      <Hoja abierta={sel !== null} onCerrar={cerrar} titulo={sel !== null ? titulo(actual) : ''}>
        {sel !== null && form(actual, cerrar)}
      </Hoja>
    </>
  );
}

export const NUEVO = '__nuevo__';
