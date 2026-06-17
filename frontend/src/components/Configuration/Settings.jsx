// frontend/src/components/Configuration/Settings.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';

const SECTIONS = [
  {
    title: 'General',
    items: [
      { label: 'Perfil de la empresa',  to: '/config/perfilEmpresa'   },
      { label: 'Operadores',            to: '/team'                   },
      { label: 'Etiquetas',             to: '/config/etiquetas'       },
      { label: 'Panel de información',  to: '/config/panel-info'      },
      { label: 'Importar contactos',    to: '/config/upload'          },
    ],
  },
  {
    title: 'Canales',
    items: [
      { label: 'WhatsApp API (Meta)',   to: '/config/whatsapp',  badge: 'Meta' },
      { label: 'Messenger',             to: '/config/messenger'  },
      { label: 'Instagram',             to: '/config/instagram'  },
      { label: 'TikTok',               to: '/config/tiktok'     },
      { label: 'Telegram',             to: '/config/telegram'   },
    ],
  },
  {
    title: 'Bot IA',
    items: [
      { label: 'Configuración del bot', to: '/bot-config'             },
      { label: 'Reglas de flujo',       to: '/config/flow-rules'      },
      { label: 'Bot de respuesta',      to: '/config/bot-respuesta'   },
    ],
  },
  {
    title: 'Automatizaciones',
    items: [
      { label: 'Campañas masivas',      to: '/campaigns'              },
      { label: 'Mensajes rápidos',      to: '/config/mensajesRapidos' },
      { label: 'Enrutamiento de chat',  to: '/config/enrutamiento'    },
      { label: 'Programar informe',     to: '/config/informes'        },
    ],
  },
  {
    title: 'Módulos',
    items: [
      { label: 'Módulos personalizados', to: '/config/modulos' },
    ],
  },
  {
    title: 'Desarrolladores',
    items: [
      { label: 'Integraciones',         to: '/config/integraciones'   },
      { label: 'Widgets',               to: '/config/widgets'         },
      { label: 'Complementos',          to: '/config/complementos'    },
    ],
  },
];

export default function Settings() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const filtered = SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
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
