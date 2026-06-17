// frontend/src/components/Configuration/FlowRulesConfig.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  FileText, Package, UserCheck, Bot, MessageSquare,
  AlertTriangle, Tag, Bell, Ban, Send,
  Pencil, Zap
} from 'lucide-react';

// ─── Textos legibles ────────────────────────────────────────────
const TRIGGER_LABELS = {
  catalog_sent:      'Catálogo específico enviado',
  catalog_any:       'Cualquier catálogo enviado',
  bot_handoff:       'Bot solicita atención humana',
  bot_text_contains: 'Respuesta del bot contiene texto',
  user_keyword:      'Mensaje del cliente contiene texto',
  no_bot_response:   'Bot no pudo responder',
};

const ACTION_LABELS = {
  apply_label:  'Aplicar etiqueta al chat',
  notify_human: 'Notificar al agente humano',
  disable_bot:  'Desactivar bot en este chat',
  send_message: 'Enviar mensaje automático',
};

const TRIGGER_COLORS = {
  catalog_sent:      'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  catalog_any:       'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  bot_handoff:       'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  bot_text_contains: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  user_keyword:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  no_bot_response:   'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};

const ACTION_COLORS = {
  apply_label:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  notify_human: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  disable_bot:  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  send_message: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
};

// Triggers con opciones de Catálogo
const TRIGGER_OPTIONS = [
  { value: 'catalog_sent',      label: 'Catálogo específico enviado',    icon: <FileText size={14} />,      hint: 'Cuando el bot envía un catálogo determinado' },
  { value: 'catalog_any',       label: 'Cualquier catálogo enviado',     icon: <Package size={14} />,       hint: 'Cuando el bot envía cualquier catálogo' },
  { value: 'bot_handoff',       label: 'Bot solicita atención humana',   icon: <UserCheck size={14} />,     hint: 'El bot incluye [HUMAN_NEEDED] en su respuesta' },
  { value: 'bot_text_contains', label: 'Respuesta del bot contiene',     icon: <Bot size={14} />,           hint: 'Una palabra específica en la respuesta del bot' },
  { value: 'user_keyword',      label: 'Cliente escribe palabra clave',  icon: <MessageSquare size={14} />, hint: 'Una palabra en el mensaje del cliente' },
  { value: 'no_bot_response',   label: 'Bot no pudo responder',          icon: <AlertTriangle size={14} />, hint: 'Sin integración activa o error de IA' },
];

const ACTION_OPTIONS = [
  { value: 'apply_label',  label: 'Aplicar etiqueta al chat',  icon: <Tag size={14} />,           hint: 'Añade una etiqueta al chat automáticamente' },
  { value: 'notify_human', label: 'Notificar al agente',       icon: <Bell size={14} />,          hint: 'Envía alerta en tiempo real a los agentes' },
  { value: 'disable_bot',  label: 'Desactivar bot',            icon: <Ban size={14} />,           hint: 'Apaga el bot en este chat para atención manual' },
  { value: 'send_message', label: 'Enviar mensaje al cliente', icon: <Send size={14} />,          hint: 'Envía un mensaje predefinido al cliente' },
];

const EMPTY_FORM = {
  name:          '',
  trigger_type:  'catalog_sent',
  trigger_value: '',
  action_type:   'apply_label',
  action_value:  '',
  channel:       'all',
  priority:      0,
};

const triggerNeedsValue = (t) => ['catalog_sent', 'bot_text_contains', 'user_keyword'].includes(t);

// ─── Chip de etiqueta con color del sistema ─────────────────────
function LabelChip({ label, selected, onClick }) {
  const color = label.color || '#6366f1';
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      style={{
        backgroundColor: selected ? color : `${color}20`,
        borderColor:     color,
        color:           selected ? '#fff' : color,
      }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border
        transition-all cursor-pointer select-none
        ${selected ? 'shadow-sm scale-105' : 'hover:opacity-80'}
      `}
    >
      {selected && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {label.nombre}
    </button>
  );
}

// ─── Selector de Trigger / Action como tarjetas ─────────────────
function CardSelector({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
            value === opt.value
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
              : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{opt.icon}</span>
            <span className={`text-xs font-semibold ${value === opt.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-slate-200'}`}>
              {opt.label}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">{opt.hint}</p>
        </button>
      ))}
    </div>
  );
}

