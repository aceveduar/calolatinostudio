import { cx } from './ui';

/** Foto del producto si la tiene; si no, su ícono. Cuadrada, del tamaño indicado (px). */
export function ImagenProducto({ foto, emoji, tam = 40, className }: { foto?: string | null; emoji?: string | null; tam?: number; className?: string }) {
  if (foto)
    return <img src={foto} alt="" width={tam} height={tam} loading="lazy" className={cx('shrink-0 rounded-xl object-cover', className)} style={{ width: tam, height: tam }} />;
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-xl bg-ink-50 leading-none', className)} style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.6) }} aria-hidden="true">
      {emoji ?? '🛍️'}
    </span>
  );
}
