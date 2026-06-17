// frontend/src/components/Modules/ModuleView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, X, Pencil, Trash2, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store';
import { ModuleIcon } from './ModulosConfig';
import ModuleRecordModal from './ModuleRecordModal';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  pending:     { label: 'Pendiente',  color: '#f59e0b', bg: '#fef3c7' },
  in_progress: { label: 'En proceso', color: '#3b82f6', bg: '#dbeafe' },
  completed:   { label: 'Completado', color: '#22c55e', bg: '#dcfce7' },
  cancelled:   { label: 'Cancelado',  color: '#ef4444', bg: '#fee2e2' },
};

function StatusBadge({ value }) {
  const s = STATUS_MAP[value] || STATUS_MAP.pending;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function ModuleView() {
  const { slug } = useParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [module,   setModule]   = useState(null);
  const [records,  setRecords]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('');
  const [page,     setPage]     = useState(1);
  const [modalOpen,setModalOpen]= useState(false);
  const [editing,  setEditing]  = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [stats,    setStats]    = useState({ today_count: 0, daily_limit: 0 });
  const LIMIT = 20;

  const loadModule = useCallback(async () => {
    try {
      const res = await api.get(`/custom-modules/${slug}`);
      setModule(res.data);
      return res.data;
    } catch {
      toast.error('Módulo no encontrado');
      return null;
    }
  }, [slug]);

  const loadRecords = useCallback(async (mod) => {
    if (!mod) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ module_id: mod.id, page, limit: LIMIT });
      if (filter) params.set('status', filter);
      if (search) params.set('search', search);
      const res = await api.get(`/module-records?${params}`);
      setRecords(res.data.records || []);
      setTotal(res.data.total || 0);
    } catch { toast.error('Error al cargar registros'); }
    finally { setLoading(false); }
  }, [page, filter, search]);

  const loadStats = useCallback(async (mod) => {
    if (!mod) return;
    try {
      const res = await api.get(`/module-records/stats/${mod.id}`);
      setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    loadModule().then(mod => {
      if (mod) { loadRecords(mod); loadStats(mod); }
    });
  }, [slug]);

  useEffect(() => {
    if (module) loadRecords(module);
  }, [page, filter, search]);

  const handleSaved = (record) => {
    if (editing) {
      setRecords(p => p.map(r => r.id === record.id ? record : r));
    } else {
      setRecords(p => [record, ...p]);
      setTotal(p => p + 1);
    }
    if (module) loadStats(module);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      setDeleting(id);
      await api.delete(`/module-records/${id}`);
      setRecords(p => p.filter(r => r.id !== id));
      setTotal(p => p - 1);
      toast.success('Registro eliminado');
    } catch { toast.error('Error al eliminar'); }
    finally { setDeleting(null); }
  };

  if (!module && !loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Módulo no encontrado</div>
  );

  const atLimit = stats.daily_limit > 0 && stats.today_count >= stats.daily_limit;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          {module && (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: module.color }}>
              <ModuleIcon name={module.icon} size={16} className="text-white" />
            </div>
          )}
          <div>
            <h1 className="text-base font-semibold text-slate-800">{module?.name || '...'}</h1>
            {module?.description && <p className="text-xs text-slate-400">{module.description}</p>}
          </div>
          {stats.daily_limit > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: atLimit ? '#fee2e2' : '#f0fdf4', color: atLimit ? '#ef4444' : '#22c55e', border: `0.5px solid ${atLimit ? '#fecaca' : '#bbf7d0'}` }}>
              <span className={`w-1.5 h-1.5 rounded-full ${atLimit ? 'bg-red-400' : 'bg-green-400'}`} />
              Hoy: {stats.today_count}/{stats.daily_limit}
            </div>
          )}
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          disabled={atLimit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: module?.color || '#6366f1' }}
          title={atLimit ? `Límite diario de ${stats.daily_limit} registros alcanzado` : 'Nuevo registro'}
        >
          <Plus size={15} /> Nuevo registro
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0" style={{ borderBottom: '0.5px solid #f1f5f9', background: '#fafbfc' }}>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar contacto..."
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white outline-none focus:border-indigo-400 w-52" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-1">
          {[{ value: '', label: 'Todos' }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))].map(s => (
            <button key={s.value} onClick={() => { setFilter(s.value); setPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === s.value ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{total} registro{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <span className="text-sm">Cargando...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
            {module && <ModuleIcon name={module.icon} size={36} />}
            <p className="text-sm">{search || filter ? 'Sin resultados para esta búsqueda' : 'Sin registros aún'}</p>
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ borderBottom: '0.5px solid #e2e8f0' }}>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Contacto</th>
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Estado</th>
                {(module?.fields_schema || []).slice(0, 3).map(f => (
                  <th key={f.id} className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">{f.label}</th>
                ))}
                <th className="text-left text-xs font-medium text-slate-400 pb-2 pr-4">Fecha</th>
                <th className="pb-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {records.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors" style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                  <td className="py-3 pr-4 font-medium text-slate-700">{rec.contact_name || <span className="text-slate-300">—</span>}</td>
                  <td className="py-3 pr-4"><StatusBadge value={rec.status} /></td>
                  {(module?.fields_schema || []).slice(0, 3).map(f => (
                    <td key={f.id} className="py-3 pr-4 text-slate-600 max-w-[180px] truncate">
                      {formatFieldValue(rec.data?.[f.id], f)}
                    </td>
                  ))}
                  <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(rec.created_at)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditing(rec); setModalOpen(true); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <Pencil size={13} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(rec.id)} disabled={deleting === rec.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                          {deleting === rec.id
                            ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                            : <Trash2 size={13} />
                          }
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación */}
        {total > LIMIT && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Anterior
            </button>
            <span className="text-xs text-slate-400">Página {page} de {Math.ceil(total / LIMIT)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / LIMIT)}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Siguiente
            </button>
          </div>
        )}
      </div>

      <ModuleRecordModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
        module={module}
        initial={editing}
      />
    </div>
  );
}

function formatFieldValue(val, field) {
  if (val === undefined || val === null || val === '') return <span className="text-slate-300">—</span>;
  if (field.type === 'checkbox') return val ? 'Sí' : 'No';
  if (field.type === 'date') return new Date(val).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  if (field.type === 'image') {
    return (
      <img
        src={val}
        alt=""
        className="w-9 h-9 rounded-lg object-cover border border-slate-200 cursor-pointer hover:scale-105 transition-transform"
        onClick={() => window.open(val, '_blank')}
        title="Ver imagen completa"
      />
    );
  }
  if (field.type === 'currency') {
    const symbol = field.currency_symbol || '$';
    const num = parseFloat(val);
    if (isNaN(num)) return <span className="text-slate-300">—</span>;
    return (
      <span className="font-medium text-slate-700">
        {symbol} {num.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  }
  return String(val);
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
