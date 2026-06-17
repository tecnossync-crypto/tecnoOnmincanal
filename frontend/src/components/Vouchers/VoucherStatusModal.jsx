// frontend/src/components/Vouchers/VoucherStatusModal.jsx
// Modal para cambiar el estado de un comprobante
// Solo muestra las transiciones válidas desde el estado actual

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { changeVoucherStatus, STATUS_LABELS, STATUS_COLORS, STATUS_TRANSITIONS } from '../../services/voucherApi';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const STATUS_ICON = {
  verified:       <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  rejected:       <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  fraud_suspected:<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>,
  pending:        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>,
};

const ACTION_CONFIG = {
  verified: {
    label: 'Verificar Comprobante',
    btnColor: 'bg-green-600 hover:bg-green-700',
    needsReason: false,
    reasonPlaceholder: ''
  },
  rejected: {
    label: 'Rechazar Comprobante',
    btnColor: 'bg-red-600 hover:bg-red-700',
    needsReason: true,
    reasonPlaceholder: 'Ej: El monto no corresponde con la factura emitida...'
  },
  fraud_suspected: {
    label: 'Marcar como Fraude Sospechoso',
    btnColor: 'bg-orange-600 hover:bg-orange-700',
    needsReason: true,
    reasonPlaceholder: 'Ej: La firma no coincide con registros anteriores del cliente...'
  },
  pending: {
    label: 'Regresar a Pendiente',
    btnColor: 'bg-slate-600 hover:bg-slate-700',
    needsReason: false,
    reasonPlaceholder: ''
  }
};

export default function VoucherStatusModal({ id, code, currentStatus, onClose, onSuccess }) {
  const available = STATUS_TRANSITIONS[currentStatus] || [];
  const [selectedStatus, setSelectedStatus] = useState(available[0] || '');
  const [reason,         setReason]         = useState('');
  const [notes,          setNotes]          = useState('');
  const [submitting,     setSubmitting]     = useState(false);

  const config     = ACTION_CONFIG[selectedStatus] || {};
  const needsReason = config.needsReason;

  const handleSubmit = async () => {
    if (needsReason && reason.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      await changeVoucherStatus(id, {
        status:           selectedStatus,
        rejection_reason: needsReason ? reason : undefined,
        internal_notes:   notes       || undefined
      });
      toast.success(`${code}: estado actualizado a "${STATUS_LABELS[selectedStatus]}"`);
      onSuccess();
    } catch (err) {
      toast.error(err.message || 'Error actualizando estado');
    } finally {
      setSubmitting(false);
    }
  };

  if (available.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
          <p className="text-slate-700 text-center mb-4">No hay transiciones disponibles desde el estado actual.</p>
          <button onClick={onClose} className="w-full px-4 py-2 bg-slate-100 rounded-lg text-sm">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Cambiar Estado</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><XIcon /></button>
        </div>

        <div className="p-6 space-y-5">

          {/* Estado actual */}
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Estado actual</p>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[currentStatus]}`}>
              {STATUS_LABELS[currentStatus]}
            </span>
          </div>

          {/* Selección de nueva acción */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Nueva acción</p>
            <div className="space-y-2">
              {available.map(s => {
                const cfg = ACTION_CONFIG[s];
                return (
                  <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedStatus === s ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <input type="radio" name="status" value={s} checked={selectedStatus === s}
                      onChange={() => { setSelectedStatus(s); setReason(''); }}
                      className="text-indigo-600" />
                    <span className="text-slate-500">{STATUS_ICON[s]}</span>
                    <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Motivo (obligatorio para rechazar/fraude) */}
          {needsReason && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-slate-400 ml-1">(mín. 10 caracteres)</span>
              </label>
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder={config.reasonPlaceholder}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{reason.length} / 500</p>
            </div>
          )}

          {/* Notas internas opcionales */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notas Internas <span className="text-xs font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Anotaciones privadas para el equipo..."
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || !selectedStatus}
            className={`px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${config.btnColor || 'bg-indigo-600'}`}>
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Aplicando...</>
            ) : (
              <>{config.emoji} {config.label}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
