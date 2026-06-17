import React, { useState, useEffect } from 'react';
import { X, Download, Send, FileText, User, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SOURCE_AUTO = new Set([
  'contact.name','contact.phone','contact.email',
  'date.today','date.tomorrow',
  'company.name','company.address','company.phone',
]);

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

/**
 * GenerateDocModal
 * Props:
 *   template    - DocumentTemplate object (required)
 *   jid         - WhatsApp JID if opened from chat (optional)
 *   sessionId   - WhatsApp sessionId if from chat (optional)
 *   contactId   - Contact ID if known (optional)
 *   onClose     - close handler
 */
export default function GenerateDocModal({ template, jid, sessionId, contactId: propContactId, onClose }) {
  const [manualFields, setManualFields] = useState({});
  const [format,       setFormat]       = useState('docx');
  const [contacts,     setContacts]     = useState([]);
  const [contactId,    setContactId]    = useState(propContactId || '');
  const [generating,   setGenerating]   = useState(false);
  const [sending,      setSending]      = useState(false);
  const [templates,    setTemplates]    = useState([]);
  const [selectedTpl,  setSelectedTpl]  = useState(template || null);

  const fromChat = !!jid; // opened from chat

  // If no template passed (opened standalone from chat), load template list
  useEffect(() => {
    if (!template) {
      api.get('/templates').then(r => setTemplates(r.data || [])).catch(() => {});
    }
  }, [template]);

  // Load contacts for contact picker (only if not from chat)
  useEffect(() => {
    if (!fromChat) {
      api.get('/contacts?limit=100').then(r => setContacts(r.data?.contacts || [])).catch(() => {});
    }
  }, [fromChat]);

  const activeTpl = selectedTpl;
  const manualFields_ = (activeTpl?.fields || []).filter(f => f.source === 'manual');
  const autoFields_   = (activeTpl?.fields || []).filter(f => SOURCE_AUTO.has(f.source));

  const setManual = (key, val) => setManualFields(p => ({ ...p, [key]: val }));

  // ── Generate (download) ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!activeTpl) return toast.error('Selecciona una plantilla');
    setGenerating(true);
    try {
      const body = { manualFields, format, ...(contactId ? { contactId } : {}) };
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/templates/${activeTpl.id}/generate`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error generando documento');
      }
      const blob     = await res.blob();
      const ext      = format === 'pdf' ? 'pdf' : 'docx';
      const filename = `${activeTpl.name}.${ext}`;
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Documento generado: ${filename}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Send via WhatsApp ────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeTpl) return toast.error('Selecciona una plantilla');
    if (!jid && !sessionId) return toast.error('No hay chat activo');
    setSending(true);
    try {
      await api.post(`/templates/${activeTpl.id}/send`, {
        jid,
        sessionId,
        manualFields,
        format,
        ...(contactId ? { contactId } : {}),
      });
      toast.success('Documento enviado por WhatsApp');
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <FileText size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                {fromChat ? 'Generar y enviar documento' : 'Generar documento'}
              </p>
              {activeTpl && <p className="text-xs text-slate-500">{activeTpl.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Template picker (only if opened standalone from chat) */}
          {!template && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plantilla</label>
              <select
                value={selectedTpl?.id || ''}
                onChange={e => setSelectedTpl(templates.find(t => t.id === e.target.value) || null)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Seleccionar plantilla —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          {/* Contact picker (only if not from chat) */}
          {!fromChat && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contacto (opcional)</label>
              <select
                value={contactId}
                onChange={e => setContactId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">— Sin contacto (completar manualmente) —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Auto fields preview */}
          {activeTpl && autoFields_.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 mb-2">Campos auto-rellenados</p>
              {autoFields_.map(f => (
                <div key={f.key} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-600">{f.label}</span>
                  <span className="text-xs text-slate-400 italic">{SOURCE_LABELS[f.source] || f.source}</span>
                </div>
              ))}
            </div>
          )}

          {/* Manual fields */}
          {activeTpl && manualFields_.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">Campos a completar</p>
              {manualFields_.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {f.label}
                    <code className="ml-1.5 text-slate-400 font-mono text-[10px]">{'{' + f.key + '}'}</code>
                  </label>
                  <input
                    value={manualFields[f.key] ?? f.default_value ?? ''}
                    onChange={e => setManual(f.key, e.target.value)}
                    placeholder={f.default_value || `Ingresa ${f.label.toLowerCase()}…`}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
            </div>
          )}

          {/* No template selected yet */}
          {!activeTpl && template === undefined && (
            <div className="text-center py-6 text-slate-400">
              <FileText size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona una plantilla para continuar</p>
            </div>
          )}

          {/* Format */}
          {activeTpl && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Formato de salida</label>
              <div className="flex gap-2">
                {['docx','pdf'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      format === f
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.toUpperCase()}
                    {f === 'pdf' && <span className="block text-[10px] font-normal opacity-70">requiere LibreOffice</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {activeTpl && (
          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={handleGenerate} disabled={generating || sending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold bg-slate-700 text-white rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors">
              <Download size={14} />
              {generating ? 'Generando…' : 'Descargar'}
            </button>
            {fromChat && (
              <button onClick={handleSend} disabled={generating || sending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                <Send size={14} />
                {sending ? 'Enviando…' : 'Enviar por WA'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
