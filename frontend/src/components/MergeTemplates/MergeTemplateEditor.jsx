import React, { useState } from 'react';
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

const CHANNELS = [
  { value: 'all',               label: 'Todos los canales' },
  { value: 'whatsapp',          label: 'WhatsApp Personal' },
  { value: 'whatsapp_business', label: 'WhatsApp Business' },
  { value: 'messenger',         label: 'Messenger' },
  { value: 'instagram',         label: 'Instagram' },
  { value: 'email',             label: 'Email' },
  { value: 'sms',               label: 'SMS' },
];

const QUICK_VARS = [
  { key: 'nombre_cliente', label: 'Nombre' },
  { key: 'telefono',       label: 'Teléfono' },
  { key: 'email',          label: 'Email' },
  { key: 'numero_ticket',  label: 'Ticket' },
  { key: 'numero_pedido',  label: 'Pedido' },
  { key: 'fecha',          label: 'Fecha' },
];

export default function MergeTemplateEditor({ template, onSaved, onClose }) {
  const { createTemplate, updateTemplate } = useMergeTemplateStore();
  const isEditing = !!template;

  const [nombre, setNombre]           = useState(template?.nombre || '');
  const [descripcion, setDescripcion] = useState(template?.descripcion || '');
  const [canal, setCanal]             = useState(template?.canal || 'all');
  const [contenido, setContenido]     = useState(template?.contenido || '');
  const [saving, setSaving]           = useState(false);

  const variables = extractVariables(contenido);

  const insertVar = (key) => setContenido((p) => p + `{${key}}`);

  const handleSave = async () => {
    if (!nombre.trim()) return toast.error('El nombre es obligatorio');
    if (!contenido.trim()) return toast.error('El contenido es obligatorio');
    setSaving(true);
    try {
      if (isEditing) { await updateTemplate(template.id, { nombre, descripcion, canal, contenido }); toast.success('Actualizada'); }
      else { await createTemplate({ nombre, descripcion, canal, contenido }); toast.success('Creada'); }
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{isEditing ? 'Editar plantilla' : 'Nueva plantilla de mensaje'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Bienvenida WhatsApp"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripcion</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Uso o contexto..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Variables <span className="font-normal text-slate-400">(clic para insertar)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_VARS.map((v) => (
                <button key={v.key} onClick={() => insertVar(v.key)}
                  className="px-2.5 py-1 text-xs font-mono rounded-md border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  {`{${v.key}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Contenido del mensaje *</label>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={8}
              placeholder={"Hola {nombre_cliente}, gracias por contactarnos..."}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y font-mono" />
          </div>

          {variables.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Variables detectadas ({variables.length})</h4>
              <div className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-xs font-mono text-slate-700 dark:text-slate-200 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />{v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl shadow-sm">
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
