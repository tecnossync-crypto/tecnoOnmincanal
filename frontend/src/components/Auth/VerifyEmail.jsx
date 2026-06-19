// Pantalla de verificación de email con código de 6 dígitos
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();
  const emailParam      = searchParams.get('email') || '';
  const setSession      = useAuthStore(s => s._setSession);

  const [code,     setCode]     = useState(['', '', '', '', '', '']);
  const [email,    setEmail]    = useState(emailParam);
  const [loading,  setLoading]  = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown,  setCooldown] = useState(0);

  const inputRefs = useRef([]);

  // Cuenta regresiva para reenviar
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleDigit = (idx, val) => {
    // Pegar todo el código de golpe
    if (val.length > 1) {
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const next = [...code];
      digits.forEach((d, i) => { if (i < 6) next[i] = d; });
      setCode(next);
      const focus = Math.min(digits.length, 5);
      inputRefs.current[focus]?.focus();
      return;
    }

    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...code];
    next[idx]   = digit;
    setCode(next);
    if (digit && idx < 5) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const fullCode = code.join('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (fullCode.length < 6) { toast.error('Ingresa los 6 dígitos del código.'); return; }
    if (!email)               { toast.error('Email requerido.');                 return; }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { email: email.trim(), code: fullCode });
      const { token, user } = res.data;

      setSession(token, user);

      toast.success('¡Correo verificado! Bienvenido/a a Tecnossync 🎉');
      navigate('/inbox');
    } catch (err) {
      if (err.code === 'CODE_EXPIRED') {
        toast.error('El código expiró. Solicita uno nuevo.');
      } else {
        toast.error(err.message || 'Código incorrecto.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) { toast.error('Ingresa tu correo primero.'); return; }
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      toast.success('Código reenviado. Revisa tu bandeja de entrada.');
      setCooldown(60);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.message || 'Error al reenviar el código.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl mb-5 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 32 32" className="w-9 h-9 text-white" fill="currentColor">
              <path d="M4 8a4 4 0 014-4h16a4 4 0 014 4v12a4 4 0 01-4 4H12l-6 4v-4H8a4 4 0 01-4-4V8z"/>
              <path fill="white" fillOpacity=".4" d="M9 13h14M9 17h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-1 bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Tecnossync
          </h1>
          <p className="text-slate-400 text-sm font-medium">Verificación de cuenta</p>
        </div>

        {/* Tarjeta */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-indigo-900/20 p-8">

          {/* Ícono de email */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-black text-gray-900 text-center mb-2">Verifica tu correo</h2>
          <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
            Te enviamos un código de verificación de 6 dígitos.<br />
            {emailParam && <span className="font-semibold text-gray-700">{emailParam}</span>}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email (si no viene en la URL) */}
            {!emailParam && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="input-field"
                  required
                />
              </div>
            )}

            {/* Inputs de 6 dígitos */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
                Código de verificación
              </label>
              <div className="flex justify-center gap-2">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => inputRefs.current[idx] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={e => handleDigit(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    onFocus={e => e.target.select()}
                    className={`w-11 h-14 text-center text-xl font-black border-2 rounded-xl outline-none transition-all
                      ${digit
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-gray-50 text-gray-900'}
                      focus:border-indigo-500 focus:bg-indigo-50`}
                  />
                ))}
              </div>
            </div>

            {/* Botón verificar */}
            <button
              type="submit"
              disabled={loading || fullCode.length < 6}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm
                         bg-gradient-to-r from-indigo-600 to-violet-600
                         hover:from-indigo-500 hover:to-violet-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Verificando...
                </span>
              ) : 'Verificar cuenta'}
            </button>

            {/* Reenviar código */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">¿No recibiste el código?</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || cooldown > 0}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {resending
                  ? 'Enviando...'
                  : cooldown > 0
                    ? `Reenviar en ${cooldown}s`
                    : 'Reenviar código'}
              </button>
            </div>

            {/* Volver al login */}
            <div className="text-center border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Tecnossync · El código expira en 24 horas
        </p>
      </div>
    </div>
  );
}
