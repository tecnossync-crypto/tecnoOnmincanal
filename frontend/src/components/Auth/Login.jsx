// frontend/src/components/Auth/Login.jsx
// ─────────────────────────────────────────────────────────────
// Pantalla de login de Tecnossync
// Animación CSS con ts-login-card y ts-login-title
// 100% responsive
// ─────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';

const CHANNELS = [
  { label: 'WhatsApp',   color: 'bg-green-100 text-green-700 border-green-200',  dot: 'bg-green-500' },
  { label: 'Messenger',  color: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-500'  },
  { label: 'Instagram',  color: 'bg-pink-100 text-pink-700 border-pink-200',     dot: 'bg-pink-500'  },
  { label: 'TikTok',     color: 'bg-gray-200 text-gray-800 border-gray-300',     dot: 'bg-black-500' }
];

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Completa todos los campos.');
      return;
    }
    const result = await login(email.trim(), password);
    if (result.success) {
      toast.success('¡Bienvenido a Tecnossync!');
      navigate('/inbox');
    } else {
      toast.error(result.message || 'Credenciales inválidas.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      {/* Tarjeta principal */}
      <div className="ts-login-card relative w-full max-w-md">

        {/* Cabecera con branding */}
        <div className="text-center mb-8">

          {/* Isotipo */}
          <div className="ts-logo-container inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl mb-5 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 32 32" className="w-9 h-9 text-white" fill="currentColor">
              <path d="M4 8a4 4 0 014-4h16a4 4 0 014 4v12a4 4 0 01-4 4H12l-6 4v-4H8a4 4 0 01-4-4V8z"/>
              <path fill="white" fillOpacity=".4" d="M9 13h14M9 17h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Nombre de marca con gradiente animado */}
          <h1 className="ts-login-title text-4xl font-black tracking-tight mb-1">
            Tecnossync
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Plataforma Omnicanal con IA
          </p>
        </div>

        {/* Tarjeta blanca interna */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-indigo-900/20 p-8">

          {/* Canales disponibles */}
          <div className="flex justify-center gap-2 mb-6">
            {CHANNELS.map((ch) => (
              <span
                key={ch.label}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${ch.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ch.dot}`} />
                {ch.label}
              </span>
            ))}
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
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
                  placeholder="usuario@tecnossync.com"
                  required
                  autoComplete="email"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPass ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Olvidaste tu contraseña */}
            <div className="flex justify-end -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 mt-2 rounded-xl font-semibold text-white text-sm
                         bg-gradient-to-r from-indigo-600 to-violet-600
                         hover:from-indigo-500 hover:to-violet-500
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-200 shadow-lg shadow-indigo-500/25
                         hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Verificando...
                </span>
              ) : 'Iniciar sesión'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Tecnossync · Sistema interno · Acceso solo para el equipo autorizado
        </p>
      </div>
    </div>
  );
}
