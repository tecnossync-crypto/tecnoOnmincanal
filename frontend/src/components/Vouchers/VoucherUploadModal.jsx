// frontend/src/components/Vouchers/VoucherUploadModal.jsx
// Modal para crear un nuevo comprobante de pago
// Usa los mismos patrones UI del proyecto (Headless, Tailwind, react-hot-toast)

import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createVoucher, buildVoucherFormData, METHOD_LABELS } from '../../services/voucherApi';
import api from '../../services/api';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
  </svg>
);
const DocIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);
const ImgIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const ACCEPTED = '.jpg,.jpeg,.png,.webp,.gif,.pdf';
const MAX_MB   = 10;

export default function VoucherUploadModal({ onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const searchTimer  = useRef(null);

  const [form, setForm] = useState({
    contact_id: '', amount: '', currency: 'DOP',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: '', description: ''
  });
  const [files,           setFiles]           = useState([]);
  const [dragging,        setDragging]        = useState(false);
  const [submitting,      setSubmitting]      = useState(false);
  const [errors,          setErrors]          = useState({});
  const [contactSearch,   setContactSearch]   = useState('');
  const [contactResults,  setContactResults]  = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [searching,       setSearching]       = useState(false);

  // Búsqueda de contactos con debounce
  const searchContacts = useCallback(async (q) => {
    if (q.length < 2) { setContactResults([]); return; }
    setSearching(true);
    try {
      // api.js interceptor: res ya ES { success, data: { contacts, total } }
      const res = await api.get('/contacts', { params: { search: q, limit: 8 } });
      setContactResults(res.data?.contacts || []);
    } catch { setContactResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleContactInput = (e) => {
    const q = e.target.value;
    setContactSearch(q);
    setSelectedContact(null);
    setForm(f => ({ ...f, contact_id: '' }));
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchContacts(q), 300);
  };

  const selectContact = (c) => {
    setSelectedContact(c);
    setContactSearch(c.name || c.phone || c.whatsapp_id || '');
    setForm(f => ({ ...f, contact_id: c.id }));
    setContactResults([]);
    if (errors.contact_id) setErrors(e => ({ ...e, contact_id: '' }));
  };

  // Manejo de archivos
  const addFiles = (incoming) => {
    const valid = Array.from(incoming).filter(f => {
      if (f.size > MAX_MB * 1024 * 1024) { toast.error(`"${f.name}" supera ${MAX_MB} MB`); return false; }
      const ext = f.name.split('.').pop().toLowerCase();
      if (!['jpg','jpeg','png','webp','gif','pdf'].includes(ext)) { toast.error(`"${f.name}" no es un tipo permitido`); return false; }
      return true;
    });
    setFiles(prev => {
      const combined = [...prev, ...valid];
      if (combined.length > 5) { toast.error('Máximo 5 archivos por comprobante'); return combined.slice(0, 5); }
      return combined;
    });
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      if (errors[key]) setErrors(ev => ({ ...ev, [key]: '' }));
    }
  });

  const validate = () => {
    const e = {};
    if (!form.contact_id)                                         e.contact_id     = 'Selecciona un cliente';
    if (!form.amount || isNaN(form.amount) || +form.amount <= 0) e.amount          = 'Ingresa un monto válido mayor a 0';
    if (!form.payment_method)                                     e.payment_method  = 'Selecciona un método de pago';
    if (!form.payment_date)                                       e.payment_date    = 'Ingresa la fecha del pago';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd  = buildVoucherFormData({ ...form, files });
      const res = await createVoucher(fd);
      toast.success(res.message || 'Comprobante creado exitosamente');
      onSuccess();
    } catch (err) {
      if (err.message?.toLowerCase().includes('duplicado')) {
        toast.error(err.message, { duration: 6000 });
      } else {
        toast.error(err.message || 'Error creando comprobante');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Subir Comprobante de Pago</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <XIcon />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400"><SearchIcon /></span>
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                value={contactSearch}
                onChange={handleContactInput}
                className={`w-full pl-9 pr-4 py-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errors.contact_id ? 'border-red-400' : 'border-slate-300'}`}
              />
              {searching && (
                <div className="absolute right-3 top-3">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {errors.contact_id && <p className="text-xs text-red-500 mt-1">{errors.contact_id}</p>}

            {contactResults.length > 0 && (
              <div className="mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-10 relative">
                {contactResults.map(c => (
                  <button key={c.id} type="button" onClick={() => selectContact(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-slate-800">{c.name || '(Sin nombre)'}</div>
                    <div className="text-xs text-slate-500">{c.phone || c.whatsapp_id} {c.email ? `· ${c.email}` : ''}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedContact && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                <span className="font-medium">{selectedContact.name || selectedContact.phone}</span>
                {selectedContact.email && <span className="text-indigo-500">· {selectedContact.email}</span>}
              </div>
            )}
          </div>

          {/* Monto y moneda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto <span className="text-red-500">*</span></label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00" {...field('amount')}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errors.amount ? 'border-red-400' : 'border-slate-300'}`}
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
              <select {...field('currency')} className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Método y fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Método de Pago <span className="text-red-500">*</span></label>
              <select {...field('payment_method')}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errors.payment_method ? 'border-red-400' : 'border-slate-300'}`}
              >
                {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del Pago <span className="text-red-500">*</span></label>
              <input type="date" max={new Date().toISOString().slice(0, 10)} {...field('payment_date')}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errors.payment_date ? 'border-red-400' : 'border-slate-300'}`}
              />
            </div>
          </div>

          {/* Referencia y descripción */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Número de Referencia</label>
            <input type="text" placeholder="Ej: 2025-TRF-00123" {...field('reference_number')}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción / Concepto</label>
            <textarea rows={2} placeholder="Ej: Pago mensualidad enero 2025..." {...field('description')}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Zona de archivos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Archivos Adjuntos <span className="text-slate-400 font-normal">(máx. 5, {MAX_MB} MB c/u)</span>
            </label>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-center text-slate-400 mb-2"><UploadIcon /></div>
              <p className="text-sm text-slate-600">Arrastra archivos aquí o <span className="text-indigo-600 font-medium">haz clic</span></p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP, GIF, PDF</p>
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden"
              onChange={e => addFiles(e.target.files)} />

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    {f.type.startsWith('image/') ? <ImgIcon /> : <DocIcon />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{f.name}</p>
                      <p className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button type="button" onClick={e => { e.stopPropagation(); setFiles(p => p.filter((_, idx) => idx !== i)); }}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Subiendo...</>
            ) : (
              <><UploadIcon />Crear Comprobante</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
