// frontend/src/components/BotConfig/TransferCriteriaPanel.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Key, MessageSquare, Calendar, FileText, Target, ArrowLeftRight } from 'lucide-react';

function getTypeIcon(type) {
  const map = {
    keyword:       <Key size={16} className="text-indigo-400" />,
    message_count: <MessageSquare size={16} className="text-blue-400" />,
    date_urgency:  <Calendar size={16} className="text-amber-400" />,
    after_quote:   <FileText size={16} className="text-green-400" />,
    intent:        <Target size={16} className="text-purple-400" />,
  };
  return map[type] || <ArrowLeftRight size={16} className="text-slate-400" />;
}

const TYPES = [
  { value: 'keyword',       label: 'Palabra clave',           desc: 'El cliente menciona una palabra específica' },
  { value: 'message_count', label: 'Límite de mensajes',      desc: 'Después de X mensajes en la conversación' },
  { value: 'date_urgency',  label: 'Urgencia por fecha',      desc: 'El cliente menciona vencimiento o urgencia' },
  { value: 'after_quote',   label: 'Después de cotización',   desc: 'Una vez que el bot envió una cotización' },
  { value: 'intent',        label: 'Intención de compra',     desc: 'La IA detecta que el cliente quiere comprar' },
];

export default function TransferCriteriaPanel() {
  const [criteria,    setCriteria]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newKeyword,  setNewKeyword]  = useState('');

  const [form, setForm] = useState({
    name:             '',
    type:             'keyword',
    config:           { keywords: [], message_limit: 10, days_threshold: 30 },
    transfer_message: 'Te conecto con uno de nuestros asesores. Un momento por favor.',
    is_active:        true,
    priority:         0
  });

  useEffect(() => { fetchCriteria(); }, []);

  const fetchCriteria = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transfer-criteria');
      setCriteria(res.data || []);
    } catch { toast.error('Error cargando criterios'); }
    finally { setLoading(false); }
  };

  const handleOpenForm = (item = null) => {
    if (item) {
      setEditingItem(item);
      setForm({
        name:             item.name,
        type:             item.type,
        config:           item.config || { keywords: [], message_limit: 10 },
        transfer_message: item.transfer_message,
        is_active:        item.is_active,
        priority:         item.priority || 0
      });
    } else {
      setEditingItem(null);
      setForm({
        name:             '',
        type:             'keyword',
        config:           { keywords: [], message_limit: 10, days_threshold: 30 },
        transfer_message: 'Te conecto con uno de nuestros asesores. Un momento por favor.',
        is_active:        true,
        priority:         0
      });
    }
    setShowForm(true);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    setForm(f => ({
      ...f,
      config: { ...f.config, keywords: [...(f.config.keywords || []), newKeyword.trim()] }
    }));
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setForm(f => ({
      ...f,
      config: { ...f.config, keywords: f.config.keywords.filter(k => k !== kw) }
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('El nombre es requerido');
    try {
      if (editingItem) {
        await api.put(`/transfer-criteria/${editingItem.id}`, form);
        toast.success('Criterio actualizado');
      } else {
        await api.post('/transfer-criteria', form);
        toast.success('Criterio creado');
      }
      setShowForm(false);
      fetchCriteria();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este criterio?')) return;
    try {
      await api.delete(`/transfer-criteria/${id}`);
      toast.success('Eliminado');
      fetchCriteria();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggle = async (item) => {
    try {
      await api.put(`/transfer-criteria/${item.id}`, { ...item, is_active: !item.is_active });
      fetchCriteria();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Criterios de Transferencia</h2>
            <p className="text-xs text-gray-400 mt-1">
              Define cuándo el bot debe transferir la conversación a un asesor humano
            </p>
          </div>
          <button onClick={() => handleOpenForm()}
            className="px-4 py-2 text-sm font-medium text-white rounded-xl"
            style={{ background: '#6366f1' }}>
            + Nuevo criterio
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="rounded-2xl p-6 mb-6 bg-white" style={{ border: '0.5px solid #e2e8f0' }}>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">
              {editingItem ? 'Editar criterio' : 'Nuevo criterio'}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Cliente listo para comprar"
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
                <input type="number" value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  className="input-field text-sm" min="0" max="100" />
              </div>
            </div>

            {/* Tipo */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de criterio</label>
              <div className="grid grid-cols-1 gap-2">
                {TYPES.map(t => (
                  <label key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-all
                      ${form.type === t.value
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <input type="radio" name="type" value={t.value}
                      checked={form.type === t.value}
                      onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        {getTypeIcon(t.value)} {t.label}
                      </p>
                      <p className="text-xs text-gray-400">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Config según tipo */}
            {form.type === 'keyword' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Palabras clave</label>
                <div className="flex gap-2 mb-2">
                  <input value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                    placeholder="Ej: quiero comprar, me interesa, acepto"
                    className="flex-1 input-field text-sm" />
                  <button onClick={handleAddKeyword}
                    className="px-3 py-2 text-sm rounded-lg text-white"
                    style={{ background: '#6366f1' }}>
                    Agregar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(form.config.keywords || []).map(kw => (
                    <span key={kw} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}>
                      {kw}
                      <button onClick={() => handleRemoveKeyword(kw)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {form.type === 'message_count' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Transferir después de cuántos mensajes
                </label>
                <input type="number" value={form.config.message_limit || 10}
                  onChange={e => setForm(f => ({ ...f, config: { ...f.config, message_limit: parseInt(e.target.value) } }))}
                  className="input-field text-sm w-32" min="1" max="100" />
              </div>
            )}

            {/* Mensaje de transferencia */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mensaje que envía el bot al transferir
              </label>
              <textarea value={form.transfer_message}
                onChange={e => setForm(f => ({ ...f, transfer_message: e.target.value }))}
                className="input-field text-sm" rows={2} />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600">
                Cancelar
              </button>
              <button onClick={handleSave}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium"
                style={{ background: '#6366f1' }}>
                {editingItem ? 'Actualizar' : 'Crear criterio'}
              </button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : criteria.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ArrowLeftRight size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Sin criterios de transferencia</p>
            <p className="text-xs mt-1">Crea criterios para que el bot sepa cuándo pasar al asesor</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {criteria.sort((a, b) => b.priority - a.priority).map(item => (
              <div key={item.id}
                className={`flex items-start gap-4 p-4 rounded-2xl bg-white transition-all
                  ${!item.is_active ? 'opacity-60' : ''}`}
                style={{ border: '0.5px solid #e2e8f0' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: '#f8fafc' }}>
                  {getTypeIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: '#f1f5f9', color: '#64748b' }}>
                      {TYPES.find(t => t.value === item.type)?.label}
                    </span>
                    {item.priority > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: '#fef3c7', color: '#92400e' }}>
                        Prioridad {item.priority}
                      </span>
                    )}
                  </div>
                  {item.type === 'keyword' && item.config.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.config.keywords.map(kw => (
                        <span key={kw} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: '#ede9fe', color: '#6d28d9' }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.type === 'message_count' && (
                    <p className="text-xs text-gray-400 mb-1">
                      Después de {item.config.message_limit} mensajes
                    </p>
                  )}
                  <p className="text-xs text-gray-400 italic">"{item.transfer_message}"</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(item)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: item.is_active ? '#f0fdf4' : '#f1f5f9',
                      color:      item.is_active ? '#16a34a' : '#64748b'
                    }}>
                    {item.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => handleOpenForm(item)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#ede9fe', color: '#6d28d9' }}>
                    Editar
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: '#fef2f2', color: '#dc2626' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}