// frontend/src/components/Team/TeamPanel.jsx
// ─────────────────────────────────────────────────────────────
// Panel de gestión del equipo Tecnossync (solo admin)
// CRUD de usuarios, cambio de contraseña, toggle activo/inactivo
// Máximo 5 agentes + admin (configurable)
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useTeamStore, useAuthStore } from '../../store';
import toast from 'react-hot-toast';

const MAX_AGENTS = 4; // máximo de agentes (excluye al admin)

// ─── Iconos inline ────────────────────────────────────────────
const EditIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg> 
  
);

const KeyIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

// ─── Colores de avatar por inicial ────────────────────────────
const AVATAR_COLORS = [
  'from-indigo-400 to-violet-500',
  'from-cyan-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
];
const avatarColor = (name = '') =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// ─── Modal genérico ───────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">
            <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Formulario de crear/editar usuario ───────────────────────
function UserForm({ initial = {}, onSave, onCancel, isNew }) {
  const [form, setForm] = useState({
    name:     initial.name     || '',
    email:    initial.email    || '',
    role:     initial.role     || 'agent',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son requeridos.');
      return;
    }
    if (isNew && (!form.password || form.password.length < 8)) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Nombre completo
        </label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ana García"
          className="input-field"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="ana@tecnossync.com"
          className="input-field"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Rol
        </label>
        <select
          value={form.role}
          onChange={e => set('role', e.target.value)}
          className="input-field"
        >
          <option value="agent">Agente</option>
          <option value="admin">Administrador</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">
          {form.role === 'admin'
            ? 'Acceso total: bandeja, chatbot, campañas y equipo.'
            : 'Solo ve las conversaciones que le asignes.'}
        </p>
      </div>

      {isNew && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Contraseña temporal
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="input-field"
            minLength={8}
          />
          <p className="text-xs text-slate-400 mt-1">
            El empleado deberá cambiarla en su primer inicio de sesión.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Guardando...
            </>
          ) : (isNew ? 'Crear empleado' : 'Guardar cambios')}
        </button>
      </div>
    </form>
  );
}

