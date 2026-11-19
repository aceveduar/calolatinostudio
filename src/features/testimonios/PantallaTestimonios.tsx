import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Globe, MessageSquareQuote } from 'lucide-react';
import { useSesion } from '../../app/sesion';
import { Cargando, Segmentos, Tarjeta, Vacio } from '../../components/ui';
import { db } from '../../db/db';
import type { EstadoTestimonio } from '../../db/types';
import { TarjetaTestimonio } from './TarjetaTestimonio';

/**
 * Testimonios que los alumnos escriben en su portal. Por revisar → Publicar (se agrega a la página
 * pública) o No publicar. Nada aparece en la página sin que alguien de la academia lo apruebe.
 */
export function PantallaTestimonios() {
  const { academia, esDueno } = useSesion();
  const [ver, setVer] = useState<EstadoTestimonio>('pendiente');
  const datos = useLiveQuery(async () => {
    const todos = (await db.testimonios.toArray()).filter((t) => !t.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
    const alumnos = new Map((await db.alumnos.bulkGet([...new Set(todos.map((t) => t.alumnoId))])).flatMap((a) => (a ? [[a.id, a] as const] : [])));
    return { todos, alumnos };
  }, []);
  if (!datos) return <Cargando />;
  const cuenta = (e: EstadoTestimonio) => datos.todos.filter((t) => t.estado === e).length;
  const lista = datos.todos.filter((t) => t.estado === ver);

  return (
    <div className="px-4 pb-8 lg:mx-auto lg:max-w-3xl">
      <div className="flex items-center gap-2 pt-4 pb-3">
        <Link to="/mas" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a Más">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Testimonios</h1>
      </div>
      {esDueno && !academia.slug && (
        <Link to="/ajustes/pagina" className="mb-3 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-600">
          <Globe size={20} className="shrink-0" />
          <span>
            <b>Publica tu página</b> para que los testimonios aprobados se vean en ella.
          </span>
        </Link>
      )}
      <Segmentos<EstadoTestimonio>
        opciones={[
          { valor: 'pendiente', texto: `Por revisar (${cuenta('pendiente')})` },
          { valor: 'aprobado', texto: `Publicados (${cuenta('aprobado')})` },
          { valor: 'rechazado', texto: `Ocultos (${cuenta('rechazado')})` },
        ]}
        valor={ver}
        onChange={setVer}
      />
      <div className="mt-4 space-y-3">
        {lista.length === 0 ? (
          <Tarjeta>
            <Vacio
              icono={<MessageSquareQuote size={32} />}
              titulo={ver === 'pendiente' ? 'Nada por revisar' : 'Nada por aquí'}
              texto="Los alumnos escriben su testimonio desde su portal. Llegan aquí y solo se publican si tú lo apruebas."
            />
          </Tarjeta>
        ) : (
          lista.map((t) => <TarjetaTestimonio key={t.id} t={t} alumno={datos.alumnos.get(t.alumnoId)} />)
        )}
      </div>
    </div>
  );
}
