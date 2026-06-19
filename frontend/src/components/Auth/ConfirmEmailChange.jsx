// Página pública: confirmar cambio de correo electrónico vía token
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function ConfirmEmailChange() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token inválido'); return; }
    api.get(`/auth/confirm-email-change/${token}`)
      .then(r => { setStatus('success'); setMessage(r.data?.message || 'Correo actualizado correctamente.'); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.message || 'El enlace es inválido o ha expirado.'); });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin text-violet-400 mx-auto mb-4" />
            <p className="text-white font-semibold">Verificando enlace...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-2">¡Correo actualizado!</h1>
            <p className="text-sm text-slate-400 mb-6">{message}</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Ir al inicio de sesión
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h1 className="text-lg font-black text-white mb-2">Enlace inválido</h1>
            <p className="text-sm text-slate-400 mb-6">{message}</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
              Volver al login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
