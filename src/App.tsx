import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { ProveedorSesion, useEstadoApp } from './app/sesion';
import { ProveedorAvisos } from './components/avisos';
import { pedirAlmacenamientoPersistente } from './db/db';
import { Alta } from './features/acceso/Alta';
import { Bloqueo } from './features/acceso/Bloqueo';
import { PantallaAjustes } from './features/ajustes/PantallaAjustes';
import { FichaAlumno } from './features/alumnos/FichaAlumno';
import { PantallaAlumnos } from './features/alumnos/PantallaAlumnos';
import { PantallaCaja } from './features/caja/PantallaCaja';
import { PantallaReportes } from './features/reportes/PantallaReportes';
import { PantallaGastos } from './features/gastos/PantallaGastos';
import { PantallaAgenda } from './features/agenda/PantallaAgenda';
import { PantallaMaestro } from './features/maestro/PantallaMaestro';
import { PantallaEntrada } from './features/entrada/PantallaEntrada';
import { iniciarSync } from './sync/engine';

export default function App() {
  const { estado, abrir, bloquear } = useEstadoApp();

  // El color de la academia pinta toda la app (botones, logo, tonos derivados)
  const color = estado.fase === 'bloqueada' || estado.fase === 'abierta' ? estado.academia.color : null;
  useEffect(() => {
    if (color) document.documentElement.style.setProperty('--marca', color);
    else document.documentElement.style.removeProperty('--marca');
  }, [color]);

  useEffect(() => {
    iniciarSync();
    void pedirAlmacenamientoPersistente();
  }, []);

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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              ) : (
              <Route element={<Layout />}>
                <Route index element={<PantallaEntrada />} />
                <Route path="alumnos" element={<PantallaAlumnos />} />
                <Route path="alumnos/:id" element={<FichaAlumno />} />
                <Route path="caja" element={<PantallaCaja />} />
                <Route path="agenda" element={<PantallaAgenda />} />
                <Route path="reportes" element={estado.usuario.rol === 'dueno' ? <PantallaReportes /> : <Navigate to="/" replace />} />
                <Route path="reportes/gastos" element={estado.usuario.rol === 'dueno' ? <PantallaGastos /> : <Navigate to="/" replace />} />
                <Route path="ajustes" element={<PantallaAjustes />} />
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
