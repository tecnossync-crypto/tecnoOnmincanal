import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const VAR_LABELS = {
  nombre_cliente: 'Nombre',
  telefono: 'Teléfono',
  email: 'Email',
  numero_ticket: 'N° Ticket',
  numero_pedido: 'N° Pedido',
  fecha: 'Fecha',
};

export default function MessageTemplatePicker({ conversationId, onInsert, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [datos, setDatos]         = useState({});
  const [resultado, setResultado] = useState(null);
  const [merging, setMerging]     = useState(false);
  const [search, setSearch]       = useState('');

  useEffect(() => {
    api.get('/merge-templates?activo=true')
      .then((res) => setTemplates(res.data || []))
      .catch(() => toast.error('Error cargando plantillas'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) =>
    !search || t.nombre.toLowerCase().includes(search.toLowerCase()) || t.contenido.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (tpl) => {
    setSelected(tpl);
    setResultado(null);
    if (!conversationId) {
      setDatos(Object.fromEntries((tpl.variables || []).map((v) => [v, ''])));
      return;
    }
    try {
      const res = await api.post(`/merge-templates/${tpl.id}/use/${conversationId}`, { datos: {} });
      setDatos(res.data.datosResueltos || {});
      setResultado(res.data.resultado);
    } catch {
      setDatos(Object.fromEntries((tpl.variables || []).map((v) => [v, ''])));
    }
  };

  const handleMerge = async () => {
    if (!selected) return;
    setMerging(true);
    try {
      if (conversationId) {
        const res = await api.post(`/merge-templates/${selected.id}/use/${conversationId}`, { datos });
        setResultado(res.data.resultado);
      } else {
        const res = await api.post(`/merge-templates/${selected.id}/merge`, { datos });
        setResultado(res.data.resultado);
      }
    } catch (e) { toast.error(e.message); } finally { setMerging(false); }
  };

  const handleInsert = () => {
    if (resultado) { onInsert(resultado); onClose(); }
    else if (selected) { onInsert(selected.contenido); onClose(); }
  };

  if (!selected) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white">Plantillas de mensaje</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-5 pt-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plantilla..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200" autoFocus />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center py-8 text-sm text-slate-400">Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-sm text-slate-400">Sin plantillas</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((tpl) => (
                  <button key={tpl.id} onClick={() => handleSelect(tpl)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{tpl.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{tpl.contenido?.substring(0, 80)}</p>
                    {tpl.variables?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {tpl.variables.slice(0, 4).map((v) => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-mono">{`{${v}}`}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="font-bold text-slate-800 dark:text-white truncate">{selected.nombre}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {(selected.variables || []).length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Variables</p>
              {selected.variables.map((v) => (
                <div key={v}>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{VAR_LABELS[v] || v}</label>
                  <input value={datos[v] || ''} onChange={(e) => { setDatos((p) => ({ ...p, [v]: e.target.value })); setResultado(null); }}
                    placeholder={`{${v}}`}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
                </div>
              ))}
              <button onClick={handleMerge} disabled={merging}
                className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 rounded-lg transition-colors">
                {merging ? 'Procesando...' : 'Actualizar vista previa'}
              </button>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mensaje resultante</p>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {resultado || selected.contenido}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
          <button onClick={handleInsert}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm">
            Insertar en chat
          </button>
        </div>
      </div>
    </div>
  );
}
