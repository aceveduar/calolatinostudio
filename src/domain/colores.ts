/** Colores para disciplinas: contrastan con texto blanco y se distinguen entre sí. */
export const COLORES = ['#e8445a', '#7c4ddb', '#1f8fd6', '#15924b', '#d97706', '#db2777', '#0d9488', '#3d3a48'];

/** El primer color que ninguna disciplina usa (así cada una se distingue sin pensarlo). */
export const colorLibre = (usados: string[]) => COLORES.find((c) => !usados.includes(c)) ?? COLORES[0];
