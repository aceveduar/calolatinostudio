import { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { prepararFoto } from '../../app/fotos';
import { useAvisos } from '../../components/avisos';
import { Avatar, Boton, Hoja } from '../../components/ui';
import { actualizar } from '../../db/repo';
import type { Alumno } from '../../db/types';

/** Foto del alumno en su ficha: tocarla permite tomarla con la cámara, elegirla o quitarla. */
export function FotoAlumno({ alumno }: { alumno: Alumno }) {
  const avisar = useAvisos();
  const [abierta, setAbierta] = useState(false);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const nombre1 = alumno.nombre.split(' ')[0];

  const usar = async (f: File | undefined) => {
    if (!f) return;
    try {
      await actualizar('alumnos', alumno.id, { foto: await prepararFoto(f) });
      avisar('Foto guardada');
      setAbierta(false);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo usar esa foto', 'error');
    }
  };

  return (
    <>
      <button onClick={() => setAbierta(true)} className="relative shrink-0 rounded-full" aria-label={alumno.foto ? `Cambiar la foto de ${nombre1}` : `Poner foto a ${nombre1}`}>
        <Avatar nombre={alumno.nombre} foto={alumno.foto} tam={64} />
        <span className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-superficie text-ink-700 shadow ring-1 ring-ink-100">
          <Camera size={15} />
        </span>
      </button>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void usar(e.target.files?.[0])} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => void usar(e.target.files?.[0])} />
      <Hoja abierta={abierta} onCerrar={() => setAbierta(false)} titulo={`Foto de ${nombre1}`}>
        <div className="space-y-3">
          <div className="flex justify-center">
            <Avatar nombre={alumno.nombre} foto={alumno.foto} tam={120} />
          </div>
          <p className="text-center text-sm text-ink-500">Para reconocerlo en recepción y en la lista del maestro. También la puede poner él desde su portal.</p>
          <Boton grande bloque onClick={() => camara.current?.click()}>
            <Camera size={20} /> Tomar foto
          </Boton>
          <Boton bloque variante="secundario" onClick={() => galeria.current?.click()}>
            <ImagePlus size={18} /> Elegir de la galería
          </Boton>
          {alumno.foto && (
            <Boton
              bloque
              variante="fantasma"
              onClick={async () => {
                await actualizar('alumnos', alumno.id, { foto: null });
                avisar('Foto quitada');
                setAbierta(false);
              }}
            >
              <span className="flex items-center gap-2 text-bad-600">
                <Trash2 size={16} /> Quitar foto
              </span>
            </Boton>
          )}
        </div>
      </Hoja>
    </>
  );
}
