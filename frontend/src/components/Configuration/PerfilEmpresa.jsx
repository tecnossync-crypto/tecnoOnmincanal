// frontend/src/components/Configuration/PerfilEmpresa.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

const Field = ({ label, id, value, onChange, placeholder, type = 'text', disabled = false }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-medium" style={{ color: '#64748b' }}>
      {label}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(id, e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all duration-150"
      style={{
        background: '#f8fafc',
        border: '0.5px solid #e2e8f0',
        color: disabled ? '#94a3b8' : '#0f172a',
        cursor: disabled ? 'not-allowed' : 'text',
      }}
      onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
    />
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
      {title}
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {children}
    </div>
  </div>
);

const DIAS = [
  { key: 'lunes',     label: 'Lunes'     },
  { key: 'martes',    label: 'Martes'    },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves',    label: 'Jueves'    },
  { key: 'viernes',   label: 'Viernes'   },
  { key: 'sabado',    label: 'Sábado'    },
  { key: 'domingo',   label: 'Domingo'   },
];

const DEFAULT_HORARIOS = {
  lunes:     { abierto: true,  desde: '08:00', hasta: '18:00' },
  martes:    { abierto: true,  desde: '08:00', hasta: '18:00' },
  miercoles: { abierto: true,  desde: '08:00', hasta: '18:00' },
  jueves:    { abierto: true,  desde: '08:00', hasta: '18:00' },
  viernes:   { abierto: true,  desde: '08:00', hasta: '17:00' },
  sabado:    { abierto: false, desde: '',       hasta: ''      },
  domingo:   { abierto: false, desde: '',       hasta: ''      },
};

const EMPTY = {
  nombre:              '',
  sitio_web:           '',
  telefono:            '',
  telefono_secundario: '',
  email:               '',
  fax:                 '',
  direccion:           '',
  ciudad:              '',
  pais:                '',
  descripcion:         '',
  horarios:            null,
};

export default function PerfilEmpresa() {
  const navigate = useNavigate();

  const [form,    setForm]    = useState(EMPTY);
  const [saved,   setSaved]   = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get('/company');
        if (res.success) {
          const clean = { ...EMPTY, ...res.data };
          setForm(clean);
          setSaved(clean);
        }
      } catch (err) {
        console.error(err);
        setError('No se pudo conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const hasChanges = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      showToast('error', 'El nombre de la empresa es obligatorio.');
      return;
    }
    try {
      setSaving(true);
      const res = await api.put('/company', form);
      if (res.success) {
        setSaved({ ...form });
        showToast('success', 'Cambios guardados correctamente.');
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setForm({ ...saved });

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const initials = (form.nombre || '??')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="h-full flex flex-col overflow-hidden"
         style={{ background: '#ffffff', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
           style={{ borderBottom: '0.5px solid #e2e8f0', background: '#ffffff' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/config')}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: '#94a3b8' }}
            onMouseEnter={e => e.currentTarget.style.color = '#0f172a'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <BackIcon />
            Configuración
          </button>
          <span style={{ color: '#cbd5e1' }}>›</span>
          <span className="text-sm font-medium" style={{ color: '#0f172a' }}>
            Perfil de la empresa
          </span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ border: '0.5px solid #e2e8f0', color: '#94a3b8' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="mx-8 mt-4 flex items-center gap-2 px-4 py-3 rounded-lg text-sm flex-shrink-0"
          style={{
            background: toast.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `0.5px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'success' ? '#16a34a' : '#dc2626',
          }}
        >
          <span>{toast.type === 'success'
            ? <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            : <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          }</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3" style={{ color: '#94a3b8' }}>
            <SpinnerIcon />
            <span className="text-sm">Cargando datos...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-4 py-2 rounded-lg"
              style={{ background: '#f1f5f9', color: '#64748b', border: '0.5px solid #e2e8f0' }}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex items-center gap-5 mb-10 pb-8"
                 style={{ borderBottom: '0.5px solid #e2e8f0' }}>
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff' }}>
                {initials}
                <button
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#ffffff', border: '0.5px solid #e2e8f0', color: '#94a3b8' }}
                  title="Cambiar logo (próximamente)"
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                  </svg>
                </button>
              </div>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>
                  {form.nombre || 'Sin nombre'}
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
                  {form.sitio_web || 'Sin sitio web'}
                </p>
              </div>
            </div>

            <Section title="Información básica">
              <Field id="nombre"              label="Nombre de la empresa *" value={form.nombre}              onChange={handleChange} placeholder="SEGUROS VRA" />
              <Field id="sitio_web"           label="Sitio web"              value={form.sitio_web}           onChange={handleChange} placeholder="www.miempresa.com" />
              <Field id="telefono"            label="Teléfono principal"     value={form.telefono}            onChange={handleChange} placeholder="+1 809 000 0000" />
              <Field id="telefono_secundario" label="Teléfono secundario"    value={form.telefono_secundario} onChange={handleChange} placeholder="+1 829 000 0000" />
              <Field id="email"               label="Correo electrónico"     value={form.email}               onChange={handleChange} placeholder="empresa@correo.com" type="email" />
              <Field id="fax"                 label="Fax"                    value={form.fax}                 onChange={handleChange} placeholder="+1 809 000 0001" />
            </Section>

            <Section title="Ubicación">
              <div className="sm:col-span-2">
                <Field id="direccion" label="Dirección" value={form.direccion} onChange={handleChange} placeholder="Paseo Del Este No.1, Edificio Matilde" />
              </div>
              <Field id="ciudad" label="Ciudad" value={form.ciudad} onChange={handleChange} placeholder="Santo Domingo" />
              <Field id="pais"   label="País"   value={form.pais}   onChange={handleChange} placeholder="República Dominicana" />
            </Section>

            <div className="mb-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94a3b8' }}>
                Sobre la empresa
              </h3>
              <textarea
                id="descripcion"
                value={form.descripcion}
                onChange={e => handleChange('descripcion', e.target.value)}
                placeholder="Describe brevemente tu empresa..."
                rows={4}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none transition-all duration-150"
                style={{
                  background: '#f8fafc',
                  border: '0.5px solid #e2e8f0',
                  color: '#0f172a',
                  maxWidth: '600px',
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
              />
            </div>

            {/* ── Horarios de atención ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#94a3b8' }}>
                  Horarios de atención
                </h3>
                {!form.horarios && (
                  <button
                    type="button"
                    onClick={() => handleChange('horarios', DEFAULT_HORARIOS)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ background: '#eef2ff', color: '#6366f1', border: '0.5px solid #c7d2fe' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e0e7ff'}
                    onMouseLeave={e => e.currentTarget.style.background = '#eef2ff'}
                  >
                    Configurar horarios
                  </button>
                )}
                {form.horarios && (
                  <button
                    type="button"
                    onClick={() => handleChange('horarios', null)}
                    className="text-xs px-3 py-1 rounded-lg transition-colors"
                    style={{ background: '#fef2f2', color: '#ef4444', border: '0.5px solid #fecaca' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                  >
                    Quitar horarios
                  </button>
                )}
              </div>

              {!form.horarios ? (
                <p className="text-sm" style={{ color: '#94a3b8' }}>
                  Sin horarios configurados — el bot de IA no informará sobre disponibilidad horaria.
                </p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '0.5px solid #e2e8f0', maxWidth: '560px' }}>
                  {/* Header */}
                  <div className="grid grid-cols-[120px_1fr_1fr_60px] gap-0 px-4 py-2"
                       style={{ background: '#f8fafc', borderBottom: '0.5px solid #e2e8f0' }}>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Día</span>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Apertura</span>
                    <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>Cierre</span>
                    <span className="text-xs font-medium text-center" style={{ color: '#94a3b8' }}>Abierto</span>
                  </div>
                  {DIAS.map(({ key, label }) => {
                    const h = form.horarios[key] || { abierto: false, desde: '', hasta: '' };
                    const setH = (field, val) => handleChange('horarios', {
                      ...form.horarios,
                      [key]: { ...h, [field]: val }
                    });
                    return (
                      <div key={key}
                           className="grid grid-cols-[120px_1fr_1fr_60px] gap-0 px-4 py-2.5 items-center"
                           style={{ borderBottom: '0.5px solid #f1f5f9' }}>
                        <span className="text-sm font-medium" style={{ color: h.abierto ? '#0f172a' : '#94a3b8' }}>
                          {label}
                        </span>
                        <input
                          type="time"
                          value={h.desde}
                          disabled={!h.abierto}
                          onChange={e => setH('desde', e.target.value)}
                          className="w-28 rounded-lg px-2 py-1 text-sm outline-none transition-all"
                          style={{
                            background: h.abierto ? '#f8fafc' : '#f1f5f9',
                            border: '0.5px solid #e2e8f0',
                            color: h.abierto ? '#0f172a' : '#cbd5e1',
                            cursor: h.abierto ? 'text' : 'not-allowed',
                          }}
                          onFocus={e => { if (h.abierto) { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; } }}
                          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = h.abierto ? '#f8fafc' : '#f1f5f9'; }}
                        />
                        <input
                          type="time"
                          value={h.hasta}
                          disabled={!h.abierto}
                          onChange={e => setH('hasta', e.target.value)}
                          className="w-28 rounded-lg px-2 py-1 text-sm outline-none transition-all"
                          style={{
                            background: h.abierto ? '#f8fafc' : '#f1f5f9',
                            border: '0.5px solid #e2e8f0',
                            color: h.abierto ? '#0f172a' : '#cbd5e1',
                            cursor: h.abierto ? 'text' : 'not-allowed',
                          }}
                          onFocus={e => { if (h.abierto) { e.target.style.borderColor = '#6366f1'; e.target.style.background = '#fff'; } }}
                          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = h.abierto ? '#f8fafc' : '#f1f5f9'; }}
                        />
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setH('abierto', !h.abierto)}
                            className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200"
                            style={{ background: h.abierto ? '#6366f1' : '#e2e8f0' }}
                          >
                            <span
                              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
                              style={{ transform: h.abierto ? 'translateX(16px)' : 'translateX(0px)' }}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs mt-3" style={{ color: '#94a3b8' }}>
                El bot de IA usará esta información automáticamente al responder preguntas sobre disponibilidad.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0"
             style={{ borderTop: '0.5px solid #e2e8f0', background: '#ffffff' }}>
          <p className="text-xs" style={{ color: hasChanges ? '#f59e0b' : '#94a3b8' }}>
            {hasChanges ? '● Tienes cambios sin guardar' : 'Todo guardado'}
          </p>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ color: '#64748b', border: '0.5px solid #e2e8f0' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: hasChanges ? '#6366f1' : '#e0e7ff',
                color: hasChanges ? '#ffffff' : '#a5b4fc',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? <SpinnerIcon /> : <SaveIcon />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}