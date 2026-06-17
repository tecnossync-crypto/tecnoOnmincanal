// frontend/src/components/Vouchers/VoucherDetailModal.jsx
// Modal de detalle de comprobante con pestañas: Detalle y Auditoría

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import {
  getVoucher, getVoucherAudit, deleteVoucherAttachment,
  STATUS_LABELS, STATUS_COLORS, METHOD_LABELS
} from '../../services/voucherApi';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const ACTION_LABELS = {
  created: 'Creado', updated: 'Actualizado', status_changed: 'Estado cambiado',
  file_uploaded: 'Archivo subido', file_deleted: 'Archivo eliminado',
  verified: 'Verificado', rejected: 'Rechazado', fraud_flagged: 'Marcado como fraude',
  notes_updated: 'Notas actualizadas', viewed: 'Visualizado'
};

const fmt = (d) => { try { return format(new Date(d + 'T00:00:00'), "dd 'de' MMMM yyyy", { locale: es }); } catch { return d || '—'; } };
const fmtDt = (d) => { try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: es }); } catch { return d || '—'; } };
const fmtAmt = (a, c = 'DOP') => new Intl.NumberFormat('es-DO', { style: 'currency', currency: c }).format(a);

function InfoRow({ label, value, highlight, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm ${highlight ? 'font-bold text-slate-900 text-base' : 'text-slate-700'}`}>{value || '—'}</p>
    </div>
  );
}

export default function VoucherDetailModal({ voucherId, isAdmin, onClose, onOpenStatus }) {
  const [voucher,  setVoucher]  = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('detail');
  const [auditLoaded, setAuditLoaded] = useState(false);

  useEffect(() => {
    getVoucher(voucherId)
      .then(res => setVoucher(res.data))
      .catch(err => { toast.error(err.message); onClose(); })
      .finally(() => setLoading(false));
  }, [voucherId]);

  const loadAudit = async () => {
    if (auditLoaded) return;
    try {
      const res = await getVoucherAudit(voucherId);
      setAuditLog(res.data?.logs || []);
      setAuditLoaded(true);
    } catch (err) { toast.error(err.message); }
  };

  const handleTab = (t) => { setTab(t); if (t === 'audit') loadAudit(); };

  const handleDeleteAttachment = async (filename) => {
    if (!window.confirm(`¿Eliminar el archivo "${filename}"?`)) return;
    try {
      const res = await deleteVoucherAttachment(voucherId, filename);
      setVoucher(res.data);
      toast.success('Archivo eliminado');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
      </div>
    </div>
  );

  if (!voucher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-indigo-700">{voucher.code}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[voucher.status]}`}>
                {STATUS_LABELS[voucher.status]}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Creado {fmtDt(voucher.createdAt || voucher.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && voucher.status !== 'verified' && (
              <button onClick={() => onOpenStatus(voucher)}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Cambiar Estado
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><XIcon /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 flex-shrink-0">
          {[
            { id: 'detail', label: 'Detalle' },
            ...(isAdmin ? [{ id: 'audit', label: 'Auditoría' }] : [])
          ].map(t => (
            <button key={t.id} onClick={() => handleTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {tab === 'detail' && (
            <div className="space-y-5">
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos del Pago</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Monto" value={fmtAmt(voucher.amount, voucher.currency)} highlight />
                  <InfoRow label="Método" value={METHOD_LABELS[voucher.payment_method]} />
                  <InfoRow label="Fecha del Pago" value={fmt(voucher.payment_date)} />
                  <InfoRow label="Moneda" value={voucher.currency} />
                  {voucher.reference_number && <InfoRow label="Referencia" value={voucher.reference_number} full />}
                  {voucher.description && <InfoRow label="Descripción" value={voucher.description} full />}
                </div>
              </section>

              {voucher.contact && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cliente</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Nombre"   value={voucher.contact.name} />
                    <InfoRow label="Teléfono" value={voucher.contact.phone || voucher.contact.whatsapp_id} />
                    {voucher.contact.email && <InfoRow label="Email" value={voucher.contact.email} full />}
                  </div>
                </section>
              )}

              {(voucher.verifier || voucher.rejection_reason || voucher.internal_notes) && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Revisión</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {voucher.verifier && <InfoRow label="Revisado por" value={voucher.verifier.name} />}
                    {voucher.verified_at  && <InfoRow label="Verificado el"  value={fmtDt(voucher.verified_at)} />}
                    {voucher.rejected_at  && <InfoRow label="Rechazado el"   value={fmtDt(voucher.rejected_at)} />}
                    {voucher.rejection_reason && (
                      <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-medium text-red-600 mb-1">Motivo de Rechazo</p>
                        <p className="text-sm text-red-800">{voucher.rejection_reason}</p>
                      </div>
                    )}
                    {isAdmin && voucher.internal_notes && (
                      <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-medium text-amber-600 mb-1">Notas Internas</p>
                        <p className="text-sm text-amber-800">{voucher.internal_notes}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {voucher.attachments?.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Archivos Adjuntos ({voucher.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {voucher.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="text-slate-400">
                          {att.mimetype?.startsWith('image/')
                            ? <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
                            : <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                          }
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{att.originalname}</p>
                          <p className="text-xs text-slate-400">{(att.size / 1024 / 1024).toFixed(2)} MB · {att.mimetype}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {att.url && (
                            <a href={att.url} target="_blank" rel="noreferrer" title="Abrir"
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <LinkIcon />
                            </a>
                          )}
                          {isAdmin && voucher.status === 'pending' && (
                            <button onClick={() => handleDeleteAttachment(att.filename)} title="Eliminar"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'audit' && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Historial de Cambios</h3>
              {auditLog.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">Sin registros de auditoría aún</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="space-y-4">
                    {auditLog.map((log) => (
                      <div key={log.id} className="relative pl-10">
                        <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{ACTION_LABELS[log.action] || log.action}</span>
                            <span className="text-xs text-slate-400">{fmtDt(log.createdAt || log.created_at)}</span>
                          </div>
                          {log.user_name && (
                            <p className="text-xs text-slate-500 mt-0.5">Por: {log.user_name} ({log.user_role})</p>
                          )}
                          {log.previous_status && log.new_status && (
                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[log.previous_status] || 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABELS[log.previous_status] || log.previous_status}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[log.new_status] || 'bg-slate-100 text-slate-600'}`}>
                                {STATUS_LABELS[log.new_status] || log.new_status}
                              </span>
                            </div>
                          )}
                          {log.note && <p className="mt-1.5 text-xs text-slate-600 italic">"{log.note}"</p>}
                          {log.ip_address && <p className="mt-1 text-xs text-slate-400">IP: {log.ip_address}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
