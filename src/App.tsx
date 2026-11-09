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
import { PantallaEntrada } from './features/entrada/PantallaEntrada';
import { iniciarSync } from './sync/engine';

export default function App() {
  const { estado, abrir, bloquear } = useEstadoApp();

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
              <Route element={<Layout />}>
                <Route index element={<PantallaEntrada />} />
                <Route path="alumnos" element={<PantallaAlumnos />} />
                <Route path="alumnos/:id" element={<FichaAlumno />} />
                <Route path="caja" element={<PantallaCaja />} />
                <Route path="ajustes" element={<PantallaAjustes />} />
                <Route path="ajustes/:seccion" element={<PantallaAjustes />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ProveedorSesion>
      )}
    </ProveedorAvisos>
  );
}
