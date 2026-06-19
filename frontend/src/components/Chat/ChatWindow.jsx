// frontend/src/components/Chat/ChatWindow.jsx
// ─────────────────────────────────────────────────────────────
// Ventana de chat de Tecnossync
// RBAC: botón "Asignarme" solo visible para admin
// Animaciones de mensajes con msg-agent / msg-contact
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Zap, X, ClipboardList } from 'lucide-react';
import { useConversationStore, useAuthStore, useThemeStore, useModuleStore } from '../../store';
import ModuleRecordModal from '../Modules/ModuleRecordModal';
import { joinConversation, leaveConversation } from '../../services/socket';
import api  from '../../services/api';
import toast from 'react-hot-toast';

const CHANNEL_CONFIG = {
  whatsapp:  { label: 'WhatsApp',  color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-200' },
  messenger: { label: 'Messenger', color: 'bg-blue-500',  textColor: 'text-blue-700',  bgLight: 'bg-blue-50',  border: 'border-blue-200'  },
  instagram: { label: 'Instagram', color: 'bg-pink-500',  textColor: 'text-pink-700',  bgLight: 'bg-pink-50',  border: 'border-pink-200'  },
};

export default function ChatWindow() {
  const { activeConversation, messages, sendMessage, resolveConversation } = useConversationStore();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const isAdmin = user?.role === 'admin';

  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const [agents,  setAgents]  = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [quickMessages,   setQuickMessages]   = useState([]);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [quickSearch,     setQuickSearch]     = useState('');
  const [showModulePicker,setShowModulePicker]   = useState(false);
  const [moduleModal,     setModuleModal]       = useState(null);
  const { modules } = useModuleStore();

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Unirse/salir de la sala Socket.io
  useEffect(() => {
    if (!activeConversation) return;
    joinConversation(activeConversation.id);
    inputRef.current?.focus();
    return () => leaveConversation(activeConversation.id);
  }, [activeConversation?.id]);

  // Cargar lista de agentes (solo admin necesita esto)
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/users')
      .then(r => setAgents(r.data.data.users.filter(u => u.role === 'agent' && u.is_active)))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    api.get('/quick-messages?channel=inbox')
      .then(res => setQuickMessages(res.data || []))
      .catch(() => {});
  }, []);

  // ── Handlers ──────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(text.trim());
      setText('');
    } catch (err) {
      toast.error('Error al enviar: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleResolve = async () => {
    if (!confirm('¿Marcar esta conversación como resuelta?')) return;
    try {
      await resolveConversation(activeConversation.id);
      toast.success('Conversación resuelta.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al resolver.');
    }
  };

  const handleAssignToMe = async () => {
    try {
      await api.post(`/conversations/${activeConversation.id}/assign`, { agentId: user.id });
      toast.success('Conversación asignada a ti.');
      setShowAssign(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al asignar.');
    }
  };

  const handleAssignTo = async (agentId) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      await api.post(`/conversations/${activeConversation.id}/assign`, { agentId });
      toast.success(`Asignado a ${agent?.name || 'agente'}.`);
      setShowAssign(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al asignar.');
    }
  };

  const handleUnassign = async () => {
    try {
      await api.post(`/conversations/${activeConversation.id}/assign`, { agentId: null });
      toast.success('Conversación desasignada.');
      setShowAssign(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error.');
    }
  };

  // ── Empty state ────────────────────────────────────────────
  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center bg-[#f8f9fa] dark:bg-[#0b141a]">
        <div className="w-16 h-16 bg-[#dfe5e7] dark:bg-[#202c33] rounded-2xl flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#54656f] dark:text-[#8696a0]" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-[#41525d] dark:text-[#e9edef] mb-1">Selecciona una conversación</p>
          <p className="text-[#667781] dark:text-[#8696a0] text-sm">
            {user?.role === 'agent'
              ? 'Elige una de tus conversaciones asignadas para comenzar'
              : 'Elige una conversación de la bandeja para ver los mensajes'}
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          {['whatsapp', 'messenger', 'instagram'].map(ch => {
            const c = CHANNEL_CONFIG[ch];
            return (
              <span key={ch} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.bgLight} ${c.textColor} border ${c.border}`}>
                {c.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  const chConfig = CHANNEL_CONFIG[activeConversation.channel] || CHANNEL_CONFIG.whatsapp;
  const contactName = activeConversation.contact?.name || 'Contacto';
  const assignedAgent = activeConversation.assigned_agent;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header del chat ───────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#d1d7db] dark:border-[#2a3942] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#dfe5e7] dark:bg-[#2a3942] flex items-center justify-center font-semibold text-[#54656f] dark:text-[#8696a0] text-sm">
              {contactName.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${chConfig.color} rounded-full border-2 border-white dark:border-[#202c33]`} />
          </div>
          {/* Nombre + canal */}
          <div className="min-w-0">
            <p className="font-medium text-[#111b21] dark:text-[#e9edef] text-[15px] truncate">{contactName}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-medium ${chConfig.textColor}`}>{chConfig.label}</span>
              {assignedAgent && (
                <span className="text-xs text-[#667781] dark:text-[#8696a0]">
                  · Agente: <span className="font-medium text-[#41525d] dark:text-[#e9edef]">{assignedAgent.name}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones — solo admin ve todo, agente ve "Resolver" */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => setShowAssign(!showAssign)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                           bg-white dark:bg-[#2a3942] hover:bg-[#f0fdf4] dark:hover:bg-[#00a884]/10 text-[#54656f] dark:text-[#8696a0] hover:text-[#00a884]
                           transition-colors border border-[#d1d7db] dark:border-[#2a3942] hover:border-[#00a884]"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                Asignar
                <svg viewBox="0 0 20 20" className={`w-3 h-3 transition-transform ${showAssign ? 'rotate-180' : ''}`} fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown de asignación */}
              {showAssign && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-[#233138] rounded-xl border border-[#d1d7db] dark:border-[#2a3942] shadow-lg shadow-slate-200/60 dark:shadow-black/40 z-20 overflow-hidden">
                  <div className="p-1">
                    <button onClick={handleAssignToMe}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[#f0fdf4] dark:hover:bg-[#00a884]/10 text-left text-[#111b21] dark:text-[#e9edef] hover:text-[#00a884] font-medium">
                      <span className="w-6 h-6 bg-[#dfe5e7] dark:bg-[#2a3942] rounded-full flex items-center justify-center text-xs font-bold text-[#54656f] dark:text-[#8696a0]">
                        {user?.name?.charAt(0) || 'A'}
                      </span>
                      Asignarme a mí
                    </button>

                    {agents.filter(a => a.id !== user?.id).map(agent => (
                      <button key={agent.id} onClick={() => handleAssignTo(agent.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-[#f5f6f6] dark:hover:bg-white/5 text-left text-[#54656f] dark:text-[#8696a0]">
                        <span className="w-6 h-6 bg-[#dfe5e7] dark:bg-[#2a3942] rounded-full flex items-center justify-center text-xs font-semibold text-[#54656f] dark:text-[#8696a0]">
                          {agent.name.charAt(0)}
                        </span>
                        {agent.name}
                      </button>
                    ))}

                    {assignedAgent && (
                      <>
                        <div className="border-t border-[#e9edef] dark:border-[#2a3942] my-1" />
                        <button onClick={handleUnassign}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-left text-red-500">
                          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Desasignar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleResolve}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                       bg-[#d9fdd3] dark:bg-[#005c4b] hover:bg-[#c5f7c0] dark:hover:bg-[#06715f] text-[#008069] dark:text-[#e9edef] border border-[#00a884]/30 dark:border-transparent
                       transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Resolver
          </button>
        </div>
      </div>

      {/* ── Área de mensajes ──────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-6 py-4 space-y-1"
        onClick={() => setShowAssign(false)}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${isDark ? '%232a3942' : '%23d8d0c4'}' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: isDark ? '#0b141a' : '#efeae2'
        }}
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#667781] dark:text-[#8696a0] text-sm bg-white/70 dark:bg-[#202c33]/80 px-3 py-1.5 rounded-lg">Aquí aparecerán los mensajes</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id || idx}
            message={msg}
            currentUserId={user?.id}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input de mensaje ──────────────────────────────── */}
      <div className="px-4 pb-3 pt-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#d1d7db] dark:border-[#2a3942] flex-shrink-0">

        {/* Quick message picker */}
        {showQuickPicker && (
          <div className="mb-2 bg-white dark:bg-[#2a3942] rounded-xl shadow-lg border border-slate-200 dark:border-[#3b4a54] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-[#3b4a54]">
              <Zap size={13} className="text-[#00a884] flex-shrink-0" />
              <input
                autoFocus
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder="Buscar mensaje rápido..."
                className="flex-1 text-sm outline-none placeholder-[#667781] bg-transparent text-[#111b21] dark:text-[#e9edef]"
              />
              <button onClick={() => { setShowQuickPicker(false); setQuickSearch(''); }} className="text-[#667781] hover:text-[#111b21]">
                <X size={13} />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {quickMessages
                .filter(m => {
                  const q = quickSearch.toLowerCase();
                  return !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || (m.shortcut || '').toLowerCase().includes(q);
                })
                .map(m => (
                  <button
                    key={m.id}
                    className="w-full text-left px-4 py-3 hover:bg-[#f0f2f5] dark:hover:bg-[#3b4a54] transition-colors border-b border-slate-50 dark:border-[#3b4a54] last:border-0"
                    onClick={() => {
                      setText(m.content);
                      setShowQuickPicker(false);
                      setQuickSearch('');
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                  >
                    <p className="text-sm font-medium text-[#111b21] dark:text-[#e9edef] truncate">{m.title}</p>
                    <p className="text-xs text-[#667781] dark:text-[#8696a0] truncate mt-0.5">{m.content}</p>
                  </button>
                ))
              }
              {quickMessages.filter(m => {
                const q = quickSearch.toLowerCase();
                return !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || (m.shortcut || '').toLowerCase().includes(q);
              }).length === 0 && (
                <p className="text-xs text-[#667781] text-center py-4">Sin resultados</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2">
          {/* Botón mensajes rápidos */}
          <button
            type="button"
            onClick={() => { setShowQuickPicker(p => !p); setQuickSearch(''); }}
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              showQuickPicker
                ? 'bg-[#00a884] text-white'
                : 'bg-white dark:bg-[#2a3942] text-[#667781] hover:text-[#00a884] hover:bg-[#e8f5f0]'
            }`}
            title="Mensajes rápidos"
          >
            <Zap size={16} />
          </button>

          {/* Botón módulos */}
          {modules.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowModulePicker(p => !p)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  showModulePicker
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-[#2a3942] text-[#667781] hover:text-emerald-500 hover:bg-[#e8f5f0]'
                }`}
                title="Nuevo registro en módulo"
              >
                <ClipboardList size={16} />
              </button>
              {showModulePicker && (
                <div className="absolute bottom-11 left-0 z-30 bg-white dark:bg-[#2a3942] rounded-xl shadow-xl border border-slate-100 dark:border-[#3b4a54] w-52 overflow-hidden">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-50 dark:border-[#3b4a54]">Crear registro en</p>
                  {modules.map(mod => (
                    <button key={mod.id} type="button"
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-[#3b4a54] transition-colors"
                      onClick={() => { setModuleModal(mod); setShowModulePicker(false); }}
                    >
                      <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: mod.color }}>
                        <span className="text-white text-[10px] font-bold">{mod.name[0]}</span>
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">{mod.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Escribir en ${chConfig.label}... (Enter para enviar)`}
              rows={1}
              className="w-full resize-none rounded-3xl border border-transparent px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-[#00a884] focus:border-transparent
                         bg-white dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#667781] dark:placeholder:text-[#8696a0] transition-colors max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#06987a]
                       disabled:bg-[#d1d7db] dark:disabled:bg-[#2a3942] disabled:cursor-not-allowed
                       flex items-center justify-center transition-colors"
          >
            {sending ? (
              <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-white -rotate-45" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </form>

        {/* Indicador de canal activo */}
        <p className="text-xs text-[#667781] dark:text-[#8696a0] mt-2 flex items-center gap-1.5 pl-1">
          <span className={`w-2 h-2 rounded-full ${chConfig.color}`} />
          Respondiendo en {chConfig.label}
          <span className="text-[#d1d7db] dark:text-[#2a3942]">·</span>
          <span>Enter para enviar · Shift+Enter nueva línea</span>
        </p>
      </div>

      {/* ── Modal módulo ──────────────────────────────── */}
      <ModuleRecordModal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        onSaved={() => {}}
        module={moduleModal}
        contactName={activeConversation?.contact?.name || ''}
        conversationId={activeConversation?.id}
      />
    </div>
  );
}

// ─── Burbuja de mensaje ──────────────────────────────────────
function MessageBubble({ message, currentUserId }) {
  const isBot    = message.sender_type === 'bot';
  const isAgent  = message.sender_type === 'agent';
  const isOutbound = message.direction === 'outbound';

  const time = message.sent_at || message.created_at
    ? format(new Date(message.sent_at || message.created_at), 'HH:mm', { locale: es })
    : '';

  if (isOutbound) {
    // Mensajes salientes (agente o bot) → derecha, burbuja verde estilo WhatsApp
    return (
      <div className={`flex justify-end ${isBot ? 'msg-agent' : 'msg-agent'}`}>
        <div className="max-w-[65%]">
          {isBot && (
            <p className="text-xs text-[#667781] dark:text-[#8696a0] text-right mb-1 flex items-center justify-end gap-1">
              <span className="w-3 h-3 bg-violet-400 rounded-full inline-block" />
              Bot IA
            </p>
          )}
          <div
            className="px-3 py-1.5 shadow-sm bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]"
            style={{ borderRadius: '8px 0px 8px 8px' }}
          >
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            <p className="text-[11px] text-[#667781] dark:text-[#8696a0] text-right mt-0.5 flex items-center justify-end gap-1 -mb-0.5">
              {time}
              {/* Tick de estado */}
              {message.status === 'read' && (
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#53bdeb]" fill="currentColor">
                  <path d="M1 8l4 4L15 3"/>
                </svg>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Mensajes entrantes (contacto) → izquierda, burbuja blanca estilo WhatsApp
  return (
    <div className="flex justify-start msg-contact">
      <div className="max-w-[65%]">
        <div
          className="bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] px-3 py-1.5 shadow-sm"
          style={{ borderRadius: '0px 8px 8px 8px' }}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          <p className="text-[11px] text-[#667781] dark:text-[#8696a0] text-right mt-0.5 -mb-0.5">{time}</p>
        </div>
      </div>
    </div>
  );
}
