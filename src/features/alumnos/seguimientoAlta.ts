import { useEffect, useState } from 'react';
import { supabase } from '../../sync/supabase';

export interface Campana {
  token: string;
  vence: string;
  altas: number;
  abierta: boolean;
  recientes?: { id: string; nombre: string; alta: number }[] | null;
}

const clave = (academia: string, usuario: string) => `compas:altas-vistas:${academia}:${usuario}`;

export function altasNuevas(campana: Campana, academia: string, usuario: string) {
  try {
    const anterior = localStorage.getItem(clave(academia, usuario))?.split(':');
    const vistas = Number(anterior?.[1]);
    if (anterior?.[0] === campana.token && Number.isSafeInteger(vistas) && vistas >= 0) {
      return Math.max(0, campana.altas - vistas);
    }
  } catch {
    // El conteo de la campaña sigue disponible si el navegador bloquea el almacenamiento.
  }
  return campana.altas;
}

export function marcarAltasVistas(campana: Campana, academia: string, usuario: string) {
  try {
    localStorage.setItem(clave(academia, usuario), `${campana.token}:${campana.altas}`);
    return true;
  } catch {
    return false;
  }
}

export function useAltasNuevas(academia: string, usuario: string) {
  const [nuevas, setNuevas] = useState(0);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente) return;
    let pendiente: AbortController | undefined;
    const consultar = async () => {
      if (pendiente || document.visibilityState !== 'visible' || !navigator.onLine) return;
      const control = new AbortController();
      pendiente = control;
      const limite = setTimeout(() => control.abort(), 12_000);
      try {
        const { data, error } = await cliente.rpc('gestionar_alta_grupal', { p_academia: academia, p_accion: 'conteo' })
          .abortSignal(control.signal);
        if (control.signal.aborted || error) return;
        const campana = data as Campana | null;
        setNuevas(campana ? altasNuevas(campana, academia, usuario) : 0);
      } catch {
        // Un fallo transitorio conserva el último aviso visible.
      } finally {
        clearTimeout(limite);
        pendiente = undefined;
      }
    };
    void consultar();
    const intervalo = setInterval(() => void consultar(), 60_000);
    const alVolver = () => void consultar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      pendiente?.abort();
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [academia, usuario]);

  return nuevas;
}
