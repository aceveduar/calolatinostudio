import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { ProveedorSesion, useEstadoApp } from './app/sesion';
import { ProveedorAvisos } from './components/avisos';
import { pedirAlmacenamientoPersistente } from './db/db';
import { Alta } from './features/acceso/Alta';
import { Bloqueo } from './features/acceso/Bloqueo';
const PantallaAjustes = lazy(() => import('./features/ajustes/PantallaAjustes').then((m) => ({ default: m.PantallaAjustes })));
const FichaAlumno = lazy(() => import('./features/alumnos/FichaAlumno').then((m) => ({ default: m.FichaAlumno })));
const PantallaAlumnos = lazy(() => import('./features/alumnos/PantallaAlumnos').then((m) => ({ default: m.PantallaAlumnos })));
const PantallaImportar = lazy(() => import('./features/alumnos/PantallaImportar').then((m) => ({ default: m.PantallaImportar })));
const PantallaListas = lazy(() => import('./features/alumnos/PantallaListas').then((m) => ({ default: m.PantallaListas })));
const PantallaTestimonios = lazy(() => import('./features/testimonios/PantallaTestimonios').then((m) => ({ default: m.PantallaTestimonios })));
const PantallaInteresados = lazy(() => import('./features/alumnos/PantallaInteresados').then((m) => ({ default: m.PantallaInteresados })));
const PantallaCaja = lazy(() => import('./features/caja/PantallaCaja').then((m) => ({ default: m.PantallaCaja })));
const PantallaReportes = lazy(() => import('./features/reportes/PantallaReportes').then((m) => ({ default: m.PantallaReportes })));
const PantallaGastos = lazy(() => import('./features/gastos/PantallaGastos').then((m) => ({ default: m.PantallaGastos })));
const PantallaAgenda = lazy(() => import('./features/agenda/PantallaAgenda').then((m) => ({ default: m.PantallaAgenda })));
const PantallaEventos = lazy(() => import('./features/eventos/PantallaEventos').then((m) => ({ default: m.PantallaEventos })));
const PantallaEncargos = lazy(() => import('./features/tienda/PantallaEncargos').then((m) => ({ default: m.PantallaEncargos })));
const PantallaMas = lazy(() => import('./features/mas/PantallaMas').then((m) => ({ default: m.PantallaMas })));
const PantallaAyuda = lazy(() => import('./features/ayuda/PantallaAyuda').then((m) => ({ default: m.PantallaAyuda })));
const PantallaPendientes = lazy(() => import('./features/pendientes/PantallaPendientes').then((m) => ({ default: m.PantallaPendientes })));
const PantallaEvento = lazy(() => import('./features/eventos/PantallaEvento').then((m) => ({ default: m.PantallaEvento })));
const PantallaMaestro = lazy(() => import('./features/maestro/PantallaMaestro').then((m) => ({ default: m.PantallaMaestro })));
import { PantallaEntrada } from './features/entrada/PantallaEntrada';
import { iniciarSync } from './sync/engine';

const PRECARGAR = [
  () => import('./features/testimonios/PantallaTestimonios'),
  () => import('./features/ajustes/PantallaAjustes'),
  () => import('./features/alumnos/FichaAlumno'),
  () => import('./features/alumnos/PantallaAlumnos'),
  () => import('./features/alumnos/PantallaListas'),
  () => import('./features/alumnos/PantallaInteresados'),
  () => import('./features/caja/PantallaCaja'),
  () => import('./features/reportes/PantallaReportes'),
  () => import('./features/gastos/PantallaGastos'),
  () => import('./features/agenda/PantallaAgenda'),
  () => import('./features/eventos/PantallaEventos'),
  () => import('./features/tienda/PantallaEncargos'),
  () => import('./features/mas/PantallaMas'),
  () => import('./features/pendientes/PantallaPendientes'),
  () => import('./features/eventos/PantallaEvento'),
  () => import('./features/maestro/PantallaMaestro'),
];

export default function App() {
  const { estado, abrir, bloquear } = useEstadoApp();

  // El color de la academia pinta toda la app (botones, logo, tonos derivados)
  const color = estado.fase === 'bloqueada' || estado.fase === 'abierta' ? estado.academia.color : null;
  useEffect(() => {
    if (color) document.documentElement.style.setProperty('--marca', color);
    else document.documentElement.style.removeProperty('--marca');
  }, [color]);

  // Entrada viene en el archivo principal; las demás pantallas se cargan aparte y se precargan
  // al poco de abrir, para que cambiar de pantalla sea instantáneo (y quedan guardadas sin internet).
  useEffect(() => {
    const t = setTimeout(() => PRECARGAR.forEach((f) => void f()), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    iniciarSync();
    void pedirAlmacenamientoPersistente();
  }, []);

  // Sin academia en este equipo (recién instalada o borrada): la dirección vuelve a "/", no se queda en
  // la última pantalla que había (p. ej. /mas). Al bloquear sí se conserva, para regresar a donde estaba.
  useEffect(() => {
    if (estado.fase === 'sin-academia' && location.pathname !== '/') history.replaceState(null, '', '/');
  }, [estado.fase]);

  return (
    <ProveedorAvisos>
      {estado.fase === 'cargando' ? null : estado.fase === 'sin-academia' ? (
        <Alta onListo={abrir} />
      ) : estado.fase === 'bloqueada' ? (
        <Bloqueo academia={estado.academia} onAbrir={abrir} />
      ) : (
        <ProveedorSesion academia={estado.academia} usuario={estado.usuario} bloquear={bloquear}>
          <BrowserRouter>
            <Routes>
              {estado.usuario.rol === 'maestro' ? (
                <Route element={<Layout />}>
                  <Route index element={<PantallaMaestro />} />
                  <Route path="ayuda" element={<PantallaAyuda />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              ) : (
              <Route element={<Layout />}>
                <Route index element={<PantallaEntrada />} />
                <Route path="alumnos" element={<PantallaAlumnos />} />
                <Route path="alumnos/listas" element={<PantallaListas />} />
                <Route path="alumnos/importar" element={<PantallaImportar />} />
                <Route path="alumnos/interesados" element={<PantallaInteresados />} />
                <Route path="alumnos/testimonios" element={<PantallaTestimonios />} />
                <Route path="alumnos/:id" element={<FichaAlumno />} />
                <Route path="caja" element={<PantallaCaja />} />
                <Route path="agenda" element={<PantallaAgenda />} />
                <Route path="agenda/eventos" element={<PantallaEventos />} />
                <Route path="encargos" element={<PantallaEncargos />} />
                <Route path="agenda/eventos/:id" element={<PantallaEvento />} />
                <Route path="reportes" element={estado.usuario.rol === 'dueno' ? <PantallaReportes /> : <Navigate to="/" replace />} />
                <Route path="reportes/gastos" element={estado.usuario.rol === 'dueno' ? <PantallaGastos /> : <Navigate to="/" replace />} />
                <Route path="mas" element={<PantallaMas />} />
                <Route path="pendientes" element={<PantallaPendientes />} />
                <Route path="ayuda" element={<PantallaAyuda />} />
                <Route path="ajustes" element={<Navigate to="/mas" replace />} />
                <Route path="ajustes/:seccion" element={<PantallaAjustes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
              )}
            </Routes>
          </BrowserRouter>
        </ProveedorSesion>
      )}
    </ProveedorAvisos>
  );
}
