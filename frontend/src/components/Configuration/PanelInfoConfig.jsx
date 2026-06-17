// frontend/src/components/Configuration/PanelInfoConfig.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, X, Check, Tag } from 'lucide-react';
import api from '../../services/api';

const CONFIG_KEY = 'panel_info_config';

const DEFAULT_FIELDS = [
  { id: 'nombre',    label: 'Nombre completo' },
  { id: 'telefono',  label: 'Teléfono' },
  { id: 'correo',    label: 'Correo electrónico' },
  { id: 'canal',     label: 'Canal de entrada' },
  { id: 'etiquetas', label: 'Etiquetas de conversación' },
  { id: 'notas',     label: 'Notas' },
  { id: 'resumen',   label: 'Resumen del chat' },
];

const loadConfig = () => {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
  catch { return {}; }
};

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className="relative inline-flex flex-shrink-0 h-5 w-9 rounded-full transition-colors duration-200"
    style={{ background: checked ? '#6366f1' : '#e2e8f0' }}
  >
    <span
      className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
      style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
    />
  </button>
);

export default function PanelInfoConfig() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(() => {
    const s = loadConfig();
    return { hiddenFields: s.hiddenFields || [], customTemplates: s.customTemplates || [] };
  });
  const [newTemplateName, setNewTemplateName] = useState('');
  const [addingTemplate,  setAddingTemplate]  = useState(false);
  const [labels,          setLabels]          = useState([]);
  const [loadingLabels,   setLoadingLabels]   = useState(true);
  const [saved,           setSaved]           = useState(false);

  useEffect(() => { fetchLabels(); }, []);

  const fetchLabels = async () => {
    try {
      const res = await api.get('/labels');
      if (res.success) setLabels(res.data.filter(l => l.activo !== false));
    } catch {}
    setLoadingLabels(false);
  };

  const persistConfig = (next) => {
    setConfig(next);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleField = (fieldId) => {
    const hidden = config.hiddenFields.includes(fieldId)
      ? config.hiddenFields.filter(id => id !== fieldId)
      : [...config.hiddenFields, fieldId];
    persistConfig({ ...config, hiddenFields: hidden });
  };

  const addTemplate = () => {
    if (!newTemplateName.trim()) return;
    const next = [
      ...config.customTemplates,
      { id: String(Date.now()), label: newTemplateName.trim() }
    ];
    persistConfig({ ...config, customTemplates: next });
    setNewTemplateName('');
    setAddingTemplate(false);
  };

  const removeTemplate = (id) => {
    const next = config.customTemplates.filter(t => t.id !== id);
    persistConfig({ ...config, customTemplates: next });
  };

  return (
    <div className="h-full overflow-y-auto bg-white" style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium">Panel de Información</span>
        </div>

        <div className="flex items-center gap-2">
          {saved && (
            <span
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ color: '#16a34a', background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)' }}
            >
              <Check size={12} /> Guardado
            </span>
          )}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ border: '0.5px solid #e2e8f0', color: '#94a3b8' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8 max-w-2xl">

        {/* Descripción */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: '#eef2ff', border: '0.5px solid #c7d2fe' }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#6366f1" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
          </svg>
          <p className="text-sm" style={{ color: '#4338ca' }}>
            Configura los campos del panel lateral de información que aparece al abrir una conversación en la bandeja general.
          </p>
        </div>

        {/* ── Campos predeterminados ── */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#0f172a' }}>Campos predeterminados</h2>
          <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>
            Activa o desactiva los campos que aparecen por defecto en el panel de información.
          </p>
          <div className="rounded-xl overflow-hidden divide-y" style={{ border: '0.5px solid #e2e8f0', divideColor: '#f1f5f9' }}>
            {DEFAULT_FIELDS.map(field => {
              const isVisible = !config.hiddenFields.includes(field.id);
              return (
                <div
                  key={field.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors"
                  style={{ borderBottom: '0.5px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isVisible ? '#6366f1' : '#e2e8f0' }}
                    />
                    <span className="text-sm" style={{ color: isVisible ? '#0f172a' : '#94a3b8' }}>
                      {field.label}
                    </span>
                  </div>
                  <Toggle checked={isVisible} onChange={() => toggleField(field.id)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Campos personalizados ── */}
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: '#0f172a' }}>Campos personalizados</h2>
          <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>
            Define campos adicionales que aparecerán en todas las conversaciones. Los valores se guardan por contacto.
          </p>

          {config.customTemplates.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-3" style={{ border: '0.5px solid #e2e8f0' }}>
              {config.customTemplates.map((tpl, idx) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between px-4 py-3 group"
                  style={{ borderBottom: idx < config.customTemplates.length - 1 ? '0.5px solid #f1f5f9' : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366f1' }} />
                    <span className="text-sm" style={{ color: '#334155' }}>{tpl.label}</span>
                  </div>
                  <button
                    onClick={() => removeTemplate(tpl.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style={{ color: '#94a3b8' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {addingTemplate ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTemplate();
                  if (e.key === 'Escape') { setAddingTemplate(false); setNewTemplateName(''); }
                }}
                placeholder="Ej: Vehículo, N° de orden, Código cliente..."
                className="flex-1 text-sm rounded-lg px-3 py-2 outline-none transition-all"
                style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
              />
              <button
                onClick={addTemplate}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
                style={{ background: '#6366f1', color: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Agregar
              </button>
              <button
                onClick={() => { setAddingTemplate(false); setNewTemplateName(''); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                style={{ border: '0.5px solid #e2e8f0', color: '#94a3b8' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingTemplate(true)}
              className="flex items-center gap-2 text-sm w-full justify-center rounded-xl px-4 py-3 transition-colors"
              style={{ border: '0.5px dashed #c7d2fe', color: '#6366f1' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#6366f1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
            >
              <Plus size={14} /> Agregar campo personalizado
            </button>
          )}
        </div>

        {/* ── Etiquetas registradas ── */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Etiquetas registradas</h2>
            <button
              onClick={() => navigate('/config/etiquetas')}
              className="text-xs transition-colors"
              style={{ color: '#6366f1' }}
              onMouseEnter={e => e.currentTarget.style.color = '#4338ca'}
              onMouseLeave={e => e.currentTarget.style.color = '#6366f1'}
            >
              Gestionar etiquetas →
            </button>
          </div>
          <p className="text-xs mb-4" style={{ color: '#94a3b8' }}>
            Estas etiquetas están disponibles para asignar a cualquier conversación desde el panel lateral.
          </p>

          {loadingLabels ? (
            <p className="text-xs py-3 text-center" style={{ color: '#94a3b8' }}>Cargando etiquetas...</p>
          ) : labels.length === 0 ? (
            <div
              className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
              style={{ border: '0.5px dashed #e2e8f0' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#f1f5f9', color: '#cbd5e1' }}
              >
                <Tag size={18} />
              </div>
              <p className="text-xs" style={{ color: '#94a3b8' }}>No hay etiquetas registradas aún</p>
              <button
                onClick={() => navigate('/config/etiquetas')}
                className="text-xs font-medium transition-colors"
                style={{ color: '#6366f1' }}
                onMouseEnter={e => e.currentTarget.style.color = '#4338ca'}
                onMouseLeave={e => e.currentTarget.style.color = '#6366f1'}
              >
                Crear etiquetas →
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {labels.map(label => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: label.color || '#6366f1' }}
                >
                  {label.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
