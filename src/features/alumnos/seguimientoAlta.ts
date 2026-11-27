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
const eventoAltasVistas = 'compas:altas-vistas';

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
    window.dispatchEvent(new Event(eventoAltasVistas));
    return true;
  } catch {
    return false;
  }
}

export function useAltasNuevas(academia: string, usuario: string, habilitado: boolean) {
  const [estado, setEstado] = useState<{ academia: string; usuario: string; campana: Campana } | null>(null);
  const [, actualizarVistas] = useState(0);

  useEffect(() => {
    const cliente = supabase;
    if (!cliente || !habilitado) return;
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
        setEstado(campana ? { academia, usuario, campana } : null);
      } catch {
        // Un fallo transitorio conserva el último aviso visible.
      } finally {
        clearTimeout(limite);
        pendiente = undefined;
      }
    };
    void consultar();
    const intervalo = setInterval(() => void consultar(), 15_000);
    const alVolver = () => void consultar();
    const recalcular = () => actualizarVistas((vistas) => vistas + 1);
    const alCambiarAlmacen = (e: StorageEvent) => {
      if (e.key === clave(academia, usuario) || e.key === null) recalcular();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);
    window.addEventListener(eventoAltasVistas, recalcular);
    window.addEventListener('storage', alCambiarAlmacen);
    return () => {
      pendiente?.abort();
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('online', alVolver);
      window.removeEventListener(eventoAltasVistas, recalcular);
      window.removeEventListener('storage', alCambiarAlmacen);
    };
  }, [academia, usuario, habilitado]);

  return habilitado && estado?.academia === academia && estado.usuario === usuario
    ? altasNuevas(estado.campana, academia, usuario)
    : 0;
}
