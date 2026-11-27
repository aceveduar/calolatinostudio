import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { useAvisos } from '../../components/avisos';
import { Boton, Tarjeta } from '../../components/ui';
import { actualizar } from '../../db/repo';
import { MENSAJES, MENSAJES_INTERESADOS, armarMensaje, plantilla, variablesMensaje, type ClaveMensaje } from '../../domain/mensajes';

const EJEMPLO = { nombre: 'Ana', academia: '', plan: 'Mensualidad', vence: 'viernes 20 nov', vigencia: '13 nov al 12 dic', monto: '$400', codigo: 'K7P2QX', enlace: 'calolatinostudio.pages.dev/p/Xb7…', clase: 'Salsa 1', horario: 'lunes y miércoles 8:00 pm' };

/** El dueño escribe los mensajes de WhatsApp con sus palabras; se ve cómo le llegará al alumno. */
export function EditorMensajes() {
  const { academia } = useSesion();
  const avisar = useAvisos();
  const [abierto, setAbierto] = useState<ClaveMensaje | null>(null);
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLTextAreaElement>(null);

  function insertar(clave: string) {
    const entrada = campo.current;
    if (!entrada) return;
    const variable = `{${clave}}`;
    const desde = entrada.selectionStart;
    const hasta = entrada.selectionEnd;
    setTexto(texto.slice(0, desde) + variable + texto.slice(hasta));
    requestAnimationFrame(() => {
      if (entrada !== campo.current) return;
      entrada.focus();
      entrada.setSelectionRange(desde + variable.length, desde + variable.length);
    });
  }

  const guardar = async (clave: ClaveMensaje, valor: string | null) => {
    const actuales = { ...(academia.mensajes ?? {}) };
    if (valor === null) delete actuales[clave];
    else actuales[clave] = valor;
    await actualizar('academias', academia.id, { mensajes: actuales });
    avisar(valor === null ? 'Mensaje original restaurado' : 'Mensaje guardado');
    setAbierto(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Así le llegan los mensajes de WhatsApp a los alumnos. Escríbelos con el estilo de la academia.</p>
      {[...MENSAJES, ...MENSAJES_INTERESADOS].map((m) => {
        const actual = plantilla(academia, m.clave);
        const propio = !!academia.mensajes?.[m.clave];
        const editando = abierto === m.clave;
        const variables = variablesMensaje(m.clave);
        const ejemplo = Object.fromEntries(variables.map(({ clave }) => [clave, clave === 'academia' ? academia.nombre : EJEMPLO[clave as keyof typeof EJEMPLO]]));
        const sinDatos = editando ? [...new Set(Array.from(texto.matchAll(/\{(\w+)\}/g), ([, clave]) => clave))].filter((clave) => !variables.some((v) => v.clave === clave)) : [];
        return (
          <Tarjeta key={m.clave} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {m.titulo} {propio && <span className="ml-1 text-xs font-medium text-brand-600">· personalizado</span>}
                </p>
                <p className="text-xs text-ink-500">{m.cuando}</p>
              </div>
              {!editando && (
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setAbierto(m.clave);
                    setTexto(actual);
                  }}
                >
                  Editar
                </Boton>
              )}
            </div>
            {editando ? (
              <div className="mt-3 space-y-2">
                <textarea
                  ref={campo}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  aria-label={`Mensaje: ${m.titulo}`}
                  className="w-full rounded-xl bg-superficie px-3 py-2 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs font-semibold text-ink-600">Insertar un dato</p>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <button
                      key={v.clave}
                      type="button"
                      title={v.texto}
                      onClick={() => insertar(v.clave)}
                      className="min-h-9 rounded-full bg-brand-50 px-2.5 py-1 font-mono text-xs text-brand-600"
                    >
                      {`{${v.clave}}`}
                    </button>
                  ))}
                </div>
                {sinDatos.length > 0 && <p className="text-sm text-warn-600">Estos datos pueden quedar en blanco al enviar el mensaje. {sinDatos.map((clave) => `{${clave}}`).join(', ')}</p>}
                <div className="rounded-xl bg-[#e7f8df] p-3 text-sm break-words whitespace-pre-wrap text-[#1c1a24]">
                  <p className="mb-1 text-[11px] font-semibold text-[#3a7a2c]">Vista previa con datos de ejemplo</p>
                  {armarMensaje(texto, ejemplo)}
                </div>
                <div className="flex gap-2">
                  <Boton variante="fantasma" onClick={() => setAbierto(null)}>
                    Cancelar
                  </Boton>
                  {propio && (
                    <Boton variante="fantasma" onClick={() => guardar(m.clave, null)}>
                      <RotateCcw size={16} /> Original
                    </Boton>
                  )}
                  <Boton className="flex-1" disabled={!texto.trim()} onClick={() => guardar(m.clave, texto.trim())}>
                    Guardar
                  </Boton>
                </div>
              </div>
            ) : (
              // 2 renglones para reconocerlo; "Editar" muestra el texto completo (antes 9 mensajes completos = ~2,200 px)
              <div className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
                <p className="line-clamp-2 break-words">{armarMensaje(actual, ejemplo)}</p>
              </div>
            )}
          </Tarjeta>
        );
      })}
    </div>
  );
}
