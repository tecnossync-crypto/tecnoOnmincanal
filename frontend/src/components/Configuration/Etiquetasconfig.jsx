import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

/* ─── Icons ─── */
const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
  </svg>
);
const TagIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
  </svg>
);
const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
);
const InfoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

/* ─── Color palette ─── */
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#78716c', '#a855f7', '#84cc16',
];

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-DO', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).replace('.', '');
};

/* ─── Toggle ─── */
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

/* ─── Modal crear / editar ─── */
const LabelModal = ({ label, onSave, onClose }) => {
  const [nombre,  setNombre]  = useState(label?.nombre  || '');
  const [desc,    setDesc]    = useState(label?.descripcion || '');
  const [color,   setColor]   = useState(label?.color   || COLORS[0]);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!nombre.trim()) { setErr('El nombre es obligatorio.'); return; }
    setSaving(true);
    await onSave({ ...label, nombre: nombre.trim(), descripcion: desc.trim(), color });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
           style={{ background: '#fff', border: '0.5px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(15,23,42,0.15)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
             style={{ borderBottom: '0.5px solid #e2e8f0' }}>
          <div className="flex items-center gap-2" style={{ color: '#0f172a' }}>
            <TagIcon />
            <h3 className="text-sm font-semibold">
              {label ? 'Editar etiqueta' : 'Nueva etiqueta'}
            </h3>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: '#94a3b8', border: '0.5px solid #e2e8f0' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
            <CloseIcon />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8fafc' }}>
            <span className="text-xs" style={{ color: '#94a3b8' }}>Vista previa:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ background: color }}>
              {nombre || 'Etiqueta'}
            </span>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: '#64748b' }}>Nombre *</label>
            <input
              ref={inputRef}
              value={nombre}
              onChange={e => { setNombre(e.target.value); setErr(''); }}
              placeholder="Ej: Urgente, Soporte, VIP..."
              maxLength={40}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: '#f8fafc', border: `0.5px solid ${err ? '#ef4444' : '#e2e8f0'}`, color: '#0f172a' }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = err ? '#ef4444' : '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
            />
            {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: '#64748b' }}>
              Descripción <span style={{ color: '#cbd5e1' }}>(opcional)</span>
            </label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Para qué se usa esta etiqueta..."
              maxLength={100}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', color: '#0f172a' }}
              onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium" style={{ color: '#64748b' }}>Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg transition-all duration-150"
                  style={{
                    background: c,
                    outline: color === c ? `2.5px solid ${c}` : 'none',
                    outlineOffset: '2px',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4"
             style={{ borderTop: '0.5px solid #e2e8f0' }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#64748b', border: '0.5px solid #e2e8f0' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: '#6366f1', color: '#fff', opacity: saving ? 0.75 : 1 }}>
            {saving && <SpinnerIcon />}
            {label ? 'Guardar cambios' : 'Crear etiqueta'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Modal confirmación eliminar ─── */
const ConfirmModal = ({ label, onConfirm, onClose }) => {
  const [loading, setLoading] = useState(false);
  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)' }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
           style={{ background: '#fff', border: '0.5px solid #e2e8f0',
                    boxShadow: '0 20px 60px rgba(15,23,42,0.15)' }}>
        <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
               style={{ background: '#fef2f2', color: '#ef4444' }}>
            <TrashIcon />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#0f172a' }}>
              ¿Eliminar etiqueta?
            </h3>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              Se eliminará <strong>"{label.nombre}"</strong> de todas las conversaciones donde esté aplicada.
            </p>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ border: '0.5px solid #e2e8f0', color: '#64748b' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#ef4444', color: '#fff', opacity: loading ? 0.75 : 1 }}>
            {loading && <SpinnerIcon />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Row de la tabla ─── */
const LabelRow = ({ label, onEdit, onDelete, onToggle }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? '#f8fafc' : '#fff', transition: 'background 0.1s' }}
    >
      {/* Nombre */}
      <td className="px-6 py-3.5" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: label.color || '#6366f1' }}
          >
            {label.nombre}
          </span>
          {label.descripcion && (
            <span className="text-xs truncate max-w-xs" style={{ color: '#94a3b8' }}>
              {label.descripcion}
            </span>
          )}
        </div>
      </td>

      {/* Color */}
      <td className="px-6 py-3.5" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded" style={{ background: label.color || '#6366f1' }} />
          <span className="text-xs font-mono" style={{ color: '#94a3b8' }}>
            {label.color || '#6366f1'}
          </span>
        </div>
      </td>

      {/* Última actualización */}
      <td className="px-6 py-3.5" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
        <div>
          <p className="text-xs font-medium" style={{ color: '#334155' }}>
            {label.updated_by || '—'}
          </p>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            {formatDate(label.updated_at)}
          </p>
        </div>
      </td>

      {/* Acciones */}
      <td className="px-6 py-3.5" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
        <div className="flex items-center justify-end gap-3">
          {/* Editar / Eliminar (solo visible en hover) */}
          <div className="flex items-center gap-1"
               style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              onClick={() => onEdit(label)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#94a3b8' }}
              title="Editar"
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#6366f1'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
              <EditIcon />
            </button>
            <button
              onClick={() => onDelete(label)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: '#94a3b8' }}
              title="Eliminar"
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
              <TrashIcon />
            </button>
          </div>
          {/* Toggle */}
          <Toggle checked={label.activo !== false} onChange={v => onToggle(label, v)} />
        </div>
      </td>
    </tr>
  );
};

