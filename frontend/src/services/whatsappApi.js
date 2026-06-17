// frontend/src/services/whatsappApi.js
import api from './api';

export const whatsappApi = {

  // ═══════════════════════════════════════════════════════
  // SESIONES PERSONALES (existente, sin cambios)
  // ═══════════════════════════════════════════════════════
  startSession:      (sessionId)              => api.post('/whatsapp/session/start', { sessionId }),
  getStatus:         (sessionId)              => api.get(`/whatsapp/session/${sessionId}/status`),
  getAllSessions:     ()                       => api.get('/whatsapp/sessions'),
  sendMessage:       (sessionId, to, message) => api.post('/whatsapp/send', { sessionId, to, message }),
  disconnectSession: (sessionId)              => api.delete(`/whatsapp/session/${sessionId}`),

  getChats:    (sessionId)      => api.get(`/whatsapp/session/${sessionId}/chats`),
  getHistory:  (sessionId, jid) => api.get(`/whatsapp/session/${sessionId}/chat/${encodeURIComponent(jid)}`),

  getChatConfig: (sessionId, jid) =>
    api.get(`/whatsapp/session/${sessionId}/chat/${encodeURIComponent(jid)}/config`),

  toggleBot: (sessionId, jid, bot_enabled, bot_prompt, bot_mode) =>
    api.patch(`/whatsapp/session/${sessionId}/chat/${encodeURIComponent(jid)}/bot`,
      { bot_enabled, bot_prompt, bot_mode }),

  sendMedia: (sessionId, to, file, caption = '') => {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('to', to);
    formData.append('caption', caption);
    formData.append('file', file);
    return api.post('/whatsapp/send-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // ═══════════════════════════════════════════════════════
  // SESIONES BUSINESS (nuevos métodos)
  // ═══════════════════════════════════════════════════════

  // Sesión
  startBusinessSession:      () => api.post('/whatsapp/business/session/start'),
  getBusinessSessionStatus:  () => api.get('/whatsapp/business/session/status'),
  disconnectBusinessSession: () => api.delete('/whatsapp/business/session'),
  logoutBusinessSession:     () => api.delete('/whatsapp/business/session/logout'),

  // Chats
  getBusinessChats:    ()             => api.get('/whatsapp/business/chats'),
  getBusinessContacts: (search = '') => api.get(`/whatsapp/business/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getBusinessHistory: (jid, limit = 100) =>
    api.get(`/whatsapp/business/chat/${encodeURIComponent(jid)}?limit=${limit}`),

  // Config bot por chat
  getBusinessChatConfig: (jid) =>
    api.get(`/whatsapp/business/chat/${encodeURIComponent(jid)}/config`),

  toggleBusinessBot: (jid, bot_enabled, bot_prompt, bot_mode) =>
    api.patch(`/whatsapp/business/chat/${encodeURIComponent(jid)}/bot`,
      { bot_enabled, bot_prompt, bot_mode }),

  // Actualizar nombre de contacto
  updateBusinessContactName: (jid, contact_name) =>
    api.patch(`/whatsapp/business/chat/${encodeURIComponent(jid)}/contact-name`, { contact_name }),

  // Etiquetas
  updateBusinessChatLabels: (jid, labels) =>
    api.patch(`/whatsapp/business/chat/${encodeURIComponent(jid)}/labels`, { labels }),

  // Envío masivo
  broadcastBusiness: (message, jids, delay_ms = 1500) =>
    api.post('/whatsapp/business/broadcast', { message, jids, delay_ms }),

  // Mensajes
  mergeBusinessChats: (keepJid, discardJid) =>
    api.post('/whatsapp/business/merge-chats', { keepJid, discardJid }),

  sendBusinessMessage: (to, message) =>
    api.post('/whatsapp/business/send', { to, message }),

  sendBusinessMedia: (to, file, caption = '') => {
    const formData = new FormData();
    formData.append('to', to);
    formData.append('caption', caption);
    formData.append('file', file);
    return api.post('/whatsapp/business/send-media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};