// frontend/src/components/Modules/ModulosConfig.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, X, Check, GripVertical, ChevronDown, ChevronUp,
         Box, ShoppingCart, FileText, Users, Calendar, Star, Truck, Tag,
         ClipboardList, Package, Wrench, BarChart2, Coffee, Zap } from 'lucide-react';
import api from '../../services/api';
import { useModuleStore } from '../../store';
import toast from 'react-hot-toast';

const ICONS = [
  { name: 'Box',           Icon: Box           },
  { name: 'ShoppingCart',  Icon: ShoppingCart  },
  { name: 'FileText',      Icon: FileText      },
  { name: 'Users',         Icon: Users         },
  { name: 'Calendar',      Icon: Calendar      },
  { name: 'Star',          Icon: Star          },
  { name: 'Truck',         Icon: Truck         },
  { name: 'Tag',           Icon: Tag           },
  { name: 'ClipboardList', Icon: ClipboardList },
  { name: 'Package',       Icon: Package       },
  { name: 'Wrench',        Icon: Wrench        },
  { name: 'BarChart2',     Icon: BarChart2     },
  { name: 'Coffee',        Icon: Coffee        },
  { name: 'Zap',           Icon: Zap           },
];

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6'];

const FIELD_TYPES = [
  { value: 'text',     label: 'Texto corto'  },
  { value: 'textarea', label: 'Texto largo'  },
  { value: 'number',   label: 'Número'       },
  { value: 'date',     label: 'Fecha'        },
  { value: 'select',   label: 'Lista'        },
  { value: 'checkbox', label: 'Casilla'      },
  { value: 'currency', label: 'Monto'        },
  { value: 'image',    label: 'Imagen'       },
];

const EMPTY_MODULE = { name: '', icon: 'Box', color: '#6366f1', description: '', fields_schema: [], daily_limit: 0, sort_order: 0 };
const EMPTY_FIELD  = { id: '', label: '', type: 'text', required: false, options: '', currency_symbol: '$' };

