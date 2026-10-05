import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthCallback from "@/components/AuthCallback";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Asistente from "@/pages/Asistente";
import Vehiculos from "@/pages/Vehiculos";
import VehiculoDetalle from "@/pages/VehiculoDetalle";
import Stock from "@/pages/Stock";
import Precios from "@/pages/Precios";
import Financiacion from "@/pages/Financiacion";
import Promociones from "@/pages/Promociones";
import Comparador from "@/pages/Comparador";
import Documentos from "@/pages/Documentos";
import Faq from "@/pages/Faq";
import Argumentario from "@/pages/Argumentario";
import Memoria from "@/pages/Memoria";
import Auditoria from "@/pages/Auditoria";
import ClienteMensaje from "@/pages/ClienteMensaje";
import Ventas from "@/pages/Ventas";
import Configuracion from "@/pages/Configuracion";

function AppRoutes() {
  const location = useLocation();
  // Emergent Google OAuth returns to `.../#session_id=...` — exchange it BEFORE route matching.
  if (location.hash.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/asistente" element={<Asistente />} />
          <Route path="/vehiculos" element={<Vehiculos />} />
          <Route path="/vehiculos/:id" element={<VehiculoDetalle />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/precios" element={<Precios />} />
          <Route path="/financiacion" element={<Financiacion />} />
          <Route path="/promociones" element={<Promociones />} />
          <Route path="/comparador" element={<Comparador />} />
          <Route path="/documentos" element={<Documentos />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/argumentario" element={<Argumentario />} />
          <Route path="/memoria" element={<Memoria />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/cliente" element={<ClienteMensaje />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return <AppRoutes />;
}
