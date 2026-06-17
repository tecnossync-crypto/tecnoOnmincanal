// frontend/src/components/Layout/Layout.jsx
// ─────────────────────────────────────────────────────────────
// Layout principal de Tecnossync
// - Sidebar con branding animado
// - Navegación condicional según rol (RBAC)
// - 100% responsive (se colapsa a iconos en móvil)
// - Notificaciones en tiempo real por canal
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useConversationStore, useThemeStore, useModuleStore } from '../../store';
import { getSocket } from '../../services/socket';
import { ModuleIcon } from '../Modules/ModulosConfig';
import toast from 'react-hot-toast';

// ─── Icono SVG inline para cada canal ───────────────────────
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
  </svg>
);

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TemplateIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const MergeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l1.5 1.5L13 11m-4 6h6" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v1.5M17.25 3v1.5M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.414 2.798H4.213c-1.444 0-2.414-1.798-1.414-2.798L4.2 15.3" />
  </svg>
);

const CampaignIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
  </svg>
);

const TeamIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const VoucherIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364-6.364l-1.06 1.06M6.696 17.304l-1.06 1.06m12.728 0l-1.06-1.06M6.696 6.696l-1.06-1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);
// ─── Configuración de nav por rol ───────────────────────────
// Todos los posibles nav items con su feature flag asociado (null = siempre visible)
const ALL_NAV_ITEMS = [
  { to: '/inbox',      icon: <InboxIcon />,     label: 'Bandeja',        id: 'inbox',      feature: null,               roles: ['admin','agent','supervisor','superadmin'] },
  { to: '/calendar',   icon: <CalendarIcon />,  label: 'Calendario',     id: 'calendar',   feature: 'appointments',     roles: ['admin','agent','supervisor','superadmin'] },
  { to: '/templates',  icon: <TemplateIcon />,  label: 'Documentos',     id: 'templates',  feature: 'document_templates', roles: ['admin','superadmin'] },
  { to: '/merge-templates', icon: <MergeIcon />, label: 'Plantillas Msg',  id: 'merge',      feature: 'merge_templates',  roles: ['admin','agent','supervisor','superadmin'] },
  { to: '/campaigns',  icon: <CampaignIcon />,  label: 'Campañas',       id: 'campaigns',  feature: 'campaigns',        roles: ['admin','superadmin'] },
  { to: '/vouchers',   icon: <VoucherIcon />,   label: 'Comprobantes',   id: 'vouchers',   feature: 'vouchers',         roles: ['admin','agent','supervisor','superadmin'] },
  { to: '/config',     icon: <SettingsIcon />,  label: 'Configuración',  id: 'config',     feature: null,               roles: ['admin','superadmin'] },
  { to: '/dashboard',  icon: <DashboardIcon />, label: 'Dashboard',      id: 'dashboard',  feature: 'dashboard',        roles: ['admin','superadmin'] },
  { to: '/superadmin', icon: <TeamIcon />,       label: 'SuperAdmin',     id: 'superadmin', feature: null,               roles: ['superadmin'] },
];