export default function FlowRulesConfig() {
  const navigate = useNavigate();
  const [rules,    setRules]    = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [labels,   setLabels]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [rulesRes, catRes, labRes] = await Promise.all([
        api.get('/flow-rules'),
        api.get('/bot-catalogs'),
        api.get('/labels'),
      ]);
      setRules(rulesRes.data    || []);
      setCatalogs(catRes.data  || []);
      setLabels(labRes.data    || []);
    } catch (e) {
      toast.error('Error cargando datos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit   = (rule) => {
    setEditing(rule);
    setForm({
      name:          rule.name,
      trigger_type:  rule.trigger_type,
      trigger_value: rule.trigger_value || '',
      action_type:   rule.action_type,
      action_value:  rule.action_value || '',
      channel:       rule.channel || 'all',
      priority:      rule.priority ?? 0,
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setTrigger = (val) => setForm(f => ({ ...f, trigger_type: val, trigger_value: '' }));
  const setAction  = (val) => setForm(f => ({ ...f, action_type:  val, action_value:  '' }));

  const handleSave = async () => {
    if (!form.name.trim())  return toast.error('El nombre es obligatorio');
    if (triggerNeedsValue(form.trigger_type) && !form.trigger_value.trim())
      return toast.error('Selecciona o escribe el valor del disparador');
    if (form.action_type === 'apply_label' && !form.action_value.trim())
      return toast.error('Selecciona una etiqueta');
    if (form.action_type === 'send_message' && !form.action_value.trim())
      return toast.error('Escribe el mensaje a enviar');

    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/flow-rules/${editing.id}`, form);
        setRules(prev => prev.map(r => r.id === editing.id ? res.data : r));
        toast.success('Regla actualizada');
      } else {
        const res = await api.post('/flow-rules', form);
        setRules(prev => [res.data, ...prev]);
        toast.success('Regla creada');
      }
      closeModal();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    try {
      const res = await api.patch(`/flow-rules/${rule.id}/toggle`);
      setRules(prev => prev.map(r => r.id === rule.id ? res.data : r));
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`¿Eliminar la regla "${rule.name}"?`)) return;
    try {
      await api.delete(`/flow-rules/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Regla eliminada');
    } catch (e) { toast.error(e.message); }
  };

  // Busca la etiqueta del sistema por nombre para mostrar su color
  const findLabel = (nombre) => labels.find(l => l.nombre === nombre);

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
         style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 dark:bg-violet-500/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Reglas de Flujo</h1>
            <p className="text-xs text-slate-400 mt-0.5">Acciones automáticas basadas en el comportamiento del bot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nueva regla
          </button>
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8 flex items-center justify-center transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tip ────────────────────────────────────────── */}
      <div className="mx-8 mt-5 p-4 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
        <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">
          <span className="font-semibold">¿Cómo funciona?</span> Cada vez que el bot responde, evalúa estas reglas.
          Para que el bot solicite atención humana por su cuenta, añade
          <code className="mx-1 bg-violet-100 dark:bg-violet-500/20 px-1 rounded text-[11px] font-mono">[HUMAN_NEEDED]</code>
          como instrucción en su prompt del sistema.
        </p>
      </div>

      {/* ── Lista ──────────────────────────────────────── */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Sin reglas de flujo</p>
            <p className="text-xs mt-1 text-slate-400">Crea la primera regla para automatizar el comportamiento del bot</p>
            <button onClick={openCreate}
              className="mt-4 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors">
              Crear primera regla
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rules.map(rule => {
              const labelObj = rule.action_type === 'apply_label' ? findLabel(rule.action_value) : null;
              return (
                <div key={rule.id}
                  className={`group flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    rule.is_active
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-white/5 opacity-55'
                  }`}>

                  {/* Toggle */}
                  <button onClick={() => handleToggle(rule)}
                    className={`relative mt-0.5 flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
                      rule.is_active ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      rule.is_active ? 'translate-x-4' : ''
                    }`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Nombre + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold text-sm text-slate-800 dark:text-white">{rule.name}</span>
                      {rule.channel !== 'all' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                          {rule.channel === 'whatsapp_business' ? 'WA Business' : 'WA Personal'}
                        </span>
                      )}
                      {rule.priority > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                          Prioridad {rule.priority}
                        </span>
                      )}
                    </div>

                    {/* Si → Entonces visual */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Trigger pill */}
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${TRIGGER_COLORS[rule.trigger_type] || 'bg-slate-100 text-slate-600'}`}>
                        {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                        {rule.trigger_value ? `: "${rule.trigger_value}"` : ''}
                      </span>

                      <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>

                      {/* Action — si es etiqueta del sistema, mostrar chip con color */}
                      {rule.action_type === 'apply_label' && labelObj ? (
                        <span
                          style={{ backgroundColor: `${labelObj.color}22`, color: labelObj.color, borderColor: `${labelObj.color}55` }}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold border"
                        >
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: labelObj.color }} />
                          {labelObj.nombre}
                        </span>
                      ) : (
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${ACTION_COLORS[rule.action_type] || 'bg-slate-100 text-slate-600'}`}>
                          {ACTION_LABELS[rule.action_type] || rule.action_type}
                          {rule.action_value && rule.action_type === 'send_message'
                            ? `: "${rule.action_value.slice(0, 35)}${rule.action_value.length > 35 ? '…' : ''}"`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Botones editar/eliminar */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(rule)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(rule)}
                      className="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL CREAR / EDITAR
      ══════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{editing ? <Pencil size={16} /> : <Zap size={16} />}</span>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {editing ? 'Editar regla' : 'Nueva regla de flujo'}
                </h2>
              </div>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-6">

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Nombre de la regla</label>
                <input
                  value={form.name}
                  onChange={e => setF('name', e.target.value)}
                  placeholder="Ej: Etiquetar cuando se envía catálogo de precios"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition"
                />
              </div>

              {/* ── DISPARADOR ─────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Si…</span>
                  <span className="text-xs text-slate-400">¿Cuándo se activa esta regla?</span>
                </div>
                <CardSelector options={TRIGGER_OPTIONS} value={form.trigger_type} onChange={setTrigger} />

                {/* Valor dinámico según trigger */}
                {form.trigger_type === 'catalog_sent' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Selecciona el catálogo</label>
                    {catalogs.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/20">
                        No hay catálogos creados. Créalos en <strong>Configuración → Chatbot</strong>.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {catalogs.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => setF('trigger_value', c.identificador)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                              form.trigger_value === c.identificador
                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                            }`}>
                            <FileText size={14} className="text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{c.nombre}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{c.identificador}</p>
                            </div>
                            {form.trigger_value === c.identificador && (
                              <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(form.trigger_type === 'bot_text_contains' || form.trigger_type === 'user_keyword') && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      {form.trigger_type === 'user_keyword' ? 'Palabra clave del cliente' : 'Texto en la respuesta del bot'}
                    </label>
                    <input
                      value={form.trigger_value}
                      onChange={e => setF('trigger_value', e.target.value)}
                      placeholder={form.trigger_type === 'user_keyword' ? 'Ej: precio, cotización, llamar' : 'Ej: no puedo ayudar, comunícate con'}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">La búsqueda no distingue mayúsculas/minúsculas.</p>
                  </div>
                )}
              </div>

              {/* ── ACCIÓN ─────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Entonces…</span>
                  <span className="text-xs text-slate-400">¿Qué debe hacer el sistema?</span>
                </div>
                <CardSelector options={ACTION_OPTIONS} value={form.action_type} onChange={setAction} />

                {/* ── apply_label: chips de colores del sistema ── */}
                {form.action_type === 'apply_label' && (
                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">
                      Selecciona la etiqueta a aplicar
                    </label>
                    {labels.length === 0 ? (
                      <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/20">
                        No hay etiquetas creadas. Créalas en <strong>Configuración → Etiquetas</strong>.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/8 min-h-[60px]">
                        {labels.map(label => (
                          <LabelChip
                            key={label.id}
                            label={label}
                            selected={form.action_value === label.nombre}
                            onClick={() => setF('action_value', label.nombre)}
                          />
                        ))}
                      </div>
                    )}
                    {form.action_value && (
                      <p className="text-xs text-slate-400 mt-2">
                        Se aplicará: <strong className="text-slate-600 dark:text-slate-300">"{form.action_value}"</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* ── notify_human: mensaje opcional ── */}
                {form.action_type === 'notify_human' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Mensaje de alerta para el agente <span className="text-slate-400">(opcional)</span>
                    </label>
                    <input
                      value={form.action_value}
                      onChange={e => setF('action_value', e.target.value)}
                      placeholder="Ej: Cliente necesita asesoría sobre el catálogo enviado"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Si lo dejas vacío se usará un mensaje genérico.</p>
                  </div>
                )}

                {/* ── send_message: texto del mensaje ── */}
                {form.action_type === 'send_message' && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                      Mensaje a enviar al cliente
                    </label>
                    <textarea
                      value={form.action_value}
                      onChange={e => setF('action_value', e.target.value)}
                      rows={3}
                      placeholder="Ej: Un agente te contactará en breve. Mientras tanto, ¿hay algo más en que pueda ayudarte?"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition resize-none"
                    />
                  </div>
                )}

                {/* ── disable_bot: info ── */}
                {form.action_type === 'disable_bot' && (
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 leading-relaxed">
                    El bot se apagará en este chat. El agente podrá reactivarlo manualmente desde el panel de conversación.
                  </div>
                )}
              </div>

              {/* ── Opciones avanzadas ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Canal</label>
                  <select value={form.channel} onChange={e => setF('channel', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition">
                    <option value="all">Todos los canales</option>
                    <option value="whatsapp_business">Solo WA Business</option>
                    <option value="whatsapp">Solo WA Personal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Prioridad <span className="text-slate-400 font-normal">(mayor = primero)</span></label>
                  <input type="number" min={0} max={100} value={form.priority}
                    onChange={e => setF('priority', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 transition" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2 flex-shrink-0">
              <button onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                {saving && <div className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear regla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
