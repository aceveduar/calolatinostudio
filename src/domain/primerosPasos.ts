/**
 * "Primeros pasos" de una academia nueva: lo que falta configurar, en orden, para empezar a cobrar.
 * Se palomea solo con lo que ya existe; la tarjeta desaparece cuando todo está listo (o si el dueño la oculta).
 */
export interface Paso {
  id: string;
  titulo: string;
  porque: string;
  ruta: string;
  hecho: boolean;
}

export interface EstadoAcademia {
  logo: boolean;
  clases: number;
  clasesSinMaestro: number;
  planesConPrecio: number;
  recepcion: number;
  alumnos: number;
  nube: boolean;
  pagina: boolean;
}

export function primerosPasos(e: EstadoAcademia): Paso[] {
  return [
    { id: 'clases', titulo: 'Clases y horarios', porque: 'Con ellas, Entrada sabe qué clase toca a cada hora.', ruta: '/ajustes/clases', hecho: e.clases > 0 },
    { id: 'planes', titulo: 'Planes y precios', porque: 'Clase suelta, mensualidades y paquetes.', ruta: '/ajustes/planes', hecho: e.planesConPrecio > 0 },
    { id: 'maestros', titulo: 'Maestros de cada clase', porque: 'Para ver cuánto deja cada maestro y que vean su lista.', ruta: '/ajustes/clases', hecho: e.clases > 0 && e.clasesSinMaestro === 0 },
    { id: 'usuarios', titulo: 'Usuario de recepción', porque: 'Para que recepción entre con su propio PIN.', ruta: '/ajustes/usuarios', hecho: e.recepcion > 0 },
    { id: 'alumnos', titulo: 'Tus alumnos', porque: 'Importa tu lista de Excel o se registran al llegar.', ruta: '/alumnos', hecho: e.alumnos > 0 },
    { id: 'academia', titulo: 'Logo y color', porque: 'Salen en el ticket, el portal y la página.', ruta: '/ajustes/academia', hecho: e.logo },
    { id: 'nube', titulo: 'Respaldo en la nube', porque: 'Que nada se pierda y usar varios teléfonos.', ruta: '/ajustes/nube', hecho: e.nube },
    { id: 'pagina', titulo: 'Página pública', porque: 'Para compartir en Facebook y recibir interesados.', ruta: '/ajustes/pagina', hecho: e.pagina },
  ];
}