const CHANNEL_LABEL = { whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram' };

export default function Layout() {
  const { user, logout, isAdmin, hasFeature } = useAuthStore();
  const { addIncomingMessage, fetchConversations } = useConversationStore();
  const { theme, toggleTheme }           = useThemeStore();
  const { modules, fetchModules }        = useModuleStore();
  const [sidebarOpen, setSidebarOpen]    = useState(false); // móvil
  const navigate = useNavigate();

  const role = user?.role || 'agent';

  // Filtrar nav items según rol y features activas de la empresa
  const navItems = ALL_NAV_ITEMS.filter(item => {
    if (!item.roles.includes(role)) return false;
    if (item.feature && !hasFeature(item.feature)) return false;
    return true;
  });

  useEffect(() => { fetchModules(); }, []);

  // ── Socket.io ────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (data) => {
      addIncomingMessage(data);
      const ch = CHANNEL_LABEL[data.conversation?.channel] || 'Mensaje';
      toast(`[${ch}] ${data.contact?.name || 'Contacto'}: ${data.message?.content?.substring(0, 40) || '...'}`,
        { duration: 4000 }
      );
    };

    const onEscalated = () => {
      toast('Conversación escalada a agente', { duration: 5000 });
      fetchConversations();
    };

    const onAssignedToYou = () => {
      toast('Se te asignó una nueva conversación', { duration: 5000 });
      fetchConversations();
    };

    const onDocReady = (data) => {
      toast(`📄 Documento listo para revisar: "${data?.templateName || 'Documento'}"`, {
        duration: 7000,
        icon: '📄',
      });
    };

    socket.on('message:new',               onNewMessage);
    socket.on('conversation:escalated',    onEscalated);
    socket.on('conversation:assigned',     fetchConversations);
    socket.on('conversation:assigned_to_you', onAssignedToYou);
    socket.on('document:ready',            onDocReady);

    return () => {
      socket.off('message:new',               onNewMessage);
      socket.off('conversation:escalated',    onEscalated);
      socket.off('conversation:assigned',     fetchConversations);
      socket.off('conversation:assigned_to_you', onAssignedToYou);
      socket.off('document:ready',            onDocReady);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?';

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden">

      {/* ── Overlay móvil ─────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════ */}
      <aside className={`
        fixed md:relative z-30 md:z-auto
        flex flex-col h-full
        bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-56' : 'w-16 md:w-56'}
        shadow-xl shadow-slate-900/30
      `}>

        {/* ── Logo / Brand ────────────────────────────── */}
        <div className="ts-logo-container flex items-center gap-3 px-3 py-4 border-b border-white/5">
          {/* Isotipo */}
          <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
              <path d="M4 8a4 4 0 014-4h8a4 4 0 014 4v8a4 4 0 01-4 4H8l-4 4V8z"/>
            </svg>
          </div>
          {/* Nombre (oculto en móvil colapsado) */}
          <div className={`ts-sidebar-label overflow-hidden transition-all ${sidebarOpen ? 'opacity-100 w-full' : 'opacity-0 w-0 md:opacity-100 md:w-full'}`}>
            <span className="ts-brand-name text-lg font-black leading-none block">
              Tecnossync
            </span>
            <span className="text-slate-500 text-xs">Omnichannel IA</span>
          </div>
        </div>

        {/* ── Canales activos (indicadores pequeños) ──── */}
        <div className={`flex gap-1.5 px-3 py-2.5 border-b border-white/5 ts-sidebar-label ${sidebarOpen ? '' : 'hidden md:flex'}`}>
          {[
            { label: 'WA', color: 'bg-green-500', title: 'WhatsApp' },
            { label: 'MS', color: 'bg-blue-500',  title: 'Messenger'},
            { label: 'IG', color: 'bg-pink-500',  title: 'Instagram'},
          ].map(ch => (
            <span key={ch.label} title={ch.title}
              className={`${ch.color} text-white text-xs font-bold px-1.5 py-0.5 rounded-md opacity-70`}>
              {ch.label}
            </span>
          ))}
        </div>

        {/* ── Navegación ──────────────────────────────── */}
<nav className="flex-1 flex flex-col gap-1 p-2 pt-3">
  {navItems.map((item) =>
    item.action === 'settings' ? (
      <button
        key={item.id}
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-slate-400 hover:bg-white/5 hover:text-white w-full"
        title={item.label}
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {item.icon}
        </span>
        <span className={`ts-sidebar-label text-sm font-medium truncate ${sidebarOpen ? '' : 'hidden md:block'}`}>
          {item.label}
        </span>
      </button>
    ) : (
      <NavLink
        key={item.id}
        to={item.to}
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 group
           ${isActive
             ? 'bg-indigo-600/80 text-white shadow-lg shadow-indigo-500/20'
             : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
        }
        title={item.label}
      >
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {item.icon}
        </span>
        <span className={`ts-sidebar-label text-sm font-medium truncate ${sidebarOpen ? '' : 'hidden md:block'}`}>
          {item.label}
        </span>
      </NavLink>
    )
  )}
</nav>

        {/* ── Módulos personalizados ──────────────────── */}
        {modules.length > 0 && (
          <div className="px-2 pb-1">
            <p className={`ts-sidebar-label text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-2.5 mb-1 ${sidebarOpen ? '' : 'hidden md:block'}`}>
              Módulos
            </p>
            {modules.map(mod => (
              <NavLink
                key={mod.id}
                to={`/modules/${mod.slug}`}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-150 group
                   ${isActive
                     ? 'bg-white/10 text-white'
                     : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
                }
                title={mod.name}
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: mod.color }}>
                  <ModuleIcon name={mod.icon} size={11} className="text-white" />
                </span>
                <span className={`ts-sidebar-label text-sm font-medium truncate ${sidebarOpen ? '' : 'hidden md:block'}`}>
                  {mod.name}
                </span>
              </NavLink>
            ))}
          </div>
        )}

        {/* ── Modo claro / oscuro ─────────────────────── */}
        <div className={`px-2 pt-2 ${sidebarOpen ? '' : 'hidden md:block'}`}>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
            className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 w-full
                       text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
            </span>
            <span className={`ts-sidebar-label text-sm font-medium truncate flex-1 text-left ${sidebarOpen ? '' : 'hidden md:block'}`}>
              {theme === 'dark' ? 'Modo noche' : 'Modo día'}
            </span>
            {/* Switch visual */}
            <span className={`ts-sidebar-label relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200
                              ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-600'} ${sidebarOpen ? '' : 'hidden md:inline-flex'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200
                                ${theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </span>
          </button>
        </div>

        {/* ── Separador + Rol del usuario ─────────────── */}
        <div className={`px-3 pb-2 border-t border-white/5 pt-2 mt-1 ts-sidebar-label ${sidebarOpen ? '' : 'hidden md:block'}`}>
          <div className="flex items-center gap-2 px-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              role === 'superadmin'
                ? 'bg-violet-500/30 text-violet-300'
                : role === 'admin'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-600/40 text-slate-400'
            }`}>
              {role === 'superadmin' ? 'SuperAdmin' : role === 'admin' ? 'Admin' : 'Agente'}
            </span>
          </div>
        </div>

        {/* ── Usuario + Logout ────────────────────────── */}
        <div className="flex items-center gap-2 p-2 border-t border-white/5">
          {/* Avatar */}
          <div className="ts-online-dot flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow shadow-indigo-500/30">
            {initials}
          </div>
          {/* Info usuario */}
          <div className={`ts-sidebar-label flex-1 overflow-hidden ${sidebarOpen ? '' : 'hidden md:block'}`}>
            <p className="text-white text-xs font-semibold truncate">{user?.name || 'Usuario'}</p>
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`ts-sidebar-label flex-shrink-0 w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors ${sidebarOpen ? '' : 'hidden md:flex'}`}
            title="Cerrar sesión"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════
          CONTENIDO PRINCIPAL
      ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Barra superior móvil ─────────────────────── */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="ts-brand-name text-lg font-black">Tecnossync</span>
        </header>

        {/* ── Área de contenido ──────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
