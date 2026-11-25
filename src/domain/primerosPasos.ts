/**
 * Configuración básica de Entrada para una academia nueva.
 */
export interface Paso {
  id: string;
  titulo: string;
  porque: string;
  ruta: string;
  hecho: boolean;
}

export interface EstadoAcademia {
  clases: number;
  planesConPrecio: number;
}

export function primerosPasos(e: EstadoAcademia): Paso[] {
  return [
    { id: 'clases', titulo: 'Clases y horarios', porque: 'Con ellas, Entrada sabe qué clase toca a cada hora.', ruta: '/ajustes/clases', hecho: e.clases > 0 },
    { id: 'planes', titulo: 'Planes y precios', porque: 'Clase suelta, mensualidades y paquetes.', ruta: '/ajustes/planes', hecho: e.planesConPrecio > 0 },
  ];
}
