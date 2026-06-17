// frontend/src/components/Inbox/ConversationInfoPanel.jsx
import { useState, useEffect, useRef } from 'react';
import {
  User, Phone, Mail, MessageSquare, Bot,
  ChevronDown, ChevronUp, RefreshCw,
  Edit2, Check, X, Plus, Trash2, Hash, Tag, FileText
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useLabelStore, useConversationStore } from '../../store';

// ─── Canal con badge de color ─────────────────────────────────
const CHANNEL_CFG = {
  whatsapp:  { label: 'WhatsApp',  abbr: 'WA',  bg: '#25d366', fg: '#fff' },
  instagram: { label: 'Instagram', abbr: 'IG',  bg: '#e1306c', fg: '#fff' },
  messenger: { label: 'Messenger', abbr: 'MSG', bg: '#0084ff', fg: '#fff' },
  tiktok:    { label: 'TikTok',    abbr: 'TT',  bg: '#010101', fg: '#fff' },
  telegram:  { label: 'Telegram',  abbr: 'TG',  bg: '#2ca5e0', fg: '#fff' },
};

function ChannelBadge({ channel }) {
  const key = channel?.toLowerCase();
  const cfg = CHANNEL_CFG[key] || { label: channel || '—', abbr: (channel || '?').slice(0, 2).toUpperCase(), bg: '#6366f1', fg: '#fff' };
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-md text-[10px] font-bold px-1.5 py-0.5"
        style={{ background: cfg.bg, color: cfg.fg, minWidth: '26px' }}
      >
        {cfg.abbr}
      </span>
      <span className="text-sm font-medium text-slate-800">{cfg.label}</span>
    </div>
  );
}

