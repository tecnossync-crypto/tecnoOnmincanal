// frontend/src/components/Configuration/WhatsappConfig.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Copy, Check, Eye, EyeOff, Save, RefreshCw, CheckCircle, XCircle, Zap, Settings, Trash2 } from 'lucide-react';

const META_APP_ID = '1308040240723209';

// ── Componente de campo seguro ───────────────────────────────
const Field = ({ label, value, onChange, placeholder, hint, secret, readOnly }) => {
  const [show,   setShow]   = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2">
        <div className={`flex-1 flex items-center border rounded-xl overflow-hidden transition-all
          ${readOnly
            ? 'bg-slate-50 border-slate-200'
            : 'bg-white border-slate-200 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-400'
          }`}>
          <input
            type={secret && !show ? 'password' : 'text'}
            value={value}
            onChange={e => onChange?.(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className="flex-1 px-4 py-2.5 text-sm text-slate-700 outline-none bg-transparent"
          />
          {secret && !readOnly && (
            <button onClick={() => setShow(!show)} className="px-3 text-slate-400 hover:text-slate-600">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
        </div>
        {value && (
          <button onClick={handleCopy} className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-all">
            {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
};

const StatusBadge = ({ ok, label }) => (
  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
    ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
  }`}>
    {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
    {label}
  </span>
);

export default function WhatsappConfig() {
  const [tab,         setTab]         = useState('signup');  // 'signup' | 'manual'
  const [account,     setAccount]     = useState(null);      // cuenta activa
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [sdkReady,    setSdkReady]    = useState(false);
  const [copied,      setCopied]      = useState(false);

  const [manual, setManual] = useState({
    phone_number_id: '',
    access_token:    '',
    app_secret:      '',
    verify_token:    '',
    phone_number:    '',
    display_name:    ''
  });

  const webhookUrl = `${window.location.origin}/api/webhook/whatsapp`;

  // ── Cargar SDK de Meta ───────────────────────────────────
  useEffect(() => {
    if (window.FB) { setSdkReady(true); return; }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId:   META_APP_ID,
        cookie:  true,
        xfbml:   true,
        version: 'v19.0'
      });
      setSdkReady(true);
    };

    const script = document.createElement('script');
    script.src   = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => { document.body.removeChild(script); };
  }, []);

  // ── Cargar cuenta activa ─────────────────────────────────
  useEffect(() => {
    api.get('/whatsapp-accounts')
      .then(res => setAccount(res.data?.data || null))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  // ── Escuchar mensaje de Meta Embedded Signup ─────────────
  const handleMetaMessage = useCallback(async (event) => {
    if (event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com') return;

    try {
      const data = JSON.parse(event.data);
      if (data.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH') {
        const { phone_number_id, waba_id } = data.data;

        // Obtener access token usando el code
        window.FB.getLoginStatus(async (response) => {
          const accessToken = response.authResponse?.accessToken;

          toast.loading('Conectando cuenta...', { id: 'connecting' });
          try {
            const res = await api.post('/whatsapp-accounts/embedded-signup', {
              phone_number_id,
              waba_id,
              access_token: accessToken,
              meta_user_id: response.authResponse?.userID
            });
            setAccount(res.data.data);
            toast.success('WhatsApp Business conectado exitosamente', { id: 'connecting' });
          } catch (e) {
            toast.error(e.response?.data?.message || 'Error al guardar', { id: 'connecting' });
          }
        });
      }

      if (data.event === 'CANCEL') {
        toast('Proceso cancelado');
      }

      if (data.event === 'ERROR') {
        toast.error(`Error de Meta: ${data.data?.error_message || 'Desconocido'}`);
      }
    } catch {}
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, [handleMetaMessage]);

  // ── Abrir popup de Meta Embedded Signup ─────────────────
  const handleEmbeddedSignup = () => {
    if (!sdkReady) { toast.error('SDK de Meta no cargado, intenta de nuevo'); return; }

    window.FB.login(
      (response) => {
        if (response.authResponse) {
          // El mensaje llega por window.message desde el popup
          toast('Completa el proceso en la ventana de Meta');
        } else {
          toast('Proceso cancelado');
        }
      },
      {
        config_id:      '${META_APP_ID}', // config ID de tu Embedded Signup flow
        response_type:  'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3'
        }
      }
    );
  };

  // ── Guardar configuración manual ─────────────────────────
  const handleSaveManual = async () => {
    if (!manual.phone_number_id || !manual.access_token || !manual.verify_token) {
      toast.error('Phone Number ID, Access Token y Verify Token son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/whatsapp-accounts/manual', manual);
      setAccount(res.data.data);
      toast.success('Configuración guardada');
    } catch (e) {
      toast.error(e.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Probar conexión ──────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/whatsapp-accounts/test');
      const { verified_name, display_phone_number, quality_rating } = res.data.data;
      toast.success(`${verified_name} · ${display_phone_number} · Calidad: ${quality_rating}`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al probar');
    } finally {
      setTesting(false);
    }
  };

  // ── Desconectar ──────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return;
    try {
      await api.delete('/whatsapp-accounts');
      setAccount(null);
      toast.success('Cuenta desconectada');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('URL copiada');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Banner: Meta App no configurada */}
        {!account && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">WhatsApp API (Meta) — Pendiente de configuración</p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Esta integración requiere una cuenta verificada en Meta Business Manager y una app aprobada en el portal de desarrolladores de Meta. Configura tus credenciales abajo cuando tengas acceso.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.49"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-800">WhatsApp Business API</h1>
              {account && <StatusBadge ok={true} label="Conectado" />}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Conecta el número general de tu empresa con Meta</p>
          </div>
        </div>

        {/* Cuenta activa */}
        {account && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
                <CheckCircle size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">
                  {account.display_name || 'WhatsApp Business'}
                </p>
                <p className="text-xs text-green-600">
                  {account.phone_number || account.phone_number_id} · via {account.connected_via === 'embedded_signup' ? 'Meta Login' : 'Manual'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-green-300 text-green-700 text-xs font-medium hover:bg-green-100 transition-all"
              >
                <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
                Probar
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-all"
              >
                <Trash2 size={13} />
                Desconectar
              </button>
            </div>
          </div>
        )}

        {/* Webhook URL */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">URL del Webhook</h2>
            <span className="text-xs bg-blue-50 text-blue-500 px-2 py-1 rounded-full font-medium">
              Copiar en Meta Developers
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <code className="flex-1 text-xs text-slate-600 break-all">{webhookUrl}</code>
            <button onClick={handleCopyWebhook} className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-500">
              {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
            </button>
          </div>
        </div>

        {/* Tabs de conexión */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setTab('signup')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all ${
                tab === 'signup'
                  ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Zap size={15} />
              Conectar con Meta
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all ${
                tab === 'manual'
                  ? 'text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-500'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Settings size={15} />
              Configuración manual
            </button>
          </div>

          <div className="p-6">
            {/* Tab: Embedded Signup */}
            {tab === 'signup' && (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Conecta tu WhatsApp Business en segundos
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Inicia sesión con tu cuenta de Meta Business y selecciona el número que quieres conectar. No necesitas copiar ningún token.
                  </p>
                </div>

                <button
                  onClick={handleEmbeddedSignup}
                  disabled={!sdkReady}
                  className="flex items-center gap-3 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #1877f2, #0a66c2)' }}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  {sdkReady ? 'Continuar con Meta' : 'Cargando SDK...'}
                </button>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle size={13} className="text-green-400" />
                  <span>Proceso seguro y oficial de Meta</span>
                </div>

                <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Nota importante</p>
                  <p className="text-xs text-amber-600">
                    Esta opción requiere que tu cuenta de Facebook esté agregada como administrador o tester en la app de Tecnossync en Meta Developers. Si no puedes completar el proceso, usa la configuración manual.
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Manual */}
            {tab === 'manual' && (
              <div className="flex flex-col gap-5">
                <Field
                  label="Phone Number ID"
                  value={manual.phone_number_id}
                  onChange={v => setManual(p => ({ ...p, phone_number_id: v }))}
                  placeholder="123456789012345"
                  hint="Meta Developers → WhatsApp → Configuración de API"
                />
                <Field
                  label="Access Token"
                  value={manual.access_token}
                  onChange={v => setManual(p => ({ ...p, access_token: v }))}
                  placeholder="EAABsbCS..."
                  hint="Token de acceso permanente de tu app de Meta"
                  secret
                />
                <Field
                  label="App Secret"
                  value={manual.app_secret}
                  onChange={v => setManual(p => ({ ...p, app_secret: v }))}
                  placeholder="abc123def456..."
                  hint="Configuración básica de tu app → Secreto de la app"
                  secret
                />
                <Field
                  label="Verify Token"
                  value={manual.verify_token}
                  onChange={v => setManual(p => ({ ...p, verify_token: v }))}
                  placeholder="mi_token_secreto_123"
                  hint="Token que defines tú — debe coincidir con el del webhook en Meta"
                />
                <Field
                  label="Número de teléfono (opcional)"
                  value={manual.phone_number}
                  onChange={v => setManual(p => ({ ...p, phone_number: v }))}
                  placeholder="+18091234567"
                />
                <Field
                  label="Nombre del perfil (opcional)"
                  value={manual.display_name}
                  onChange={v => setManual(p => ({ ...p, display_name: v }))}
                  placeholder="Tecnossync Soporte"
                />

                <button
                  onClick={handleSaveManual}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium disabled:opacity-50 transition-all shadow-sm"
                >
                  <Save size={15} />
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}