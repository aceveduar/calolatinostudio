import { DIAS_CORTOS } from '../../domain/fechas';
import { estadoCurso } from '../../domain/cursos';

export const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const SEMANA = [1, 2, 3, 4, 5, 6, 0];

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const horaFin = (h: string, min: number) => {
  const t = Number(h.slice(0, 2)) * 60 + Number(h.slice(3)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** La disciplina de una clase (la manda la base; si es una base vieja, la primera palabra del nombre). */
export const disciplinaDe = (c: { clase: string; disciplina?: string | null }) => c.disciplina || c.clase.split(' ')[0];

export const diasTexto = (dias: number[]) => SEMANA.filter((x) => dias.includes(x)).map((x) => DIAS_CORTOS[x]).join(' · ');

export const DESDE_CERO = /\b(0|b[aá]sico|principiantes?|inicial|desde cero)\b/i;

export type Estados = Map<string, ReturnType<typeof estadoCurso>>;

export const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));

export const enCuanto = (m: number) => (m < 60 ? `En ${m} min` : m < 120 ? 'En 1 h' : `En ${Math.round(m / 60)} h`);