// ─── Campo editable ───────────────────────────────────────────
function EditableField({ label, value, onSave, icon: Icon }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(value || '');
  useEffect(() => setVal(value || ''), [value]);
  const save = () => { onSave(val); setEditing(false); };
  return (
    <div className="group">
      {label && (
        <span className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
          {Icon && <Icon size={10} strokeWidth={1.5} />}{label}
        </span>
      )}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
          />
          <button onClick={save} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={12} /></button>
          <button onClick={() => setEditing(false)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X size={12} /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className={`text-sm ${value ? 'text-slate-800 font-medium' : 'text-slate-300 italic'}`}>
            {value || 'Sin datos'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-all"
          >
            <Edit2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sección colapsable ───────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {Icon && <Icon size={12} strokeWidth={2} />}{title}
        </span>
        {open ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

// ─── Fila de info solo lectura ────────────────────────────────
function InfoRow({ label, value, mono = false }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-xs text-slate-700 font-medium text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function ConversationInfoPanel({ conversation }) {
  const [contact, setContact]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField]       = useState({ label: '', value: '' });
  const [convLabels, setConvLabels]   = useState([]);
  const [notes, setNotes]             = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const labelPickerRef = useRef(null);

  const { labels: allLabels, fetchLabels } = useLabelStore();
  const { updateActiveConversationMeta }   = useConversationStore();

  const convId    = conversation?.id;
  const contactId = conversation?.contact_id || conversation?.contact?.id;

  // Cargar catálogo de etiquetas
  useEffect(() => { fetchLabels(); }, []);

  // Reset al cambiar conversación
  useEffect(() => {
    setConvLabels(conversation?.metadata?.labels || []);
    setNotes(conversation?.metadata?.notes || '');
    setShowLabelPicker(false);
  }, [convId]);

  // Cerrar dropdown de etiquetas al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target)) {
        setShowLabelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const load = async () => {
    if (!contactId) return;
    try {
      const r = await api.get(`/contacts/${contactId}`);
      if (r.data.success) {
        const c = r.data.data;
        setContact(c);
        setCustomFields(c.metadata?.custom_fields || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setLoading(true); load(); }, [contactId]);

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const updateContact = async (field, value) => {
    try {
      const r = await api.patch(`/contacts/${contactId}`, { [field]: value });
      if (r.data.success) { setContact(r.data.data); toast.success('Guardado'); }
    } catch { toast.error('Error al guardar'); }
  };

  const updateMeta = async (key, value) => {
    const meta = { ...(contact?.metadata || {}), [key]: value };
    await updateContact('metadata', meta);
  };

  const saveCustomFields = async (fields) => {
    const meta = { ...(contact?.metadata || {}), custom_fields: fields };
    try {
      const r = await api.patch(`/contacts/${contactId}`, { metadata: meta });
      if (r.data.success) { setContact(r.data.data); setCustomFields(fields); }
    } catch { toast.error('Error al guardar'); }
  };

  const addCustomField = async () => {
    if (!newField.label.trim()) return;
    const fields = [...customFields, { ...newField, id: Date.now() }];
    await saveCustomFields(fields);
    setNewField({ label: '', value: '' });
    setAddingField(false);
  };

  const removeCustomField = async (id) => {
    const fields = customFields.filter(f => f.id !== id);
    await saveCustomFields(fields);
  };

  const updateCustomField = async (id, value) => {
    const fields = customFields.map(f => f.id === id ? { ...f, value } : f);
    await saveCustomFields(fields);
  };

  // ── Actualizar metadata de la conversación ────────────────
  const patchConvMeta = async (metaPatch) => {
    try {
      const r = await api.patch(`/conversations/${convId}`, { metadata: metaPatch });
      if (r.data.success) updateActiveConversationMeta(metaPatch);
    } catch {
      toast.error('Error al guardar');
    }
  };

  // ── Etiquetas de conversación ─────────────────────────────
  const addLabel = async (labelId) => {
    if (convLabels.includes(labelId)) return;
    const next = [...convLabels, labelId];
    setConvLabels(next);
    setShowLabelPicker(false);
    await patchConvMeta({ labels: next });
  };

  const removeLabel = async (labelId) => {
    const next = convLabels.filter(id => id !== labelId);
    setConvLabels(next);
    await patchConvMeta({ labels: next });
  };

  // ── Notas ──────────────────────────────────────────────────
  const saveNotes = async () => {
    await patchConvMeta({ notes });
    toast.success('Notas guardadas');
  };

  // ── Campos de plantilla (configurados en PanelInfoConfig) ─
  const panelCfg = (() => {
    try { return JSON.parse(localStorage.getItem('panel_info_config') || '{}'); }
    catch { return {}; }
  })();
  const fieldTemplates = panelCfg.customTemplates || [];
  const hiddenFields   = panelCfg.hiddenFields    || [];

  const getTemplateValue = (templateLabel) =>
    customFields.find(f => f.label === templateLabel)?.value || '';

  const saveTemplateField = async (templateLabel, value) => {
    const existing = customFields.find(f => f.label === templateLabel);
    const fields = existing
      ? customFields.map(f => f.label === templateLabel ? { ...f, value } : f)
      : [...customFields, { id: `tpl_${templateLabel}`, label: templateLabel, value }];
    await saveCustomFields(fields);
  };

  // ── Helpers de conversación ───────────────────────────────
  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getDuration = () => {
    if (!conversation?.created_at) return null;
    const start = new Date(conversation.created_at);
    const end   = conversation.assigned_agent_id ? new Date(conversation.updated_at) : new Date();
    const mins  = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const summary     = conversation?.metadata?.summary;
  const summaryDate = conversation?.metadata?.summary_updated_at
    ? formatDate(conversation.metadata.summary_updated_at) : null;

  const statusMap = {
    bot:      { label: 'Bot activo',  cls: 'bg-violet-100 text-violet-700' },
    open:     { label: 'Sin asignar', cls: 'bg-amber-100 text-amber-700'   },
    assigned: { label: 'Asignado',    cls: 'bg-blue-100 text-blue-700'     },
    resolved: { label: 'Resuelto',    cls: 'bg-green-100 text-green-700'   },
  };
  const statusInfo = statusMap[conversation?.status] || statusMap.open;

  const assignedLabelObjects = allLabels.filter(l => convLabels.includes(l.id));
  const availableLabels      = allLabels.filter(l => l.activo !== false && !convLabels.includes(l.id));

  // ─────────────────────────────────────────────────────────
  if (!conversation) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Selecciona una conversación
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      Cargando...
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">

      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <span className="text-sm font-semibold text-slate-700">Información del cliente</span>
        <button
          onClick={handleRefresh}
          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* AVATAR + NOMBRE + ESTADO */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center font-bold text-indigo-600 text-base flex-shrink-0">
          {contact?.name ? contact.name[0].toUpperCase() : '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {contact?.name || 'Cliente sin nombre'}
          </p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${statusInfo.cls}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* ── DATOS DEL CLIENTE ── */}
      <Section title="Datos del cliente" icon={User}>
        {!hiddenFields.includes('nombre') && (
          <EditableField
            label="Nombre completo"
            value={contact?.name}
            onSave={v => updateContact('name', v)}
            icon={User}
          />
        )}
        {!hiddenFields.includes('telefono') && (
          <EditableField
            label="Teléfono"
            value={contact?.phone}
            onSave={v => updateContact('phone', v)}
            icon={Phone}
          />
        )}
        {!hiddenFields.includes('correo') && (
          <EditableField
            label="Correo electrónico"
            value={contact?.email}
            onSave={v => updateContact('email', v)}
            icon={Mail}
          />
        )}
        {!hiddenFields.includes('canal') && (
          <div>
            <span className="flex items-center gap-1 text-xs text-slate-400 mb-1">
              <MessageSquare size={10} strokeWidth={1.5} /> Canal de entrada
            </span>
            <ChannelBadge channel={conversation?.channel} />
          </div>
        )}
        {/* Campos de plantilla global configurados en PanelInfoConfig */}
        {fieldTemplates.map(tpl => (
          <EditableField
            key={tpl.id}
            label={tpl.label}
            value={getTemplateValue(tpl.label)}
            onSave={v => saveTemplateField(tpl.label, v)}
          />
        ))}
      </Section>

      {/* ── ETIQUETAS DE CONVERSACIÓN ── */}
      {!hiddenFields.includes('etiquetas') && (
        <Section title="Etiquetas" icon={Tag} defaultOpen>
          {/* Etiquetas asignadas */}
          {assignedLabelObjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {assignedLabelObjects.map(label => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ background: label.color || '#6366f1' }}
                >
                  {label.nombre}
                  <button
                    onClick={() => removeLabel(label.id)}
                    className="rounded-full hover:bg-black/20 p-0.5 transition-colors flex-shrink-0"
                  >
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Dropdown para agregar etiqueta */}
          <div className="relative" ref={labelPickerRef}>
            <button
              onClick={() => setShowLabelPicker(!showLabelPicker)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg py-2 transition-colors hover:bg-indigo-50"
            >
              <Plus size={11} /> Agregar etiqueta
            </button>

            {showLabelPicker && (
              <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                {availableLabels.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 px-3">
                    {allLabels.length === 0
                      ? 'No hay etiquetas registradas'
                      : 'Todas las etiquetas ya están asignadas'}
                  </p>
                ) : (
                  <div className="py-1 max-h-44 overflow-y-auto">
                    {availableLabels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => addLabel(label.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: label.color || '#6366f1' }}
                        />
                        <span className="text-sm text-slate-700">{label.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── NOTAS ── */}
      {!hiddenFields.includes('notas') && (
        <Section title="Notas" icon={FileText} defaultOpen>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Escribe notas sobre esta conversación..."
            rows={3}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-slate-50 focus:bg-white resize-none text-slate-700 placeholder-slate-300 transition-colors"
          />
          <button
            onClick={saveNotes}
            className="w-full text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-lg py-1.5 font-medium transition-colors"
          >
            Guardar notas
          </button>
        </Section>
      )}

      {/* ── RESUMEN DEL CHAT ── */}
      {!hiddenFields.includes('resumen') && (
        <Section title="Resumen del chat" icon={Bot} defaultOpen={!!summary}>
          {summary ? (
            <div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                {summary}
              </p>
              {summaryDate && (
                <p className="text-xs text-slate-400 mt-1.5">Actualizado: {summaryDate}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              El resumen se genera automáticamente cada 15 mensajes.
            </p>
          )}
        </Section>
      )}

      {/* ── CONVERSACIÓN (metadata) ── */}
      <Section title="Conversación" icon={MessageSquare} defaultOpen={false}>
        <InfoRow label="Canal"    value={conversation?.channel?.toUpperCase()} />
        <InfoRow label="Iniciada" value={formatDate(conversation?.created_at)} />
        <InfoRow label="Duración" value={getDuration()} />
        <InfoRow label="Agente"   value={conversation?.assigned_agent?.name} />
        <InfoRow label="Estado"   value={statusInfo.label} />
        <InfoRow label="ID"       value={`#${conversation?.id?.slice(0, 8)}`} mono />
      </Section>

      {/* ── CAMPOS ADICIONALES por contacto ── */}
      <Section title="Campos adicionales" icon={Hash} defaultOpen={customFields.length > 0}>
        {customFields.map(field => (
          <div key={field.id} className="group">
            <span className="text-xs text-slate-400">{field.label}</span>
            <div className="flex items-center gap-1">
              <div className="flex-1">
                <EditableField
                  label=""
                  value={field.value}
                  onSave={v => updateCustomField(field.id, v)}
                />
              </div>
              <button
                onClick={() => removeCustomField(field.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-50 rounded flex-shrink-0 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}

        {addingField ? (
          <div className="space-y-2 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
            <input
              autoFocus
              placeholder="Nombre del campo (ej: Vehículo)"
              value={newField.label}
              onChange={e => setNewField(f => ({ ...f, label: e.target.value }))}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
            <input
              placeholder="Valor"
              value={newField.value}
              onChange={e => setNewField(f => ({ ...f, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addCustomField()}
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
            />
            <div className="flex gap-1.5">
              <button
                onClick={addCustomField}
                className="flex-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 font-medium hover:bg-indigo-700 transition-colors"
              >
                Agregar
              </button>
              <button
                onClick={() => { setAddingField(false); setNewField({ label: '', value: '' }); }}
                className="flex-1 text-xs bg-slate-100 text-slate-600 rounded-lg py-1.5 font-medium hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingField(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg py-2 transition-colors hover:bg-indigo-50"
          >
            <Plus size={12} /> Agregar campo
          </button>
        )}
      </Section>
    </div>
  );
}
