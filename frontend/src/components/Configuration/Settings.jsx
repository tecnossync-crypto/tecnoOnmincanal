// frontend/src/components/Configuration/Settings.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';

const SECTIONS = [
  {
    title: 'General',
    items: [
      { label: 'Perfil de la empresa',  to: '/config/perfilEmpresa',   feature: 'config_company_profile' },
      { label: 'Operadores',            to: '/team',                   feature: 'team_management' },
      { label: 'Etiquetas',             to: '/config/etiquetas',       feature: 'labels' },
      { label: 'Panel de información',  to: '/config/panel-info',      feature: 'config_info_panel' },
      { label: 'Importar contactos',    to: '/config/upload',          feature: 'config_import_contacts' },
    ],
  },
  {
    title: 'Canales',
    items: [
      { label: 'WhatsApp API (Meta)',   to: '/config/whatsapp',  badge: 'Meta', feature: 'whatsapp_business' },
      { label: 'Messenger',             to: '/config/messenger',  feature: 'config_messenger' },
      { label: 'Instagram',             to: '/config/instagram',  feature: 'config_instagram' },
      { label: 'TikTok',               to: '/config/tiktok',     feature: 'config_tiktok' },
      { label: 'Telegram',             to: '/config/telegram',   feature: 'config_telegram' },
    ],
  },
  {
    title: 'Bot IA',
    items: [
      { label: 'Configuración del bot', to: '/bot-config',            feature: 'bot_ai' },
      { label: 'Reglas de flujo',       to: '/config/flow-rules',     feature: 'flow_rules' },
      { label: 'Bot de respuesta',      to: '/config/bot-respuesta',  feature: 'config_bot_response' },
    ],
  },
  {
    title: 'Automatizaciones',
    items: [
      { label: 'Campañas masivas',      to: '/campaigns',              feature: 'campaigns' },
      { label: 'Mensajes rápidos',      to: '/config/mensajesRapidos', feature: 'quick_messages' },
      { label: 'Enrutamiento de chat',  to: '/config/enrutamiento',    feature: 'config_chat_routing' },
      { label: 'Programar informe',     to: '/config/informes',        feature: 'config_reports' },
    ],
  },
  {
    title: 'Módulos',
    items: [
      { label: 'Módulos personalizados', to: '/config/modulos', feature: 'custom_modules' },
    ],
  },
  {
    title: 'Desarrolladores',
    items: [
      { label: 'Integraciones',         to: '/config/integraciones',   feature: 'config_integrations' },
      { label: 'Widgets',               to: '/config/widgets',         feature: 'config_widgets' },
      { label: 'Complementos',          to: '/config/complementos',    feature: 'config_plugins' },
    ],
  },
];

export default function Settings() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, hasFeature } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const filtered = SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) &&
        (!item.feature || hasFeature(item.feature))
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-semibold text-slate-800">Configuración</h1>
          <p className="text-xs text-slate-400 mt-0.5">Administra tu cuenta y preferencias</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Buscador */}
          <div className="relative">
            <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar opción..."
              className="pl-8 pr-8 py-1.5 text-sm bg-slate-100 rounded-lg border border-transparent outline-none focus:border-indigo-300 focus:bg-white transition-colors w-48"
              style={{ color: '#374151' }}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────────── */}
      <div className="px-8 py-6 max-w-5xl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <svg viewBox="0 0 24 24" className="w-8 h-8 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
            </svg>
            <p className="text-sm">Sin resultados para "<span className="text-slate-600">{query}</span>"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map(section => (
              <div key={section.title} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {/* Section header */}
                <div className="px-4 py-3 border-b border-slate-50">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    {section.title}
                  </p>
                </div>
                {/* Items */}
                <div className="p-2">
                  {section.items.map(item => (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 group
                        ${isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`
                      }
                    >
                      <span className="truncate">{item.label}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {item.badge}
                          </span>
                        )}
                        <svg viewBox="0 0 24 24" className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                        </svg>
                      </div>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
