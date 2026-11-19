import { describe, expect, it } from 'vitest';
import { enlaceInvitacion, huellaValida, leerHuella, mensajeInvitacion, textoInvitados } from '../../src/domain/invitar';

describe('invitar a un amigo', () => {
  it('solo acepta huellas de 8 caracteres hexadecimales', () => {
    expect(huellaValida('a1b2c3d4')).toBe(true);
    for (const x of ['', 'a1b2c3d', 'a1b2c3d4e', 'K7P2QXAB', "'; drop--", null, undefined]) expect(huellaValida(x)).toBe(false);
  });
  it('lee la huella de la dirección, o nada si no es válida', () => {
    expect(leerHuella('?de=A1B2C3D4')).toBe('a1b2c3d4');
    expect(leerHuella('?de=<script>')).toBeNull();
    expect(leerHuella('')).toBeNull();
  });
  it('arma el enlace y el mensaje', () => {
    const url = enlaceInvitacion('https://calo.pages.dev', 'calo-latino', 'a1b2c3d4');
    expect(url).toBe('https://calo.pages.dev/a/calo-latino?de=a1b2c3d4');
    expect(mensajeInvitacion('Calo Latino Studio', url)).toMatch(/Calo Latino Studio.*\?de=a1b2c3d4$/);
  });
  it('cuántos invitó y cuántos se inscribieron', () => {
    expect(textoInvitados(0, 0)).toBeNull();
    expect(textoInvitados(1, 0)).toBe('Has invitado a 1 amigo');
    expect(textoInvitados(3, 1)).toBe('Has invitado a 3 amigos · 1 ya se inscribió 🎉');
  });
});
