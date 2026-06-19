// Modal de perfil de usuario: cambio de contraseña (con verificación) y cambio de email (con confirmación)
import React, { useState } from 'react';
import { X, Lock, Mail, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

function Field({ label, type = 'text', value, onChange, placeholder, show, onToggle }) {
  const isPassword = type === 'password';
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={isPassword ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-slate-900 border border-slate-700 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-violet-500 pr-10"
        />
        {isPassword && (
          <button type="button" onClick={onToggle}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab: Cambiar contraseña ────────────────────────────────────────────────
function PasswordTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState({ cur: false, new: false, con: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres'); return; }
    if (form.newPassword !== form.confirm) { toast.error('Las contraseñas no coinciden'); return; }
    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      toast.success('Contraseña actualizada correctamente');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl text-xs text-slate-400 flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
        Para cambiar tu contraseña debes confirmar tu identidad con la contraseña actual.
      </div>

      <Field label="Contraseña actual *" type="password" value={form.currentPassword}
        onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
        placeholder="Tu contraseña actual" show={show.cur} onToggle={() => setShow(p => ({ ...p, cur: !p.cur }))} />

      <Field label="Nueva contraseña *" type="password" value={form.newPassword}
        onChange={e => setForm(p => ({ ...p, newPassword: e.target.value }))}
        placeholder="Mínimo 8 caracteres" show={show.new} onToggle={() => setShow(p => ({ ...p, new: !p.new }))} />

      <Field label="Confirmar nueva contraseña *" type="password" value={form.confirm}
        onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
        placeholder="Repite la nueva contraseña" show={show.con} onToggle={() => setShow(p => ({ ...p, con: !p.con }))} />

      <button type="submit" disabled={saving || !form.currentPassword || !form.newPassword || !form.confirm}
        className="w-full py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2">
        {saving && <Loader2 size={13} className="animate-spin" />}
        {saving ? 'Actualizando...' : 'Actualizar contraseña'}
      </button>
    </form>
  );
}

// ── Tab: Cambiar email ─────────────────────────────────────────────────────
function EmailTab({ currentEmail }) {
  const [form, setForm]     = useState({ newEmail: '', currentPassword: '' });
  const [show, setShow]     = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.newEmail || !form.currentPassword) { toast.error('Completa todos los campos'); return; }
    if (form.newEmail === currentEmail) { toast.error('El correo es el mismo que el actual'); return; }
    setSaving(true);
    try {
      await api.post('/auth/request-email-change', {
        newEmail:        form.newEmail,
        currentPassword: form.currentPassword,
      });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Error al solicitar cambio de correo');
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle size={40} className="text-emerald-400" />
        <p className="text-white font-semibold">Correo de confirmación enviado</p>
        <p className="text-sm text-slate-400">
          Hemos enviado un enlace a <strong className="text-white">{form.newEmail}</strong>.<br />
          Haz clic en el enlace para confirmar el cambio de correo electrónico.
        </p>
        <button onClick={() => { setSent(false); setForm({ newEmail: '', currentPassword: '' }); }}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 underline">
          Solicitar de nuevo
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl text-xs text-slate-400">
        <p className="flex items-start gap-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
          El cambio de correo requiere confirmación. Se enviará un enlace al nuevo correo y deberás hacer clic para activarlo.
        </p>
        <p className="mt-1 ml-[19px] text-slate-500">Correo actual: <span className="text-slate-300">{currentEmail}</span></p>
      </div>

      <Field label="Nuevo correo electrónico *" type="email" value={form.newEmail}
        onChange={e => setForm(p => ({ ...p, newEmail: e.target.value }))}
        placeholder="nuevo@correo.com" />

      <Field label="Contraseña actual (verificación) *" type="password" value={form.currentPassword}
        onChange={e => setForm(p => ({ ...p, currentPassword: e.target.value }))}
        placeholder="Tu contraseña actual" show={show} onToggle={() => setShow(p => !p)} />

      <button type="submit" disabled={saving || !form.newEmail || !form.currentPassword}
        className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center gap-2">
        {saving && <Loader2 size={13} className="animate-spin" />}
        {saving ? 'Enviando...' : 'Enviar confirmación'}
      </button>
    </form>
  );
}

// ── Modal principal ────────────────────────────────────────────────────────
export default function UserProfileModal({ open, onClose, user }) {
  const [tab, setTab] = useState('password');

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{user?.name || 'Mi perfil'}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-800">
          <button onClick={() => setTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px
              ${tab === 'password' ? 'text-white border-violet-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
            <Lock size={13} /> Contraseña
          </button>
          <button onClick={() => setTab('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px
              ${tab === 'email' ? 'text-white border-emerald-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}>
            <Mail size={13} /> Correo
          </button>
        </div>

        {/* Contenido */}
        <div className="p-5">
          {tab === 'password' && <PasswordTab />}
          {tab === 'email'    && <EmailTab currentEmail={user?.email} />}
        </div>
      </div>
    </div>
  );
}
