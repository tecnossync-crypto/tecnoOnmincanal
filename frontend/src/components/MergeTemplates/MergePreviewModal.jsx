import React, { useState, useMemo } from 'react';
import { useMergeTemplateStore } from '../../store';
import toast from 'react-hot-toast';

const VARIABLE_REGEX = /\{([a-z0-9_]+)\}/g;
function extractVariables(text) {
  if (!text) return [];
  const m = new Set();
  let r;
  while ((r = VARIABLE_REGEX.exec(text)) !== null) m.add(r[1]);
  return Array.from(m);
}

const VAR_LABELS = {
  nombre_cliente: 'Nombre del cliente',
  telefono: 'Teléfono',
  email: 'Email',
  numero_ticket: 'N° Ticket',
  numero_pedido: 'N° Pedido',
  fecha: 'Fecha',
};

export default function MergePreviewModal({ template, onClose }) {
  const { mergeTemplate } = useMergeTemplateStore();
  const variables = useMemo(() => extractVariables(template.contenido), [template.contenido]);

  const [datos, setDatos] = useState(() => Object.fromEntries(variables.map((v) => [v, ''])));
  const [resultado, setResultado] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [merging, setMerging] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleChange = (variable, value) => { setDatos((p) => ({ ...p, [variable]: value })); setResultado(null); };

  const handleMerge = async () => {
    setMerging(true);
    try {
      const res = await mergeTemplate(template.id, datos);
      setResultado(res.resultado);
      setValidacion(res.validacion);
      if (res.variablesSinValor?.length > 0) toast(`${res.variablesSinValor.length} variable(s) sin valor`, { icon: '⚠️' });
    } catch (e) { toast.error(e.message); } finally { setMerging(false); }
  };

  const handleCopy = async () => {
    if (!resultado) return;
    try { await navigator.clipboard.writeText(resultado); setCopied(true); toast.success('Copiado'); setTimeout(() => setCopied(false), 2000); } catch { toast.error('No se pudo copiar'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Vista previa: {template.nombre}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Variables</h3>
            {variables.length === 0 ? (
              <p className="text-sm text-slate-400">Sin variables</p>
            ) : (
              <div className="space-y-3">
                {variables.map((v) => (
                  <div key={v}>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{VAR_LABELS[v] || v}</label>
                    <input value={datos[v] || ''} onChange={(e) => handleChange(v, e.target.value)} placeholder={`{${v}}`}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>
            )}
            <button onClick={handleMerge} disabled={merging}
              className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm">
              {merging ? 'Generando...' : 'Generar vista previa'}
            </button>
            {validacion && (
              <div className={`mt-3 rounded-lg p-3 text-xs ${validacion.valid ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'}`}>
                {validacion.valid ? 'Todas las variables reemplazadas' : `Faltan: ${validacion.faltantes.map(v => `{${v}}`).join(', ')}`}
              </div>
            )}
          </div>

          <div className="lg:w-3/5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{resultado !== null ? 'Resultado' : 'Plantilla'}</h3>
              {resultado !== null && (
                <button onClick={handleCopy} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-5 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap min-h-[200px]">
                {resultado !== null ? resultado : template.contenido}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