// ─── Formulario de cambio de contraseña ──────────────────────
function PasswordForm({ userName, onSave, onCancel }) {
  const [form, setForm]   = useState({ newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form.newPassword);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Establecer nueva contraseña para <strong className="text-slate-700">{userName}</strong>.
      </p>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nueva contraseña</label>
        <input
          type="password"
          value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
          placeholder="Mínimo 8 caracteres"
          className="input-field"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar contraseña</label>
        <input
          type="password"
          value={form.confirm}
          onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
          placeholder="Repetir contraseña"
          className="input-field"
          required
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════
// PANEL PRINCIPAL
// ═════════════════════════════════════════════════════════════
export default function TeamPanel() {
  const { users, isLoading, error, fetchUsers, createUser, updateUser, toggleActive, removeUser, changePassword } = useTeamStore();
  const { user: currentUser } = useAuthStore();

  // Modales
  const [modalCreate,   setModalCreate]   = useState(false);
  const [modalEdit,     setModalEdit]     = useState(null);  // objeto usuario
  const [modalPassword, setModalPassword] = useState(null);  // objeto usuario
  const [confirmDelete, setConfirmDelete] = useState(null);  // objeto usuario

  useEffect(() => { fetchUsers(); }, []);

  const agents = users.filter(u => u.role === 'agent');
  const admins = users.filter(u => u.role === 'admin');
  const canAddAgent = agents.filter(u => u.is_active).length < MAX_AGENTS;

  // ── Handlers ──────────────────────────────────────────────
  const handleCreate = async (form) => {
    try {
      await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
      toast.success(`${form.name} creado correctamente.`);
      setModalCreate(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear usuario.');
    }
  };

  const handleEdit = async (form) => {
    try {
      await updateUser(modalEdit.id, { name: form.name, email: form.email, role: form.role });
      toast.success('Perfil actualizado.');
      setModalEdit(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar.');
    }
  };

  const handleToggle = async (u) => {
    try {
      await toggleActive(u.id);
      toast.success(`Cuenta ${u.is_active ? 'desactivada' : 'activada'}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error.');
    }
  };

  const handleDelete = async () => {
    try {
      await removeUser(confirmDelete.id);
      toast.success(`${confirmDelete.name} eliminado del sistema.`);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al eliminar.');
    }
  };

  const handlePassword = async (newPassword) => {
    try {
      await changePassword(modalPassword.id, { newPassword });
      toast.success('Contraseña actualizada.');
      setModalPassword(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar contraseña.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50">
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">

        {/* ── Header ────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Equipo Tecnossync</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {agents.filter(u => u.is_active).length}/{MAX_AGENTS} agentes activos · {admins.length} administrador{admins.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <button
            onClick={() => setModalCreate(true)}
            disabled={!canAddAgent}
            className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
            title={!canAddAgent ? `Máximo ${MAX_AGENTS} agentes activos` : undefined}
          >
            <PlusIcon /> Nuevo empleado
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Tarjeta de capacidad ─────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Capacidad del equipo</span>
            <span className="text-sm text-slate-500">
              {agents.filter(u => u.is_active).length} / {MAX_AGENTS} agentes
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(agents.filter(u => u.is_active).length / MAX_AGENTS) * 100}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3">
            {['whatsapp', 'messenger', 'instagram'].map(ch => (
              <span key={ch} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${
                  ch === 'whatsapp' ? 'bg-green-500' :
                  ch === 'messenger' ? 'bg-blue-500' : 'bg-pink-500'
                }`} />
                {ch.charAt(0).toUpperCase() + ch.slice(1)} activo
              </span>
            ))}
          </div>
        </div>

        {/* ── Administradores ──────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Administradores
          </h2>
          <div className="space-y-2">
            {admins.map(u => (
              <UserCard
                key={u.id}
                user={u}
                isCurrentUser={u.id === currentUser?.id}
                onEdit={() => setModalEdit(u)}
                onToggle={() => handleToggle(u)}
                onDelete={() => setConfirmDelete(u)}
                onPassword={() => setModalPassword(u)}
              />
            ))}
          </div>
        </section>

        {/* ── Agentes ──────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
            Agentes ({agents.length})
          </h2>
          {agents.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-slate-400 text-sm">No hay agentes todavía.</p>
              <button
                onClick={() => setModalCreate(true)}
                className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
              >
                + Añadir el primer agente
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  isCurrentUser={u.id === currentUser?.id}
                  onEdit={() => setModalEdit(u)}
                  onToggle={() => handleToggle(u)}
                  onDelete={() => setConfirmDelete(u)}
                  onPassword={() => setModalPassword(u)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ══ MODALES ══════════════════════════════════════════ */}

      {/* Crear usuario */}
      {modalCreate && (
        <Modal title="Nuevo empleado" onClose={() => setModalCreate(false)}>
          <UserForm isNew onSave={handleCreate} onCancel={() => setModalCreate(false)} />
        </Modal>
      )}

      {/* Editar usuario */}
      {modalEdit && (
        <Modal title={`Editar: ${modalEdit.name}`} onClose={() => setModalEdit(null)}>
          <UserForm initial={modalEdit} isNew={false} onSave={handleEdit} onCancel={() => setModalEdit(null)} />
        </Modal>
      )}

      {/* Cambiar contraseña */}
      {modalPassword && (
        <Modal title="Cambiar contraseña" onClose={() => setModalPassword(null)}>
          <PasswordForm
            userName={modalPassword.name}
            onSave={handlePassword}
            onCancel={() => setModalPassword(null)}
          />
        </Modal>
      )}

      {/* Confirmar eliminación */}
      {confirmDelete && (
        <Modal title="Eliminar empleado" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">
                ¿Eliminar a <strong>{confirmDelete.name}</strong> del sistema?
              </p>
              <p className="text-xs text-red-500 mt-1">
                Esta acción desactivará la cuenta. El historial de mensajes se conservará.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors">
                Sí, eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tarjeta de usuario ──────────────────────────────────────
function UserCard({ user, isCurrentUser, onEdit, onToggle, onDelete, onPassword }) {
  const initials = user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const color    = avatarColor(user.name);

  return (
    <div className={`
      bg-white rounded-xl border border-slate-200 p-4
      flex flex-col sm:flex-row sm:items-center gap-4
      transition-all ${!user.is_active ? 'opacity-60' : ''}
    `}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-10 h-10 rounded-xl
        bg-gradient-to-br ${color}
        flex items-center justify-center
        text-white text-sm font-bold
        shadow-sm
      `}>
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
          {isCurrentUser && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              Tú
            </span>
          )}
          <span className={user.role === 'admin' ? 'badge-admin' : 'badge-agent'}>
            {user.role === 'admin' ? 'Admin' : 'Agente'}
          </span>
          {!user.is_active && (
            <span className="bg-slate-100 text-slate-500 text-xs font-semibold px-2 py-0.5 rounded-full">
              Inactivo
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Editar */}
        <button onClick={onEdit} title="Editar perfil"
          className="w-8 h-8 rounded-lg flex items-center justify-center
                     text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
          <EditIcon />
        </button>

        {/* Cambiar contraseña */}
        <button onClick={onPassword} title="Cambiar contraseña"
          className="w-8 h-8 rounded-lg flex items-center justify-center
                     text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
          <KeyIcon />
        </button>

        {/* Toggle activo/inactivo */}
        {!isCurrentUser && (
          <button onClick={onToggle}
            title={user.is_active ? 'Desactivar cuenta' : 'Activar cuenta'}
            className={`
              relative w-10 h-5 rounded-full transition-colors
              ${user.is_active ? 'bg-indigo-500' : 'bg-slate-300'}
            `}
          >
            <span className={`
              absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${user.is_active ? 'translate-x-5' : 'translate-x-0'}
            `} />
          </button>
        )}

        {/* Eliminar */}
        {!isCurrentUser && (
          <button onClick={onDelete} title="Eliminar usuario"
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}
