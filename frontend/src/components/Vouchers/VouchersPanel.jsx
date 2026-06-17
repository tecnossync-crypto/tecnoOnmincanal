// frontend/src/components/Vouchers/VouchersPanel.jsx
// Panel principal de Comprobantes de Pago
// Mismo estilo visual y estructura que CampaignsPanel y TeamPanel del proyecto

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store';
import {
  listVouchers, deleteVoucher,
  STATUS_LABELS, STATUS_COLORS, METHOD_LABELS
} from '../../services/voucherApi';
import VoucherUploadModal from './VoucherUploadModal';
import VoucherDetailModal from './VoucherDetailModal';
import VoucherStatusModal from './VoucherStatusModal';

// ── Iconos inline (mismo patrón que Layout.jsx del proyecto) ─
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const FilterIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591L15.75 12.75V19.5a.75.75 0 0 1-.443.691l-4.5 2.25A.75.75 0 0 1 9.75 21.75V12.75L4.659 7.409A2.25 2.25 0 0 1 4 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
  </svg>
);
const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);
const DocIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);

const formatAmount = (amount, currency = 'DOP') =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency }).format(amount);

const formatDate = (d) => {
  if (!d) return '—';
  try { return format(new Date(d + 'T00:00:00'), 'dd MMM yyyy', { locale: es }); }
  catch { return d; }
};

export default function VouchersPanel() {
  const { user } = useAuthStore();
  const isAdmin  = user?.role === 'admin' || user?.role === 'supervisor';

  const [vouchers,   setVouchers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [filters,    setFilters]    = useState({ status: '', payment_method: '', search: '', date_from: '', date_to: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [detailId,    setDetailId]    = useState(null);
  const [statusModal, setStatusModal] = useState(null);

  const fetchVouchers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filters.status)         params.status         = filters.status;
      if (filters.payment_method) params.payment_method = filters.payment_method;
      if (filters.search)         params.search         = filters.search;
      if (filters.date_from)      params.date_from      = filters.date_from;
      if (filters.date_to)        params.date_to        = filters.date_to;

      // api.js interceptor devuelve response.data directamente
      const res = await listVouchers(params);
      setVouchers(res.data?.vouchers || []);
      setPagination({
        page:       res.data?.page       || 1,
        total:      res.data?.total      || 0,
        totalPages: res.data?.totalPages || 1
      });
    } catch (err) {
      toast.error(err.message || 'Error cargando comprobantes');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchVouchers(1); }, [fetchVouchers]);

  const handleDelete = async (id, code) => {
    if (!window.confirm(`¿Eliminar el comprobante ${code}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteVoucher(id);
      toast.success(`Comprobante ${code} eliminado.`);
      fetchVouchers(pagination.page);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── HEADER ────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <DocIcon />
              Comprobantes de Pago
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {pagination.total} comprobante{pagination.total !== 1 ? 's' : ''} en total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FilterIcon />
              Filtros
            </button>
            <button
              onClick={() => fetchVouchers(pagination.page)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Actualizar"
            >
              <RefreshIcon />
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusIcon />
              Subir Comprobante
            </button>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-400"><SearchIcon /></span>
          <input
            type="text"
            placeholder="Buscar por código, referencia o descripción..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Filtros expandibles */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Estado</label>
              <select
                value={filters.status}
                onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Método de Pago</label>
              <select
                value={filters.payment_method}
                onChange={e => setFilters(f => ({ ...f, payment_method: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Todos</option>
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Desde</label>
              <input type="date" value={filters.date_from}
                onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hasta</label>
              <input type="date" value={filters.date_to}
                onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── LISTA ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : vouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <DocIcon />
            <p className="text-sm mt-3">No se encontraron comprobantes</p>
            <button onClick={() => setUploadOpen(true)} className="mt-3 text-xs text-indigo-600 hover:underline">
              Subir el primero →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {vouchers.map(v => (
              <div key={v.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-sm font-bold text-indigo-700">{v.code}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status]}`}>
                        {STATUS_LABELS[v.status]}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                      <span className="font-semibold text-slate-900">{formatAmount(v.amount, v.currency)}</span>
                      <span className="text-slate-500">{METHOD_LABELS[v.payment_method]}</span>
                      <span className="text-slate-500">{formatDate(v.payment_date)}</span>
                      {v.reference_number && <span className="text-slate-400 text-xs">Ref: {v.reference_number}</span>}
                    </div>
                    {v.contact && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                        {v.contact.name || v.contact.phone || v.contact.whatsapp_id}
                        {v.contact.email ? ` · ${v.contact.email}` : ''}
                      </p>
                    )}
                    {v.rejection_reason && (
                      <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mt-1.5 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                        {v.rejection_reason}
                      </p>
                    )}
                    {v.attachments?.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/></svg>
                        {v.attachments.length} archivo{v.attachments.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setDetailId(v.id)}
                      title="Ver detalle"
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <EyeIcon />
                    </button>
                    {isAdmin && v.status !== 'verified' && (
                      <button
                        onClick={() => setStatusModal({ id: v.id, code: v.code, currentStatus: v.status })}
                        title="Cambiar estado"
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <CheckIcon />
                      </button>
                    )}
                    {isAdmin && ['pending', 'rejected'].includes(v.status) && (
                      <button
                        onClick={() => handleDelete(v.id, v.code)}
                        title="Eliminar"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => fetchVouchers(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-sm text-slate-600">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchVouchers(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* ── MODALES ──────────────────────────────────────── */}
      {uploadOpen && (
        <VoucherUploadModal
          onClose={() => setUploadOpen(false)}
          onSuccess={() => { setUploadOpen(false); fetchVouchers(1); }}
        />
      )}
      {detailId && (
        <VoucherDetailModal
          voucherId={detailId}
          isAdmin={isAdmin}
          onClose={() => setDetailId(null)}
          onOpenStatus={(v) => { setDetailId(null); setStatusModal({ id: v.id, code: v.code, currentStatus: v.status }); }}
        />
      )}
      {statusModal && (
        <VoucherStatusModal
          {...statusModal}
          onClose={() => setStatusModal(null)}
          onSuccess={() => { setStatusModal(null); fetchVouchers(pagination.page); }}
        />
      )}
    </div>
  );
}
