// frontend/src/store/index.js
// NOTA: api.js interceptor hace (response) => response.data
// Por eso res ya ES el body JSON { success, data: {...} }
// Usar res.data para acceder al contenido, NO res.data.data
import { create } from 'zustand';
import api from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

// ══════════════════════════════════════════════════════════════
// AUTH STORE
// ══════════════════════════════════════════════════════════════
export const useAuthStore = create((set, get) => ({
  user:           null,
  token:          localStorage.getItem('token'),
  permissions:    null,
  activeFeatures: null,  // active_features de la empresa del usuario
  isLoading:      false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      initSocket(user.id);
      set({ user, token, permissions: user.permissions, activeFeatures: user.active_features ?? null, isLoading: false });
      return { success: true };
    } catch (error) {
      set({ isLoading: false });
      return { success: false, message: error.message || 'Error de conexión.' };
    }
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    localStorage.removeItem('token');
    disconnectSocket();
    set({ user: null, token: null, permissions: null, activeFeatures: null });
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      const user = res.data;
      initSocket(user.id);
      set({ user, permissions: user.permissions, activeFeatures: user.active_features ?? null });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, permissions: null, activeFeatures: null });
    }
  },

  // Recarga las features llamando /auth/me (útil cuando el superadmin actualiza una empresa)
  refreshFeatures: async () => {
    try {
      const res = await api.get('/auth/me');
      const user = res.data;
      set({ user, permissions: user.permissions, activeFeatures: user.active_features ?? null });
    } catch { /* silencioso */ }
  },

  forgotPassword: async (email) => {
    try {
      const res = await api.post('/auth/forgot-password', { email });
      return { success: true, message: res.message, resetLink: res.resetLink };
    } catch (error) {
      return { success: false, message: error.message || 'Error al procesar la solicitud.' };
    }
  },

  resetPassword: async (token, newPassword) => {
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword });
      return { success: true, message: res.message };
    } catch (error) {
      return { success: false, message: error.message || 'Error al restablecer la contraseña.' };
    }
  },

  can: (permission) => {
    const { permissions } = get();
    return permissions?.[permission] === true;
  },

  isAdmin: () => get().user?.role === 'admin',

  isSuperAdmin: () => get().user?.role === 'superadmin',

  // Verifica si un feature está habilitado para la empresa actual
  // superadmin siempre tiene acceso; si no hay datos cargados, por defecto true
  hasFeature: (featureName) => {
    const { user, activeFeatures } = get();
    if (user?.role === 'superadmin') return true;
    if (!activeFeatures) return true;  // cargando o sin empresa → optimista
    return activeFeatures[featureName] === true;
  },
}));

// ══════════════════════════════════════════════════════════════
// CONVERSATIONS STORE
// ══════════════════════════════════════════════════════════════
export const useConversationStore = create((set, get) => ({
  conversations:      [],
  activeConversation: null,
  messages:           [],
  isLoading:          false,
  filters:            { status: '', channel: '', search: '' },
  channelTab:         '',
  totalConversations: 0,

  setChannelTab: (tab) => {
    set({ channelTab: tab });
    set((s) => ({ filters: { ...s.filters, channel: tab } }));
    get().fetchConversations();
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),


  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const { filters } = get();
      const params = new URLSearchParams();
      if (filters.status)  params.set('status',  filters.status);
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.search)  params.set('search',  filters.search);
      const res = await api.get(`/conversations?${params}`);
      const { conversations, total } = res.data;
      set({ conversations, totalConversations: total, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  selectConversation: async (conversation) => {
    set({ activeConversation: conversation, messages: [] });
    try {
      const res = await api.get(`/conversations/${conversation.id}/messages`);
      set({ messages: res.data.messages });
    } catch (err) {
      console.warn('Sin acceso a esta conversación:', err.message);
    }
  },

  sendMessage: async (text) => {
    const { activeConversation } = get();
    if (!activeConversation) return;
    const res = await api.post(`/conversations/${activeConversation.id}/messages`, { text });
    set((s) => ({ messages: [...s.messages, res.data] }));
  },

  addIncomingMessage: (data) => {
    const { activeConversation } = get();
    if (activeConversation?.id === data.conversation?.id) {
      set((s) => ({ messages: [...s.messages, data.message] }));
    }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === data.conversation?.id
          ? {
              ...c,
              last_message_preview: data.message.content,
              last_message_at:      data.message.sent_at,
              unread_count: c.id !== activeConversation?.id
                ? (c.unread_count || 0) + 1
                : 0
            }
          : c
      )
    }));
  },

  resolveConversation: async (id) => {
    await api.post(`/conversations/${id}/resolve`);
    set((s) => ({
      conversations:      s.conversations.filter((c) => c.id !== id),
      activeConversation: s.activeConversation?.id === id ? null : s.activeConversation
    }));
  },

  updateActiveConversationMeta: (metaPatch) => {
    set((s) => {
      if (!s.activeConversation) return s;
      return {
        activeConversation: {
          ...s.activeConversation,
          metadata: { ...(s.activeConversation.metadata || {}), ...metaPatch }
        }
      };
    });
  },

  unreadByChannel: () => {
    const { conversations } = get();
    return conversations.reduce((acc, c) => {
      if (c.unread_count > 0) acc[c.channel] = (acc[c.channel] || 0) + c.unread_count;
      return acc;
    }, {});
  }
}));

