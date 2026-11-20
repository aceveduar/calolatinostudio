import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronDown, FileSpreadsheet, Undo2 } from 'lucide-react';
import { useAlumnos } from '../../app/datos';
import { useSesion } from '../../app/sesion';
import { leerExcel } from '../../app/xlsx';
import { Boton, Etiqueta, Selector, Tarjeta, Vacio, cx, type Tono } from '../../components/ui';
import { useAvisos } from '../../components/avisos';
import { borrar, crear, enTransaccion } from '../../db/repo';
import type { ID } from '../../db/types';
import { detectarColumnas, leerTexto, prepararFilas, type Campo, type Columnas, type EstadoFila } from '../../domain/importar';
import { generarCodigo } from '../../domain/operaciones';

const CAMPOS: { campo: Campo; texto: string }[] = [
  { campo: 'nombre', texto: 'Nombre' },
  { campo: 'apellido', texto: 'Apellidos' },
  { campo: 'telefono', texto: 'WhatsApp' },
  { campo: 'notas', texto: 'Notas' },
];

const ESTADO: Record<EstadoFila, { texto: string; tono: Tono }> = {
  nuevo: { texto: 'Nuevo', tono: 'ok' }, // no se muestra: la mayoría son nuevos; solo se marcan los que se saltan
  'ya-esta': { texto: 'Ya está', tono: 'neutro' },
  repetido: { texto: 'Repetido', tono: 'neutro' },
  'sin-nombre': { texto: 'Sin nombre', tono: 'sin' },
};

