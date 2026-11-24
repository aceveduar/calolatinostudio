import { useState } from 'react';
import { cx } from './ui';

/** Foto del producto con un fondo neutro cuando no está disponible. */
export function ImagenProducto({ foto, tam = 40, ajustar = false, className }: { foto?: string | null; tam?: number | 'tarjeta'; ajustar?: boolean; className?: string }) {
  const [fotoFallida, setFotoFallida] = useState<string>();
  const cuadro = cx('shrink-0 rounded-xl', tam === 'tarjeta' && 'aspect-[4/3] w-full', className);
  const medida = typeof tam === 'number' ? tam : undefined;
  const estilo = medida === undefined ? undefined : { width: medida, height: medida };
  if (foto && foto !== fotoFallida)
    return <img src={foto} alt="" width={medida} height={medida} loading="lazy" onError={() => setFotoFallida(foto)} className={cx(cuadro, ajustar ? 'object-contain' : 'object-cover')} style={estilo} />;
  return (
    <span className={cx(cuadro, 'flex items-center justify-center bg-ink-100 px-1 text-center font-medium leading-tight text-ink-500', medida && medida < 65 ? 'text-[10px]' : 'text-xs')} style={estilo} aria-hidden="true">
      Sin foto
    </span>
  );
}
