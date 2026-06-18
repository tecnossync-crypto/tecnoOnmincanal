// frontend/src/components/SuperAdmin/GestionFuncionalidades.jsx
import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CONFIG_SECTIONS = [
  {
    section: 'General',
    features: [
      { key: 'config_company_profile', label: 'Perfil de la empresa',  desc: 'Datos y configuración de la empresa' },
      { key: 'team_management',        label: 'Operadores',            desc: 'Gestión de usuarios del equipo' },
      { key: 'labels',                 label: 'Etiquetas',             desc: 'Clasificación y filtrado por etiquetas' },
      { key: 'config_info_panel',      label: 'Panel de información',  desc: 'Configuración del panel informativo' },
      { key: 'config_import_contacts', label: 'Importar contactos',    desc: 'Importación masiva de contactos' },
    ],
  },
  {
    section: 'Canales',
    features: [
      { key: 'whatsapp_business',  label: 'WhatsApp API (Meta)',  desc: 'Integración con Meta Cloud API' },
      { key: 'config_messenger',   label: 'Messenger',            desc: 'Canal de Facebook Messenger' },
      { key: 'config_instagram',   label: 'Instagram',            desc: 'Canal de Instagram Direct' },
      { key: 'config_tiktok',      label: 'TikTok',               desc: 'Canal de TikTok' },
      { key: 'config_telegram',    label: 'Telegram',             desc: 'Canal de Telegram' },
    ],
  },
  {
    section: 'Bot IA',
    features: [
      { key: 'bot_ai',              label: 'Configuración del bot', desc: 'Integración con IA (Claude, GPT, Gemini)' },
      { key: 'flow_rules',          label: 'Reglas de flujo',       desc: 'Automatización y enrutamiento de mensajes' },
      { key: 'config_bot_response', label: 'Bot de respuesta',      desc: 'Bot de respuesta automática' },
    ],
  },
  {
    section: 'Automatizaciones',
    features: [
      { key: 'campaigns',           label: 'Campañas masivas',     desc: 'Envío de mensajes en lote' },
      { key: 'quick_messages',      label: 'Mensajes rápidos',     desc: 'Respuestas rápidas predefinidas' },
      { key: 'config_chat_routing', label: 'Enrutamiento de chat',  desc: 'Distribución automática de chats' },
      { key: 'config_reports',      label: 'Programar informe',     desc: 'Programación de reportes automáticos' },
    ],
  },
  {
    section: 'Desarrolladores',
    features: [
      { key: 'config_integrations', label: 'Integraciones',  desc: 'Integraciones con plataformas externas' },
      { key: 'config_widgets',      label: 'Widgets',        desc: 'Widgets embebidos para sitios web' },
      { key: 'config_plugins',      label: 'Complementos',   desc: 'Plugins y extensiones adicionales' },
    ],
  },
];

const ALL_CONFIG_KEYS = CONFIG_SECTIONS.flatMap(s => s.features.map(f => f.key));

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
        ${value ? 'bg-indigo-600' : 'bg-slate-600'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
        ${value ? 'translate-x-[22px]' : 'translate-x-1'}`} />
    </button>
  );
}

export default function GestionFuncionalidades() {
  const [companies, setCompanies] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [allFeatures, setAllFeatures] = useState({});
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/company/all');
      setCompanies(res.data || []);
    } catch {
      toast.error('Error cargando empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const selectCompany = async (company) => {
    setSelected(company);
    try {
      const res = await api.get(`/company/${company.id}/features`);
      setAllFeatures(res.data?.active_features || {});
    } catch {
      setAllFeatures({});
    }
  };

  const handleToggle = (key, value) => {
    setAllFeatures(prev => ({ ...prev, [key]: value }));
  };

  const handleEnableAll = () => {
    setAllFeatures(prev => {
      const next = { ...prev };
      ALL_CONFIG_KEYS.forEach(k => { next[k] = true; });
      return next;
    });
  };

  const handleDisableAll = () => {
    setAllFeatures(prev => {
      const next = { ...prev };
      ALL_CONFIG_KEYS.forEach(k => { next[k] = false; });
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/company/${selected.id}/features`, { features: allFeatures });
      toast.success(`Funcionalidades de "${selected.nombre}" actualizadas`);
    } catch (err) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = ALL_CONFIG_KEYS.filter(k => allFeatures[k] !== false).length;

  return (
    <div className="flex h-full bg-slate-950 text-white overflow-hidden">

      {/* Lista de empresas */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-black text-violet-300">Funcionalidades</h1>
          <p className="text-xs text-slate-500 mt-0.5">Controla las opciones de Configuración por empresa</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-8">Cargando...</p>
          ) : companies.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">Sin empresas registradas</p>
          ) : companies.map(c => (
            <div
              key={c.id}
              onClick={() => selectCompany(c)}
              className={`flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors
                ${selected?.id === c.id
                  ? 'bg-violet-600/20 border border-violet-500/40'
                  : 'hover:bg-slate-800/70 border border-transparent'}`}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {c.nombre?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{c.user_count ?? 0} usuarios</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de funcionalidades */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm">Selecciona una empresa para gestionar sus funcionalidades</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">{selected.nombre}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeCount} de {ALL_CONFIG_KEYS.length} funcionalidades activas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleEnableAll} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                  Activar todo
                </button>
                <button onClick={handleDisableAll} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                  Desactivar todo
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>

            {/* Secciones */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {CONFIG_SECTIONS.map(section => (
                <div key={section.section}>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3 px-1">
                    {section.section}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {section.features.map(f => (
                      <div
                        key={f.key}
                        className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors
                          ${allFeatures[f.key] !== false
                            ? 'bg-indigo-500/10 border-indigo-500/30'
                            : 'bg-slate-800/50 border-slate-700/40'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${allFeatures[f.key] !== false ? 'text-white' : 'text-slate-400'}`}>
                            {f.label}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.desc}</p>
                        </div>
                        <Toggle
                          value={allFeatures[f.key] !== false}
                          onChange={(v) => handleToggle(f.key, v)}
                          disabled={saving}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
