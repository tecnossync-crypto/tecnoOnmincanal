// frontend/src/services/socket.js
import { io } from 'socket.io-client';

// In dev: proxy via Vite (socket.io proxied to localhost:3001)
// In production (Docker/nginx): use same origin so nginx proxy handles it
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

let socket = null;

export const initSocket = (userId) => {
  if (socket) {
    // Socket ya existe: actualizar userId y rejoin si ya está conectado
    if (userId && socket._setUserId) socket._setUserId(userId);
    if (userId && socket.connected) socket.emit('join:agents', userId);
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  });

  // Captura userId en closure para que reconnect automático siempre rejoins
  let _userId = userId;
  const rejoin = () => {
    if (_userId) socket.emit('join:agents', _userId);
  };

  socket.on('connect',   () => { console.log('🔌 Socket conectado:', socket.id); rejoin(); });
  socket.on('reconnect', () => { console.log('🔄 Socket reconectado'); rejoin(); });
  socket.on('disconnect', () => console.log('🔌 Socket desconectado'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  // Exponer setter para que initSocket con userId tardío lo registre
  socket._setUserId = (id) => { _userId = id; };

  return socket;
};

export const getSocket = () => socket;

export const joinConversation = (conversationId) => {
  socket?.emit('join:conversation', conversationId);
};

export const leaveConversation = (conversationId) => {
  socket?.emit('leave:conversation', conversationId);
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

export const joinWhatsappSession = (sessionId) => {
  socket?.emit('join:whatsapp', sessionId);
};