const VISTA = 40;
const TANDA = 100;
const letra = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(64 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`);
const telBonito = (t: string) => (t.length === 10 ? `${t.slice(0, 2)} ${t.slice(2, 6)} ${t.slice(6)}` : t);

/**
 * Importar la lista de alumnos que la academia ya tiene (Excel, Google Sheets, CSV o celdas pegadas).
 * Vista previa antes de guardar; se salta a quien ya está registrado; se puede deshacer al terminar.
 */
export function PantallaImportar() {
  const { esDueno } = useSesion();
  const avisar = useAvisos();
  const alumnos = useAlumnos();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [origen, setOrigen] = useState('');
  const [tabla, setTabla] = useState<string[][] | null>(null);
  const [columnas, setColumnas] = useState<Columnas | null>(null);
  const [conEncabezado, setConEncabezado] = useState(false);
  const [pegado, setPegado] = useState('');
  const [error, setError] = useState('');
  const [avance, setAvance] = useState<number | null>(null);
  const [creados, setCreados] = useState<ID[] | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  // la lista de alumnos de antes de importar: así, al terminar, los recién creados no salen como "ya está"
  const [existentes, setExistentes] = useState<{ nombre: string; telefono: string }[]>([]);
  const filas = useMemo(() => (tabla && columnas ? prepararFilas(tabla, columnas, conEncabezado, existentes) : []), [tabla, columnas, conEncabezado, existentes]);
  const cuenta = (e: EstadoFila) => filas.filter((f) => f.estado === e).length;
  const nuevos = filas.filter((f) => f.estado === 'nuevo');
  const raros = nuevos.filter((f) => f.telefonoRaro).length;

  function cargar(datos: string[][], nombre: string) {
    if (datos.length === 0) return setError('No encontramos datos. Revisa que la lista esté en la primera hoja.');
    const d = detectarColumnas(datos);
    setError('');
    setExistentes(alumnos.map((a) => ({ nombre: a.nombre, telefono: a.telefono })));
    setTabla(datos);
    setColumnas(d.columnas);
    setConEncabezado(d.conEncabezado);
    setOrigen(nombre);
    setVerTodos(false);
  }

  async function elegirArchivo(f: File) {
    try {
      const esExcel = /\.xlsx$/i.test(f.name) || f.type.includes('spreadsheetml');
      if (/\.xls$/i.test(f.name)) throw new Error('Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx o como CSV.');
      cargar(esExcel ? await leerExcel(f) : leerTexto(await f.text()), f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
  }

  async function importar() {
    const ids: ID[] = [];
    setAvance(0);
    try {
      for (let i = 0; i < nuevos.length; i += TANDA) {
        await enTransaccion(async () => {
          for (const f of nuevos.slice(i, i + TANDA)) {
            const a = await crear('alumnos', { nombre: f.nombre, telefono: f.telefono, notas: f.notas, codigo: generarCodigo(), activo: true });
            ids.push(a.id);
          }
        });
        setAvance(ids.length);
      }
      setCreados(ids);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo importar', 'error');
      if (ids.length) setCreados(ids);
    } finally {
      setAvance(null);
    }
  }

  async function deshacer() {
    if (!creados) return;
    for (let i = 0; i < creados.length; i += TANDA) await enTransaccion(async () => void (await Promise.all(creados.slice(i, i + TANDA).map((id) => borrar('alumnos', id)))));
    avisar(`Se quitaron los ${creados.length.toLocaleString('es-MX')} alumnos importados`);
    setCreados(null);
    setTabla(null);
  }

  const encabezado = (
    <div className="flex items-center gap-2 pt-4 pb-3">
      <Link to="/alumnos" className="-ml-2.5 rounded-full p-2.5 active:bg-ink-100" aria-label="Volver a alumnos">
        <ArrowLeft size={22} />
      </Link>
      <h1 className="flex-1 text-2xl font-extrabold tracking-tight">Importar alumnos</h1>
    </div>
  );

  if (!esDueno)
    return (
      <div className="px-4 pb-6 lg:mx-auto lg:max-w-2xl">
        {encabezado}
        <Vacio titulo="Solo la dirección" texto="Pide a la dirección que importe la lista de alumnos." />
      </div>
    );

  // ---------- terminado ----------
  if (creados)
    return (
      <div className="px-4 pb-6 lg:mx-auto lg:max-w-2xl">
        {encabezado}
        <Tarjeta className="flex flex-col items-center p-6 text-center">
          <CheckCircle2 size={48} className="text-ok-600" aria-hidden="true" />
          <p className="mt-3 text-xl font-extrabold">
            {creados.length.toLocaleString('es-MX')} alumno{creados.length === 1 ? '' : 's'} nuevo{creados.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-sm text-ink-500">Ya aparecen en Alumnos y en Entrada. Cuando lleguen, se cobra como siempre. Nadie recibió mensajes.</p>
          <Link to="/alumnos" className="mt-5 w-full">
            <Boton grande bloque>Ver alumnos</Boton>
          </Link>
        </Tarjeta>
        <button onClick={() => void deshacer()} className="mx-auto mt-4 flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold text-ink-500 active:text-ink-700">
          <Undo2 size={16} aria-hidden="true" /> ¿Algo salió mal? Deshacer la importación
        </button>
      </div>
    );

  // ---------- elegir archivo ----------
  if (!tabla || !columnas)
    return (
      <div className="px-4 pb-6 lg:mx-auto lg:max-w-2xl">
        {encabezado}
        <Tarjeta className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
              <FileSpreadsheet size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-bold">Trae la lista que ya tienes</p>
              <p className="mt-0.5 text-sm text-ink-500">De Excel, Google Sheets o un CSV. Basta una columna con el nombre; el WhatsApp es opcional.</p>
            </div>
          </div>
          <input
            ref={archivoRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void elegirArchivo(f);
            }}
          />
          <Boton grande bloque className="mt-4" onClick={() => archivoRef.current?.click()}>
            Elegir archivo
          </Boton>
          <div className="my-4 flex items-center gap-3 text-xs font-semibold text-ink-300" aria-hidden="true">
            <span className="h-px flex-1 bg-ink-100" /> o <span className="h-px flex-1 bg-ink-100" />
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-ink-700">Pega las celdas copiadas de Excel</span>
            <textarea
              value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              rows={4}
              placeholder={'Ana López\t55 1234 5678\nLuis Pérez\t55 8765 4321'}
              className="mt-1.5 w-full resize-y rounded-xl bg-superficie px-3 py-2.5 font-mono text-sm ring-1 ring-ink-100 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
            />
          </label>
          {pegado.trim() && (
            <Boton bloque variante="secundario" className="mt-2" onClick={() => cargar(leerTexto(pegado), 'Lo que pegaste')}>
              Ver vista previa
            </Boton>
          )}
          {error && <p className="mt-3 text-sm font-medium text-bad-600">{error}</p>}
        </Tarjeta>
        <p className="mt-3 px-1 text-xs text-ink-500">Antes de guardar verás la lista. Los que ya están registrados se saltan solos y nadie recibe mensajes.</p>
      </div>
    );

  // ---------- vista previa ----------
  const ancho = Math.max(...tabla.slice(0, 50).map((f) => f.length));
  const ejemplo = (i: number) => (conEncabezado ? tabla[1] : tabla[0])?.[i] ?? '';
  const nombreCol = (i: number) => (conEncabezado && tabla[0][i] ? tabla[0][i] : `Columna ${letra(i)}${ejemplo(i) ? ` (${ejemplo(i).slice(0, 18)})` : ''}`);
  const saltan = cuenta('ya-esta') + cuenta('repetido') + cuenta('sin-nombre');
  const mostrar = verTodos ? filas : filas.slice(0, VISTA);

  return (
    <div className="px-4 pb-6 lg:mx-auto lg:max-w-2xl">
      {encabezado}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="min-w-0 truncate text-sm text-ink-500">{origen}</p>
        <button onClick={() => setTabla(null)} className="min-h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-brand-600 active:bg-brand-50">
          Cambiar archivo
        </button>
      </div>

      <Tarjeta className="p-4">
        <p className="text-3xl font-extrabold tracking-tight tabular-nums">{nuevos.length.toLocaleString('es-MX')}</p>
        <p className="font-semibold">alumno{nuevos.length === 1 ? '' : 's'} nuevo{nuevos.length === 1 ? '' : 's'} para importar</p>
        {(saltan > 0 || raros > 0) && (
          <ul className="mt-2 space-y-0.5 text-sm text-ink-500">
            {cuenta('ya-esta') > 0 && <li>{cuenta('ya-esta') === 1 ? '1 ya estaba registrado' : `${cuenta('ya-esta')} ya estaban registrados`} · se salta{cuenta('ya-esta') === 1 ? '' : 'n'}</li>}
            {cuenta('repetido') > 0 && <li>{cuenta('repetido') === 1 ? '1 repetido' : `${cuenta('repetido')} repetidos`} en la lista · se salta{cuenta('repetido') === 1 ? '' : 'n'}</li>}
            {cuenta('sin-nombre') > 0 && <li>{cuenta('sin-nombre') === 1 ? '1 fila' : `${cuenta('sin-nombre')} filas`} sin nombre · se salta{cuenta('sin-nombre') === 1 ? '' : 'n'}</li>}
            {raros > 0 && <li className="text-warn-600">{raros === 1 ? '1 teléfono no tiene' : `${raros} teléfonos no tienen`} 10 dígitos · se importa{raros === 1 ? '' : 'n'} igual, revísalo{raros === 1 ? '' : 's'} después</li>}
          </ul>
        )}
        <Boton grande bloque className="mt-4" disabled={nuevos.length === 0 || avance !== null} onClick={() => void importar()}>
          {avance !== null
            ? `Importando… ${avance.toLocaleString('es-MX')} de ${nuevos.length.toLocaleString('es-MX')}`
            : nuevos.length === 0
              ? 'No hay alumnos nuevos'
              : `Importar ${nuevos.length.toLocaleString('es-MX')} alumno${nuevos.length === 1 ? '' : 's'}`}
        </Boton>
      </Tarjeta>

      <section className="mt-5">
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">Qué columna es qué</h2>
        <Tarjeta className="divide-y divide-ink-100">
          {CAMPOS.map(({ campo, texto }) => (
            <label key={campo} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-24 shrink-0 text-sm font-semibold">{texto}</span>
              <span className="relative min-w-0 flex-1">
                <Selector
                  value={columnas[campo] ?? ''}
                  onChange={(e) => setColumnas({ ...columnas, [campo]: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label={`Columna de ${texto}`}
                  className="h-11 pr-10"
                >
                  <option value="">— ninguna —</option>
                  {Array.from({ length: ancho }, (_, i) => (
                    <option key={i} value={i}>
                      {nombreCol(i)}
                    </option>
                  ))}
                </Selector>
                <ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-500" aria-hidden="true" />
              </span>
            </label>
          ))}
        </Tarjeta>
        <label className="mt-2 flex min-h-11 items-center gap-2.5 px-1 text-sm text-ink-700">
          <input type="checkbox" checked={conEncabezado} onChange={(e) => setConEncabezado(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          La primera fila son títulos (no es un alumno)
        </label>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-500 uppercase">Así quedarían</h2>
        <Tarjeta className="divide-y divide-ink-100">
          {mostrar.map((f, i) => (
            <div key={i} className={cx('flex items-center gap-3 px-4 py-2.5', f.estado !== 'nuevo' && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.nombre || '(sin nombre)'}</p>
                <p className={cx('truncate text-sm tabular-nums', f.telefonoRaro ? 'text-warn-600' : 'text-ink-500')}>
                  {f.telefono ? telBonito(f.telefono) : 'Sin teléfono'}
                  {f.telefonoRaro && ` · ${f.telefono.length} dígitos`}
                </p>
              </div>
              {f.estado !== 'nuevo' && <Etiqueta tono={ESTADO[f.estado].tono}>{ESTADO[f.estado].texto}</Etiqueta>}
            </div>
          ))}
        </Tarjeta>
        {!verTodos && filas.length > VISTA && (
          <button onClick={() => setVerTodos(true)} className="mt-1 min-h-11 w-full text-sm font-semibold text-brand-600">
            Ver los {filas.length.toLocaleString('es-MX')}
          </button>
        )}
      </section>
    </div>
  );
}
