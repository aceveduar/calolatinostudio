/**
 * Foto del alumno: recorte cuadrado al centro y reducida (200 px, JPEG) para que pese ~10 KB
 * y se pueda guardar y sincronizar sin problema aun con cientos de alumnos.
 */
export async function prepararFoto(archivo: File, lado = 200, maximo = 60_000): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.');
  const bmp = await createImageBitmap(archivo);
  const corte = Math.min(bmp.width, bmp.height);
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = lado;
  const g = lienzo.getContext('2d')!;
  g.drawImage(bmp, (bmp.width - corte) / 2, (bmp.height - corte) / 2, corte, corte, 0, 0, lado, lado);
  bmp.close();
  // baja la calidad si aún pesa mucho (fotos con mucho detalle)
  for (const q of [0.78, 0.65, 0.5]) {
    const url = lienzo.toDataURL('image/jpeg', q);
    if (url.length < maximo) return url;
  }
  return lienzo.toDataURL('image/jpeg', 0.4);
}

/**
 * La foto más ligera que quepa en `maximo`: WebP (~30 % menos que JPEG a la misma calidad) si el navegador
 * sabe generarlo; si no (Safari en iPhone), JPEG. Todos los navegadores actuales muestran ambos.
 */
function comprimir(lienzo: HTMLCanvasElement, calidades: number[], maximo: number): string {
  const webp = lienzo.toDataURL('image/webp', calidades[0]).startsWith('data:image/webp');
  const tipo = webp ? 'image/webp' : 'image/jpeg';
  for (const q of calidades) {
    const url = lienzo.toDataURL(tipo, q);
    if (url.length < maximo) return url;
  }
  return lienzo.toDataURL(tipo, 0.4);
}

/**
 * Foto de portada de la página pública: horizontal (recorte 16:10 al centro si viene vertical),
 * máximo 1280 px de ancho y ~140 KB (WebP), para que cargue rápido en el celular.
 */
export async function prepararPortada(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.');
  const bmp = await createImageBitmap(archivo);
  // nunca más alta que 16:10 (en el celular se ve como banda ancha)
  const alto = Math.min(bmp.height, Math.round((bmp.width * 10) / 16));
  const ancho = Math.min(1280, bmp.width);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = Math.round((alto * ancho) / bmp.width);
  lienzo.getContext('2d')!.drawImage(bmp, 0, (bmp.height - alto) / 2, bmp.width, alto, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  // es lo primero que carga la página: con WebP baja a ~140 KB (antes ~200 KB en JPEG)
  return comprimir(lienzo, [0.78, 0.7, 0.6, 0.5], 200_000);
}

/** Flyer o foto de un evento: sin recortar (un flyer trae texto), máximo 1080 px y ~180 KB (WebP). */
export async function prepararFlyer(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen.');
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, 1080 / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  return comprimir(lienzo, [0.8, 0.7, 0.6, 0.5], 180_000);
}

/** Foto para la galería de la página: sin recortar, máximo 900 px y ~80 KB (WebP). */
export async function prepararFotoGaleria(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una foto.');
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close();
  return comprimir(lienzo, [0.76, 0.66, 0.56, 0.5], 110_000);
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
