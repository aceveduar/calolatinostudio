/**
 * Si una pantalla falla al dibujarse, en lugar de dejar la app en blanco (en pleno cobro)
 * muestra un aviso con salida. Los datos ya están guardados en el teléfono: no se pierde nada.
 * Guarda los últimos errores en este teléfono para poder revisarlos después.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

const CLAVE = 'compas:errores';

export function anotarError(e: unknown, donde: string) {
  try {
    const previos = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as unknown[];
    const nuevo = { at: new Date().toISOString(), donde, mensaje: e instanceof Error ? e.message : String(e), pila: e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') : undefined };
    localStorage.setItem(CLAVE, JSON.stringify([nuevo, ...previos].slice(0, 10)));
  } catch {
    /* sin almacenamiento: no importa */
  }
}

export function erroresRecientes(): { at: string; donde: string; mensaje: string }[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
  } catch {
    return [];
  }
}

interface Props {
  children: ReactNode;
  /** 'pantalla': deja visibles las barras de la app · 'app': ocupa todo */
  nivel: 'pantalla' | 'app';
}

export class Tropiezo extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    anotarError(error, `${location.pathname} ${info.componentStack?.split('\n').find((l) => l.trim()) ?? ''}`.trim());
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.nivel === 'app' ? 'flex min-h-dvh items-center justify-center bg-ink-50 p-6' : 'p-6'}>
        <div role="alert" className="mx-auto max-w-md rounded-3xl bg-superficie p-6 text-center shadow-sm ring-1 ring-ink-100">
          <AlertTriangle className="mx-auto text-warn-600" size={36} aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold text-ink-900">{this.props.nivel === 'pantalla' ? 'Esta pantalla tuvo un problema' : 'Algo falló'}</h2>
          <p className="mt-2 text-ink-700">
            {this.props.nivel === 'pantalla' ? 'Lo que ya cobraste o registraste está guardado. Vuelve a la entrada o recarga la app.' : 'Lo que ya estaba guardado no se pierde. Recarga para seguir.'}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {this.props.nivel === 'pantalla' && (
              <button onClick={() => location.assign('/')} className="h-12 rounded-2xl bg-brand-500 font-bold text-white active:bg-brand-600">
                Volver a la entrada
              </button>
            )}
            <button onClick={() => location.reload()} className="h-12 rounded-2xl bg-ink-50 font-bold text-ink-900 ring-1 ring-ink-100">
              Recargar
            </button>
          </div>
          <details className="mt-4 text-left text-xs text-ink-500">
            <summary className="cursor-pointer">Detalle para soporte</summary>
            <p className="mt-2 break-words">{this.state.error.message}</p>
          </details>
        </div>
      </div>
    );
  }
}
