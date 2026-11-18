import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Boton, Hoja, Tarjeta } from '../../components/ui';
import { type ID } from '../../db/types';

/** Lista + hoja de edición: patrón común de todos los catálogos. */
export function Catalogo<T extends { id: ID }>({
  items,
  fila,
  titulo,
  form,
  textoNuevo,
}: {
  items: T[];
  fila: (x: T) => ReactNode;
  titulo: (x: T | null) => string;
  form: (x: T | null, cerrar: () => void) => ReactNode;
  textoNuevo: string;
}) {
  const [sel, setSel] = useState<T | null | 'nuevo'>(null);
  const cerrar = () => setSel(null);
  const actual = sel === 'nuevo' ? null : sel;
  return (
    <>
      <Tarjeta className="divide-y divide-ink-100">
        {items.map((x) => (
          <button key={x.id} onClick={() => setSel(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-ink-50">
            {fila(x)}
          </button>
        ))}
      </Tarjeta>
      <Boton bloque variante="secundario" className="mt-3" onClick={() => setSel('nuevo')}>
        <Plus size={18} /> {textoNuevo}
      </Boton>
      <Hoja abierta={sel !== null} onCerrar={cerrar} titulo={sel !== null ? titulo(actual) : ''}>
        {sel !== null && form(actual, cerrar)}
      </Hoja>
    </>
  );
}

export const NUEVO = '__nuevo__';
