import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, MessageSquare, HardDrive, Megaphone, Smartphone,
  TrendingUp, AlertTriangle, CheckCircle, Clock, ChevronDown,
  ChevronUp, Save, DollarSign, Calendar, XCircle, FileText,
  LayoutGrid, Loader2, ArrowLeft,
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PLAN_COLORS = {
  free:       { bg: 'bg-slate-700/40',   border: 'border-slate-600',      text: 'text-slate-300',  badge: 'bg-slate-700 text-slate-300',         ring: 'ring-slate-500' },
  basic:      { bg: 'bg-indigo-900/20',  border: 'border-indigo-700/40',  text: 'text-indigo-300', badge: 'bg-indigo-900/60 text-indigo-300',     ring: 'ring-indigo-500' },
  pro:        { bg: 'bg-violet-900/20',  border: 'border-violet-700/40',  text: 'text-violet-300', badge: 'bg-violet-900/60 text-violet-300',     ring: 'ring-violet-500' },
  enterprise: { bg: 'bg-amber-900/20',   border: 'border-amber-700/40',   text: 'text-amber-300',  badge: 'bg-amber-900/60 text-amber-300',       ring: 'ring-amber-500' },
};

const PLAN_ICONS = { free: '·', basic: '◆', pro: '◈', enterprise: '★' };

const ALERT_STYLES = {
  overdue:  { wrap: 'bg-red-900/20 border-red-700/40',   icon: <XCircle  size={14} className="text-red-400 flex-shrink-0" />,   label: 'Vencido',  dot: 'bg-red-500' },
  due_soon: { wrap: 'bg-amber-900/20 border-amber-700/40', icon: <Clock  size={14} className="text-amber-400 flex-shrink-0" />, label: 'Próximo',  dot: 'bg-amber-400' },
};

