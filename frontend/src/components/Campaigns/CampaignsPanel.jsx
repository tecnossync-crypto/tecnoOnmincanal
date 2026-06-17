// frontend/src/components/Campaigns/CampaignsPanel.jsx
import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone, Send as SendIcon, Trash2, CheckCircle, XCircle, Users, Upload, AlertCircle, Clock } from 'lucide-react';

const STATUS_COLORS = {
  draft:     'bg-gray-100 text-gray-600',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
  paused:    'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
};

const EMPTY_FORM = {
  name: '',
  channel: 'whatsapp',
  message_template: 'Hola {{nombre}}, tenemos una oferta especial para ti. ¡Contáctanos!',
  messages_per_minute: 30,
};

export default function CampaignsPanel() {
  const [campaigns, setCampaigns] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(null);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data);
    } catch { toast.error('Error cargando campañas'); }
  };

  const handleCreate = async () => {
    if (!form.name || !form.message_template) return toast.error('Nombre y mensaje son requeridos');
    setSaving(true);
    try {
      await api.post('/campaigns', form);
      toast.success('Campaña creada');
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchCampaigns();
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const handleLaunch = async (id) => {
    if (!confirm('¿Lanzar esta campaña ahora?')) return;
    setLaunching(id);
    try {
      await api.post(`/campaigns/${id}/launch`);
      toast.success('Campaña lanzada');
      fetchCampaigns();
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally { setLaunching(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta campaña?')) return;
    await api.delete(`/campaigns/${id}`);
    toast.success('Campaña eliminada');
    fetchCampaigns();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-gray-700" />
            <h1 className="text-lg font-bold text-gray-900">Campañas Masivas</h1>
          </div>
          <p className="text-sm text-gray-500">Envía mensajes a múltiples contactos usando Bull Queue</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? '✕ Cancelar' : '+ Nueva campaña'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Formulario de nueva campaña */}
        {showForm && (
          <div className="card mb-6 border-blue-100">
            <h3 className="font-semibold text-gray-900 mb-4">Nueva Campaña</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la campaña</label>
                <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                  className="input-field" placeholder="Black Friday 2025" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Canal</label>
                <select value={form.channel} onChange={(e) => setForm({...form, channel: e.target.value})} className="input-field">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="messenger">Messenger</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje
                <span className="ml-2 text-gray-400 font-normal text-xs">Variables: {'{{nombre}}'} {'{{telefono}}'} {'{{email}}'}</span>
              </label>
              <textarea value={form.message_template} onChange={(e) => setForm({...form, message_template: e.target.value})}
                className="input-field" rows={4} placeholder="Hola {{nombre}}, tenemos una oferta para ti..." />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Velocidad: <span className="font-bold text-blue-600">{form.messages_per_minute} msg/min</span>
              </label>
              <input type="range" min="5" max="100" step="5" value={form.messages_per_minute}
                onChange={(e) => setForm({...form, messages_per_minute: +e.target.value})}
                className="w-full accent-blue-600" />
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><AlertCircle size={11} /> WhatsApp recomienda máximo 80 msg/min para evitar bloqueos</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving} className="btn-primary">
                {saving ? 'Creando...' : 'Crear campaña'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        )}

        {/* Info de funcionamiento */}
        {campaigns.length === 0 && !showForm ? (
          <div className="text-center py-20">
            <Megaphone size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Sin campañas aún</h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Crea tu primera campaña para enviar mensajes masivos a tus contactos usando Redis + Bull Queue
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4">+ Crear primera campaña</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onLaunch={handleLaunch}
                onDelete={handleDelete}
                launching={launching === c.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CampaignCard({ campaign: c, onLaunch, onDelete, launching }) {
  const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
              {c.status}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{c.channel}</span>
          </div>
          <p className="text-sm text-gray-500 truncate mb-2">{c.message_template}</p>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Upload size={11} /> Enviados: <b className="text-gray-900">{c.sent_count}</b></span>
            <span className="flex items-center gap-1"><CheckCircle size={11} className="text-green-500" /> Entregados: <b className="text-green-600">{c.delivered_count}</b></span>
            <span className="flex items-center gap-1"><XCircle size={11} className="text-red-500" /> Fallidos: <b className="text-red-600">{c.failed_count}</b></span>
            <span className="flex items-center gap-1"><Users size={11} /> Total: <b>{c.total_recipients}</b></span>
          </div>

          {/* Barra de progreso */}
          {c.status === 'running' && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progreso</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {c.created_at && (
            <p className="text-xs text-gray-400 mt-2">
              Creada {format(new Date(c.created_at), "d 'de' MMM 'a las' HH:mm", { locale: es })}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          {c.status === 'draft' && (
            <>
              <button onClick={() => onLaunch(c.id)} disabled={launching}
                className="btn-primary text-xs px-4 py-2">
                {launching ? <span className="flex items-center gap-1"><Clock size={12} /> Lanzando...</span> : <span className="flex items-center gap-1"><SendIcon size={12} /> Lanzar</span>}
              </button>
              <button onClick={() => onDelete(c.id)} className="btn-secondary text-xs px-4 py-2 text-red-500 hover:bg-red-50">
                <span className="flex items-center gap-1"><Trash2 size={12} /> Eliminar</span>
              </button>
            </>
          )}
          {c.status === 'running' && (
            <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              En progreso
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
