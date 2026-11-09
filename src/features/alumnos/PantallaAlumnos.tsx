import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { useAlumnos, useEstadosPorAlumno } from '../../app/datos';
import { Avatar, Boton, Encabezado, Etiqueta, Hoja, Segmentos, Tarjeta, Vacio } from '../../components/ui';
import { semaforoAlumno, type Semaforo } from '../../domain/membresias';
import { FormAlumno } from './FormAlumno';

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
type Filtro = 'todos' | Semaforo;

export function PantallaAlumnos() {
  const alumnos = useAlumnos();
  const estados = useEstadosPorAlumno();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [nuevo, setNuevo] = useState(false);

  const filas = useMemo(() => {
    const t = normalizar(q.trim());
    return alumnos
      .filter((a) => a.activo)
      .map((a) => ({ a, s: semaforoAlumno(estados.get(a.id) ?? []) }))
      .filter(({ a }) => !t || normalizar(a.nombre).includes(t) || a.telefono.includes(t))
      .filter(({ s }) => filtro === 'todos' || s.tono === filtro);
  }, [alumnos, estados, q, filtro]);

  return (
    <div className="px-4 pb-6">
      <div className="-mx-4">
        <Encabezado
          titulo="Alumnos"
          sub={`${alumnos.filter((a) => a.activo).length} registrados`}
          accion={
            <Boton onClick={() => setNuevo(true)}>
              <Plus size={18} /> Nuevo
            </Boton>
          }
        />
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" size={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono"
          className="h-12 w-full rounded-xl bg-white pr-4 pl-11 ring-1 ring-ink-100 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <Segmentos<Filtro>
        opciones={[
          { valor: 'todos', texto: 'Todos' },
          { valor: 'ok', texto: 'Al corriente' },
          { valor: 'pronto', texto: 'Por vencer' },
          { valor: 'sin', texto: 'Sin plan' },
        ]}
        valor={filtro}
        onChange={setFiltro}
      />

      <div className="mt-3">
        {filas.length === 0 ? (
          <Vacio icono={<Users size={40} />} titulo={alumnos.length ? 'Nadie coincide' : 'Aún no hay alumnos'} texto={alumnos.length ? undefined : 'Se registran solos desde Entrada la primera vez que llegan.'} />
        ) : (
          <Tarjeta className="divide-y divide-ink-100">
            {filas.map(({ a, s }) => (
              <button key={a.id} onClick={() => nav(`/alumnos/${a.id}`)} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-ink-50">
                <Avatar nombre={a.nombre} tam={40} />
                <span className="min-w-0 flex-1 truncate font-semibold">{a.nombre}</span>
                <Etiqueta tono={s.tono}>{s.texto}</Etiqueta>
              </button>
            ))}
          </Tarjeta>
        )}
      </div>

      <Hoja abierta={nuevo} onCerrar={() => setNuevo(false)} titulo="Alumno nuevo">
        <FormAlumno onGuardado={(a) => { setNuevo(false); nav(`/alumnos/${a.id}`); }} />
      </Hoja>
    </div>
  );
}
