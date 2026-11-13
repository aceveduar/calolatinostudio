import type { Academia } from '../db/types';
import { Logo } from './Logo';

/** El logo de la academia si subió uno; si no, el de Compás. */
export function LogoAcademia({ academia, tam = 40 }: { academia: Pick<Academia, 'logo' | 'nombre'>; tam?: number }) {
  if (!academia.logo) return <Logo tam={tam} />;
  return <img src={academia.logo} alt={academia.nombre} width={tam} height={tam} className="shrink-0 object-contain" style={{ width: tam, height: tam }} />;
}

/** Reduce una imagen subida a ≤ max px y la devuelve como data URL (PNG si tiene transparencia). */
export async function prepararLogo(archivo: File, max = 256): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (PNG o JPG).');
  const bmp = await createImageBitmap(archivo);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * escala);
  lienzo.height = Math.round(bmp.height * escala);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  const tipo = archivo.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return lienzo.toDataURL(tipo, 0.9);
}