function genId() { return `f_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function ModuleIcon({ name, size = 18, className = '' }) {
  const found = ICONS.find(i => i.name === name);
  if (!found) return <Box size={size} className={className} />;
  return <found.Icon size={size} className={className} />;
}

function FieldRow({ field, onChange, onRemove }) {
  return (
    <div className="p-3 rounded-lg flex flex-col gap-1.5" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}>
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="text-slate-300 flex-shrink-0 cursor-grab" />
        <div className="flex-1 grid grid-cols-[1fr_140px_80px] gap-2">
          <input
            value={field.label}
            onChange={e => onChange({ ...field, label: e.target.value })}
            placeholder="Nombre del campo"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          <select
            value={field.type}
            onChange={e => onChange({ ...field, type: e.target.value })}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-400"
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => onChange({ ...field, required: !field.required })}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              field.required ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {field.required ? 'Req.' : 'Opc.'}
          </button>
        </div>
        <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
          <X size={13} />
        </button>
      </div>

      {field.type === 'select' && (
        <div className="ml-6 mr-8">
          <input
            value={field.options}
            onChange={e => onChange({ ...field, options: e.target.value })}
            placeholder="Opción 1, Opción 2, Opción 3"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
          />
          <p className="text-[11px] text-slate-400 mt-0.5">Separadas por coma</p>
        </div>
      )}

      {field.type === 'currency' && (
        <div className="ml-6 mr-8 flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <input
              value={field.currency_symbol || '$'}
              onChange={e => onChange({ ...field, currency_symbol: e.target.value })}
              placeholder="$"
              maxLength={5}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 text-center font-medium"
            />
            <p className="text-[11px] text-slate-400 text-center">Símbolo</p>
          </div>
          <p className="text-xs text-slate-400">Ej: <span className="font-medium text-slate-600">$</span>, <span className="font-medium text-slate-600">€</span>, <span className="font-medium text-slate-600">Bs.</span></p>
        </div>
      )}

      {field.type === 'image' && (
        <div className="ml-6 mr-8">
          <p className="text-[11px] text-slate-400">Permite adjuntar una imagen por registro (máx. 2 MB, JPG/PNG/WebP)</p>
        </div>
      )}
    </div>
  );
}

function ModuleModal({ open, onClose, onSave, initial, saving }) {
  const [form, setForm] = useState(EMPTY_MODULE);
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        ...initial,
        fields_schema: (initial.fields_schema || []).map(f => ({
          ...f,
          options: Array.isArray(f.options) ? f.options.join(', ') : (f.options || '')
        }))
      } : EMPTY_MODULE);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addField = () => {
    set('fields_schema', [...form.fields_schema, { ...EMPTY_FIELD, id: genId() }]);
  };

  const updateField = (idx, updated) => {
    const next = [...form.fields_schema];
    next[idx] = updated;
    set('fields_schema', next);
  };

  const removeField = (idx) => {
    set('fields_schema', form.fields_schema.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    const cleanFields = form.fields_schema
      .filter(f => f.label.trim())
      .map(f => ({
        ...f,
        label: f.label.trim(),
        options: f.type === 'select'
          ? f.options.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
        currency_symbol: f.type === 'currency' ? (f.currency_symbol || '$') : undefined,
      }));
    onSave({ ...form, fields_schema: cleanFields });
  };

  const selectedIcon = ICONS.find(i => i.name === form.icon) || ICONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: form.color }}>
              <ModuleIcon name={form.icon} size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              {initial?.id ? 'Editar módulo' : 'Nuevo módulo'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* Nombre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Nombre del módulo <span className="text-red-400">*</span></label>
              <input ref={nameRef} value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ej: Pedidos, Facturación, Reservas..." className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-500">Descripción <span className="text-slate-400 font-normal">(opcional)</span></label>
              <input value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="¿Para qué sirve este módulo?" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
            </div>

            {/* Ícono + Color + Límite diario */}
            <div className="grid grid-cols-[1fr_1fr_120px] gap-4">
              {/* Ícono */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Ícono</label>
                <div className="flex flex-wrap gap-1.5">
                  {ICONS.map(({ name, Icon }) => (
                    <button key={name} type="button" onClick={() => set('icon', name)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        form.icon === name ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      style={form.icon === name ? { background: form.color } : {}}
                      title={name}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Color</label>
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => set('color', c)}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                      style={{ background: c }}
                    >
                      {form.color === c && <Check size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Límite diario */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500">Límite diario</label>
                <input type="number" min={0} value={form.daily_limit} onChange={e => set('daily_limit', parseInt(e.target.value) || 0)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                <p className="text-[11px] text-slate-400">0 = sin límite</p>
              </div>
            </div>

            {/* Campos personalizados */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-widest">Campos del formulario</label>
                <button type="button" onClick={addField}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  <Plus size={13} /> Agregar campo
                </button>
              </div>

              {form.fields_schema.length === 0 ? (
                <div className="text-center py-6 rounded-xl border-2 border-dashed border-slate-200">
                  <p className="text-xs text-slate-400">Sin campos personalizados.<br/>Agrega campos para estructurar los registros.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {form.fields_schema.map((field, idx) => (
                    <FieldRow key={field.id || idx} field={field}
                      onChange={updated => updateField(idx, updated)}
                      onRemove={() => removeField(idx)} />
                  ))}
                </div>
              )}

              <div className="rounded-lg px-3 py-2 text-xs text-slate-500" style={{ background: '#eef2ff', border: '0.5px solid #c7d2fe' }}>
                Todos los registros incluyen por defecto: <strong>Contacto, Estado</strong> (Pendiente / En proceso / Completado / Cancelado) y <strong>Notas</strong>.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: form.color }}>
              {saving
                ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <Check size={14} />
              }
              {saving ? 'Guardando...' : 'Guardar módulo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { ModuleIcon };

export default function ModulosConfig() {
  const navigate = useNavigate();
  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [expanded,  setExpanded]  = useState(null);

  const syncSidebar = (updater) => {
    const { modules, setModules } = useModuleStore.getState();
    setModules(typeof updater === 'function' ? updater(modules) : updater);
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/custom-modules/admin');
      setItems(res.data || []);
    } catch { toast.error('Error al cargar módulos'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleOpen = (item = null) => { setEditing(item); setModalOpen(true); };

  const handleSave = async (form) => {
    try {
      setSaving(true);
      if (editing?.id) {
        const res = await api.put(`/custom-modules/${editing.id}`, form);
        setItems(p => p.map(i => i.id === editing.id ? res.data : i));
        syncSidebar(prev => prev.map(m => m.id === editing.id ? res.data : m));
        toast.success('Módulo actualizado');
      } else {
        const res = await api.post('/custom-modules', form);
        setItems(p => [...p, res.data]);
        syncSidebar(prev => [...prev, res.data]);
        toast.success('Módulo creado');
      }
      setModalOpen(false); setEditing(null);
    } catch (err) { toast.error(err.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este módulo? Se perderán todos sus registros.')) return;
    try {
      setDeleting(id);
      await api.delete(`/custom-modules/${id}`);
      setItems(p => p.filter(i => i.id !== id));
      syncSidebar(prev => prev.filter(m => m.id !== id));
      toast.success('Módulo eliminado');
    } catch { toast.error('Error al eliminar'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0" style={{ borderBottom: '0.5px solid #e2e8f0' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/config')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-800 transition-colors">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
            Configuración
          </button>
          <span className="text-slate-300">›</span>
          <div className="flex items-center gap-2">
            <Box size={15} className="text-indigo-500" />
            <span className="text-sm font-medium text-slate-800">Módulos personalizados</span>
          </div>
        </div>
        <button onClick={() => handleOpen()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
          <Plus size={15} /> Nuevo módulo
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            <span className="text-sm">Cargando...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-slate-400">
            <Box size={40} strokeWidth={1.5} />
            <p className="text-sm font-medium">Sin módulos personalizados</p>
            <button onClick={() => handleOpen()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 transition-colors">
              <Plus size={14} /> Crear primer módulo
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-w-2xl">
            {items.map(item => (
              <div key={item.id} className="rounded-xl border transition-all" style={{ borderColor: '#e2e8f0' }}>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.color }}>
                    <ModuleIcon name={item.icon} size={18} className="text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                      {!item.is_active && <span className="text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded">Inactivo</span>}
                      {item.daily_limit > 0 && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                          Límite: {item.daily_limit}/día
                        </span>
                      )}
                      <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {item.fields_schema?.length || 0} campo{(item.fields_schema?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</p>}
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => navigate(`/modules/${item.slug}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                      Ver registros
                    </button>
                    <button onClick={() => handleOpen(item)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {deleting === item.id
                        ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        : <Trash2 size={13} />
                      }
                    </button>
                    <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                      {expanded === item.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expandido: campos */}
                {expanded === item.id && item.fields_schema?.length > 0 && (
                  <div className="px-5 pb-4 border-t border-slate-50">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-3 mb-2">Campos del formulario</p>
                    <div className="flex flex-wrap gap-2">
                      {item.fields_schema.map(f => (
                        <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#f8fafc', border: '0.5px solid #e2e8f0' }}>
                          {f.type === 'image' && (
                            <svg viewBox="0 0 24 24" className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v14.25c0 .414.336.75.75.75z"/>
                            </svg>
                          )}
                          {f.type === 'currency' && (
                            <span className="text-[11px] font-bold text-slate-500">{f.currency_symbol || '$'}</span>
                          )}
                          <span className="text-xs font-medium text-slate-700">{f.label}</span>
                          <span className="text-[10px] text-slate-400">{FIELD_TYPES.find(t => t.value === f.type)?.label}</span>
                          {f.required && <span className="text-[10px] text-red-400">*</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleModal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave} initial={editing} saving={saving} />
    </div>
  );
}
