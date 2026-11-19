import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useAvisos } from '../../components/avisos';
import { Boton, Tarjeta } from '../../components/ui';
import { hoy } from '../../domain/fechas';
import { exportarRespaldo, leerRespaldo, restaurarRespaldo, type Respaldo } from '../../domain/respaldo';

/** Descarga un archivo con todos los datos de la academia. `onDescargado` sirve para habilitar acciones que lo exigen. */
export function RespaldoLocal({ onDescargado }: { onDescargado?: () => void }) {
  const [preparando, setPreparando] = useState(false);
  return (
    <Boton
      bloque
      variante="secundario"
      disabled={preparando}
      onClick={async () => {
        setPreparando(true);
        const a = document.createElement('a');
        const { archivo, extension } = await exportarRespaldo().finally(() => setPreparando(false));
        a.href = URL.createObjectURL(archivo);
        a.download = `compas-respaldo-${hoy()}.${extension}`;
        a.click();
        URL.revokeObjectURL(a.href);
        onDescargado?.();
      }}
    >
      <Download size={18} /> {preparando ? 'Preparando respaldo…' : 'Descargar respaldo'}
    </Boton>
  );
}

/** Carga un respaldo. Nunca borra: mezcla y gana lo más reciente. */
export function RestaurarRespaldo({ onRestaurado }: { onRestaurado?: () => void }) {
  const avisar = useAvisos();
  const input = useRef<HTMLInputElement>(null);
  const [leido, setLeido] = useState<{ respaldo: Respaldo; nombre: string; registros: number } | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="application/json,.json,.gz,application/gzip"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setError('');
          try {
            const r = await leerRespaldo(f);
            setLeido({ respaldo: r.respaldo, nombre: r.academia.nombre, registros: r.registros });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo leer el archivo');
          }
        }}
      />
      {!leido ? (
        <Boton bloque variante="secundario" onClick={() => input.current?.click()}>
          <Upload size={18} /> Restaurar un respaldo
        </Boton>
      ) : (
        <Tarjeta className="space-y-3 p-4">
          <div className="text-sm">
            <p className="font-semibold">{leido.nombre}</p>
            <p className="text-ink-500">
              Respaldo del {new Date(leido.respaldo.exportado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
              {leido.registros.toLocaleString('es-MX')} registros
            </p>
            <p className="mt-2 text-ink-700">No se borra nada: solo se agrega lo que falte y se actualiza lo que esté más nuevo en el respaldo.</p>
          </div>
          <div className="flex gap-2">
            <Boton variante="fantasma" onClick={() => setLeido(null)}>
              Cancelar
            </Boton>
            <Boton
              className="flex-1"
              disabled={ocupado}
              onClick={async () => {
                setOcupado(true);
                try {
                  const n = await restaurarRespaldo(leido.respaldo);
                  avisar(n ? `Respaldo restaurado · ${n.toLocaleString('es-MX')} registros recuperados` : 'Todo ya estaba al día');
                  setLeido(null);
                  onRestaurado?.();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'No se pudo restaurar');
                } finally {
                  setOcupado(false);
                }
              }}
            >
              {ocupado ? 'Restaurando…' : 'Restaurar'}
            </Boton>
          </div>
        </Tarjeta>
      )}
      {error && <p className="text-sm font-medium text-bad-600">{error}</p>}
    </div>
  );
}