// ══════════════════════════════════════════════════════════════
// TEAM STORE
// ══════════════════════════════════════════════════════════════
export const useTeamStore = create((set) => ({
  users:     [],
  isLoading: false,
  error:     null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/users');
      set({ users: res.data.users, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err.message || 'Error cargando usuarios.' });
    }
  },

  createUser: async (userData) => {
    const res = await api.post('/users', userData);
    set((s) => ({ users: [...s.users, res.data] }));
    return res.data;
  },

  updateUser: async (id, updates) => {
    const res = await api.put(`/users/${id}`, updates);
    set((s) => ({ users: s.users.map((u) => u.id === id ? res.data : u) }));
    return res.data;
  },

  toggleActive: async (id) => {
    const res = await api.patch(`/users/${id}/toggle`);
    set((s) => ({ users: s.users.map((u) => u.id === id ? res.data : u) }));
  },

  removeUser: async (id) => {
    await api.delete(`/users/${id}`);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },

  changePassword: async (id, passwords) => {
    await api.patch(`/users/${id}/password`, passwords);
  }
}));

// ══════════════════════════════════════════════════════════════
// WHATSAPP PERSONAL STORE (Baileys)
// ══════════════════════════════════════════════════════════════
export const useWhatsappStore = create((set, get) => ({
  sessions:      [],
  activeSession: null,
  chats:         {},
  activeChat:    null,

  // ── Estado persistente WA Business (sobrevive navegación) ──
  bizSessionId:  null,
  bizStatus:     'not_found',
  bizChatList:   [],

  setBizSession: (sessionId, status) => set({ bizSessionId: sessionId, bizStatus: status }),
  setBizChatList: (list) => set({ bizChatList: list }),
  updateBizChatList: (updater) => set((s) => ({ bizChatList: updater(s.bizChatList) })),

  setSessions: (sessions) => set({ sessions }),

  updateSessionStatus: (sessionId, status) => set((s) => ({
    sessions: s.sessions.map(se =>
      se.sessionId === sessionId ? { ...se, status } : se
    )
  })),

  setActiveSession: (sessionId) => set({ activeSession: sessionId, activeChat: null }),
  setActiveChat:    (jid)       => set({ activeChat: jid }),

  // Carga historial completo de un chat desde BD
  setChats: (sessionId, jid, msgs) => set((s) => ({
    chats: {
      ...s.chats,
      [sessionId]: {
        ...(s.chats[sessionId] || {}),
        [jid]: msgs
      }
    }
  })),

  // Agrega un mensaje nuevo en tiempo real
  addMessage: (sessionId, msg) => set((s) => {
    const sessionChats = s.chats[sessionId] || {};
    const jid  = msg.from;
    const msgs = sessionChats[jid] || [];
    // Deduplicar por externalId primero, luego por timestamp+body
    const exists = msgs.some(m =>
      (msg.externalId && m.externalId && msg.externalId === m.externalId) ||
      (m.timestamp === msg.timestamp && m.body === msg.body && m.fromMe === msg.fromMe)
    );
    if (exists) return s;
    return {
      chats: {
        ...s.chats,
        [sessionId]: {
          ...sessionChats,
          [jid]: [...msgs, msg]
        }
      }
    };
  }),

  getMessages: (sessionId, jid) => {
    const { chats } = get();
    return chats[sessionId]?.[jid] || [];
  },

  getChatsForSession: (sessionId) => {
    const { chats } = get();
    return chats[sessionId] || {};
  },

  unreadBySession: () => {
    const { chats } = get();
    const counts = {};
    Object.entries(chats).forEach(([sessionId, jidMap]) => {
      counts[sessionId] = Object.values(jidMap)
        .reduce((a, msgs) => a + msgs.length, 0);
    });
    return counts;
  }
}));

