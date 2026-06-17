// frontend/src/components/Auth/ForgotPassword.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email,    setEmail]    = useState('');
  const [sent,     setSent]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [resetLink, setResetLink] = useState('');
  const { forgotPassword } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Ingresa tu correo electrónico.'); return; }

    setLoading(true);
    const result = await forgotPassword(email.trim());
    setLoading(false);

    if (result.success) {
      setSent(true);
      if (result.resetLink) setResetLink(result.resetLink);
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
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
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">Tecnossync</h1>
          <p className="text-slate-400 text-sm">Recuperación de contraseña</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-indigo-900/20 p-8">
          {!sent ? (
            <>
              <p className="text-sm text-slate-600 mb-6 text-center">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      required
                      autoFocus
                      className="input-field pl-10"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white text-sm
                             bg-gradient-to-r from-indigo-600 to-violet-600
                             hover:from-indigo-500 hover:to-violet-500
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-all duration-200 shadow-lg shadow-indigo-500/25"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Procesando...
                    </span>
                  ) : 'Enviar instrucciones'}
                </button>

                <div className="text-center pt-2">
                  <Link to="/login" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">
                    ← Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              {/* Ícono de éxito */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-800">¡Instrucciones enviadas!</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña.
                </p>
              </div>

              {/* Si no hay SMTP, mostramos el link directamente */}
              {resetLink && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-2">
                    ℹ️ Sin correo configurado — comparte este enlace con el usuario:
                  </p>
                  <a
                    href={resetLink}
                    className="text-xs text-indigo-600 break-all hover:underline"
                  >
                    {resetLink}
                  </a>
                </div>
              )}

              <Link
                to="/login"
                className="inline-block mt-2 text-sm text-indigo-500 hover:text-indigo-700 font-medium"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
