import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Rocket, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_COLOR = {
  completed: 'text-emerald-400',
  success:   'text-emerald-400',
  failure:   'text-red-400',
  cancelled: 'text-slate-400',
  in_progress: 'text-amber-400',
  queued:    'text-amber-300',
  waiting:   'text-amber-300',
};

const STATUS_DOT = {
  completed:   'bg-emerald-400',
  success:     'bg-emerald-400',
  failure:     'bg-red-500',
  cancelled:   'bg-slate-500',
  in_progress: 'bg-amber-400 animate-pulse',
  queued:      'bg-amber-300 animate-pulse',
  waiting:     'bg-amber-300 animate-pulse',
};

function statusLabel(run) {
  if (run.status === 'completed') return run.conclusion || 'completed';
  return run.status;
}

function RunRow({ run, env }) {
  const label = statusLabel(run);
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60 transition-colors">
      <span className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[label] || 'bg-slate-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold uppercase ${STATUS_COLOR[label] || 'text-slate-400'}`}>{label}</span>
          <span className="text-xs text-slate-500">#{run.id}</span>
          <span className="text-xs font-mono text-slate-400">{run.sha}</span>
          {run.branch && <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{run.branch}</span>}
        </div>
        {run.message && <p className="text-xs text-slate-300 mt-0.5 truncate">{run.message}</p>}
        <div className="flex items-center gap-3 mt-1">
          {run.author && <span className="text-xs text-slate-500">{run.author}</span>}
          {run.startedAt && (
            <span className="text-xs text-slate-500">
              {new Date(run.startedAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
          {run.duration && <span className="text-xs text-slate-500">{run.duration}s</span>}
          {run.url && (
            <a href={run.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 underline">
              Ver logs ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DeployPanel() {
  const [status, setStatus]       = useState({ qa: [], prod: [] });
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // QA trigger state
  const [qaReason, setQaReason]   = useState('');
  const [triggeringQA, setTriggeringQA] = useState(false);

  // Prod trigger state
  const [showProdModal, setShowProdModal] = useState(false);
  const [prodConfirm, setProdConfirm]     = useState('');
  const [prodReason, setProdReason]       = useState('');
  const [triggeringProd, setTriggeringProd] = useState(false);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/deploy/status');
      setStatus(res.data || { qa: [], prod: [] });
    } catch (err) {
      if (!silent) toast.error('No se pudo cargar el estado de deploys');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleTriggerQA = async () => {
    if (triggeringQA) return;
    setTriggeringQA(true);
    try {
      await api.post('/deploy/trigger-qa', { reason: qaReason || 'Deploy manual desde SuperAdmin' });
      toast.success('Deploy a QA iniciado — actualiza en unos segundos');
      setQaReason('');
      setTimeout(() => fetchStatus(true), 3000);
    } catch (err) {
      toast.error(err.message || 'Error iniciando deploy QA');
    } finally {
      setTriggeringQA(false);
    }
  };

  const handleTriggerProd = async (e) => {
    e.preventDefault();
    if (triggeringProd) return;
    setTriggeringProd(true);
    try {
      await api.post('/deploy/trigger-prod', { confirm: prodConfirm, reason: prodReason });
      toast.success('Deploy a Producción iniciado');
      setShowProdModal(false);
      setProdConfirm('');
      setProdReason('');
      setTimeout(() => fetchStatus(true), 3000);
    } catch (err) {
      toast.error(err.message || 'Error iniciando deploy Producción');
    } finally {
      setTriggeringProd(false);
    }
  };

  const latestQA   = status.qa?.[0];
  const latestProd = status.prod?.[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Panel de Despliegues</h2>
          <p className="text-xs text-slate-400 mt-0.5">Gestiona QA y Producción desde aquí</p>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">Cargando...</div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── QA ────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-300">Ambiente QA</span>
                {latestQA && (
                  <span className={`text-xs font-semibold ${STATUS_COLOR[statusLabel(latestQA)] || 'text-slate-400'}`}>
                    • {statusLabel(latestQA)}
                  </span>
                )}
              </div>
            </div>

            {/* Trigger QA */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-amber-200 font-semibold mb-2">Desplegar rama develop → QA</p>
              <input
                type="text"
                value={qaReason}
                onChange={e => setQaReason(e.target.value)}
                placeholder="Motivo (opcional)"
                className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500/60 mb-3"
              />
              <button
                onClick={handleTriggerQA}
                disabled={triggeringQA}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold text-sm rounded-lg transition-colors"
              >
                <Rocket size={13} />
                {triggeringQA ? 'Iniciando...' : 'Deploy a QA'}
              </button>
            </div>

            {/* Historial QA */}
            <div className="flex flex-col gap-2">
              {status.qa?.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Sin deploys recientes</p>
              )}
              {status.qa?.map(run => <RunRow key={run.id} run={run} env="qa" />)}
            </div>
          </div>

          {/* ── PRODUCCIÓN ─────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-300">Producción</span>
                {latestProd && (
                  <span className={`text-xs font-semibold ${STATUS_COLOR[statusLabel(latestProd)] || 'text-slate-400'}`}>
                    • {statusLabel(latestProd)}
                  </span>
                )}
              </div>
            </div>

            {/* Trigger Prod */}
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <p className="text-xs text-red-300 font-semibold mb-1">Desplegar rama main → Producción</p>
              <p className="text-xs text-slate-500 mb-3">Requiere confirmación. Asegúrate de que QA está aprobado.</p>
              <button
                onClick={() => setShowProdModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-sm rounded-lg transition-colors"
              >
                <ShieldAlert size={13} />
                Deploy a Producción
              </button>
            </div>

            {/* Historial Prod */}
            <div className="flex flex-col gap-2">
              {status.prod?.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-4">Sin deploys recientes</p>
              )}
              {status.prod?.map(run => <RunRow key={run.id} run={run} env="prod" />)}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación Producción */}
      {showProdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleTriggerProd}
            className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-black text-red-400 mb-1 flex items-center gap-2"><AlertCircle size={18} />Confirmar Deploy a Producción</h3>
            <p className="text-sm text-slate-400 mb-4">
              Esta acción desplegará la rama <strong className="text-white">main</strong> en el servidor de producción.
              No se puede revertir automáticamente.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Motivo del deploy *</label>
                <input
                  type="text"
                  required
                  value={prodReason}
                  onChange={e => setProdReason(e.target.value)}
                  placeholder="Ej: Release v2.1 — nuevas funcionalidades"
                  className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-red-500/60"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Escribe <strong className="text-white">PRODUCCION</strong> para confirmar *
                </label>
                <input
                  type="text"
                  required
                  value={prodConfirm}
                  onChange={e => setProdConfirm(e.target.value)}
                  placeholder="PRODUCCION"
                  className={`w-full bg-slate-800 border text-white text-sm rounded-lg px-3 py-2 focus:outline-none transition-colors
                    ${prodConfirm === 'PRODUCCION' ? 'border-emerald-500/60' : 'border-slate-700 focus:border-red-500/60'}`}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => { setShowProdModal(false); setProdConfirm(''); setProdReason(''); }}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={triggeringProd || prodConfirm !== 'PRODUCCION' || !prodReason.trim()}
                className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors"
              >
                {triggeringProd ? 'Iniciando...' : 'Confirmar Deploy'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
