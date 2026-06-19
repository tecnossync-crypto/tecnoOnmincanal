import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Phone, FileText, Check, Trash2, CalendarDays, Settings2, Bot, Link, Link2Off } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_LONG  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const STATUS = {
  pending:   { label: 'Pendiente',  dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200'  },
  confirmed: { label: 'Confirmada', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelada',  dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border-red-200'  },
  completed: { label: 'Completada', dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const DURATIONS = [15,30,45,60,90,120];

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

function buildGrid(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let day = 1 - firstDow;
  for (let r = 0; r < 6; r++) {
    const week = [];
    for (let c = 0; c < 7; c++, day++) {
      const d = new Date(year, month, day);
      week.push({
        dateStr: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
        dayNum:  d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: d.toISOString().slice(0,10) === todayStr(),
      });
    }
    grid.push(week);
  }
  return grid;
}

const DEFAULT_SCHED = DAYS_LONG.map((_, i) => ({
  day_of_week: i,
  is_active: i >= 1 && i <= 5,
  start_time: '08:00',
  end_time: i === 6 ? '13:00' : '17:00',
  slot_duration: 30,
  bot_scheduling_enabled: false,
}));

// ─── Modal de cita ─────────────────────────────────────────────────────────
function AppointmentModal({ appointment, defaultDate, availableSlots, onSave, onClose }) {
  const editing = !!appointment?.id;
  const [form, setForm] = useState({
    contact_name:     appointment?.contact_name     || '',
    contact_phone:    appointment?.contact_phone    || '',
    title:            appointment?.title            || '',
    date:             appointment?.date             || defaultDate || todayStr(),
    start_time:       appointment?.start_time       || (availableSlots?.[0] || '08:00'),
    duration_minutes: appointment?.duration_minutes || 30,
    status:           appointment?.status           || 'pending',
    notes:            appointment?.notes            || '',
  });
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState(availableSlots || []);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!form.date) return;
    setLoadingSlots(true);
    api.get(`/appointments/availability?date=${form.date}`)
      .then(r => {
        const s = r.data?.slots || [];
        setSlots(s);
        if (!editing && s.length && !s.includes(form.start_time)) set('start_time', s[0]);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contact_name.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/appointments/${appointment.id}`, form);
        toast.success('Cita actualizada');
      } else {
        await api.post('/appointments', form);
        toast.success('Cita creada');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {editing ? 'Editar cita' : 'Nueva cita'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del contacto *</label>
            <div className="relative">
              <User size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={form.contact_name}
                onChange={e => set('contact_name', e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
          </div>

          {/* Teléfono */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp / Teléfono</label>
            <div className="relative">
              <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={form.contact_phone}
                onChange={e => set('contact_phone', e.target.value)}
                placeholder="Ej: +1 809 234 5678"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Título opcional */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo / Título</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ej: Consulta inicial"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Fecha + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Hora *{loadingSlots && <span className="text-slate-400 ml-1">(cargando…)</span>}
              </label>
              {slots.length > 0 ? (
                <select
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  required
                />
              )}
            </div>
          </div>

          {/* Duración + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Duración</label>
              <select
                value={form.duration_minutes}
                onChange={e => set('duration_minutes', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Información adicional…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 px-4 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 px-4 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Crear cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Panel de configuración de horarios ─────────────────────────────────────
function ScheduleConfig({ schedule, onChange, onSave, saving }) {
  const botEnabled = schedule.some(d => d.bot_scheduling_enabled);

  const setDay = (idx, field, value) => {
    const next = schedule.map((d, i) => i === idx ? { ...d, [field]: value } : d);
    onChange(next);
  };

  const toggleBot = () => {
    const next = schedule.map(d => ({ ...d, bot_scheduling_enabled: !botEnabled }));
    onChange(next);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Bot scheduling toggle */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
          <Bot size={20} className="text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-800">Agendamiento por bot</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  El bot incluirá la disponibilidad en sus respuestas y podrá sugerir horarios automáticamente.
                </p>
              </div>
              <button
                onClick={toggleBot}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none
                  ${botEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5
                  ${botEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Days table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-700">Horario de atención semanal</p>
          </div>
          <div className="divide-y divide-slate-100">
            {schedule.map((day, idx) => (
              <div key={day.day_of_week} className={`flex items-center gap-3 px-5 py-3 ${!day.is_active ? 'opacity-60' : ''}`}>
                {/* Toggle activo */}
                <button
                  onClick={() => setDay(idx, 'is_active', !day.is_active)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200
                    ${day.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5
                    ${day.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </button>

                {/* Día */}
                <span className="text-sm font-medium text-slate-700 w-24 flex-shrink-0">
                  {DAYS_LONG[day.day_of_week]}
                </span>

                {/* Horario */}
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={day.start_time}
                    onChange={e => setDay(idx, 'start_time', e.target.value)}
                    disabled={!day.is_active}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50"
                  />
                  <span className="text-slate-400 text-xs">—</span>
                  <input
                    type="time"
                    value={day.end_time}
                    onChange={e => setDay(idx, 'end_time', e.target.value)}
                    disabled={!day.is_active}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50"
                  />
                </div>

                {/* Duración slot */}
                <select
                  value={day.slot_duration}
                  onChange={e => setDay(idx, 'slot_duration', Number(e.target.value))}
                  disabled={!day.is_active}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:bg-slate-50 w-24"
                >
                  {[15,20,30,45,60,90].map(d => <option key={d} value={d}>c/{d} min</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ─── Panel lateral del día ─────────────────────────────────────────────────
function DayPanel({ dateStr, appointments, onNew, onEdit, onDelete, onStatusChange }) {
  if (!dateStr) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
        <CalendarDays size={32} className="opacity-30" />
        <p className="text-sm">Selecciona un día</p>
      </div>
    );
  }

  const d = new Date(dateStr + 'T12:00:00');
  const label = `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{appointments.length} cita{appointments.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={12} />
          Nueva
        </button>
      </div>

      {/* Appointment list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-1">
            <p className="text-xs">Sin citas</p>
          </div>
        ) : appointments.map(a => (
          <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
            {/* Time + status */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">{a.start_time}</span>
                <span className="text-xs text-slate-400">· {a.duration_minutes} min</span>
              </div>
              <select
                value={a.status}
                onChange={e => onStatusChange(a.id, e.target.value)}
                className={`text-xs font-medium border rounded-full px-2 py-0.5 ${STATUS[a.status]?.badge || ''} cursor-pointer focus:outline-none`}
              >
                {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Name */}
            <p className="text-sm font-semibold text-slate-800 truncate">{a.contact_name}</p>
            {a.title && <p className="text-xs text-slate-500 truncate">{a.title}</p>}
            {a.contact_phone && (
              <p className="text-xs text-slate-400 mt-0.5">{a.contact_phone}</p>
            )}
            {a.notes && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">"{a.notes}"</p>
            )}

            {/* Actions */}
            <div className="flex gap-1 mt-2">
              <button onClick={() => onEdit(a)}
                className="flex-1 text-xs py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Editar
              </button>
              <button onClick={() => onDelete(a.id)}
                className="w-8 flex items-center justify-center rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Outlook status badge ─────────────────────────────────────────────────
function OutlookBadge({ status, onConnect, onDisconnect, connecting }) {
  if (!status) return null;
  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate max-w-[140px]">
            Outlook: {status.email}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          title="Desconectar Outlook"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
        >
          <Link2Off size={13} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="flex items-center gap-2 px-3 py-1.5 border border-blue-300 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
    >
      <Link size={13} />
      {connecting ? 'Conectando...' : 'Conectar Outlook'}
    </button>
  );
}

// ─── Google Calendar status badge ─────────────────────────────────────────
function GoogleCalendarBadge({ status, onConnect, onDisconnect, connecting }) {
  if (!status) return null;
  if (status.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <svg viewBox="0 0 24 24" width="12" height="12" className="flex-shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-xs font-medium text-red-700 dark:text-red-300 truncate max-w-[140px]">
            GCal: {status.email}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          title="Desconectar Google Calendar"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
        >
          <Link2Off size={13} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="flex items-center gap-2 px-3 py-1.5 border border-red-300 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" width="13" height="13">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {connecting ? 'Conectando...' : 'Conectar Google Calendar'}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────
export default function CalendarPanel() {
  const today = new Date();
  const [tab,          setTab]          = useState('calendar');
  const [year,         setYear]         = useState(today.getFullYear());
  const [month,        setMonth]        = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [monthAppts,   setMonthAppts]   = useState({}); // { 'YYYY-MM-DD': [] }
  const [dayAppts,     setDayAppts]     = useState([]);
  const [outlookAppts, setOutlookAppts] = useState([]); // eventos de Outlook del día
  const [modal,        setModal]        = useState(null); // null | 'new' | appointment obj
  const [schedule,     setSchedule]     = useState(DEFAULT_SCHED);
  const [savingSched,  setSavingSched]  = useState(false);
  const [loadingMonth,  setLoadingMonth]  = useState(false);
  const [outlookStatus, setOutlookStatus] = useState(null);
  const [connectingOL,  setConnectingOL]  = useState(false);
  const [gcalStatus,    setGcalStatus]    = useState(null);
  const [gcalAppts,     setGcalAppts]     = useState([]);
  const [connectingGCal, setConnectingGCal] = useState(false);
  const [confirmModal,  setConfirmModal]  = useState(null); // { msg, onConfirm }

  // Revisar si llegó de callback de Outlook o Google Calendar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const olResult = params.get('outlook');
    const gcResult = params.get('gcal');
    if (olResult === 'connected') {
      toast.success('Outlook Calendar conectado correctamente');
      window.history.replaceState({}, '', window.location.pathname);
      api.get('/outlook/status').then(r => setOutlookStatus(r.data || null)).catch(() => {});
    } else if (olResult === 'error') {
      toast.error('Error conectando Outlook: ' + (params.get('msg') || 'desconocido'));
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (gcResult === 'connected') {
      toast.success('Google Calendar conectado correctamente');
      window.history.replaceState({}, '', window.location.pathname);
      api.get('/gcal/status').then(r => setGcalStatus(r.data?.data || r.data || null)).catch(() => {});
    } else if (gcResult === 'error') {
      toast.error('Error conectando Google Calendar');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Cargar estado de Outlook y Google Calendar
  useEffect(() => {
    api.get('/outlook/status')
      .then(r => setOutlookStatus(r.data || null))
      .catch(() => {});
    api.get('/gcal/status')
      .then(r => setGcalStatus(r.data?.data || r.data || null))
      .catch(() => {});
  }, []);

  const handleConnectOutlook = async () => {
    setConnectingOL(true);
    try {
      const res = await api.get('/outlook/connect');
      window.location.href = res.data.url;
    } catch (err) {
      toast.error('No se pudo iniciar la conexión con Outlook');
      setConnectingOL(false);
    }
  };

  const handleDisconnectOutlook = () => {
    setConfirmModal({
      msg: '¿Desconectar la cuenta de Outlook?',
      onConfirm: async () => {
        try {
          await api.delete('/outlook/disconnect');
          setOutlookStatus({ connected: false });
          setOutlookAppts([]);
          toast.success('Outlook desconectado');
        } catch (err) {
          toast.error('Error desconectando Outlook');
        }
      },
    });
  };

  const handleConnectGCal = () => {
    setConnectingGCal(true);
    const base = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${base}/gcal/connect`;
  };

  const handleDisconnectGCal = () => {
    setConfirmModal({
      msg: '¿Desconectar Google Calendar?',
      onConfirm: async () => {
        try {
          await api.delete('/gcal/disconnect');
          setGcalStatus({ connected: false });
          setGcalAppts([]);
          toast.success('Google Calendar desconectado');
        } catch (err) {
          toast.error('Error desconectando Google Calendar');
        }
      },
    });
  };

  // ── Fetch month appointments ───────────────────────────
  const fetchMonth = useCallback(async () => {
    setLoadingMonth(true);
    try {
      const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
      const res = await api.get(`/appointments?month=${monthStr}`);
      const rows = res.data || [];
      const map = {};
      for (const a of rows) {
        if (!map[a.date]) map[a.date] = [];
        map[a.date].push(a);
      }
      setMonthAppts(map);
      // Update day panel
      if (selectedDate) setDayAppts(map[selectedDate] || []);
    } catch (err) {
      console.error('fetchMonth error:', err);
    } finally {
      setLoadingMonth(false);
    }
  }, [year, month]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  // ── Fetch schedule config ──────────────────────────────
  useEffect(() => {
    api.get('/appointments/schedule')
      .then(r => {
        if (Array.isArray(r.data)) {
          setSchedule(r.data.map(d => ({ bot_scheduling_enabled: false, ...d })));
        }
      })
      .catch(() => {});
  }, []);

  // ── Day click ──────────────────────────────────────────
  const handleDayClick = (ds) => {
    setSelectedDate(ds);
    setDayAppts(monthAppts[ds] || []);
    if (outlookStatus?.connected) {
      api.get(`/outlook/events?start=${ds}&end=${ds}`)
        .then(r => setOutlookAppts(r.data || []))
        .catch(() => setOutlookAppts([]));
    }
    if (gcalStatus?.connected) {
      api.get(`/gcal/events?startDate=${ds}&endDate=${ds}`)
        .then(r => setGcalAppts(r.data?.data || r.data || []))
        .catch(() => setGcalAppts([]));
    }
  };

  // ── Status change inline ───────────────────────────────
  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      await fetchMonth();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    }
  };

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = (id) => {
    setConfirmModal({
      msg: '¿Eliminar esta cita?',
      onConfirm: async () => {
        try {
          await api.delete(`/appointments/${id}`);
          toast.success('Cita eliminada');
          await fetchMonth();
        } catch (err) {
          toast.error(err.response?.data?.message || err.message);
        }
      },
    });
  };

  // ── Save schedule ──────────────────────────────────────
  const handleSaveSchedule = async () => {
    setSavingSched(true);
    try {
      const botEnabled = schedule.some(d => d.bot_scheduling_enabled);
      await api.put('/appointments/schedule', { days: schedule, bot_scheduling_enabled: botEnabled });
      toast.success('Horario guardado');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSavingSched(false);
    }
  };

  // ── Month navigation ───────────────────────────────────
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const grid = buildGrid(year, month);

  const tabCls = (t) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">

      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white">Calendario de Citas</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Gestiona citas y disponibilidad</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <OutlookBadge
            status={outlookStatus}
            onConnect={handleConnectOutlook}
            onDisconnect={handleDisconnectOutlook}
            connecting={connectingOL}
          />
          <GoogleCalendarBadge
            status={gcalStatus}
            onConnect={handleConnectGCal}
            onDisconnect={handleDisconnectGCal}
            connecting={connectingGCal}
          />
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={15} />
            Nueva cita
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 px-6 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setTab('calendar')} className={tabCls('calendar')}>
          <span className="flex items-center gap-1.5"><CalendarDays size={14} />Calendario</span>
        </button>
        <button onClick={() => setTab('schedule')} className={tabCls('schedule')}>
          <span className="flex items-center gap-1.5"><Settings2 size={14} />Disponibilidad</span>
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────── */}
      {tab === 'calendar' ? (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Calendar grid ─────────────────────────── */}
          <div className="flex-1 p-4 overflow-y-auto min-w-0">

            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                {MONTHS[month]} {year}
              </h2>
              <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
              {grid.flat().map(({ dateStr, dayNum, inMonth, isToday }, i) => {
                const appts = monthAppts[dateStr] || [];
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(dateStr)}
                    className={`
                      relative flex flex-col items-center p-1 rounded-lg min-h-[52px] transition-all text-left
                      ${isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : isToday
                          ? 'bg-indigo-50 border-2 border-indigo-300 text-indigo-700'
                          : inMonth
                            ? 'hover:bg-white hover:shadow-sm bg-white/50 text-slate-700'
                            : 'text-slate-300 bg-transparent'}
                    `}
                  >
                    <span className={`text-xs font-semibold ${isSelected ? 'text-white' : isToday ? 'text-indigo-700' : inMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                      {dayNum}
                    </span>
                    {/* Appointment dots */}
                    {appts.length > 0 && (
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {appts.slice(0,3).map((a, idx) => (
                          <span key={idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : STATUS[a.status]?.dot || 'bg-slate-400'}`} />
                        ))}
                        {appts.length > 3 && (
                          <span className={`text-[8px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>+{appts.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-4 flex-wrap">
              {Object.entries(STATUS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                  <span className="text-xs text-slate-500">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Day panel ─────────────────────────────── */}
          <div className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 overflow-hidden flex flex-col">
            <DayPanel
              dateStr={selectedDate}
              appointments={dayAppts}
              onNew={() => setModal('new')}
              onEdit={(a) => setModal(a)}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
            {/* Eventos de Outlook */}
            {outlookStatus?.connected && outlookAppts.length > 0 && (
              <div className="border-t border-blue-100 dark:border-blue-900/30 p-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Outlook Calendar
                </p>
                <div className="space-y-1.5">
                  {outlookAppts.map(ev => {
                    const start = ev.start?.dateTime
                      ? new Date(ev.start.dateTime).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={ev.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {start && <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{start}</span>}
                          {ev.isAllDay && <span className="text-xs text-blue-500">Todo el día</span>}
                        </div>
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate">{ev.subject}</p>
                        {ev.location?.displayName && (
                          <p className="text-xs text-blue-500 truncate">{ev.location.displayName}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Eventos de Google Calendar */}
            {gcalStatus?.connected && gcalAppts.length > 0 && (
              <div className="border-t border-red-100 dark:border-red-900/30 p-3">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" width="10" height="10" className="flex-shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google Calendar
                </p>
                <div className="space-y-1.5">
                  {gcalAppts.map(ev => {
                    const start = ev.start?.dateTime
                      ? new Date(ev.start.dateTime).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={ev.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {start && <span className="text-xs font-semibold text-red-700 dark:text-red-300">{start}</span>}
                          {ev.start?.date && !ev.start?.dateTime && <span className="text-xs text-red-500">Todo el día</span>}
                        </div>
                        <p className="text-xs font-medium text-red-800 dark:text-red-200 truncate">{ev.summary}</p>
                        {ev.location && (
                          <p className="text-xs text-red-500 truncate">{ev.location}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <ScheduleConfig
          schedule={schedule}
          onChange={setSchedule}
          onSave={handleSaveSchedule}
          saving={savingSched}
        />
      )}

      {/* ── Modal de cita ─────────────────────────────── */}
      {modal && (
        <AppointmentModal
          appointment={modal === 'new' ? null : modal}
          defaultDate={selectedDate}
          availableSlots={[]}
          onSave={fetchMonth}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Modal de confirmación (reemplaza window.confirm) ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <p className="text-sm font-medium text-slate-800 mb-5">{confirmModal.msg}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmModal(null); confirmModal.onConfirm(); }}
                className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
