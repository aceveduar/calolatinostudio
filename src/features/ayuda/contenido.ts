/**
 * Manual "Cómo se usa": temas cortos, de lo más importante (lo de todos los días) a lo menos.
 * Cada tema: para quién es, un resumen de una línea, 3–5 pasos y, si ayuda, un consejo y una captura
 * (public/ayuda/<imagen>.jpg, las genera tools/capturas-manual.mjs).
 * Los nombres de botones van tal cual aparecen en la app, para que se puedan encontrar.
 */
import type { Rol } from '../../db/types';

export interface Tema {
  id: string;
  titulo: string;
  resumen: string;
  pasos: string[];
  consejo?: string;
  imagen?: string;
  para: Rol[];
  /** palabras extra para el buscador */
  claves?: string;
}

export interface Capitulo {
  id: string;
  titulo: string;
  emoji: string;
  temas: Tema[];
}

const RECEPCION: Rol[] = ['dueno', 'recepcion'];
const DUENO: Rol[] = ['dueno'];
const MAESTRO: Rol[] = ['maestro'];

export const MANUAL: Capitulo[] = [
  {
    id: 'diario',
    titulo: 'Lo de todos los días',
    emoji: '💃',
    temas: [
      {
        id: 'entrada',
        titulo: 'Dar entrada y cobrar',
        resumen: 'Cuando llega un alumno: un toque y listo.',
        imagen: 'entrada',
        para: RECEPCION,
        claves: 'cobrar clase suelta llegó asistencia',
        pasos: [
          'En Entrada ya está la clase de la hora (la tarjeta de color). Si es otra, tócala y elige.',
          'Toca la tarjeta del alumno. Si tiene plan o beca, entra sin cobrar y la cuenta se cierra sola en un par de segundos.',
          'Si no tiene plan, la clase se suma a la cuenta de abajo.',
          'Si te pagan en efectivo, toca el billete con que te pagan ($200, $500…) y la app te dice el cambio.',
          'Toca "Listo". Si fue por transferencia, toca "Fue transferencia" antes.',
        ],
        consejo: 'Si te equivocaste, el aviso de abajo tiene "Deshacer" por unos segundos.',
      },
      {
        id: 'varios',
        titulo: 'Cobrar a varios juntos',
        resumen: 'Una pareja o una familia que paga junta.',
        para: RECEPCION,
        claves: 'pareja familia cuenta juntos',
        pasos: ['Toca a cada uno: todos se van sumando en la misma cuenta.', 'Abajo ves "Pagan juntos" y el total.', 'Cobra una sola vez y toca "Listo".'],
        consejo: 'Para quitar a alguien de la cuenta, toca la ✕ junto a su nombre.',
      },
      {
        id: 'buscar',
        titulo: 'Buscar o escanear a alguien',
        resumen: 'Si no lo ves en la cuadrícula.',
        para: RECEPCION,
        claves: 'qr credencial buscar nombre teléfono escáner',
        pasos: ['Escribe su nombre o teléfono en "Buscar…" (en computadora, solo empieza a escribir).', 'O toca el botón del escáner y apunta a su QR (el de su credencial o su portal).', 'Si no existe, toca "Nuevo: …" para darlo de alta ahí mismo.'],
      },
      {
        id: 'visitante',
        titulo: 'Alguien que viene por primera vez',
        resumen: 'Sin registrarlo: "+$60 sin nombre".',
        para: RECEPCION,
        claves: 'visitante prueba nuevo sin nombre',
        pasos: ['Toca "+$60 sin nombre" (el precio es el de tu clase suelta).', 'Si quieres anotar su nombre, toca "Visitante con nombre".', 'Cobra y toca "Listo".'],
      },
      {
        id: 'plan',
        titulo: 'Vender un plan (mensualidad o paquete)',
        resumen: 'Desde la ficha del alumno.',
        imagen: 'vender',
        para: RECEPCION,
        claves: 'mensualidad paquete renovar plan vender',
        pasos: ['Abre su ficha (desde Alumnos o tocando su nombre).', 'Toca "Vender plan" y elige el plan.', 'Revisa el monto y cómo pagó, y toca "Cobrar".', 'En el aviso toca "Enviar ticket" para mandarle su ticket por WhatsApp.'],
        consejo: 'Si vendiste el plan equivocado, tócalo en su ficha para anularlo y vende el correcto.',
      },
      {
        id: 'ticket',
        titulo: 'Mandar el ticket de compra',
        resumen: 'Una imagen tipo ticket, con sello "PAGADO".',
        imagen: 'ticket',
        para: RECEPCION,
        claves: 'recibo comprobante ticket imagen',
        pasos: ['Al cobrar un plan, toca "Enviar ticket" en el aviso.', 'En el celular se abre el menú de compartir: elige WhatsApp y el chat.', 'En computadora se descarga la imagen y se abre su chat: arrástrala ahí.'],
        consejo: '"Solo mensaje" manda el recibo en texto, sin imagen.',
      },
      {
        id: 'corte',
        titulo: 'Corte de caja',
        resumen: 'Al cerrar: cuánto debe haber en el cajón.',
        imagen: 'corte',
        para: RECEPCION,
        claves: 'corte caja cierre feria fondo efectivo cuadrar',
        pasos: ['En Caja, toca "Hacer corte de caja".', 'Revisa la feria con la que abriste (se llena sola con la del último corte).', 'Escribe cuánto efectivo hay, o toca "Contar billete por billete".', 'Si falta dinero, escribe qué pasó. Toca "Guardar corte".'],
        consejo: 'Te dice cuánto guardar y cuánto dejar de feria para mañana.',
      },
      {
        id: 'salida',
        titulo: 'Sacar dinero del cajón',
        resumen: 'El garrafón, un pago a un maestro…',
        para: RECEPCION,
        claves: 'salida gasto efectivo garrafón pago maestro',
        pasos: ['En Caja, toca "Registrar salida de efectivo".', 'Escribe para qué fue y cuánto.', 'Toca "Registrar salida". Se descuenta solo en el corte y queda en Gastos.'],
      },
      {
        id: 'tienda',
        titulo: 'Vender algo de la tienda',
        resumen: 'Agua, snacks, playeras… en la misma cuenta.',
        para: RECEPCION,
        claves: 'tienda producto agua vender snack',
        pasos: ['En Entrada, toca el botón de la bolsita (Tienda).', 'Elige el producto (o escanea su código de barras).', 'Se suma a la cuenta: cobra junto con la clase.'],
      },
    ],
  },
  {
    id: 'alumnos',
    titulo: 'Alumnos',
    emoji: '🙋',
    temas: [
      {
        id: 'alta',
        titulo: 'Dar de alta a un alumno',
        resumen: 'Nombre y WhatsApp; lo demás es opcional.',
        para: RECEPCION,
        claves: 'nuevo alta registrar alumno',
        pasos: ['En Alumnos, toca "Nuevo".', 'Escribe su nombre completo y su WhatsApp.', 'Toca "Registrar alumno".'],
        consejo: 'Si el teléfono ya lo tiene alguien, te avisa: puede ser un familiar (está bien) o la misma persona registrada dos veces.',
      },
      {
        id: 'importar',
        titulo: 'Importar tu lista de Excel',
        resumen: 'Todos tus alumnos de una vez, sin capturarlos.',
        para: DUENO,
        claves: 'importar excel csv google sheets lista subir masivo',
        pasos: [
          'En Alumnos, hasta abajo, toca "Importar alumnos de Excel".',
          'Toca "Elegir archivo" (Excel o CSV), o copia las celdas en Excel y pégalas.',
          'Revisa qué columna es el nombre y cuál el WhatsApp, y cómo quedaría la lista.',
          'Toca "Importar". Los que ya estaban registrados se saltan solos.',
        ],
        consejo: 'Nadie recibe mensajes. Si algo salió mal, al terminar toca "Deshacer la importación".',
      },
      {
        id: 'ficha',
        titulo: 'La ficha del alumno',
        resumen: 'Su plan, sus clases, sus pagos y sus botones.',
        imagen: 'ficha',
        para: RECEPCION,
        claves: 'ficha alumno plan pagos historial',
        pasos: ['Arriba ves si su plan está vigente o por vencer.', '"Vender plan" para renovar; "Credencial con QR" para su credencial.', '"WhatsApp" para mandarle mensajes listos (recordatorio, su portal, etc.).', 'Abajo: sus últimas clases y sus pagos.'],
      },
      {
        id: 'portal',
        titulo: 'Mandarle su portal',
        resumen: 'Su pase con QR, su plan y sus clases, en su celular.',
        para: RECEPCION,
        claves: 'portal enlace pase qr alumno app',
        pasos: ['En su ficha, toca "WhatsApp".', 'Toca "Su portal": se abre WhatsApp con su enlace.', 'Desde su portal puede poner su foto, ver eventos, apartar en la tienda e invitar amigos.'],
        consejo: 'El enlace es solo suyo. Si se compartió por error, en la misma hoja toca "Crear uno nuevo".',
      },
      {
        id: 'archivados',
        titulo: 'Alumnos archivados',
        resumen: 'Los que ya no vienen se apartan solos.',
        para: RECEPCION,
        claves: 'archivado archivados no viene inactivo baja regresó',
        pasos: [
          'Quien no viene hace 6 meses y no tiene plan se archiva solo: ya no estorba en la lista.',
          'Para verlos, al final de Alumnos toca "Ver archivados".',
          'Si buscas su nombre, sale aunque esté archivado. En cuanto vuelve a entrar, regresa solo a la lista.',
        ],
        consejo: 'Archivar no borra nada: conserva su ficha y todo su historial. "Dar de baja" es otra cosa: lo decides tú.',
      },
      {
        id: 'borrar-datos',
        titulo: 'Si un alumno pide borrar sus datos',
        resumen: 'Se quitan su nombre, teléfono y foto; los cobros se quedan.',
        para: DUENO,
        claves: 'borrar datos personales privacidad anonimizar eliminar',
        pasos: [
          'Abre su ficha y, hasta abajo, toca "Borrar sus datos personales".',
          'Escribe BORRAR para confirmar y toca "Borrar sus datos".',
          'Queda como "Alumno anónimo": sus pagos y entradas siguen contando en tus reportes y tu caja.',
        ],
        consejo: 'No se puede deshacer. Hazlo solo si el alumno lo pide (así lo dice tu aviso de privacidad).',
      },
      {
        id: 'pendientes',
        titulo: 'A quién escribir hoy',
        resumen: 'Planes por vencer, quien debe clases, rentas por cobrar.',
        imagen: 'pendientes',
        para: RECEPCION,
        claves: 'pendientes vence debe recordatorio',
        pasos: ['Toca el botón de pendientes (arriba en Entrada) o Más → Pendientes.', 'Toca el botón verde de WhatsApp: el mensaje ya va escrito.', 'Toca ✓ cuando ya le avisaste.'],
      },
    ],
  },
  {
    id: 'dueno',
    titulo: 'Para el dueño',
    emoji: '📊',
    temas: [
      {
        id: 'primeros-pasos',
        titulo: 'Dejar lista la academia',
        resumen: 'La tarjeta "Deja lista tu academia" en Entrada.',
        para: DUENO,
        claves: 'primeros pasos empezar configurar nueva academia',
        pasos: [
          'En Entrada verás cuántos pasos llevas y cuál sigue: tócalo y te lleva ahí.',
          'Cada paso se palomea solo cuando lo terminas (logo, clases, precios, recepción, nube…).',
          'Al terminar todo, la tarjeta desaparece. Si quieres quitarla antes, toca la ✕.',
        ],
      },
      {
        id: 'reportes',
        titulo: 'Reportes: ¿cómo vamos?',
        resumen: 'Ingresos, alumnos y a quién atender.',
        imagen: 'reportes',
        para: DUENO,
        claves: 'reportes ingresos estadísticas',
        pasos: ['Arriba: ingresos, asistencias, alumnos y nuevos, comparados con el periodo anterior.', 'Luego lo que hay que atender: quién vence esta semana y quién dejó de venir.', 'Más abajo: por sede, por clase, por maestro, tienda y los últimos 12 meses.'],
        consejo: 'Cambia entre "Últimos 7 días" y "30 días" arriba.',
      },
      {
        id: 'gastos',
        titulo: 'Gastos y utilidad',
        resumen: 'Cuánto te queda en el mes.',
        para: DUENO,
        claves: 'gastos utilidad renta luz',
        pasos: ['Más → Gastos y utilidad.', 'Toca "Registrar gasto" para la renta, la luz o el pago a maestros.', 'Los gastos fijos (renta, internet) te recuerdan cuáles faltan en el mes.'],
      },
      {
        id: 'planes-precios',
        titulo: 'Planes y precios',
        resumen: 'Clase suelta, mensualidades y paquetes.',
        para: DUENO,
        claves: 'planes precios mensualidad paquete',
        pasos: ['Más → Planes y precios.', 'Toca un plan para cambiar su precio, o agrega uno nuevo.', 'Un plan "de 1 grupo" cubre solo la clase que elija al pagar; uno "ilimitado", todas.'],
      },
      {
        id: 'clases',
        titulo: 'Clases, horarios y maestros',
        resumen: 'Qué se da, cuándo y con quién.',
        para: DUENO,
        claves: 'clases horario maestro sede',
        pasos: ['Más → Clases y horarios: días, hora, sede y maestro de cada clase.', 'Más → Maestros: sus datos; para que vean su lista, dales usuario en "Usuarios y PIN".', 'Con eso, Entrada sabe sola qué clase toca a cada hora.'],
      },
    ],
  },
  {
    id: 'crecer',
    titulo: 'Para crecer',
    emoji: '🚀',
    temas: [
      {
        id: 'pagina',
        titulo: 'Tu página pública',
        resumen: 'Para compartir en Facebook e Instagram.',
        para: DUENO,
        claves: 'página web facebook anuncios',
        pasos: ['Más → Página pública: escribe tu frase, sube tu portada y fotos.', 'Horarios, precios y eventos salen solos de la app.', 'Copia el enlace y compártelo. Revisa el aviso de privacidad.'],
        consejo: 'En anuncios usa ?utm_source=facebook&utm_campaign=nombre al final del enlace: sabrás qué anuncio trajo a cada interesado.',
      },
      {
        id: 'interesados',
        titulo: 'Interesados',
        resumen: 'Quien se inscribió desde la página.',
        para: RECEPCION,
        claves: 'interesados prospectos inscripción',
        pasos: ['Más → Interesados (o el aviso en Alumnos).', 'Toca el botón verde para escribirle por WhatsApp.', 'Cuando venga, toca el botón de alta para pasarlo a alumno.'],
      },
      {
        id: 'eventos',
        titulo: 'Eventos y boletos',
        resumen: 'Socials, talleres, fiestas.',
        para: RECEPCION,
        claves: 'evento social boleto fiesta taller',
        pasos: ['Más → Eventos → "Nuevo" (solo el dueño crea eventos).', 'Decide si se anuncia en la página y en el portal de los alumnos.', 'Toca el evento y "Vender boleto"; en la puerta, escanea o marca la entrada.'],
      },
      {
        id: 'encargos',
        titulo: 'Tienda en línea y encargos',
        resumen: 'Lo que los alumnos apartan desde su portal.',
        para: RECEPCION,
        claves: 'apartado encargo proveedor pedido tienda',
        pasos: ['Lo apartado aparece en Pendientes y en Más → Encargos.', 'Lo que se pide al proveedor: "Ya se los pedí al proveedor"; al llegar, "Llegó".', 'Se cobra en Entrada cuando lo recogen.'],
      },
      {
        id: 'testimonios',
        titulo: 'Testimonios',
        resumen: 'Lo que escriben los alumnos, para tu página.',
        para: RECEPCION,
        claves: 'testimonio reseña opinión',
        pasos: ['Más → Testimonios.', 'Léelo y toca "Publicar" o "No publicar".', 'En la página aparece con su nombre y la inicial del apellido.'],
      },
    ],
  },
  {
    id: 'maestro',
    titulo: 'Para maestros',
    emoji: '🎓',
    temas: [
      {
        id: 'mi-clase',
        titulo: 'Tu lista en vivo',
        resumen: 'Quién llegó a tu clase, en orden.',
        para: MAESTRO,
        claves: 'lista clase maestro',
        pasos: ['Al entrar ves tu clase de la hora y quién va llegando.', 'Los marcados vienen por primera vez: dales la bienvenida.', 'Si hoy das varias, toca "Otra clase" en la tarjeta.'],
        consejo: 'La lista se actualiza sola cada minuto, o toca "Actualizar".',
      },
    ],
  },
  {
    id: 'ajustes',
    titulo: 'Configuración y ayuda',
    emoji: '⚙️',
    temas: [
      {
        id: 'usuarios',
        titulo: 'Usuarios y PIN',
        resumen: 'Quién entra a la app y qué ve.',
        para: DUENO,
        claves: 'usuario pin contraseña recepción maestro',
        pasos: ['Más → Usuarios y PIN.', 'Recepción cobra y da entrada; el dueño ve todo; el maestro solo su lista.', 'Si alguien olvida su PIN, el dueño lo cambia aquí.'],
      },
      {
        id: 'nube',
        titulo: 'Nube, respaldo y otro teléfono',
        resumen: 'Que nada se pierda, aunque se rompa un celular.',
        para: RECEPCION,
        claves: 'nube respaldo sincronizar teléfono nuevo',
        pasos: ['Abajo a la izquierda (o arriba en el celular) ves si está "Respaldado".', 'Para otro teléfono: abre la app, "Conectar a mi academia" con el correo de la academia.', 'Más → Nube y respaldo → "Descargar respaldo" para guardar una copia en archivo.'],
        consejo: 'La app funciona sin internet. En el teléfono quedan las entradas y cobros de los últimos 18 meses, para que no se llene; todo lo anterior está guardado en la nube.',
      },
      {
        id: 'seguridad',
        titulo: 'Se perdió un teléfono o alguien dejó de trabajar aquí',
        resumen: 'Cierra la sesión en todos los equipos.',
        para: DUENO,
        claves: 'seguridad robo perdido teléfono cerrar sesión empleado contraseña',
        pasos: [
          'Más → Nube y respaldo → "Cerrar sesión en todos los equipos" y confirma.',
          'Todos los equipos dejan de respaldar, también este. Lo guardado en cada uno no se pierde.',
          'Cambia la contraseña de la academia si alguien más la sabía, y el PIN de quien se fue (Usuarios y PIN).',
          'Vuelve a conectar los equipos buenos con el correo y la nueva contraseña.',
        ],
      },
      {
        id: 'falla',
        titulo: 'Si algo no funciona',
        resumen: 'Manda un reporte a soporte en un toque.',
        para: RECEPCION,
        claves: 'error falla soporte ayuda problema',
        pasos: ['Más → Ayuda y errores.', 'Toca "Mandar a soporte por WhatsApp".', 'Si la app se ve vieja, ciérrala por completo y ábrela: se actualiza sola.'],
      },
    ],
  },
];

/** Los temas que le tocan a un rol, en orden; y una búsqueda que ignora acentos y mayúsculas. */
const sinAcentos = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function manualPara(rol: Rol, busqueda = ''): Capitulo[] {
  const q = sinAcentos(busqueda.trim());
  return MANUAL.map((c) => ({
    ...c,
    temas: c.temas.filter((t) => t.para.includes(rol) && (!q || sinAcentos([t.titulo, t.resumen, t.claves ?? '', ...t.pasos].join(' ')).includes(q))),
  })).filter((c) => c.temas.length > 0);
}
