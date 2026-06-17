// frontend/src/components/Modules/ModuleRecordModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Upload, ImageOff } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pendiente',    color: '#f59e0b' },
  { value: 'in_progress', label: 'En proceso',   color: '#3b82f6' },
  { value: 'completed',   label: 'Completado',   color: '#22c55e' },
  { value: 'cancelled',   label: 'Cancelado',    color: '#ef4444' },
];

function DynamicField({ field, value, onChange }) {
  const base = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors';
  const fileRef = useRef(null);

  switch (field.type) {
    case 'textarea':
      return <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} className={`${base} resize-none`} placeholder={`Ingresa ${field.label.toLowerCase()}...`} />;

    case 'number':
      return <input type="number" value={value || ''} onChange={e => onChange(e.target.value)} className={base} placeholder="0" />;

    case 'date':
      return <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className={base} />;

    case 'select': {
      const opts = Array.isArray(field.options) ? field.options : [];
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={base}>
          <option value="">-- Selecciona --</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'checkbox':
      return (
        <button type="button" onClick={() => onChange(!value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
            value ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${value ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
            {value && <Check size={10} className="text-white" />}
          </span>
          {value ? 'Sí' : 'No'}
        </button>
      );

    case 'currency': {
      const symbol = field.currency_symbol || '$';
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500 select-none">
            {symbol}
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className={`${base} text-right`}
            style={{ paddingLeft: `${Math.max(28, symbol.length * 8 + 16)}px` }}
            placeholder="0.00"
          />
        </div>
      );
    }

    case 'image': {
      const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error('Imagen demasiado grande (máx. 2 MB)'); return; }
        if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
        const reader = new FileReader();
        reader.onload = ev => onChange(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
      };

      return (
        <div className="flex flex-col gap-2">
          {value ? (
            <div className="relative w-full max-w-[200px]">
              <img src={value} alt="preview" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[200px] h-32 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center">
              <ImageOff size={24} className="text-slate-300" />
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-colors w-fit"
          >
            <Upload size={13} />
            {value ? 'Cambiar imagen' : 'Seleccionar imagen'}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
        </div>
      );
    }

    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className={base} placeholder={`Ingresa ${field.label.toLowerCase()}...`} />;
  }
}

export default function ModuleRecordModal({ open, onClose, onSaved, module, initial, contactName = '', contactJid = '', sessionId = '' }) {
  const [data,    setData]    = useState({});
  const [status,  setStatus]  = useState('pending');
  const [notes,   setNotes]   = useState('');
  const [contact, setContact] = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (open) {
      if (initial) {
        setData(initial.data || {});
        setStatus(initial.status || 'pending');
        setNotes(initial.notes || '');
        setContact(initial.contact_name || '');
      } else {
        setData({});
        setStatus('pending');
        setNotes('');
        setContact(contactName || '');
      }
    }
  }, [open, initial, contactName]);

  if (!open || !module) return null;

  const setField = (id, val) => setData(p => ({ ...p, [id]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required fields
    for (const field of (module.fields_schema || [])) {
      if (field.required && !data[field.id] && data[field.id] !== false) {
        toast.error(`El campo "${field.label}" es obligatorio`);
        return;
      }
    }
    try {
      setSaving(true);
      let res;
      if (initial?.id) {
        res = await api.put(`/module-records/${initial.id}`, { data, status, notes, contact_name: contact });
      } else {
        res = await api.post('/module-records', {
          module_id:    module.id,
          contact_name: contact || null,
          contact_jid:  contactJid  || null,
          session_id:   sessionId   || null,
          data,
          status,
          notes
        });
      }
      toast.success(initial?.id ? 'Registro actualizado' : 'Registro creado');
      onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: module.color }}>
              <span className="text-white text-[10px] font-bold">{module.name[0]}</span>
            </div>
            <span className="text-sm font-semibold text-slate-800">
              {initial?.id ? `Editar registro — ${module.name}` : `Nuevo registro — ${module.name}`}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Contacto */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Contacto</label>
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Nombre del cliente"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
          </div>

          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Estado</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    status === s.value ? 'text-white border-transparent' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                  style={status === s.value ? { background: s.color } : {}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Campos dinámicos */}
          {(module.fields_schema || []).map(field => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              <DynamicField field={field} value={data[field.id]} onChange={val => setField(field.id, val)} />
            </div>
          ))}

          {/* Notas */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Notas internas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observaciones adicionales..."
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none" />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ background: module.color }}>
            {saving
              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              : <Check size={14} />
            }
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
