import type { Academia } from '../db/types';
import { Logo } from './Logo';

/** El logo de la academia si subió uno; si no, el de Compás. */
export function LogoAcademia({ academia, tam = 40 }: { academia: Pick<Academia, 'logo' | 'nombre'>; tam?: number }) {
  if (!academia.logo) return <Logo tam={tam} />;
  return <img src={academia.logo} alt={academia.nombre} width={tam} height={tam} className="shrink-0 object-contain" style={{ width: tam, height: tam }} />;
}

