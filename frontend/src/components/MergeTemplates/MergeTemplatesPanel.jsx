import React, { useState, useEffect } from 'react';
import { useMergeTemplateStore, useAuthStore } from '../../store';
import MergeTemplateEditor from './MergeTemplateEditor';
import MergePreviewModal from './MergePreviewModal';
import toast from 'react-hot-toast';

const CHANNELS = [
  { value: 'all',               label: 'Todos' },
  { value: 'whatsapp',          label: 'WhatsApp' },
  { value: 'whatsapp_business', label: 'WA Business' },
  { value: 'messenger',         label: 'Messenger' },
  { value: 'instagram',         label: 'Instagram' },
  { value: 'email',             label: 'Email' },
  { value: 'sms',               label: 'SMS' },
];

const CHANNEL_BADGE = {
  all:               'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  whatsapp:          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  whatsapp_business: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  messenger:         'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  instagram:         'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  email:             'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sms:               'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function MergeTemplatesPanel() {
  const { templates, isLoading, fetchTemplates, removeTemplate, toggleActive } = useMergeTemplateStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [editorOpen, setEditorOpen]     = useState(false);
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [editing, setEditing]           = useState(null);
  const [previewTpl, setPreviewTpl]     = useState(null);
  const [search, setSearch]             = useState('');
  const [filterCanal, setFilterCanal]   = useState('all');
  const [filterActivo, setFilterActivo] = useState('all');

  useEffect(() => { fetchTemplates(); }, []);

  const filtered = templates.filter((t) => {
    if (filterActivo === 'active' && !t.activo) return false;
    if (filterActivo === 'inactive' && t.activo) return false;
    if (filterCanal !== 'all' && t.canal !== 'all' && t.canal !== filterCanal) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.nombre.toLowerCase().includes(q) || t.descripcion?.toLowerCase().includes(q) || t.contenido?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDelete = async (tpl) => {
    if (!confirm(`Eliminar plantilla "${tpl.nombre}"?`)) return;
    try { await removeTemplate(tpl.id); toast.success('Eliminada'); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Plantillas de Mensajes
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Mensajes reutilizables con variables {"{"} {"}"} para cualquier canal</p>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditing(null); setEditorOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nueva plantilla
            </button>
          )}
        </div>
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-1">
            {CHANNELS.map((ch) => (
              <button key={ch.value} onClick={() => setFilterCanal(ch.value)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterCanal === ch.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                {ch.label}
              </button>
            ))}
          </div>
          <select value={filterActivo} onChange={(e) => setFilterActivo(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2">
            <option value="all">Todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 dark:text-slate-400 font-medium">No hay plantillas</p>
            <p className="text-sm text-slate-400 mt-1">{search ? 'Intenta otro término' : 'Crea tu primera plantilla de mensaje'}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tpl) => (
              <div key={tpl.id} className={`bg-white dark:bg-slate-800 rounded-xl border transition-all hover:shadow-md ${tpl.activo ? 'border-slate-200 dark:border-slate-700' : 'border-orange-200 dark:border-orange-800 opacity-70'}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 dark:text-white truncate">{tpl.nombre}</h3>
                      {tpl.descripcion && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{tpl.descripcion}</p>}
                    </div>
                    <div className="flex gap-1.5 ml-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CHANNEL_BADGE[tpl.canal] || CHANNEL_BADGE.all}`}>
                        {CHANNELS.find(c => c.value === tpl.canal)?.label || tpl.canal}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${tpl.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                        {tpl.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 mb-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[48px]">
                    {tpl.contenido?.substring(0, 120)}{tpl.contenido?.length > 120 ? '...' : ''}
                  </div>

                  {tpl.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {tpl.variables.slice(0, 5).map((v) => (
                        <span key={v} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-mono">{`{${v}}`}</span>
                      ))}
                      {tpl.variables.length > 5 && <span className="text-xs text-slate-400">+{tpl.variables.length - 5}</span>}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={() => { setPreviewTpl(tpl); setPreviewOpen(true); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Vista previa
                    </button>
                    {isAdmin && (
                      <>
                        <button onClick={() => { setEditing(tpl); setEditorOpen(true); }} className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Editar</button>
                        <button onClick={() => toggleActive(tpl.id)} className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">{tpl.activo ? 'Desactivar' : 'Activar'}</button>
                        <button onClick={() => handleDelete(tpl)} className="ml-auto px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">Eliminar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorOpen && <MergeTemplateEditor template={editing} onSaved={() => { setEditorOpen(false); setEditing(null); }} onClose={() => { setEditorOpen(false); setEditing(null); }} />}
      {previewOpen && previewTpl && <MergePreviewModal template={previewTpl} onClose={() => { setPreviewOpen(false); setPreviewTpl(null); }} />}
    </div>
  );
}
