import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, AlertTriangle, Clock, XCircle,
  CheckCircle, RefreshCw, ChevronDown, ChevronUp, Calendar,
  Users, Save, Loader2, UserPlus, Shield, Trash2, X,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PLAN_BADGE = {
  free:       'bg-slate-700 text-slate-300',
  basic:      'bg-indigo-900/60 text-indigo-300',
  pro:        'bg-violet-900/60 text-violet-300',
  enterprise: 'bg-amber-900/60 text-amber-300',
};

const STATUS_BADGE = {
  active:    'bg-emerald-500/15 text-emerald-400',
  overdue:   'bg-red-500/15 text-red-400',
  trial:     'bg-blue-500/15 text-blue-400',
  cancelled: 'bg-slate-700 text-slate-400',
  unknown:   'bg-slate-700 text-slate-500',
};

const ALERT_STYLE = {
  overdue:  { wrap: 'border-red-700/40 bg-red-900/15',    icon: <XCircle  size={13} className="text-red-400 flex-shrink-0" />,   label: 'Vencido'  },
  due_soon: { wrap: 'border-amber-700/40 bg-amber-900/15', icon: <Clock   size={13} className="text-amber-400 flex-shrink-0" />, label: 'En 7 días' },
  upcoming: { wrap: 'border-slate-700/40 bg-slate-800/40', icon: <Calendar size={13} className="text-slate-400 flex-shrink-0" />, label: 'Próximo'   },
};

