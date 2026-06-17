// frontend/src/components/Auth/ResetPassword.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const { token }        = useParams();
  const navigate         = useNavigate();
  const { resetPassword } = useAuthStore();

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) { toast.error('Completa todos los campos.'); return; }
    if (newPassword.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    const result = await resetPassword(token, newPassword);
    setLoading(false);

    if (result.success) {
      setDone(true);
      toast.success('Contraseña restablecida correctamente.');
      setTimeout(() => navigate('/login'), 3000);
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl mb-5 shadow-lg shadow-indigo-500/30">
            <svg viewBox="0 0 32 32" className="w-9 h-9 text-white" fill="currentColor">
              <path d="M4 8a4 4 0 014-4h16a4 4 0 014 4v12a4 4 0 01-4 4H12l-6 4v-4H8a4 4 0 01-4-4V8z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-1">Tecnossync</h1>
          <p className="text-slate-400 text-sm">Nueva contraseña</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-indigo-900/20 p-8">
          {!done ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600 text-center mb-2">
                Crea una nueva contraseña segura para tu cuenta.
              </p>

              {/* Nueva contraseña */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nueva contraseña
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
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    autoFocus
                    className="input-field pl-10 pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showPass
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    className="input-field pl-10"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || (confirmPassword && newPassword !== confirmPassword)}
                className="w-full py-3 px-4 mt-2 rounded-xl font-semibold text-white text-sm
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
                    Guardando...
                  </span>
                ) : 'Restablecer contraseña'}
              </button>

              <div className="text-center pt-1">
                <Link to="/login" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium">
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">¡Contraseña restablecida!</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Redirigiendo al inicio de sesión en 3 segundos...
                </p>
              </div>
              <Link to="/login" className="inline-block text-sm text-indigo-500 hover:text-indigo-700 font-medium">
                Ir al inicio de sesión →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
