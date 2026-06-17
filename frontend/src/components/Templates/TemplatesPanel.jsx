import React, { useState, useEffect, useRef } from 'react';
import { Plus, Upload, FileText, Trash2, Settings, ChevronDown, ChevronRight, X, Download, Send, Info, RefreshCw, Clock, CheckCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import GenerateDocModal from './GenerateDocModal';
import { getSocket } from '../../services/socket';

// ─── Solicitudes de documentos ────────────────────────────────────────────────
const STATUS_CFG = {
  collecting: { label: 'Recopilando datos', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  icon: <Clock size={12} /> },
  ready:      { label: 'Listo para enviar', bg: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',icon: <CheckCircle size={12} /> },
  sent:       { label: 'Enviado',           bg: 'bg-slate-100',  text: 'text-slate-500',  border: 'border-slate-200',  icon: <Send size={12} /> },
  rejected:   { label: 'Cancelado',         bg: 'bg-red-50',     text: 'text-red-400',    border: 'border-red-200',    icon: <X size={12} /> },
};

function RequestsSection() {
  const [requests,  setRequests]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [sending,   setSending]   = useState(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/document-requests');
      setRequests(res.data?.data || []);
    } catch { toast.error('Error cargando solicitudes'); }
    finally   { setLoading(false); }
  };

  useEffect(() => {
    fetchRequests();
    const socket = getSocket();
    if (socket) {
      socket.on('document:ready', fetchRequests);
      return () => socket.off('document:ready', fetchRequests);
    }
  }, []);

  const handleSend = async (req) => {
    setSending(req.id);
    try {
      await api.post(`/document-requests/${req.id}/send`);
      toast.success('Documento enviado al cliente');
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'sent' } : r));
    } catch (err) {
      toast.error(err.message || 'Error al enviar');
    } finally {
      setSending(null);
    }
  };

  const handleDownload = (req) => {
    const token = localStorage.getItem('token');
    const a = document.createElement('a');
    a.href = `/api/document-requests/${req.id}/download`;
    a.setAttribute('Authorization', `Bearer ${token}`);
    // usar fetch para descargar con auth
    fetch(`/api/document-requests/${req.id}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${req.template?.name || 'documento'}.docx`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Error al descargar'));
  };

  const handleReject = async (req) => {
    if (!window.confirm('¿Cancelar esta solicitud?')) return;
    try {
      await api.post(`/document-requests/${req.id}/reject`);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
    } catch { toast.error('Error al cancelar'); }
  };

  const active = requests.filter(r => ['collecting','ready','sent'].includes(r.status));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Solicitudes de documentos</h2>
          <p className="text-xs text-slate-400">Documentos pedidos por clientes vía bot</p>
        </div>
        <button onClick={fetchRequests} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Cargando solicitudes…</div>
      ) : active.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center">
          <FileText size={28} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No hay solicitudes todavía.</p>
          <p className="text-xs text-slate-300 mt-1">Aparecerán aquí cuando un cliente pida un documento por WhatsApp.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(req => {
            const st  = STATUS_CFG[req.status] || STATUS_CFG.collecting;
            const jidShort = req.jid?.replace(/@.+/, '') || '—';
            const ts  = req.created_at ? new Date(req.created_at).toLocaleString('es-DO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
            return (
              <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <User size={15} className="text-indigo-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 truncate">{jidShort}</span>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${st.bg} ${st.text} ${st.border}`}>
                      {st.icon} {st.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {req.template?.name || 'Documento'} · {ts}
                  </p>
                  {req.status === 'collecting' && (() => {
                    const fields   = (req.template?.fields || []).filter(f => f.source === 'manual');
                    const done     = req.current_field_index || 0;
                    const total    = fields.length;
                    return (
                      <p className="text-xs text-amber-600 mt-0.5">Campo {done} de {total} recopilado{done !== 1 ? 's' : ''}</p>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {req.status === 'ready' && (
                    <>
                      <button onClick={() => handleDownload(req)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                        <Download size={12} /> Ver
                      </button>
                      <button onClick={() => handleSend(req)} disabled={sending === req.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                        <Send size={12} /> {sending === req.id ? 'Enviando…' : 'Enviar'}
                      </button>
                      <button onClick={() => handleReject(req)}
                        className="w-7 h-7 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <X size={13} />
                      </button>
                    </>
                  )}
                  {req.status === 'sent' && (
                    <span className="text-xs text-slate-400 italic">Enviado</span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="text-xs text-red-300 italic">Cancelado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SOURCE_LABELS = {
  'contact.name':    'Nombre del contacto',
  'contact.phone':   'Teléfono del contacto',
  'contact.email':   'Email del contacto',
  'date.today':      'Fecha de hoy',
  'date.tomorrow':   'Fecha de mañana',
  'company.name':    'Nombre de la empresa',
  'company.address': 'Dirección de la empresa',
  'company.phone':   'Teléfono de la empresa',
  'manual':          'Entrada manual',
};

// ─── Field Mapper Modal ──────────────────────────────────────────────────────
function FieldMapperModal({ template, fieldSources, onSave, onClose }) {
  const [name,        setName]        = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [fields,      setFields]      = useState(template.fields || []);
  const [keywords,    setKeywords]    = useState(template.trigger_keywords || []);
  const [kwInput,     setKwInput]     = useState('');
  const [saving,      setSaving]      = useState(false);

  const setField = (idx, key, value) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const addKeyword = () => {
    const kw = kwInput.trim().toLowerCase();
    if (!kw || keywords.includes(kw)) return;
    setKeywords(prev => [...prev, kw]);
    setKwInput('');
  };

  const removeKeyword = (kw) => setKeywords(prev => prev.filter(k => k !== kw));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/templates/${template.id}`, { name, description, fields, trigger_keywords: keywords });
      toast.success('Plantilla actualizada');
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">Configurar campos</h2>
            <p className="text-xs text-slate-500 mt-0.5">Define qué dato va en cada marcador del documento</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name + description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la plantilla</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Ej: Contrato de servicios"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {/* Bot trigger keywords */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Palabras clave del bot
              <span className="ml-1 font-normal text-slate-400">(opcionales)</span>
            </label>
            <p className="text-xs text-slate-400 mb-2">
              Si el cliente escribe alguna de estas frases, el bot iniciará automáticamente la recolección de datos para esta plantilla.
            </p>
            <div className="flex gap-2 mb-2">
              <input
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="Ej: contrato, solicitar documento…"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button onClick={addKeyword}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Agregar
              </button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(kw => (
                  <span key={kw} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-red-500 ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Fields table */}
          {fields.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No se encontraron campos en el documento.</p>
              <p className="text-xs mt-1">Usa la sintaxis <code className="bg-slate-100 px-1 rounded">{'{campo}'}</code> en tu archivo Word.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex gap-2">
                <Info size={14} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-700">
                  En tu documento Word, escribe los marcadores entre llaves: <strong>{'{nombre_cliente}'}</strong>, <strong>{'{fecha}'}</strong>, etc. Al generar, se reemplazarán por los datos reales.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <div className="col-span-3">Marcador en Word</div>
                  <div className="col-span-3">Etiqueta amigable</div>
                  <div className="col-span-4">Fuente de datos</div>
                  <div className="col-span-2">Valor por defecto</div>
                </div>
                {fields.map((f, idx) => (
                  <div key={f.key} className={`grid grid-cols-12 px-4 py-2.5 gap-2 items-center ${idx % 2 === 0 ? '' : 'bg-slate-50/50'} border-b border-slate-100 last:border-0`}>
                    <div className="col-span-3">
                      <code className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono">
                        {'{' + f.key + '}'}
                      </code>
                    </div>
                    <div className="col-span-3">
                      <input
                        value={f.label}
                        onChange={e => setField(idx, 'label', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="col-span-4">
                      <select
                        value={f.source}
                        onChange={e => setField(idx, 'source', e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        {(fieldSources || []).map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      {f.source === 'manual' ? (
                        <input
                          value={f.default_value || ''}
                          onChange={e => setField(idx, 'default_value', e.target.value)}
                          placeholder="Opcional"
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">auto</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────
function UploadZone({ onUploaded }) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name,      setName]      = useState('');
  const [file,      setFile]      = useState(null);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/_/g,' '));
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return toast.error('Selecciona un archivo DOCX');
    if (!name.trim()) return toast.error('Ingresa un nombre para la plantilla');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      await api.post('/templates/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Plantilla subida');
      setFile(null); setName('');
      onUploaded();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Subir nueva plantilla</p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : file ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
      >
        <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={e => handleFile(e.target.files[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={20} className="text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">{file.name}</span>
            <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">Arrastra un archivo DOCX o haz clic para seleccionar</p>
            <p className="text-xs text-slate-400 mt-1">Máximo 25 MB · Solo archivos Word (.docx)</p>
          </>
        )}
      </div>

      {file && (
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nombre de la plantilla"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button onClick={handleUpload} disabled={uploading}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2">
            {uploading ? 'Subiendo…' : <><Upload size={14} /> Subir</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDelete, onGenerate }) {
  const manualCount = (template.fields || []).filter(f => f.source === 'manual').length;
  const autoCount   = (template.fields || []).length - manualCount;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <FileText size={18} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-800 truncate">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{template.description}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{template.filename_original}</p>
        </div>
      </div>

      {/* Field summary */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {(template.fields || []).length} campos
        </span>
        {autoCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {autoCount} auto
          </span>
        )}
        {manualCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {manualCount} manual
          </span>
        )}
        {(template.trigger_keywords || []).length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
            🤖 {(template.trigger_keywords).length} keyword{template.trigger_keywords.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Auto-mapped fields preview */}
      {(template.fields || []).slice(0,3).map(f => (
        <div key={f.key} className="flex items-center gap-2 mb-1">
          <code className="text-xs bg-slate-50 text-slate-500 border border-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0">
            {'{' + f.key + '}'}
          </code>
          <span className="text-xs text-slate-400 truncate">→ {SOURCE_LABELS[f.source] || f.source}</span>
        </div>
      ))}
      {(template.fields || []).length > 3 && (
        <p className="text-xs text-slate-400 mt-1">+{template.fields.length - 3} más…</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
        <button onClick={() => onGenerate(template)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Download size={12} /> Generar
        </button>
        <button onClick={() => onEdit(template)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
          <Settings size={12} /> Campos
        </button>
        <button onClick={() => onDelete(template.id)}
          className="flex items-center justify-center w-8 py-1.5 text-xs border border-red-100 text-red-400 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function TemplatesPanel() {
  const [templates,    setTemplates]    = useState([]);
  const [fieldSources, setFieldSources] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [editingTpl,   setEditingTpl]   = useState(null);
  const [generateTpl,  setGenerateTpl]  = useState(null);
  const [showUpload,   setShowUpload]   = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/templates');
      setTemplates(res.data || []);
    } catch (err) {
      toast.error('Error cargando plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    api.get('/templates/field-sources').then(r => setFieldSources(r.data || [])).catch(() => {});
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    try {
      await api.delete(`/templates/${id}`);
      toast.success('Plantilla eliminada');
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Plantillas de Documentos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Genera contratos y documentos con datos del cliente</p>
        </div>
        <button onClick={() => setShowUpload(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus size={15} />
          Nueva plantilla
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Upload zone */}
          {showUpload && (
            <UploadZone onUploaded={() => { fetchTemplates(); setShowUpload(false); }} />
          )}

          {/* Instructions banner */}
          {!showUpload && templates.length === 0 && !loading && (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <FileText size={40} className="mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-700 mb-2">Sin plantillas todavía</h3>
              <p className="text-sm text-slate-500 mb-1">Crea un documento Word (.docx) con marcadores como <code className="bg-slate-100 px-1 rounded text-indigo-600">{'{nombre_cliente}'}</code></p>
              <p className="text-sm text-slate-500 mb-4">y súbelo para empezar a generar documentos automáticamente.</p>
              <button onClick={() => setShowUpload(true)}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
                Subir primera plantilla
              </button>
            </div>
          )}

          {/* Solicitudes de documentos */}
          <RequestsSection />

          {/* Divider */}
          <div className="border-t border-slate-200 pt-2">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Plantillas disponibles</h2>
          </div>

          {/* Templates grid */}
          {templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(tpl => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  onEdit={setEditingTpl}
                  onDelete={handleDelete}
                  onGenerate={setGenerateTpl}
                />
              ))}
            </div>
          )}

          {loading && (
            <div className="text-center py-12 text-slate-400 text-sm">Cargando plantillas…</div>
          )}
        </div>
      </div>

      {/* Field Mapper Modal */}
      {editingTpl && (
        <FieldMapperModal
          template={editingTpl}
          fieldSources={fieldSources}
          onSave={fetchTemplates}
          onClose={() => setEditingTpl(null)}
        />
      )}

      {/* Generate Modal */}
      {generateTpl && (
        <GenerateDocModal
          template={generateTpl}
          onClose={() => setGenerateTpl(null)}
        />
      )}
    </div>
  );
}
