// frontend/src/components/Configuration/MensajesRapidosConfig.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Plus, Pencil, Trash2, Search, X, Check, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CHANNELS = [
  { value: 'all',                label: 'Todos los canales' },
  { value: 'whatsapp_business',  label: 'WhatsApp Business' },
  { value: 'inbox',              label: 'Bandeja general' },
];

const EMPTY_FORM = {
  title:      '',
  shortcut:   '',
  content:    '',
  category:   '',
  channel:    'all',
  sort_order: 0,
  is_active:  true,
};

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

function ChannelBadge({ value }) {
  const ch = CHANNELS.find(c => c.value === value) || CHANNELS[0];
  const colors = {
    all:               'bg-slate-100 text-slate-600',
    whatsapp_business: 'bg-blue-50 text-blue-700',
    inbox:             'bg-indigo-50 text-indigo-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${colors[value] || colors.all}`}>
      {ch.label}
    </span>
  );
}

function Modal({ open, onClose, onSave, initial, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const titleRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(initial || EMPTY_FORM);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim())   { toast.error('El título es obligatorio'); return; }
    if (!form.content.trim()) { toast.error('El contenido es obligatorio'); return; }
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-800">
              {initial?.id ? 'Editar mensaje rápido' : 'Nuevo mensaje rápido'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          {/* Título */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Título <span className="text-red-400">*</span></label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ej: Saludo inicial"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Atajo (opcional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">
              Atajo <span className="text-slate-400 font-normal">(opcional, ej: /saludo)</span>
            </label>
            <input
              value={form.shortcut}
              onChange={e => set('shortcut', e.target.value)}
              placeholder="/atajo"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Contenido */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500">Contenido <span className="text-red-400">*</span></label>
            <textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Escribe aquí el texto del mensaje rápido..."
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Categoría + Canal */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Categoría</label>
              <input
                value={form.category}
                onChange={e => set('category', e.target.value)}
                placeholder="General"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Canal</label>
              <select
                value={form.channel}
                onChange={e => set('channel', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              >
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Orden + Activo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Orden</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Estado</label>
              <button
                type="button"
                onClick={() => set('is_active', !form.is_active)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  form.is_active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${form.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {form.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60"
            >
              {saving ? <SpinnerIcon /> : <Check size={14} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MensajesRapidosConfig() {
  const navigate = useNavigate();

  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/quick-messages/admin');
      setItems(res.data || []);
    } catch (err) {
      toast.error('No se pudieron cargar los mensajes rápidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleSave = async (form) => {
    try {
      setSaving(true);
      if (editing?.id) {
        const res = await api.put(`/quick-messages/${editing.id}`, form);
        setItems(prev => prev.map(i => i.id === editing.id ? res.data : i));
        toast.success('Mensaje actualizado');
      } else {
        const res = await api.post('/quick-messages', form);
        setItems(prev => [...prev, res.data]);
        toast.success('Mensaje creado');
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setDeleting(id);
      await api.delete(`/quick-messages/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
      toast.success('Mensaje eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = items.filter(item => {
    const matchChannel = filter === 'all' || item.channel === filter || item.channel === 'all';
    const q = search.toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q) || (item.shortcut || '').toLowerCase().includes(q);
    return matchChannel && matchSearch;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#ffffff', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <BackIcon />
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-indigo-500" />
            <span className="text-sm font-medium">Mensajes rápidos</span>
          </div>
        </div>
        <button
          onClick={() => handleOpen()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: '#6366f1' }}
          onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
          onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
        >
          <Plus size={15} />
          Nuevo mensaje
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 px-8 py-3 flex-shrink-0" style={{ borderBottom: '0.5px solid #f1f5f9', background: '#fafbfc' }}>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar mensajes..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white outline-none focus:border-indigo-400 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {CHANNELS.map(ch => (
            <button
              key={ch.value}
              onClick={() => setFilter(ch.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === ch.value
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  : 'text-slate-500 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} mensaje{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
            <SpinnerIcon />
            <span className="text-sm">Cargando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <Zap size={36} strokeWidth={1.5} />
            <p className="text-sm font-medium">
              {search || filter !== 'all' ? 'Sin resultados para esta búsqueda' : 'No hay mensajes rápidos aún'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={() => handleOpen()}
                className="mt-1 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors"
              >
                <Plus size={14} />
                Crear primer mensaje
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-4 px-5 py-4 rounded-xl border transition-all"
                style={{ borderColor: '#e2e8f0', background: item.is_active ? '#ffffff' : '#f8fafc' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#c7d2fe'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              >
                {/* Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${item.is_active ? 'bg-indigo-50' : 'bg-slate-100'}`}>
                  <Zap size={16} className={item.is_active ? 'text-indigo-500' : 'text-slate-400'} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-sm font-semibold ${item.is_active ? 'text-slate-800' : 'text-slate-400'}`}>{item.title}</span>
                    {item.shortcut && (
                      <code className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{item.shortcut}</code>
                    )}
                    {item.category && item.category !== 'General' && (
                      <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-medium">{item.category}</span>
                    )}
                    <ChannelBadge value={item.channel} />
                    {!item.is_active && (
                      <span className="text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded font-medium">Inactivo</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{item.content}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpen(item)}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    {deleting === item.id ? <SpinnerIcon /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
        saving={saving}
      />
    </div>
  );
}
