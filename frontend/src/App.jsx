// frontend/src/App.jsx — versión final con TeamPanel
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import Layout          from './components/Layout/Layout';
import Login           from './components/Auth/Login';
import ForgotPassword  from './components/Auth/ForgotPassword';
import ResetPassword   from './components/Auth/ResetPassword';
import Inbox           from './components/Inbox/Inbox';
import BotConfigPanel  from './components/BotConfig/BotConfigPanel';
import CampaignsPanel  from './components/Campaigns/CampaignsPanel';
import TeamPanel       from './components/Team/TeamPanel';
import Dashboard       from './components/Dashboard/Dashboard';
import Settings        from './components/Configuration/Settings';
import PerfilEmpresa   from './components/Configuration/PerfilEmpresa';
import EtiquetasConfig  from './components/Configuration/Etiquetasconfig';
import PanelInfoConfig  from './components/Configuration/PanelInfoConfig';
import VouchersPanel    from './components/Vouchers/VouchersPanel';
import WhatsappConfig  from './components/Configuration/WhatsappConfig';
import Integraciones   from './components/Configuration/Integraciones';
import FlowRulesConfig       from './components/Configuration/FlowRulesConfig';
import MensajesRapidosConfig  from './components/Configuration/MensajesRapidosConfig';
import ModulosConfig          from './components/Modules/ModulosConfig';
import ModuleView             from './components/Modules/ModuleView';
import CalendarPanel          from './components/Calendar/CalendarPanel';
import TemplatesPanel         from './components/Templates/TemplatesPanel';
import SuperAdminPanel        from './components/SuperAdmin/SuperAdminPanel';
import MergeTemplatesPanel    from './components/MergeTemplates/MergeTemplatesPanel';


const Placeholder = ({ name }) => (
  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
     <span className="ml-2">{name} — próximamente</span>
  </div>
);


const PrivateRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({ role, children }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role && user.role !== 'superadmin') return <Navigate to="/inbox" replace />;
  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/inbox" replace />;
  return children;
};

export default function App() {
  const { token, fetchMe } = useAuthStore();
  useEffect(() => { if (token) fetchMe(); }, []);

  return (
    <Routes>
      <Route path="/login"                  element={<Login />} />
      <Route path="/forgot-password"        element={<ForgotPassword />} />
      <Route path="/reset-password/:token"  element={<ResetPassword />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/inbox" replace />} />

         {/* ── Rutas principales ── */}
        <Route path="inbox"      element={<Inbox />} />
        <Route path="bot-config" element={<RoleRoute role="admin"><BotConfigPanel /></RoleRoute>} />
        <Route path="campaigns"  element={<RoleRoute role="admin"><CampaignsPanel /></RoleRoute>} />
        <Route path="team"       element={<RoleRoute role="admin"><TeamPanel /></RoleRoute>} />
        <Route path="dashboard"  element={<RoleRoute role="admin"><Dashboard /></RoleRoute>} />
        <Route path="vouchers"   element={<VouchersPanel />} />
        <Route path="calendar"   element={<CalendarPanel />} />
        <Route path="templates"  element={<RoleRoute role="admin"><TemplatesPanel /></RoleRoute>} />
        <Route path="merge-templates" element={<MergeTemplatesPanel />} />

         {/* ── Configuraciónn ── */}

        <Route path="config"     element={<Settings />} />

         {/* ── General ── */}

        <Route path="config/perfilEmpresa"  element={<PerfilEmpresa />} />
        <Route path="config/configPerfiles" element={<Placeholder name="Perfiles" />} />
        <Route path="config/departamentos"  element={<Placeholder name="Departamentos" />} />
        <Route path="config/upload"         element={<Placeholder name="Importar" />} />
        <Route path="config/etiquetas"      element={<EtiquetasConfig />} />
        <Route path="config/panel-info"     element={<PanelInfoConfig />} />

         {/* Canales */}

        <Route path="config/whatsapp" element={<RoleRoute role="admin"><WhatsappConfig /></RoleRoute>} />
        <Route path="config/messenger" element={<Placeholder name="Messenger" />} />
        <Route path="config/instagram" element={<Placeholder name="Instagram" />} />
        <Route path="config/tiktok"    element={<Placeholder name="TikTok" />} />
        <Route path="config/telegram"  element={<Placeholder name="Telegram" />} />

         {/* Bot */}
          <Route path="config/bot-respuesta"  element={<Placeholder name="Bot de Respuesta" />} />
          <Route path="config/flow-rules"     element={<RoleRoute role="admin"><FlowRulesConfig /></RoleRoute>} />

        {/* Automatizaciones */}
        <Route path="config/enrutamiento"    element={<Placeholder name="Enrutamiento de Chat" />} />
        <Route path="config/informes"        element={<Placeholder name="Programar Informe" />} />
        <Route path="config/mensajesRapidos" element={<RoleRoute role="admin"><MensajesRapidosConfig /></RoleRoute>} />

         {/* Desarrolladores */}
        <Route path="config/integraciones" element={<RoleRoute role="admin"><Integraciones /></RoleRoute>} />
        <Route path="config/widgets"       element={<Placeholder name="Widgets" />} />
        <Route path="config/complementos"  element={<Placeholder name="Complementos" />} />
        {/* ── Módulos personalizados ── */}
        <Route path="modules/:slug" element={<ModuleView />} />

        {/* ── Panel SuperAdministrador ── */}
        <Route path="superadmin" element={<SuperAdminRoute><SuperAdminPanel /></SuperAdminRoute>} />

        {/* ── Config módulos (solo admin) ── */}
        <Route path="config/modulos" element={<RoleRoute role="admin"><ModulosConfig /></RoleRoute>} />

      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}