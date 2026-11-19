import { describe, expect, it } from 'vitest';
import { origenVisita } from '../../src/domain/origen';
import { avisoPrivacidadBase, textoAvisoPrivacidad } from '../../src/domain/privacidad';

describe('de dónde llegó quien se inscribe', () => {
  const H = 'calolatinostudio.pages.dev';
  it('anuncios con etiquetas utm', () => {
    expect(origenVisita('?utm_source=Facebook&utm_campaign=Navidad%202026', '', H)).toBe('facebook · navidad 2026');
    expect(origenVisita('?utm_source=instagram', '', H)).toBe('instagram');
  });
  it('identificadores de anuncios de Facebook, Google y TikTok', () => {
    expect(origenVisita('?fbclid=abc', '', H)).toBe('facebook · anuncio o publicación');
    expect(origenVisita('?gclid=x', '', H)).toBe('google · anuncio');
    expect(origenVisita('?ttclid=x', '', H)).toBe('tiktok · anuncio');
  });
  it('por la página de donde viene', () => {
    expect(origenVisita('', 'https://l.facebook.com/l.php?u=x', H)).toBe('facebook');
    expect(origenVisita('', 'https://www.instagram.com/', H)).toBe('instagram');
    expect(origenVisita('', 'https://www.google.com.mx/', H)).toBe('google');
    expect(origenVisita('', 'https://wa.me/', H)).toBe('whatsapp');
    expect(origenVisita('', `https://${H}/a/calo-latino`, H)).toBeNull();
    expect(origenVisita('', '', H)).toBeNull();
  });
  it('no deja pasar texto raro', () => {
    expect(origenVisita('?utm_source=<script>alert(1)</script>', '', H)).toBe('scriptalert1script');
  });
});

describe('aviso de privacidad', () => {
  it('la base lleva el nombre, la dirección y cómo ejercer los derechos', () => {
    const t = avisoPrivacidadBase({ academia: 'Calo Latino Studio', direccion: 'Av. Juárez 10', whatsapp: '5512345678' });
    expect(t).toMatch(/^Calo Latino Studio, con domicilio en Av\. Juárez 10, es responsable/);
    expect(t).toMatch(/derechos ARCO/);
    expect(t).toMatch(/WhatsApp al 5512345678/);
  });
  it('si la academia escribió el suyo, se usa el suyo', () => {
    expect(textoAvisoPrivacidad('  Mi aviso  ', { academia: 'X' })).toBe('Mi aviso');
    expect(textoAvisoPrivacidad('', { academia: 'X' })).toMatch(/^X es responsable/);
  });
});