/* ─── Componente principal ─── */
export default function EtiquetasConfig() {
  const navigate = useNavigate();

  const [labels,      setLabels]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState('Conversaciones');
  const [modal,       setModal]       = useState(null); // null | { type: 'create'|'edit'|'delete', label? }
  const [toast,       setToast]       = useState(null);

  /* Fetch */
  useEffect(() => {
    fetchLabels();
  }, []);

  const fetchLabels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/labels');
      if (res.data.success) setLabels(res.data.data);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  /* CRUD */
  const handleSave = async (labelData) => {
    try {
      if (labelData.id) {
        const res = await api.put(`/labels/${labelData.id}`, labelData);
        if (res.data.success) {
          setLabels(prev => prev.map(l => l.id === labelData.id ? res.data.data : l));
          showToast('success', 'Etiqueta actualizada correctamente.');
        }
      } else {
        const res = await api.post('/labels', labelData);
        if (res.data.success) {
          setLabels(prev => [res.data.data, ...prev]);
          showToast('success', 'Etiqueta creada correctamente.');
        }
      }
    } catch {
      showToast('error', 'Error al guardar. Intenta de nuevo.');
    }
    setModal(null);
  };

  const handleDelete = async () => {
    const label = modal.label;
    try {
      await api.delete(`/labels/${label.id}`);
      setLabels(prev => prev.filter(l => l.id !== label.id));
      showToast('success', `"${label.nombre}" eliminada.`);
    } catch {
      showToast('error', 'Error al eliminar. Intenta de nuevo.');
    }
    setModal(null);
  };

  const handleToggle = async (label, value) => {
    const updated = { ...label, activo: value };
    setLabels(prev => prev.map(l => l.id === label.id ? updated : l));
    try {
      await api.put(`/labels/${label.id}`, updated);
    } catch {
      setLabels(prev => prev.map(l => l.id === label.id ? label : l));
      showToast('error', 'Error al actualizar el estado.');
    }
  };

  /* Filtrado */
  const filtered = labels.filter(l =>
    l.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    l.descripcion?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-hidden"
         style={{ background: '#ffffff', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* ── Topbar ── */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
           style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
            <BackIcon /> Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium" style={{ color: '#0f172a' }}>Etiquetas</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ border: '0.5px solid #e2e8f0', color: '#94a3b8' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}>
          <CloseIcon />
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="mx-8 mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm flex-shrink-0"
             style={{
               background: toast.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
               border: `0.5px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
               color: toast.type === 'success' ? '#16a34a' : '#dc2626',
             }}>
          <span>{toast.type === 'success'
            ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          }</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-8 py-4 flex-shrink-0"
           style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        {/* Count + info */}
        <div className="flex items-center gap-1.5 mr-1">
          <span className="text-sm font-semibold" style={{ color: '#0f172a' }}>
            Etiquetas
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#f1f5f9', color: '#64748b' }}>
            {filtered.length}
          </span>
          <button className="ml-0.5" style={{ color: '#cbd5e1' }} title="Las etiquetas se aplican a conversaciones para organizarlas.">
            <InfoIcon />
          </button>
        </div>

        <div className="w-px h-5" style={{ background: '#e2e8f0' }} />

        {/* Filter dropdown */}
        <div className="relative">
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: '0.5px solid #e2e8f0', color: '#334155' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {filter}
            <ChevronDown />
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
            style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0', color: '#0f172a' }}
            onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
            onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
          />
        </div>

        <div className="flex-1" />

        {/* Agregar */}
        <button
          onClick={() => setModal({ type: 'create' })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ background: '#6366f1', color: '#fff' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
          <PlusIcon />
          Agregar
        </button>
      </div>

      {/* ── Body / Tabla ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3" style={{ color: '#94a3b8' }}>
            <SpinnerIcon />
            <span className="text-sm">Cargando etiquetas...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            <button onClick={fetchLabels}
              className="text-xs px-4 py-2 rounded-lg"
              style={{ background: '#f1f5f9', color: '#64748b', border: '0.5px solid #e2e8f0' }}>
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                 style={{ background: '#f1f5f9', color: '#cbd5e1' }}>
              <TagIcon />
            </div>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              {search ? 'Sin resultados para tu búsqueda.' : 'Aún no hay etiquetas. ¡Crea la primera!'}
            </p>
            {!search && (
              <button onClick={() => setModal({ type: 'create' })}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: '#6366f1' }}>
                <PlusIcon /> Nueva etiqueta
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Etiquetas', 'Color', 'Última actualización', ''].map((h, i) => (
                  <th key={i}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#94a3b8', borderBottom: '0.5px solid #e2e8f0',
                             width: i === 3 ? '140px' : 'auto' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(label => (
                <LabelRow
                  key={label.id}
                  label={label}
                  onEdit={l => setModal({ type: 'edit', label: l })}
                  onDelete={l => setModal({ type: 'delete', label: l })}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <LabelModal
          label={modal.type === 'edit' ? modal.label : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          label={modal.label}
          onConfirm={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}