// ══════════════════════════════════════════════════════════════
// LABEL STORE — etiquetas globales (caché)
// ══════════════════════════════════════════════════════════════
export const useLabelStore = create((set, get) => ({
  labels: [],
  loaded: false,

  fetchLabels: async (force = false) => {
    if (get().loaded && !force) return;
    try {
      const res = await api.get('/labels');
      if (res.success) {
        set({ labels: res.data, loaded: true });
      }
    } catch (e) {
      console.error('Error cargando etiquetas:', e);
    }
  },

  invalidate: () => set({ loaded: false })
}));

// ══════════════════════════════════════════════════════════════
// THEME STORE — modo claro / oscuro
// ══════════════════════════════════════════════════════════════
const THEME_KEY = 'ts-theme';

const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

const getInitialTheme = () => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useThemeStore = create((set, get) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// ══════════════════════════════════════════════════════════════
// MODULE STORE
// ══════════════════════════════════════════════════════════════
export const useModuleStore = create((set) => ({
  modules:  [],
  loading:  false,

  fetchModules: async () => {
    try {
      set({ loading: true });
      const res = await api.get('/custom-modules');
      set({ modules: res.data || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setModules: (modules) => set({ modules }),
}));

// ══════════════════════════════════════════════════════════════
// MERGE TEMPLATE STORE — Plantillas de Mensajes Omnicanal
// ══════════════════════════════════════════════════════════════
export const useMergeTemplateStore = create((set, get) => ({
  templates:  [],
  isLoading:  false,

  fetchTemplates: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters.activo !== undefined) params.set('activo', filters.activo);
      if (filters.canal) params.set('canal', filters.canal);
      const q = params.toString();
      const res = await api.get(`/merge-templates${q ? `?${q}` : ''}`);
      set({ templates: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createTemplate: async (data) => {
    const res = await api.post('/merge-templates', data);
    set((s) => ({ templates: [res.data, ...s.templates] }));
    return res.data;
  },

  updateTemplate: async (id, data) => {
    const res = await api.put(`/merge-templates/${id}`, data);
    set((s) => ({ templates: s.templates.map((t) => t.id === id ? res.data : t) }));
    return res.data;
  },

  removeTemplate: async (id) => {
    await api.delete(`/merge-templates/${id}`);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  toggleActive: async (id) => {
    const res = await api.patch(`/merge-templates/${id}/toggle`);
    set((s) => ({ templates: s.templates.map((t) => t.id === id ? res.data : t) }));
  },

  mergeTemplate: async (id, datos) => {
    const res = await api.post(`/merge-templates/${id}/merge`, { datos });
    return res.data;
  },

  useInConversation: async (templateId, conversationId, datos) => {
    const res = await api.post(`/merge-templates/${templateId}/use/${conversationId}`, { datos });
    return res.data;
  },

  preview: async (contenido, datos) => {
    const res = await api.post('/merge-templates/preview', { contenido, datos });
    return res.data;
  },
}));
