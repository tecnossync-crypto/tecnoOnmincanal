// frontend/src/services/voucherApi.js
// Cliente API para comprobantes de pago
// Usa el mismo axios instance (api.js) que el resto del proyecto
// IMPORTANTE: api.js interceptor ya hace (response) => response.data
// Por eso res ya ES { success, data, message } — no res.data.data

import api from './api';

const BASE = '/vouchers';

// ── Endpoints REST ───────────────────────────────────────────

export const listVouchers = (params = {}) =>
  api.get(BASE, { params });

export const getVoucher = (id) =>
  api.get(`${BASE}/${id}`);

export const createVoucher = (formData) =>
  api.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  });

export const updateVoucher = (id, formData) =>
  api.put(`${BASE}/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  });

export const changeVoucherStatus = (id, payload) =>
  api.patch(`${BASE}/${id}/status`, payload);

export const deleteVoucher = (id) =>
  api.delete(`${BASE}/${id}`);

export const deleteVoucherAttachment = (voucherId, filename) =>
  api.delete(`${BASE}/${voucherId}/attachments/${encodeURIComponent(filename)}`);

export const getVoucherAudit = (id) =>
  api.get(`${BASE}/${id}/audit`);

export const getVoucherStats = () =>
  api.get(`${BASE}/stats`);

// ── Helper: construye FormData desde un objeto plano ─────────
export const buildVoucherFormData = ({
  contact_id, amount, currency, payment_method,
  payment_date, reference_number, description, metadata, files
}) => {
  const fd = new FormData();
  fd.append('contact_id',    contact_id);
  fd.append('amount',        amount);
  fd.append('currency',      currency || 'DOP');
  fd.append('payment_method', payment_method);
  fd.append('payment_date',  payment_date);
  if (reference_number) fd.append('reference_number', reference_number);
  if (description)      fd.append('description', description);
  if (metadata)         fd.append('metadata', JSON.stringify(metadata));
  if (files?.length)    files.forEach(f => fd.append('attachments', f));
  return fd;
};

// ── Constantes de UI ─────────────────────────────────────────

export const STATUS_LABELS = {
  pending:         'Pendiente',
  verified:        'Verificado',
  rejected:        'Rechazado',
  fraud_suspected: 'Fraude Sospechoso'
};

export const STATUS_COLORS = {
  pending:         'bg-yellow-100 text-yellow-800',
  verified:        'bg-green-100 text-green-800',
  rejected:        'bg-red-100 text-red-800',
  fraud_suspected: 'bg-orange-100 text-orange-800'
};

export const METHOD_LABELS = {
  bank_transfer:  'Transferencia Bancaria',
  cash:           'Efectivo',
  card:           'Tarjeta',
  mobile_payment: 'Pago Móvil',
  crypto:         'Criptomoneda',
  other:          'Otro'
};

// Transiciones de estado permitidas por el frontend (refleja la lógica del backend)
export const STATUS_TRANSITIONS = {
  pending:         ['verified', 'rejected', 'fraud_suspected'],
  verified:        ['fraud_suspected'],
  rejected:        ['pending'],
  fraud_suspected: ['rejected']
};
