// frontend/src/components/SuperAdmin/SuperAdminPanel.jsx
// Panel exclusivo del SuperAdministrador para gestionar empresas y sus feature flags
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Catálogo de features con etiquetas amigables y descripciones
const FEATURE_CATALOG = [
  { key: 'inbox',              label: 'Bandeja / Mensajería',       desc: 'Acceso a conversaciones y mensajes entrantes' },
  { key: 'whatsapp_personal',  label: 'WhatsApp Personal',          desc: 'Sesiones Baileys (QR) para WhatsApp personal' },
  { key: 'whatsapp_business',  label: 'WhatsApp Business (Meta)',   desc: 'Integración con Meta Cloud API' },
  { key: 'campaigns',          label: 'Campañas Masivas',           desc: 'Envío de mensajes en lote a múltiples contactos' },
  { key: 'vouchers',           label: 'Comprobantes de Pago',       desc: 'Verificación y gestión de comprobantes' },
  { key: 'appointments',       label: 'Calendario / Citas',         desc: 'Agendamiento y gestión de citas' },
  { key: 'document_templates', label: 'Plantillas de Documentos',   desc: 'Generación automática de documentos .docx' },
  { key: 'bot_ai',             label: 'Bot con Inteligencia Artificial', desc: 'Integración con Claude, GPT, Gemini' },
  { key: 'flow_rules',         label: 'Reglas de Flujo',            desc: 'Automatización y enrutamiento de mensajes' },
  { key: 'quick_messages',     label: 'Mensajes Rápidos',           desc: 'Respuestas rápidas predefinidas (canned responses)' },
  { key: 'labels',             label: 'Etiquetas',                  desc: 'Clasificación y filtrado por etiquetas' },
  { key: 'custom_modules',     label: 'Módulos Personalizados',     desc: 'Tablas y formularios de datos a medida' },
  { key: 'bot_catalogs',       label: 'Catálogos del Bot',          desc: 'Base de conocimiento para el chatbot' },
  { key: 'dashboard',          label: 'Dashboard Analítico',        desc: 'Estadísticas y métricas del sistema' },
  { key: 'team_management',    label: 'Gestión de Equipo',          desc: 'Crear y administrar usuarios del equipo' },
  { key: 'merge_templates',    label: 'Plantillas de Mensajes',     desc: 'Mensajes reutilizables con variables para WhatsApp, Email, SMS' },
];

const DEFAULT_FEATURES = Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, true]));

// ── Componente Toggle ────────────────────────────────────────────────────────
function FeatureToggle({ featureKey, label, desc, value, onChange, disabled }) {
  return (
    <div className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-colors
      ${value
        ? 'bg-indigo-500/10 border-indigo-500/30'
        : 'bg-slate-800/50 border-slate-700/40'
      }`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${value ? 'text-white' : 'text-slate-400'}`}>{label}</p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{desc}</p>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(featureKey, !value)}
        className={`relative flex-shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none
          ${value ? 'bg-indigo-600' : 'bg-slate-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={value ? 'Desactivar' : 'Activar'}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
          ${value ? 'translate-x-[22px]' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────
export default function SuperAdminPanel() {
  const navigate = useNavigate();
  const [companies, setCompanies]   = useState([]);
  const [selected, setSelected]     = useState(null);   // empresa seleccionada
  const [features, setFeatures]     = useState({});     // features editables
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ nombre: '', email: '', admin_name: '', admin_email: '', admin_password: '' });
  const [creating, setCreating]     = useState(false);

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
      setFeatures({ ...DEFAULT_FEATURES, ...(res.data?.active_features || {}) });
    } catch {
      setFeatures({ ...DEFAULT_FEATURES });
    }
  };

  const handleToggle = (key, value) => {
    setFeatures(prev => ({ ...prev, [key]: value }));
  };

  const handleEnableAll = () => setFeatures(Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, true])));
  const handleDisableAll = () => setFeatures(Object.fromEntries(FEATURE_CATALOG.map(f => [f.key, false])));

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/company/${selected.id}/features`, { features });
      toast.success(`Features de "${selected.nombre}" actualizadas`);
    } catch (err) {
      toast.error(err.message || 'Error guardando features');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/company/create', createForm);
      toast.success(`Empresa "${createForm.nombre}" creada`);
      setShowCreateModal(false);
      setCreateForm({ nombre: '', email: '', admin_name: '', admin_email: '', admin_password: '' });
      fetchCompanies();
    } catch (err) {
      toast.error(err.message || 'Error creando empresa');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCompany = async (company) => {
    if (!window.confirm(`¿Eliminar la empresa "${company.nombre}" y desactivar todos sus usuarios? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/company/${company.id}`);
      toast.success(`Empresa "${company.nombre}" eliminada`);
      if (selected?.id === company.id) { setSelected(null); setFeatures({}); }
      fetchCompanies();
    } catch (err) {
      toast.error(err.message || 'Error eliminando empresa');
    }
  };

  const activeCount = Object.values(features).filter(Boolean).length;

  return (
    <div className="flex h-full bg-slate-950 text-white overflow-hidden">

      {/* ── Lista de empresas ─────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-black text-violet-300">SuperAdmin</h1>
            <span className="text-xs text-slate-500">{companies.length} empresa{companies.length !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs text-slate-500">Gestión global de empresas y módulos</p>
          <button
            onClick={() => navigate('/gestion-funcionalidades')}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg transition-colors border border-indigo-500/30"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            Gestión de Funcionalidades
          </button>
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
              className={`group flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors
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
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCompany(c); }}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                title="Eliminar empresa"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva Empresa
          </button>
        </div>
      </div>

      {/* ── Panel de feature flags ─────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              </div>
              <p className="text-slate-400 text-sm">Selecciona una empresa para gestionar sus módulos</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white">{selected.nombre}</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {activeCount} de {FEATURE_CATALOG.length} módulos activos
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

            {/* Grid de features */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {FEATURE_CATALOG.map(f => (
                  <FeatureToggle
                    key={f.key}
                    featureKey={f.key}
                    label={f.label}
                    desc={f.desc}
                    value={features[f.key] ?? true}
                    onChange={handleToggle}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Modal crear empresa ────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-white mb-4">Nueva Empresa</h3>
            <form onSubmit={handleCreateCompany} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre de la empresa *</label>
                <input
                  required
                  value={createForm.nombre}
                  onChange={e => setCreateForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
                  placeholder="Ej: Acme Corp"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email de la empresa</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
                  placeholder="empresa@ejemplo.com"
                />
              </div>
              <hr className="border-slate-700" />
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Administrador inicial</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre del admin</label>
                <input
                  value={createForm.admin_name}
                  onChange={e => setCreateForm(p => ({ ...p, admin_name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
                  placeholder="Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Email del admin *</label>
                <input
                  required type="email"
                  value={createForm.admin_email}
                  onChange={e => setCreateForm(p => ({ ...p, admin_email: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
                  placeholder="admin@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Contraseña *</label>
                <input
                  required type="password" minLength={8}
                  value={createForm.admin_password}
                  onChange={e => setCreateForm(p => ({ ...p, admin_password: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl transition-colors">
                  {creating ? 'Creando...' : 'Crear empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