const LIMITS_CONFIG = [
  { key: 'max_operators',           label: 'Operadores máximos',      icon: <Users size={13} /> },
  { key: 'max_conversations_month', label: 'Conversaciones / mes',    icon: <MessageSquare size={13} /> },
  { key: 'max_storage_mb',          label: 'Almacenamiento (MB)',      icon: <HardDrive size={13} /> },
  { key: 'max_campaigns_month',     label: 'Campañas / mes',          icon: <Megaphone size={13} /> },
  { key: 'max_whatsapp_accounts',   label: 'Cuentas WhatsApp',        icon: <Smartphone size={13} /> },
  { key: 'max_merge_templates',     label: 'Plantillas Merge',        icon: <FileText size={13} /> },
  { key: 'max_custom_modules',      label: 'Módulos personalizados',  icon: <LayoutGrid size={13} /> },
];

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function LimitInput({ icon, label, value, onChange }) {
  const isUnlimited = value === -1;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
      ${isUnlimited ? 'bg-emerald-900/10 border-emerald-700/30' : 'bg-slate-800/60 border-slate-700/40'}`}>
      <div className={`flex-shrink-0 ${isUnlimited ? 'text-emerald-400' : 'text-slate-400'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={-1}
            value={isUnlimited ? '' : value}
            onChange={e => onChange(e.target.value === '' ? -1 : Number(e.target.value))}
            placeholder="−1 = ilimitado"
            className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5
                       focus:outline-none focus:border-violet-500 transition-colors"
          />
          {isUnlimited && (
            <span className="text-xs text-emerald-400 whitespace-nowrap font-semibold">∞</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-slate-400 text-xs">{icon}{label}</div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Spinner({ size = 16 }) {
  return <Loader2 size={size} className="animate-spin text-violet-400" />;
}

// ── Panel principal ────────────────────────────────────────────────────────────

export default function PlansPanel({ companies }) {
  const [presets,    setPresets]    = useState({});
  const [overview,   setOverview]   = useState(null);
  const [alerts,     setAlerts]     = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [planData,   setPlanData]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [loadingCo,  setLoadingCo]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState('limits');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o, a] = await Promise.all([
        api.get('/plans/presets'),
        api.get('/plans/overview'),
        api.get('/plans/billing-alerts'),
      ]);
      setPresets(p.data || {});
      setOverview(o.data || null);
      setAlerts(a.data || []);
    } catch {
      toast.error('Error cargando resumen de planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectCompany = async (company) => {
    setSelected(company);
    setLoadingCo(true);
    try {
      const res = await api.get(`/plans/company/${company.id}`);
      const d = res.data;
      setPlanData({
        plan:              d.plan || 'basic',
        plan_limits:       d.plan_limits || {},
        billing:           d.billing || { price: '', currency: 'USD', cycle: 'monthly', next_payment: '', status: 'active', notes: '' },
        current_operators: d.current_operators || 0,
      });
    } catch {
      toast.error('Error cargando datos de la empresa');
    } finally {
      setLoadingCo(false);
    }
  };

  const applyPreset = (planKey) => {
    const preset = presets[planKey];
    if (!preset) return;
    setPlanData(p => ({ ...p, plan: planKey, plan_limits: { ...preset.limits } }));
  };

  const setLimit   = (key, val) => setPlanData(p => ({ ...p, plan_limits: { ...p.plan_limits, [key]: val } }));
  const setBilling = (key, val) => setPlanData(p => ({ ...p, billing: { ...p.billing, [key]: val } }));

  const handleSave = async () => {
    if (!selected || !planData) return;
    setSaving(true);
    try {
      await api.put(`/plans/company/${selected.id}`, {
        plan:        planData.plan,
        plan_limits: planData.plan_limits,
        billing:     planData.billing,
      });
      toast.success(`Plan de "${selected.nombre}" actualizado`);
      load();
    } catch (err) {
      toast.error(err.message || 'Error guardando plan');
    } finally {
      setSaving(false);
    }
  };

  const colors = PLAN_COLORS[planData?.plan] || PLAN_COLORS.basic;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar empresas ──────────────────────────────── */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresas</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {companies.map(c => {
            const pc      = PLAN_COLORS[c.plan] || PLAN_COLORS.basic;
            const hasAlert = alerts.some(a => a.id === c.id);
            const isActive = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => selectCompany(c)}
                className={`w-full text-left flex items-center gap-2.5 p-3 rounded-xl border transition-all
                  ${isActive
                    ? 'bg-violet-600/20 border-violet-500/40'
                    : 'hover:bg-slate-800/70 border-transparent'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0
                  bg-gradient-to-br from-violet-600 to-indigo-700 text-white`}>
                  {c.nombre?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${pc.badge}`}>
                    {PLAN_ICONS[c.plan] || '·'} {c.plan || 'basic'}
                  </span>
                </div>
                {hasAlert && <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Área principal ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Loading inicial */}
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <Spinner size={18} /> Cargando planes...
          </div>
        )}

        {/* Overview cuando no hay empresa seleccionada */}
        {!loading && !selected && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Tarjetas resumen */}
            {overview && (
              <div>
                <h2 className="text-sm font-bold text-white mb-3">Resumen general</h2>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <StatCard icon={<Users size={13} />}        label="Total empresas"   value={overview.total}        color="text-white" />
                  <StatCard icon={<DollarSign size={13} />}   label="MRR estimado"     value={`$${overview.mrr}`}    sub="USD/mes activos"  color="text-emerald-400" />
                  {Object.entries(overview.by_plan || {}).map(([plan, count]) => (
                    <StatCard key={plan}
                      icon={<TrendingUp size={13} />}
                      label={plan}
                      value={count}
                      sub="empresa(s)"
                      color={PLAN_COLORS[plan]?.text || 'text-white'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Alertas de facturación */}
            {alerts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-400" />
                  Alertas de facturación
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">{alerts.length}</span>
                </h3>
                <div className="space-y-2">
                  {alerts.map(a => {
                    const as = ALERT_STYLES[a.alert_type];
                    return (
                      <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${as.wrap}`}>
                        {as.icon}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{a.nombre}</p>
                          <p className="text-xs text-slate-400">
                            Vence: {a.next_payment}
                            {' · '}
                            {a.days_until < 0
                              ? `${Math.abs(a.days_until)} días vencido`
                              : `en ${a.days_until} días`}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-white">${a.price} {a.currency}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLAN_COLORS[a.plan]?.badge || ''}`}>
                            {a.plan}
                          </span>
                        </div>
                        <button
                          onClick={() => selectCompany({ id: a.id, nombre: a.nombre })}
                          className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex-shrink-0"
                        >
                          Gestionar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!overview && !loading && (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                Selecciona una empresa para gestionar su plan
              </div>
            )}
          </div>
        )}

        {/* Editor de plan */}
        {!loading && selected && (
          <div className="flex-1 overflow-y-auto">

            {/* Header fijo del editor */}
            <div className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelected(null); setPlanData(null); }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-base font-black text-white leading-tight">{selected.nombre}</h2>
                  {planData && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {planData.current_operators} operador{planData.current_operators !== 1 ? 'es' : ''} activo{planData.current_operators !== 1 ? 's' : ''}
                      {planData.plan_limits.max_operators !== -1 && (
                        <span className="text-slate-500"> / {planData.plan_limits.max_operators} máx.</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || loadingCo}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500
                           disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? <Spinner size={13} /> : <Save size={13} />}
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            {/* Loading empresa */}
            {loadingCo && (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-400 text-sm">
                <Spinner size={18} /> Cargando datos...
              </div>
            )}

            {!loadingCo && planData && (
              <div className="p-6 space-y-5">

                {/* Selector de plan */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Plan contratado</p>
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {Object.entries(presets).map(([key, preset]) => {
                      const pc     = PLAN_COLORS[key] || PLAN_COLORS.basic;
                      const active = planData.plan === key;
                      return (
                        <button
                          key={key}
                          onClick={() => applyPreset(key)}
                          className={`p-4 rounded-xl border text-left transition-all
                            ${active
                              ? `${pc.bg} ${pc.border} ring-2 ${pc.ring}`
                              : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600 hover:bg-slate-800/60'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-bold ${active ? pc.text : 'text-white'}`}>
                              {PLAN_ICONS[key]} {preset.label}
                            </p>
                            {active && <CheckCircle size={13} className={pc.text} />}
                          </div>
                          <p className="text-xs text-slate-400">
                            {preset.price === 0 ? 'Gratis' : `$${preset.price}/mes`}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {preset.limits.max_operators === -1 ? '∞' : preset.limits.max_operators} op ·{' '}
                            {preset.limits.max_storage_mb === -1 ? '∞' : `${preset.limits.max_storage_mb}MB`}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Límites de uso */}
                <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === 'limits' ? null : 'limits')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className="text-violet-400" />
                      <span className="text-sm font-semibold text-white">Límites de uso</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                        −1 = ilimitado
                      </span>
                    </div>
                    {expanded === 'limits'
                      ? <ChevronUp  size={14} className="text-slate-400" />
                      : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {expanded === 'limits' && (
                    <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                      {LIMITS_CONFIG.map(({ key, label, icon }) => (
                        <LimitInput
                          key={key}
                          icon={icon}
                          label={label}
                          value={planData.plan_limits[key] ?? -1}
                          onChange={v => setLimit(key, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Facturación */}
                <div className="bg-slate-800/30 border border-slate-700/40 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === 'billing' ? null : 'billing')}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Facturación</span>
                      {planData.billing?.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          planData.billing.status === 'active'    ? 'bg-emerald-500/20 text-emerald-400' :
                          planData.billing.status === 'overdue'   ? 'bg-red-500/20 text-red-400' :
                          planData.billing.status === 'trial'     ? 'bg-blue-500/20 text-blue-400' :
                                                                     'bg-slate-700 text-slate-400'
                        }`}>
                          {planData.billing.status}
                        </span>
                      )}
                    </div>
                    {expanded === 'billing'
                      ? <ChevronUp  size={14} className="text-slate-400" />
                      : <ChevronDown size={14} className="text-slate-400" />}
                  </button>

                  {expanded === 'billing' && (
                    <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-3">

                      {/* Precio */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Precio contratado</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={planData.billing.price || ''}
                            onChange={e => setBilling('price', e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                       px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                          <select
                            value={planData.billing.currency || 'USD'}
                            onChange={e => setBilling('currency', e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                       px-2 py-2 focus:outline-none"
                          >
                            <option>USD</option><option>DOP</option><option>EUR</option><option>COP</option>
                          </select>
                        </div>
                      </div>

                      {/* Ciclo */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Ciclo de cobro</label>
                        <select
                          value={planData.billing.cycle || 'monthly'}
                          onChange={e => setBilling('cycle', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                     px-3 py-2 focus:outline-none"
                        >
                          <option value="monthly">Mensual</option>
                          <option value="annual">Anual</option>
                        </select>
                      </div>

                      {/* Próximo pago */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar size={11} /> Próximo pago
                        </label>
                        <input
                          type="date"
                          value={planData.billing.next_payment || ''}
                          onChange={e => setBilling('next_payment', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                     px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      {/* Estado */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Estado de pago</label>
                        <select
                          value={planData.billing.status || 'active'}
                          onChange={e => setBilling('status', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                     px-3 py-2 focus:outline-none"
                        >
                          <option value="active">Activo</option>
                          <option value="overdue">Vencido</option>
                          <option value="cancelled">Cancelado</option>
                          <option value="trial">Prueba</option>
                        </select>
                      </div>

                      {/* Notas */}
                      <div className="xl:col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Notas internas</label>
                        <textarea
                          value={planData.billing.notes || ''}
                          onChange={e => setBilling('notes', e.target.value)}
                          placeholder="Ej: Cliente paga por transferencia los primeros 5 días del mes"
                          rows={2}
                          className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg
                                     px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
