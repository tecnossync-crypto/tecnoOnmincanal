// frontend/src/components/Configuration/Integraciones.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Bot, Plug, Check } from 'lucide-react';

const PROVIDERS = [
  {
    key:     'claude',
    name:    'Anthropic Claude',
    models:  ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
    color:   '#D97706',
    bg:      '#FFFBEB',
    border:  '#FDE68A',
    docsUrl: 'https://console.anthropic.com',
    dotColor: '#D97706'
  },
  {
    key:     'openai',
    name:    'OpenAI',
    models:  ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    color:   '#059669',
    bg:      '#ECFDF5',
    border:  '#A7F3D0',
    docsUrl: 'https://platform.openai.com/api-keys',
    dotColor: '#059669'
  },
  {
    key:     'gemini',
    name:    'Google Gemini',
    models:  ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
    color:   '#2563EB',
    bg:      '#EFF6FF',
    border:  '#BFDBFE',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    dotColor: '#2563EB'
  }
];

export default function Integraciones() {
  const [integrations, setIntegrations]     = useState([]);
  const [selectedProvider, setProvider]     = useState(null);
  const [apiKey,           setApiKey]       = useState('');
  const [selectedModel,    setModel]        = useState('');
  const [label,            setLabel]        = useState('');
  const [testMsg,          setTestMsg]      = useState('Hola, ¿funcionas correctamente?');
  const [testResponse,     setTestResponse] = useState('');
  const [saving,           setSaving]       = useState(false);
  const [testing,          setTesting]      = useState(false);
  const [showKey,          setShowKey]      = useState(false);

  useEffect(() => { fetchIntegrations(); }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await api.get('/integrations');
      setIntegrations(res.data || []);
    } catch { setIntegrations([]); }
  };

  const handleSave = async () => {
    if (!selectedProvider) return toast.error('Selecciona un proveedor');
    if (!apiKey.trim())    return toast.error('Ingresa la API Key');
    setSaving(true);
    try {
      await api.post('/integrations', {
        provider: selectedProvider.key,
        api_key:  apiKey.trim(),
        label:    label || selectedProvider.name
      });
      toast.success(`${selectedProvider.name} configurado y activado`);
      setApiKey(''); setLabel('');
      fetchIntegrations();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const handleActivate = async (id) => {
    try {
      await api.patch(`/integrations/${id}/activate`);
      toast.success('Integración activada');
      fetchIntegrations();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/integrations/${id}`);
      toast.success('Integración eliminada');
      fetchIntegrations();
    } catch (e) { toast.error(e.message); }
  };

  const handleTest = async () => {
    if (!selectedProvider || !apiKey.trim())
      return toast.error('Selecciona proveedor e ingresa la API Key primero');
    setTesting(true); setTestResponse('');
    try {
      const res = await api.post('/integrations/test', {
        provider:    selectedProvider.key,
        api_key:     apiKey.trim(),
        model:       selectedModel || selectedProvider.models[0],
        testMessage: testMsg
      });
      setTestResponse(res.data?.response || 'Sin respuesta');
    } catch (e) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  return (
    <div className="h-full overflow-y-auto p-8"
         style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold" style={{ color: '#020202' }}>Integraciones de IA</h1>
        <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
          Conecta tu proveedor de inteligencia artificial. Solo uno puede estar activo a la vez.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* ── Seleccionar proveedor ── */}
        <div className="rounded-2xl p-6 bg-white" style={{ border: '0.5px solid #e2e8f0' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#475569' }}>
            1. Selecciona el proveedor
          </p>
          <div className="flex flex-col gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.key}
                onClick={() => { setProvider(p); setModel(p.models[0]); setTestResponse(''); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: selectedProvider?.key === p.key ? p.bg : '#f8fafc',
                  border: `1.5px solid ${selectedProvider?.key === p.key ? p.border : '#e2e8f0'}`,
                  color: p.color
                }}
              >
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.dotColor }} />
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: '#020202' }}>{p.name}</p>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>{p.models.length} modelos disponibles</p>
                </div>
                {selectedProvider?.key === p.key && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}>
                    Seleccionado
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Configurar API Key ── */}
        <div className="rounded-2xl p-6 bg-white" style={{ border: '0.5px solid #e2e8f0' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#475569' }}>
            2. Configura tu API Key
          </p>

          {!selectedProvider ? (
            <div className="text-center py-8 text-sm" style={{ color: '#94a3b8' }}>
              Selecciona un proveedor primero
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#64748b' }}>
                  Nombre descriptivo (opcional)
                </label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder={`Mi cuenta ${selectedProvider.name}`}
                  className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium" style={{ color: '#64748b' }}>
                    API Key
                  </label>
                  <a href={selectedProvider.docsUrl} target="_blank" rel="noreferrer"
                     className="text-xs" style={{ color: '#6366f1' }}>
                    Obtener key →
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full text-sm px-3 py-2 rounded-xl outline-none pr-10"
                    style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc', fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-xs"
                    style={{ color: '#94a3b8' }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: '#64748b' }}>
                  Modelo por defecto
                </label>
                <select
                  value={selectedModel}
                  onChange={e => setModel(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ border: '0.5px solid #e2e8f0', background: '#f8fafc' }}
                >
                  {selectedProvider.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Test */}
              <div className="rounded-xl p-3" style={{ background: '#f1f5f9', border: '0.5px solid #e2e8f0' }}>
                <p className="text-xs font-medium mb-2" style={{ color: '#64748b' }}>Probar antes de guardar</p>
                <div className="flex gap-2">
                  <input
                    value={testMsg}
                    onChange={e => setTestMsg(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                    style={{ border: '0.5px solid #e2e8f0', background: '#fff' }}
                  />
                  <button
                    onClick={handleTest}
                    disabled={testing}
                    className="text-xs px-3 py-2 rounded-lg font-medium transition-all"
                    style={{ background: '#6366f1', color: '#fff', opacity: testing ? 0.7 : 1 }}
                  >
                    {testing ? '...' : 'Probar'}
                  </button>
                </div>
                {testResponse && (
                  <div className="mt-2 p-2 rounded-lg text-xs flex items-start gap-1.5" style={{ background: '#fff', border: '0.5px solid #e2e8f0', color: '#475569' }}>
                    <Bot size={12} className="flex-shrink-0 mt-0.5 text-indigo-400" />
                    {testResponse}
                  </div>
                )}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#16a34a', color: '#fff', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Guardando...' : 'Guardar y activar'}
              </button>
            </div>
          )}
        </div>

        {/* ── Integraciones existentes ── */}
        {integrations.length > 0 && (
          <div className="lg:col-span-2 rounded-2xl p-6 bg-white" style={{ border: '0.5px solid #e2e8f0' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#475569' }}>
              Integraciones configuradas
            </p>
            <div className="flex flex-col gap-3">
              {integrations.map(intg => {
                const p = PROVIDERS.find(pr => pr.key === intg.provider);
                return (
                  <div key={intg.id}
                       className="flex items-center gap-4 px-4 py-3 rounded-xl"
                       style={{ background: intg.is_active ? p?.bg || '#f0fdf4' : '#f8fafc', border: `0.5px solid ${intg.is_active ? p?.border || '#bbf7d0' : '#e2e8f0'}` }}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p?.dotColor || '#94a3b8' }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: '#020202' }}>
                        {intg.label || p?.name || intg.provider}
                      </p>
                      <p className="text-xs" style={{ color: '#94a3b8' }}>{intg.api_key}</p>
                    </div>
                    {intg.is_active ? (
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: '#dcfce7', color: '#16a34a' }}>
                        <span className="flex items-center gap-1"><Check size={11} /> Activo</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivate(intg.id)}
                        className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
                        style={{ background: '#f1f5f9', color: '#6366f1', border: '0.5px solid #e2e8f0' }}
                      >
                        Activar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(intg.id)}
                      className="text-xs px-2 py-1 rounded-lg transition-all"
                      style={{ background: '#fef2f2', color: '#dc2626' }}
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}