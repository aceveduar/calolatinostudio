import { describe, expect, it } from 'vitest';
import { arreglarNombre, arreglarTelefono, detectarColumnas, leerTexto, prepararFilas } from '../../src/domain/importar';

describe('importar alumnos', () => {
  it('lee lo pegado de Excel (tabuladores) y CSV con comillas y punto y coma', () => {
    expect(leerTexto('Nombre\tCelular\r\nAna López\t55 1234 5678\r\n\r\n')).toEqual([
      ['Nombre', 'Celular'],
      ['Ana López', '55 1234 5678'],
    ]);
    expect(leerTexto('\uFEFFnombre;tel\n"Pérez; Luis";"5512345678"\n"Dice ""hola""";1')).toEqual([
      ['nombre', 'tel'],
      ['Pérez; Luis', '5512345678'],
      ['Dice "hola"', '1'],
    ]);
  });

  it('detecta columnas por encabezado, con apellidos aparte', () => {
    const { columnas, conEncabezado } = detectarColumnas([['No.', 'Apellidos', 'Nombre(s)', 'WhatsApp', 'Comentarios']]);
    expect(conEncabezado).toBe(true);
    expect(columnas).toEqual({ nombre: 2, apellido: 1, telefono: 3, notas: 4 });
  });

  it('"Nombre completo" es el nombre, no el apellido', () => {
    expect(detectarColumnas([['Nombre y apellido', 'Tel']]).columnas).toMatchObject({ nombre: 0, apellido: null, telefono: 1 });
  });

  it('sin encabezado: adivina por el contenido', () => {
    const r = detectarColumnas([
      ['5512345678', 'Ana López'],
      ['5587654321', 'Luis Pérez'],
    ]);
    expect(r.conEncabezado).toBe(false);
    expect(r.columnas).toMatchObject({ nombre: 1, telefono: 0 });
  });

  it('limpia nombres y teléfonos', () => {
    expect(arreglarNombre('  JUAN  DE LA CRUZ ')).toBe('Juan de la Cruz');
    expect(arreglarNombre('maría josé')).toBe('María José');
    expect(arreglarNombre('McDonald López')).toBe('McDonald López');
    expect(arreglarTelefono('+52 1 55 1234 5678')).toBe('5512345678');
    expect(arreglarTelefono('52 (55) 1234-5678')).toBe('5512345678');
    expect(arreglarTelefono('5512345678.0')).toBe('5512345678');
  });

  it('se salta a quien ya está, repetidos y filas sin nombre; mismo teléfono con otro nombre sí entra', () => {
    const filas = [
      ['Nombre', 'Tel'],
      ['ana lópez', '5512345678'], // ya está (mismo nombre y teléfono, sin importar mayúsculas)
      ['Luis Pérez', '5512345678'], // familiar: mismo teléfono, otro nombre → nuevo
      ['Luis Pérez', '55 1234 5678'], // repetido en el archivo
      ['', '5599999999'], // sin nombre
      ['Sofía', '123'], // teléfono raro: se importa, marcado
    ];
    const { columnas, conEncabezado } = detectarColumnas(filas);
    const r = prepararFilas(filas, columnas, conEncabezado, [{ nombre: 'Ana López', telefono: '55-1234-5678' }]);
    expect(r.map((f) => f.estado)).toEqual(['ya-esta', 'nuevo', 'repetido', 'sin-nombre', 'nuevo']);
    expect(r[1]).toMatchObject({ nombre: 'Luis Pérez', telefono: '5512345678', telefonoRaro: false });
    expect(r[4].telefonoRaro).toBe(true);
  });
});