function StatCard({ icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">{icon}{label}</div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return <Loader2 size={16} className="animate-spin text-violet-400" />;
}

// ── Modal Nuevo Admin ────────────────────────────────────────────────────────
function NewAdminModal({ open, onClose, onCreated }) {
  const [form, setForm]       = useState({ name: '', email: '', password: '' });
  const [saving, setSaving]   = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', { ...form, role: 'superadmin' });
      toast.success(`Administrador "${form.name}" creado`);
      setForm({ name: '', email: '', password: '' });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error creando administrador');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4"
         onClick={!saving ? onClose : undefined}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Shield size={16} className="text-violet-400" /> Nuevo Administrador
          </h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nombre *</label>
            <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
              placeholder="Nombre completo" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
              placeholder="admin@tecnossync.com" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contraseña *</label>
            <input required type="password" minLength={8} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500"
              placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Creando...' : 'Crear admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function RevenuePanel() {
  const [summary,   setSummary]   = useState(null);
  const [companies, setCompanies] = useState([]);
  const [admins,    setAdmins]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('ingresos');
  const [expanded,  setExpanded]  = useState(null);
  const [editing,   setEditing]   = useState({});   // billingForm por company id
  const [saving,    setSaving]    = useState(null);
  const [showNewAdmin, setShowNewAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, a] = await Promise.all([
        api.get('/revenue/summary'),
        api.get('/revenue/companies'),
        api.get('/revenue/admins'),
      ]);
      setSummary(s.data?.data || s.data);
      setCompanies(c.data?.data || c.data || []);
      setAdmins(a.data?.data || a.data || []);
    } catch {
      toast.error('Error cargando panel de ingresos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (company) => {
    setEditing(prev => ({
      ...prev,
      [company.id]: {
        price:        company.billing?.price        || '',
        currency:     company.billing?.currency     || 'USD',
        cycle:        company.billing?.cycle        || 'monthly',
        next_payment: company.billing?.next_payment || '',
        status:       company.billing?.status       || 'active',
        notes:        company.billing?.notes        || '',
      },
    }));
    setExpanded(company.id);
  };

  const saveBilling = async (companyId) => {
    setSaving(companyId);
    try {
      await api.put(`/revenue/companies/${companyId}/billing`, editing[companyId]);
      toast.success('Facturación actualizada');
      setExpanded(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Error guardando');
    } finally {
      setSaving(null);
    }
  };

  const setField = (companyId, key, val) => {
    setEditing(prev => ({ ...prev, [companyId]: { ...prev[companyId], [key]: val } }));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 text-sm">
        <Spinner /> Cargando panel de ingresos...
      </div>
    );
  }

  const tabs = [
    { id: 'ingresos',  label: 'Ingresos' },
    { id: 'empresas',  label: 'Empresas' },
    { id: 'admins',    label: 'Administradores' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      <NewAdminModal open={showNewAdmin} onClose={() => setShowNewAdmin(false)} onCreated={load} />

      {/* Sub-tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 px-5 pt-4 border-b border-slate-800">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px
              ${activeTab === t.id
                ? 'text-white border-emerald-500 bg-emerald-500/10'
                : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
        <button onClick={load}
          className="ml-auto mb-1 text-slate-500 hover:text-slate-300 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* ── TAB: INGRESOS ─────────────────────────────────── */}
        {activeTab === 'ingresos' && summary && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard icon={<Users size={13} />}       label="Total empresas"   value={summary.totals.companies}          color="text-white" />
              <StatCard icon={<DollarSign size={13} />}  label="MRR"              value={`$${summary.totals.mrr}`}          sub="USD/mes activos"   color="text-emerald-400" />
              <StatCard icon={<TrendingUp size={13} />}  label="ARR estimado"     value={`$${summary.totals.arr}`}          sub="USD/año"           color="text-blue-400" />
              <StatCard icon={<AlertTriangle size={13}/>} label="Alertas venc."   value={summary.alerts.filter(a=>a.alert_type==='overdue').length} color="text-red-400" />
            </div>

            {/* Por plan */}
            <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Distribución por plan</h3>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {Object.entries(summary.by_plan || {}).map(([plan, count]) => (
                  <div key={plan} className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-xl border border-slate-700/30">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${PLAN_BADGE[plan] || 'bg-slate-700 text-slate-300'}`}>{plan}</span>
                    <span className="text-lg font-black text-white">{count}</span>
                    <span className="text-xs text-slate-500">empresa{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas */}
            {summary.alerts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  Próximos cobros (30 días)
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">{summary.alerts.length}</span>
                </h3>
                <div className="space-y-2">
                  {summary.alerts.map(a => {
                    const st = ALERT_STYLE[a.alert_type] || ALERT_STYLE.upcoming;
                    return (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${st.wrap}`}>
                        {st.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.nombre}</p>
                          <p className="text-xs text-slate-400">
                            {a.days_until < 0
                              ? `Vencido hace ${Math.abs(a.days_until)} días`
                              : `Vence en ${a.days_until} días — ${a.next_payment}`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black text-white">${a.price} <span className="text-xs text-slate-400">{a.currency}</span></p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[a.status] || ''}`}>{a.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB: EMPRESAS ─────────────────────────────────── */}
        {activeTab === 'empresas' && (
          <div className="space-y-3">
            {companies.map(c => {
              const isOpen   = expanded === c.id;
              const isEditing = !!editing[c.id];
              const bill     = editing[c.id] || c.billing || {};
              const isSaving = saving === c.id;

              return (
                <div key={c.id} className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                  {/* Header empresa */}
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors"
                    onClick={() => isEditing ? setExpanded(isOpen ? null : c.id) : startEdit(c)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                      {c.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLAN_BADGE[c.plan] || 'bg-slate-700 text-slate-300'}`}>{c.plan || 'free'}</span>
                        {c.billing?.status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[c.billing.status] || ''}`}>{c.billing.status}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.active_operators} operador{c.active_operators !== 1 ? 'es' : ''} activo{c.active_operators !== 1 ? 's' : ''}
                        {c.billing?.price ? ` · $${c.billing.price} ${c.billing.currency || 'USD'}/${c.billing.cycle === 'annual' ? 'año' : 'mes'}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-slate-400">
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>

                  {/* Formulario de facturación */}
                  {isOpen && isEditing && (
                    <div className="px-4 pb-4 border-t border-slate-700/40 pt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
                      {/* Precio + moneda */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-slate-400 mb-1">Precio</label>
                          <input type="number" value={bill.price || ''} onChange={e => setField(c.id, 'price', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                            placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Moneda</label>
                          <select value={bill.currency || 'USD'} onChange={e => setField(c.id, 'currency', e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-2 py-2 focus:outline-none h-[38px]">
                            <option>USD</option><option>DOP</option><option>EUR</option><option>COP</option>
                          </select>
                        </div>
                      </div>

                      {/* Ciclo */}
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Ciclo</label>
                        <select value={bill.cycle || 'monthly'} onChange={e => setField(c.id, 'cycle', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
                          <option value="monthly">Mensual</option>
                          <option value="annual">Anual</option>
                        </select>
                      </div>

                      {/* Próximo pago */}
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Próximo pago</label>
                        <input type="date" value={bill.next_payment || ''} onChange={e => setField(c.id, 'next_payment', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
                      </div>

                      {/* Estado */}
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Estado</label>
                        <select value={bill.status || 'active'} onChange={e => setField(c.id, 'status', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none">
                          <option value="active">Activo</option>
                          <option value="overdue">Vencido</option>
                          <option value="trial">Prueba</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </div>

                      {/* Notas */}
                      <div className="xl:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1">Notas internas</label>
                        <input type="text" value={bill.notes || ''} onChange={e => setField(c.id, 'notes', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                          placeholder="Ej: Paga por transferencia los primeros 5 días" />
                      </div>

                      {/* Botones */}
                      <div className="xl:col-span-3 flex justify-end gap-2">
                        <button onClick={() => { setExpanded(null); setEditing(p => { const n = {...p}; delete n[c.id]; return n; }); }}
                          className="px-4 py-2 text-sm text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
                          Cancelar
                        </button>
                        <button onClick={() => saveBilling(c.id)} disabled={isSaving}
                          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl transition-colors flex items-center gap-2">
                          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {isSaving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: ADMINISTRADORES ─────────────────────────── */}
        {activeTab === 'admins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Administradores del sistema</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cuentas con acceso total a Tecnossync</p>
              </div>
              <button onClick={() => setShowNewAdmin(true)}
                className="flex items-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
                <UserPlus size={13} /> Nuevo admin
              </button>
            </div>

            <div className="space-y-2">
              {admins.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                    {a.name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-lg bg-violet-500/20 text-violet-300 font-semibold flex items-center gap-1">
                      <Shield size={10} /> SuperAdmin
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${a.is_online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                      {a.is_online ? 'En línea' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
              {admins.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">Sin administradores registrados</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
