// frontend/src/components/Inbox/WhatsappBusinessPanel.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWhatsappStore, useLabelStore, useAuthStore, useModuleStore } from '../../store';
import ModuleRecordModal from '../Modules/ModuleRecordModal';
import { whatsappApi } from '../../services/whatsappApi';
import { getSocket, joinWhatsappSession } from '../../services/socket';
import { notifyNewMessage, clearBadge, requestPermission } from '../../services/notificationService';
import { Search, Paperclip, Send, X, Briefcase, Bot, ChevronDown, ChevronUp, Edit2, Check, UserPlus, Tag, Plus, Radio, Zap, ClipboardList, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import GenerateDocModal from '../Templates/GenerateDocModal';

const STATUS_DOT = {
  connected:    'bg-emerald-500',
  connecting:   'bg-amber-400 animate-pulse',
  disconnected: 'bg-red-500',
  not_found:    'bg-slate-400',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-cyan-500',
  'bg-sky-500',  'bg-blue-600',   'bg-indigo-600', 'bg-violet-600'
];

const getAvatarColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name, jid) => {
  const n = name || jid?.replace('@s.whatsapp.net', '').replace('@lid', '') || '?';
  const words = n.trim().split(' ').filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  const now   = new Date();
  const diff  = now - date;
  if (diff < 86400000)  return date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return date.toLocaleDateString('es-DO', { weekday: 'short' });
  return date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatMsgTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
};

const chatDisplayName = (jid, name) =>
  name?.trim() || jid?.replace('@s.whatsapp.net', '').replace('@lid', '') || '';

export default function WhatsappBusinessPanel() {
  const {
    activeChat, setActiveChat,
    addMessage, getMessages, setChats,
    bizSessionId, bizStatus, bizChatList,
    setBizSession, setBizChatList, updateBizChatList,
  } = useWhatsappStore();

  const { labels: allLabels, fetchLabels } = useLabelStore();
  const { user } = useAuthStore();

  // Estado propio del panel business
  // Prioridad: 1) store Zustand (navegación SPA), 2) localStorage (recarga F5), 3) 'not_found'
  const [sessionId,     setSessionId]     = useState(
    bizSessionId || localStorage.getItem('wa_biz_sid') || null
  );
  const [sessionStatus, setSessionStatus] = useState(
    (bizStatus !== 'not_found' ? bizStatus : null) ||
    localStorage.getItem('wa_biz_status') ||
    'not_found'
  );
  const [qrImage,       setQrImage]       = useState(null);
  const [msgText,       setMsgText]       = useState('');
  const [loadingChats,  setLoadingChats]  = useState(false);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [chatList,      setChatList]      = useState(bizChatList);
  const [filtered,      setFiltered]      = useState(bizChatList);
  const [search,        setSearch]        = useState('');
  const [sending,       setSending]       = useState(false);
  const [showNewChat,      setShowNewChat]      = useState(false);
  const [newChatNumber,    setNewChatNumber]    = useState('');
  const [newChatName,      setNewChatName]      = useState('');
  const [contactList,      setContactList]      = useState([]);
  const [loadingContacts,  setLoadingContacts]  = useState(false);
  const [contactSearch,    setContactSearch]    = useState('');
  const [editingName,   setEditingName]   = useState(false);
  const [editNameVal,   setEditNameVal]   = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [pdfPreview,     setPdfPreview]     = useState(null); // { url, name }
  const [showBroadcast,   setShowBroadcast]   = useState(false);
  const [broadcastMsg,    setBroadcastMsg]    = useState('');
  const [broadcastJids,   setBroadcastJids]   = useState([]);
  const [quickMessages,   setQuickMessages]   = useState([]);
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [quickSearch,     setQuickSearch]     = useState('');
  const [showModulePicker,setShowModulePicker]= useState(false);
  const [showDocModal,    setShowDocModal]    = useState(false);
  const [showDocRequest,  setShowDocRequest]  = useState(false); // panel selector plantilla para colección bot
  const [docRequests,     setDocRequests]     = useState([]);   // solicitudes listas para revisión
  const [templates,       setTemplates]       = useState([]);   // plantillas disponibles
  const [sendingDoc,      setSendingDoc]      = useState(null); // id de solicitud en envío
  const [showMergeModal,  setShowMergeModal]  = useState(false);
  const [mergeDiscardJid, setMergeDiscardJid] = useState('');
  const [mergingChats,    setMergingChats]    = useState(false);
  const [moduleModal,     setModuleModal]     = useState(null); // module object
  const { modules } = useModuleStore();
  const [broadcastSending, setBroadcastSending] = useState(false);
  const labelPickerRef = useRef(null);
  const [syncing,       setSyncing]       = useState(false);
  const [activeBusinessChat, setActiveBusinessChat] = useState(null);

  // Refs para leer estado actual dentro de closures de socket
  const activeChatRef      = useRef(null);
  const sessionIdRef       = useRef(null);
  const sessionStatusRef   = useRef(sessionStatus); // estado actual sin stale-closure

  // ── Estado del bot por chat ───────────────────────────────
  const [showBotPanel,  setShowBotPanel]  = useState(false);
  const [botConfig,     setBotConfig]     = useState({ bot_enabled: false, bot_mode: 'generic', bot_prompt: '' });
  const [savingBot,     setSavingBot]     = useState(false);

  const bottomRef            = useRef(null);
  const fileRef              = useRef(null);
  const inputRef             = useRef(null);
  const loadChatsDebounceRef = useRef(null);
  const historyDebounceRef   = useRef(null);

  // Sincronizar estado local → store (navegación) y localStorage (recarga F5)
  useEffect(() => {
    setBizSession(sessionId, sessionStatus);
    if (sessionId) localStorage.setItem('wa_biz_sid', sessionId);
    else           localStorage.removeItem('wa_biz_sid');
    if (sessionStatus && sessionStatus !== 'not_found')
      localStorage.setItem('wa_biz_status', sessionStatus);
    else
      localStorage.removeItem('wa_biz_status');
  }, [sessionId, sessionStatus]);

  useEffect(() => { setBizChatList(chatList); }, [chatList]);

  const mapDbMsg = (m) => ({
    sessionId:     m.session_id,
    from:          m.jid,
    body:          m.body,
    timestamp:     Number(m.timestamp) || 0,   // BIGINT llega como string desde Sequelize
    fromMe:        m.from_me,
    pushName:      m.contact_name || '',
    contentType:   m.content_type || 'text',
    mediaUrl:      m.metadata?.media_url      || null,
    mediaMimetype: m.metadata?.media_mimetype || null,
    mediaFilename: m.metadata?.media_filename || null,
    externalId:    m.external_id || null,
  });

  // Mantener refs sincronizados con el estado actual (para closures de socket)
  useEffect(() => { activeChatRef.current    = activeBusinessChat; }, [activeBusinessChat]);
  useEffect(() => { sessionIdRef.current     = sessionId; },         [sessionId]);
  useEffect(() => { sessionStatusRef.current = sessionStatus; },     [sessionStatus]);

  // Cargar plantillas disponibles para solicitud de documentos
  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data || [])).catch(() => {});
  }, []);

  // Polling de respaldo: consulta BD cada 10 s mientras un chat está abierto.
  // Garantiza que los mensajes aparezcan aunque el socket no los entregue en tiempo real.
  useEffect(() => {
    if (!activeBusinessChat || !sessionId) return;
    const poll = async () => {
      try {
        const res    = await whatsappApi.getBusinessHistory(activeBusinessChat);
        const sid    = res.data?.sessionId || sessionId;
        const dbMsgs = (res.data?.messages || []).map(mapDbMsg);
        if (dbMsgs.length === 0) return;
        const existing = getMessages(sid, activeBusinessChat);
        // Comparar por timestamp del último mensaje — más fiable que por cantidad
        const lastDbTs  = dbMsgs[dbMsgs.length - 1]?.timestamp || 0;
        const lastMemTs = existing.length ? existing[existing.length - 1]?.timestamp || 0 : -1;
        if (lastDbTs === lastMemTs && dbMsgs.length <= existing.length) return;
        // Fusionar: BD como fuente de verdad + mensajes en memoria no guardados aún
        const merged = [...dbMsgs];
        for (const m of existing) {
          const dup = merged.some(x =>
            (m.externalId && x.externalId && m.externalId === x.externalId) ||
            (Number(x.timestamp) === Number(m.timestamp) && x.body === m.body)
          );
          if (!dup) merged.push(m);
        }
        merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setChats(sid, activeBusinessChat, merged);
        const last = merged[merged.length - 1];
        if (last) {
          setChatList(prev => prev.map(c => c.jid === activeBusinessChat
            ? { ...c, last_message: last.body, last_message_at: last.timestamp }
            : c
          ));
        }
      } catch (_) {}
    };
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [activeBusinessChat, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresco periódico de la lista de chats (cada 30 s).
  // Garantiza que los conteos de no leídos y el último mensaje se actualicen
  // aunque el socket no entregue el evento en tiempo real.
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'connected') return;
    const id = setInterval(() => loadChats(sessionId, true), 30000);
    return () => clearInterval(id);
  }, [sessionId, sessionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrar por búsqueda
  useEffect(() => {
    if (!search.trim()) { setFiltered(chatList); return; }
    const q = search.toLowerCase();
    setFiltered(chatList.filter(c =>
      chatDisplayName(c.jid, c.contact_name).toLowerCase().includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    ));
  }, [search, chatList]);

  // Cargar contactos del teléfono al abrir el panel "Nuevo chat"
  useEffect(() => {
    if (!showNewChat) { setContactSearch(''); return; }
    setLoadingContacts(true);
    whatsappApi.getBusinessContacts()
      .then(res => setContactList(res.data?.contacts || []))
      .catch(() => setContactList([]))
      .finally(() => setLoadingContacts(false));
  }, [showNewChat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-filtrar contactos al buscar (debounce ligero)
  const filteredContacts = contactSearch.trim()
    ? contactList.filter(c =>
        c.display_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.jid.includes(contactSearch.replace(/\D/g, ''))
      )
    : contactList;

  // Cerrar label picker al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target)) {
        setShowLabelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Carga inicial — sin socket
  useEffect(() => {
    requestPermission();
    fetchLabels();
    // hasCache: true si sessionStatus y sessionId ya vienen del store o localStorage
    // → en ese caso verificar en fondo sin mostrar loading
    const cachedSid    = bizSessionId    || localStorage.getItem('wa_biz_sid');
    const cachedStatus = bizStatus !== 'not_found' ? bizStatus : localStorage.getItem('wa_biz_status');
    const hasCache = !!cachedSid && !!cachedStatus && cachedStatus !== 'not_found';
    loadBusinessSession(hasCache);
    // Si hay sessionId cacheado, cargar chats en silencio sin esperar al API
    if (hasCache && cachedSid && cachedStatus === 'connected') {
      loadChats(cachedSid, true);
    }
    // Cargar mensajes rápidos
    api.get('/quick-messages?channel=whatsapp_business')
      .then(res => setQuickMessages(res.data || []))
      .catch(() => {});
  }, []);

  // Suscripción al socket — espera a que el usuario esté autenticado (socket inicializado)
  // user?.id cambia de undefined → ID real cuando fetchMe() completa, lo que inicializa el socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Unirse a la sala de la sesión cacheada (importante al recargar página)
    const cachedSid = sessionIdRef.current || localStorage.getItem('wa_biz_sid');
    if (cachedSid) joinWhatsappSession(cachedSid);

    const onQr = ({ sessionId: sid, qr, sessionType }) => {
      if (sessionType === 'business') setQrImage(qr);
    };

    const onStatus = ({ sessionId: sid, status, sessionType }) => {
      if (sessionType !== 'business') return;
      const wasConnected = sessionStatusRef.current === 'connected';
      setSessionStatus(status);
      setQrImage(null);
      if (status === 'connected') {
        setSessionId(sid);
        if (!wasConnected) {
          // Transición real: de no-conectado a conectado (primer QR scan o reconexión Baileys)
          toast.success('WhatsApp Business conectado');
          setSyncing(true);
          loadChats(sid);
        }
        // Si ya estábamos "conectados" localmente pero el socket acaba de reconectar,
        // la recarga la dispara el handler 'reconnect' del socket (ver abajo)
      }
      if (status === 'disconnected') toast.error('WhatsApp Business desconectado');
    };

    // ── Reconexión del socket: recargar chats que llegaron mientras estaba caído ──
    const onSocketReconnect = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      joinWhatsappSession(sid);
      // Pequeño delay para que el backend procese join:agents antes de hacer fetch
      setTimeout(() => loadChats(sid, true), 1000);
      // Si había un chat abierto, refrescar sus mensajes también
      const jid = activeChatRef.current;
      if (jid) {
        setTimeout(() => {
          whatsappApi.getBusinessHistory(jid).then(res => {
            const sid2 = res.data?.sessionId || sid;
            const dbMsgs = (res.data?.messages || []).map(mapDbMsg);
            if (dbMsgs.length === 0) return;
            setChats(sid2, jid, dbMsgs);
          }).catch(() => {});
        }, 1200);
      }
    };

    const onChatsSync = ({ sessionId: sid, sessionType }) => {
      if (sessionType !== 'business') return;
      setSyncing(false);

      // Debounce loadChats: múltiples batches seguidos solo disparan UNA recarga
      if (loadChatsDebounceRef.current) clearTimeout(loadChatsDebounceRef.current);
      loadChatsDebounceRef.current = setTimeout(() => loadChats(sid, true), 800);

      // Refrescar mensajes del chat abierto con debounce
      const jid  = activeChatRef.current;
      const sid2 = sessionIdRef.current || sid;
      if (jid && sid2) {
        if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
        historyDebounceRef.current = setTimeout(() => {
          whatsappApi.getBusinessHistory(jid).then(res => {
            const dbMsgs = (res.data?.messages || []).map(mapDbMsg);
            const existingMsgs = getMessages(res.data?.sessionId || sid2, jid);
            const merged = [...dbMsgs];
            for (const m of existingMsgs) {
              const dup = merged.some(x =>
                (m.externalId && x.externalId && m.externalId === x.externalId) ||
                (Number(x.timestamp) === Number(m.timestamp) && x.body === m.body)
              );
              if (!dup) merged.push(m);
            }
            merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            setChats(res.data?.sessionId || sid2, jid, merged);
          }).catch(() => {});
        }, 800);
      }
    };

    const onMessage = (msg) => {
      console.log('[ws:message]', msg?.sessionId, msg?.from, msg?.body?.slice?.(0, 40));
      if (!msg.sessionId?.startsWith('business_')) return;
      addMessage(msg.sessionId, msg);
      if (!msg.fromMe) {
        notifyNewMessage(msg);
        const nombre = msg.pushName || msg.from?.split('@')[0] || 'Cliente';
        toast(`${nombre}: ${(msg.body || '[media]').slice(0, 60)}`, { duration: 5000 });
      }
      setChatList(prev => {
        const exists = prev.find(c => c.jid === msg.from);
        if (exists) {
          return prev
            .map(c => c.jid === msg.from
              ? { ...c, last_message: msg.body, last_message_at: msg.timestamp, unread_count: msg.fromMe ? c.unread_count : (c.unread_count || 0) + 1 }
              : c
            ).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));
        }
        return [{
          jid: msg.from, contact_name: msg.pushName || '',
          last_message: msg.body, last_message_at: msg.timestamp, unread_count: msg.fromMe ? 0 : 1
        }, ...prev];
      });
    };

    const onDocReady = (data) => {
      // Siempre refrescar el chat activo — sin restricción de JID
      const jidToFetch = data?.jid || activeChatRef.current;
      if (jidToFetch) fetchDocRequests(jidToFetch);
      if (activeChatRef.current && activeChatRef.current !== jidToFetch) {
        fetchDocRequests(activeChatRef.current);
      }
      toast(`📄 Documento listo para revisar: ${data?.templateName || ''}`, { duration: 5000 });
    };

    socket.on('whatsapp:qr', onQr);
    socket.on('whatsapp:status', onStatus);
    socket.on('whatsapp:chats_synced', onChatsSync);
    socket.on('whatsapp:message', onMessage);
    socket.on('reconnect', onSocketReconnect);
    socket.on('document:ready', onDocReady);

    return () => {
      socket.off('whatsapp:qr', onQr);
      socket.off('whatsapp:status', onStatus);
      socket.off('whatsapp:chats_synced', onChatsSync);
      socket.off('whatsapp:message', onMessage);
      socket.off('reconnect', onSocketReconnect);
      socket.off('document:ready', onDocReady);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // El backend emite el QR y los eventos de la sesión a la sala `session:<sessionId>`,
  // así que el socket debe unirse a esa sala para poder recibirlos.
  useEffect(() => {
    if (sessionId) joinWhatsappSession(sessionId);
  }, [sessionId]);

  const loadBusinessSession = async (background = false) => {
    try {
      const res = await whatsappApi.getBusinessSessionStatus();
      const { sessionId: sid, status } = res.data;
      if (sid) joinWhatsappSession(sid);
      setSessionId(sid);
      setSessionStatus(status);
      if (status === 'connected' && !background) loadChats(sid);
      if (background && status !== bizStatus) {
        if (status === 'connected') loadChats(sid, true);
        else setChatList([]);
      }
    } catch {
      if (!background) setSessionStatus('not_found');
    }
  };

  const loadChats = async (sid, silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const res = await whatsappApi.getBusinessChats();
      setChatList(res.data?.chats || []);
      if (sid) setSessionId(res.data?.sessionId || sid);
    } catch {
      if (!silent) setChatList([]);
    } finally {
      if (!silent) setLoadingChats(false);
    }
  };

  const handleConnect = async () => {
    try {
      setQrImage(null);
      setSessionStatus('connecting');
      const res = await whatsappApi.startBusinessSession();
      const sid  = res.data.sessionId;
      // Unirse INMEDIATAMENTE para no perder el evento QR
      joinWhatsappSession(sid);
      setSessionId(sid);
      if (res.data.status === 'connected') {
        loadChats(sid);
      } else if (res.data.status !== 'connecting') {
        toast.success('Escanea el QR con tu WhatsApp Business');
      }
    } catch (e) {
      toast.error(e.message);
      setSessionStatus('disconnected');
    }
  };

  const clearBizStorage = () => {
    localStorage.removeItem('wa_biz_sid');
    localStorage.removeItem('wa_biz_status');
  };

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnectBusinessSession();
      clearBizStorage();
      setSessionStatus('disconnected');
      setQrImage(null);
      setChatList([]);
      setActiveBusinessChat(null);
      setShowBotPanel(false);
      toast.success('Sesión desconectada');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('ATENCIÓN: Cerrar sesión borra las credenciales y obliga a escanear un QR nuevo. WhatsApp enviará miles de mensajes históricos al reconectarse (sync de 1-2 min). ¿Continuar?')) return;
    try {
      await whatsappApi.logoutBusinessSession();
      clearBizStorage();
      setSessionStatus('not_found');
      setSessionId(null);
      setQrImage(null);
      setChatList([]);
      setActiveBusinessChat(null);
      setShowBotPanel(false);
      toast.success('Sesión cerrada completamente');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const messages = (sessionId && activeBusinessChat
    ? getMessages(sessionId, activeBusinessChat)
    : []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const fetchDocRequests = useCallback(async (jid) => {
    if (!jid) return;
    try {
      const res = await api.get(`/document-requests?jid=${encodeURIComponent(jid)}&status=ready`);
      setDocRequests(res.data?.data || []);
    } catch (_) {}
  }, []);

  // Recargar solicitudes cuando cambia el chat activo
  useEffect(() => {
    if (activeBusinessChat) fetchDocRequests(activeBusinessChat);
    else setDocRequests([]);
  }, [activeBusinessChat, fetchDocRequests]);

  const handleOpenChat = useCallback(async (jid) => {
    setActiveBusinessChat(jid);
    setShowBotPanel(false);
    setEditingName(false);
    setShowDocRequest(false);
    clearBadge();
    setLoadingMsgs(true);
    fetchDocRequests(jid);
    try {
      const [histRes, cfgRes] = await Promise.all([
        whatsappApi.getBusinessHistory(jid),
        whatsappApi.getBusinessChatConfig(jid)
      ]);
      const dbMsgs = (histRes.data?.messages || []).map(mapDbMsg);
      // Fusionar con mensajes en el store (socket) evitando duplicados
      const existingMsgs = getMessages(histRes.data?.sessionId || sessionId, jid);
      const merged = [...dbMsgs];
      for (const m of existingMsgs) {
        const dup = merged.some(x =>
          (m.externalId && x.externalId && m.externalId === x.externalId) ||
          (Number(x.timestamp) === Number(m.timestamp) && x.body === m.body)
        );
        if (!dup) merged.push(m);
      }
      merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setChats(histRes.data?.sessionId || sessionId, jid, merged);
      const cfg = cfgRes.data || {};
      setBotConfig({
        bot_enabled: cfg.bot_enabled || false,
        bot_mode:    cfg.bot_mode    || 'generic',
        bot_prompt:  cfg.bot_prompt  || ''
      });
      // Sincronizar etiquetas desde DB al abrir el chat
      setChatList(prev => prev.map(c => c.jid === jid
        ? { ...c, unread_count: 0, labels: cfg.labels || c.labels || [] }
        : c
      ));
    } catch {
      toast.error('No se pudo cargar el historial');
    } finally {
      setLoadingMsgs(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [sessionId]);

  const handleDownloadDoc = async (req) => {
    try {
      const token = localStorage.getItem('token');
      const res  = await fetch(`/api/document-requests/${req.id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { toast.error('Error al descargar el documento'); return; }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = `${req.template?.name || 'documento'}.docx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch { toast.error('Error al descargar'); }
  };

  const handleSendDocRequest = async (docReqId) => {
    setSendingDoc(docReqId);
    try {
      await api.post(`/document-requests/${docReqId}/send`);
      toast.success('Documento enviado al cliente');
      setDocRequests(prev => prev.filter(r => r.id !== docReqId));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error enviando documento';
      toast.error(msg);
    } finally {
      setSendingDoc(null);
    }
  };

  const handleRejectDocRequest = async (docReqId) => {
    try {
      await api.post(`/document-requests/${docReqId}/reject`);
      toast.success('Solicitud rechazada');
      setDocRequests(prev => prev.filter(r => r.id !== docReqId));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStartDocCollection = async (templateId) => {
    if (!activeBusinessChat || !sessionId) return;
    try {
      await api.post('/document-requests/start', { templateId, jid: activeBusinessChat, sessionId });
      toast.success('Recolección iniciada — el bot preguntará los datos al cliente');
      setShowDocRequest(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleBot = async () => {
    if (!activeBusinessChat) return;
    const newEnabled = !botConfig.bot_enabled;
    setBotConfig(c => ({ ...c, bot_enabled: newEnabled }));
    try {
      await whatsappApi.toggleBusinessBot(activeBusinessChat, newEnabled, botConfig.bot_prompt, botConfig.bot_mode);
    } catch (e) {
      // Revertir si falla
      setBotConfig(c => ({ ...c, bot_enabled: !newEnabled }));
      toast.error('No se pudo cambiar el bot');
    }
  };

  const handleSaveBotConfig = async () => {
    if (!activeBusinessChat) return;
    setSavingBot(true);
    try {
      await whatsappApi.toggleBusinessBot(
        activeBusinessChat,
        botConfig.bot_enabled,
        botConfig.bot_prompt,
        botConfig.bot_mode
      );
      toast.success('Configuración del bot guardada');
      setShowBotPanel(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingBot(false);
    }
  };

  const handleStartNewChat = async () => {
    if (!newChatNumber.trim() || !sessionId) return;
    const number = newChatNumber.trim().replace(/[\s\-\(\)]/g, '');
    const jid    = number.includes('@') ? number : `${number}@s.whatsapp.net`;
    const name   = newChatName.trim();
    await _openNewContact(jid, name);
  };

  const handleStartNewChatDirect = async (jid, name) => {
    if (!jid || !sessionId) return;
    await _openNewContact(jid, name || '');
  };

  const _openNewContact = async (jid, name) => {
    setShowNewChat(false);
    setNewChatNumber('');
    setNewChatName('');
    setContactSearch('');
    if (!chatList.find(c => c.jid === jid)) {
      setChatList(prev => [{ jid, contact_name: name, last_message: '', last_message_at: 0, unread_count: 0, labels: [] }, ...prev]);
    } else if (name) {
      setChatList(prev => prev.map(c => c.jid === jid ? { ...c, contact_name: name } : c));
    }
    if (name) {
      try { await whatsappApi.updateBusinessContactName(jid, name); } catch {}
    }
    await handleOpenChat(jid);
  };

  const handleSaveContactName = async () => {
    if (!activeBusinessChat) return;
    const name = editNameVal.trim();
    setEditingName(false);
    setChatList(prev => prev.map(c => c.jid === activeBusinessChat ? { ...c, contact_name: name } : c));
    try {
      await whatsappApi.updateBusinessContactName(activeBusinessChat, name);
      toast.success('Nombre actualizado');
    } catch {
      toast.error('No se pudo guardar el nombre');
    }
  };

  // ── Helpers de etiquetas ──────────────────────────────
  const currentLabels = activeBusinessChat
    ? (chatList.find(c => c.jid === activeBusinessChat)?.labels || [])
    : [];

  const handleAddLabel = async (labelId) => {
    if (!activeBusinessChat || currentLabels.includes(labelId)) return;
    const next = [...currentLabels, labelId];
    setChatList(prev => prev.map(c => c.jid === activeBusinessChat ? { ...c, labels: next } : c));
    setShowLabelPicker(false);
    try { await whatsappApi.updateBusinessChatLabels(activeBusinessChat, next); }
    catch { toast.error('Error al guardar etiqueta'); }
  };

  const handleRemoveLabel = async (labelId) => {
    if (!activeBusinessChat) return;
    const next = currentLabels.filter(id => id !== labelId);
    setChatList(prev => prev.map(c => c.jid === activeBusinessChat ? { ...c, labels: next } : c));
    try { await whatsappApi.updateBusinessChatLabels(activeBusinessChat, next); }
    catch { toast.error('Error al quitar etiqueta'); }
  };

  // ── Broadcast ─────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim() || broadcastJids.length === 0) return;
    setBroadcastSending(true);
    try {
      await whatsappApi.broadcastBusiness(broadcastMsg.trim(), broadcastJids);
      toast.success(`Envío iniciado a ${broadcastJids.length} contactos`);
      setShowBroadcast(false);
      setBroadcastMsg('');
      setBroadcastJids([]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleMergeChats = async () => {
    if (!mergeDiscardJid || !activeBusinessChat || mergingChats) return;
    if (!window.confirm(`¿Unificar la conversación "${mergeDiscardJid.replace('@s.whatsapp.net','')}" con la actual?\nLos mensajes se moverán aquí y la otra conversación se eliminará.`)) return;
    setMergingChats(true);
    try {
      await whatsappApi.mergeBusinessChats(activeBusinessChat, mergeDiscardJid);
      setChatList(prev => prev.filter(c => c.jid !== mergeDiscardJid));
      setShowMergeModal(false);
      setMergeDiscardJid('');
      toast.success('Conversaciones unificadas');
      // Recargar mensajes del chat activo desde la BD
      const res = await whatsappApi.getBusinessHistory(activeBusinessChat);
      const dbMsgs = (res.data?.messages || []).map(mapDbMsg);
      setChats(res.data?.sessionId || sessionId, activeBusinessChat, dbMsgs);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMergingChats(false);
    }
  };

  const handleSend = async () => {
    if (!msgText.trim() || !sessionId || !activeBusinessChat || sending) return;
    const text = msgText.trim();
    setMsgText('');
    setSending(true);
    try {
      const res = await whatsappApi.sendBusinessMessage(activeBusinessChat, text);
      const msgTs    = res.data?.timestamp || Math.floor(Date.now() / 1000);
      const extId    = res.data?.externalId || null;
      addMessage(sessionId, {
        sessionId, from: activeBusinessChat, body: text,
        timestamp: msgTs, fromMe: true,
        contentType: 'text', mediaUrl: null, externalId: extId
      });
      setChatList(prev => prev.map(c =>
        c.jid === activeBusinessChat
          ? { ...c, last_message: text, last_message_at: msgTs }
          : c
      ).sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0)));
    } catch (e) {
      toast.error(e.message);
      setMsgText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

const handleSendMedia = async (e) => {
  const file = e.target.files[0];
  if (!file || !sessionId || !activeBusinessChat) return;
  setSending(true);
  try {
    await whatsappApi.sendBusinessMedia(activeBusinessChat, file);
    
    // ── NUEVO: agregar mensaje localmente para que aparezca ──
    const isImage = file.type.startsWith('image/');
    const localUrl = URL.createObjectURL(file);
    addMessage(sessionId, {
      sessionId,
      from:        activeBusinessChat,
      body:        isImage ? '' : file.name,
      timestamp:   Math.floor(Date.now() / 1000),
      fromMe:      true,
      contentType: isImage ? 'image' : 'document',
      mediaUrl:    localUrl
    });

    toast.success('Archivo enviado');
  } catch (err) {
    toast.error(err.message);
  } finally {
    setSending(false);
    e.target.value = '';
  }
};

  const activeContactName = activeBusinessChat
    ? chatDisplayName(activeBusinessChat, chatList.find(c => c.jid === activeBusinessChat)?.contact_name)
    : '';

  // ── Estado: sin sesión conectada ─────────────────────────
  if (sessionStatus === 'not_found' || sessionStatus === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Briefcase className="w-10 h-10 text-blue-500" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-700">WhatsApp Business</p>
          <p className="text-sm text-slate-400 mt-1">
            {sessionStatus === 'disconnected'
              ? 'La sesión fue desconectada. Las credenciales están guardadas.'
              : 'Conecta tu número empresarial para atender clientes'}
          </p>
        </div>
        <button
          onClick={handleConnect}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {sessionStatus === 'disconnected' ? 'Reconectar' : 'Conectar número business'}
        </button>
        {sessionStatus === 'disconnected' && (
          <button
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors underline"
          >
            Cerrar sesión completamente (nuevo QR)
          </button>
        )}
      </div>
    );
  }

  // ── Estado: conectando / mostrando QR ────────────────────
  if (sessionStatus === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8 text-center">
        {qrImage ? (
          <>
            <p className="text-sm font-medium text-slate-600">Escanea con tu WhatsApp Business</p>
            <img src={qrImage} alt="QR Business" className="w-64 h-64 rounded-2xl shadow-lg border-4 border-blue-100" />
            <p className="text-xs text-slate-400">Abre WhatsApp Business → Dispositivos vinculados → Vincular dispositivo</p>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-400 transition-colors underline mt-2">
              Cancelar y cerrar sesión
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full" />
            <div>
              <p className="text-sm font-semibold text-slate-600">Reconectando...</p>
              <p className="text-xs text-slate-400 mt-1">Restaurando sesión anterior, espera un momento</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-400 transition-colors underline">
              Cancelar y cerrar sesión
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Estado: conectado ─────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden bg-[#f0f4f8]">

      {/* ── PANEL IZQUIERDO ─────────────────────────────── */}
      <div className="w-[380px] flex-shrink-0 flex flex-col bg-white border-r border-[#e2e8f0]">

        {/* Header */}
        <div className="bg-[#ebf4ff] px-4 py-3 flex items-center justify-between border-b border-[#dbeafe]">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">WhatsApp Business</span>
            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[sessionStatus]}`} />
          </div>
          <div className="flex items-center gap-1">
            {sessionStatus === 'connected' && (
              <>
                <button
                  onClick={() => setShowBroadcast(true)}
                  className="p-2 text-blue-400 hover:bg-blue-100 rounded-full transition-colors"
                  title="Envío masivo"
                >
                  <Radio size={15} />
                </button>
                <button
                  onClick={() => setShowNewChat(!showNewChat)}
                  className="p-2 text-blue-400 hover:bg-blue-100 rounded-full transition-colors"
                  title="Nuevo chat"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={handleDisconnect}
              className="p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-400 rounded-full transition-colors"
              title="Desconectar (conserva credenciales)"
            >
              <X size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-400 rounded-full transition-colors"
              title="Cerrar sesión completamente"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Nuevo chat */}
        {showNewChat && (
          <div className="bg-white border-b border-[#e2e8f0] flex flex-col" style={{ maxHeight: '420px' }}>
            {/* Header del panel */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                <UserPlus size={13} /> Nueva conversación
              </div>
              <button onClick={() => { setShowNewChat(false); setNewChatName(''); setNewChatNumber(''); setContactSearch(''); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X size={14} />
              </button>
            </div>

            {/* Búsqueda de contactos */}
            <div className="px-3 pt-2.5 pb-1">
              <div className="flex items-center gap-2 bg-[#f0f4f8] rounded-lg px-2.5 py-1.5">
                <Search size={13} className="text-slate-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowNewChat(false); }}
                  placeholder="Buscar contacto o número..."
                  className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
                />
                {contactSearch && <button onClick={() => setContactSearch('')} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
              </div>
            </div>

            {/* Lista de contactos del teléfono */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              {loadingContacts ? (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Cargando contactos...</span>
                </div>
              ) : filteredContacts.length > 0 ? (
                <div className="py-1">
                  {filteredContacts.map(contact => {
                    const initials = getInitials(contact.contact_name, contact.jid);
                    const color    = getAvatarColor(contact.display_name);
                    const phone    = contact.jid.replace('@s.whatsapp.net', '');
                    return (
                      <button
                        key={contact.jid}
                        onClick={() => {
                          setNewChatNumber(phone);
                          setNewChatName(contact.contact_name || '');
                          handleStartNewChatDirect(contact.jid, contact.contact_name);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#f0f4f8] transition-colors text-left"
                      >
                        <div className={`w-8 h-8 rounded-full ${color} text-white flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{contact.display_name}</p>
                          <p className="text-xs text-slate-400 truncate">+{phone}</p>
                        </div>
                        {contact.has_chat && (
                          <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Chat</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-5">
                  {contactSearch ? 'Sin resultados' : 'Sin contactos sincronizados aún'}
                </p>
              )}
            </div>

            {/* Entrada manual de número */}
            <div className="px-3 pb-3 pt-2 border-t border-[#e2e8f0]">
              <p className="text-[10px] text-slate-400 mb-1.5 font-medium uppercase tracking-wide">O ingresa el número manualmente</p>
              <div className="flex gap-2">
                <input
                  value={newChatNumber}
                  onChange={e => setNewChatNumber(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStartNewChat(); }}
                  placeholder="Ej: 18091234567"
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-[#f0f4f8]"
                />
                <button
                  onClick={handleStartNewChat}
                  disabled={!newChatNumber.trim()}
                  className="px-3 py-2 bg-blue-500 text-white text-sm rounded-lg font-medium hover:bg-blue-600 disabled:bg-slate-300 transition-colors"
                >
                  Iniciar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="px-3 py-2 bg-white border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2 bg-[#f0f4f8] rounded-lg px-3 py-2">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversación..."
              className="flex-1 text-sm bg-transparent outline-none text-slate-700 placeholder-slate-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats || syncing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              <span className="text-sm text-slate-400">{syncing ? 'Sincronizando...' : 'Cargando chats...'}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {search ? 'Sin resultados' : 'Sin conversaciones aún'}
            </div>
          ) : (
            filtered.map(chat => {
              const name     = chatDisplayName(chat.jid, chat.contact_name);
              const isActive = activeBusinessChat === chat.jid;
              const color    = getAvatarColor(name);
              const initials = getInitials(chat.contact_name, chat.jid);
              return (
                <div
                  key={chat.jid}
                  onClick={() => handleOpenChat(chat.jid)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[#e2e8f0] transition-colors ${
                    isActive ? 'bg-[#ebf4ff]' : 'hover:bg-[#f5f8ff]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full ${color} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#111b21] truncate">{name}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {chat.last_message || 'Sin mensajes'}
                      </p>
                      <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {/* Puntos de etiquetas */}
                        {(chat.labels || []).slice(0, 3).map(labelId => {
                          const lbl = allLabels.find(l => l.id === labelId);
                          return lbl ? (
                            <span key={labelId} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: lbl.color || '#6366f1' }} title={lbl.nombre} />
                          ) : null;
                        })}
                        {chat.unread_count > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-medium flex-shrink-0">
                            {chat.unread_count > 99 ? '99+' : chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: CHAT ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeBusinessChat ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f0f4f8]">
            <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center">
              <Briefcase className="w-12 h-12 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-light text-[#41525d]">WhatsApp Business</p>
              <p className="text-sm text-slate-400 mt-2">Selecciona un chat para comenzar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header del chat */}
            <div className="bg-[#ebf4ff] px-4 py-3 flex items-center justify-between border-b border-[#dbeafe] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(activeContactName)} text-white flex items-center justify-center font-semibold text-sm flex-shrink-0`}>
                  {getInitials(chatList.find(c => c.jid === activeBusinessChat)?.contact_name, activeBusinessChat)}
                </div>
                <div>
                  {editingName ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editNameVal}
                        onChange={e => setEditNameVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveContactName(); if (e.key === 'Escape') setEditingName(false); }}
                        className="text-sm font-semibold text-[#111b21] border border-blue-300 rounded-lg px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-400 bg-white w-40"
                      />
                      <button onClick={handleSaveContactName} className="p-1 text-green-600 hover:bg-green-100 rounded-full">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingName(false)} className="p-1 text-red-400 hover:bg-red-100 rounded-full">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <p className="text-sm font-semibold text-[#111b21]">{activeContactName}</p>
                      <button
                        onClick={() => { setEditNameVal(chatList.find(c => c.jid === activeBusinessChat)?.contact_name || ''); setEditingName(true); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded-full transition-all"
                        title="Editar nombre"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">{activeBusinessChat.replace('@s.whatsapp.net', '')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Etiquetas asignadas */}
                {currentLabels.map(labelId => {
                  const lbl = allLabels.find(l => l.id === labelId);
                  if (!lbl) return null;
                  return (
                    <span
                      key={labelId}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium text-white"
                      style={{ background: lbl.color || '#6366f1' }}
                    >
                      {lbl.nombre}
                      <button onClick={() => handleRemoveLabel(labelId)} className="rounded-full hover:bg-black/20 p-0.5">
                        <X size={9} />
                      </button>
                    </span>
                  );
                })}

                {/* Picker de etiquetas */}
                <div className="relative" ref={labelPickerRef}>
                  <button
                    onClick={() => setShowLabelPicker(v => !v)}
                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded-full transition-colors"
                    title="Etiquetas"
                  >
                    <Tag size={14} />
                  </button>
                  {showLabelPicker && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden">
                      {allLabels.filter(l => l.activo !== false && !currentLabels.includes(l.id)).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">Sin etiquetas disponibles</p>
                      ) : (
                        <div className="py-1 max-h-48 overflow-y-auto">
                          {allLabels.filter(l => l.activo !== false && !currentLabels.includes(l.id)).map(lbl => (
                            <button
                              key={lbl.id}
                              onClick={() => handleAddLabel(lbl.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                            >
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: lbl.color || '#6366f1' }} />
                              <span className="text-sm text-slate-700 truncate">{lbl.nombre}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Briefcase size={11} /> Business
                </span>
                <button
                  onClick={() => { setShowMergeModal(v => !v); setMergeDiscardJid(''); }}
                  title="Unificar con otra conversación"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6H21"/><path d="M8 12H21"/><path d="M8 18H21"/><path d="M3 6l0 .01"/><path d="M3 12l0 .01"/><path d="M3 18l0 .01"/></svg>
                  <span>Unificar</span>
                </button>
                <button
                  onClick={() => setShowBotPanel(v => !v)}
                  title="Configurar bot"
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    botConfig.bot_enabled
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  <Bot size={13} />
                  <span>{botConfig.bot_enabled ? 'Bot ON' : 'Bot'}</span>
                  {showBotPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>
            </div>

            {/* Modal Unificar conversaciones */}
            {showMergeModal && (
              <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-orange-700 mb-1">Unificar — selecciona la conversación a absorber en esta:</p>
                  <select
                    value={mergeDiscardJid}
                    onChange={e => setMergeDiscardJid(e.target.value)}
                    className="w-full text-sm border border-orange-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-orange-300"
                  >
                    <option value="">— Seleccionar conversación —</option>
                    {chatList
                      .filter(c => c.jid !== activeBusinessChat)
                      .map(c => (
                        <option key={c.jid} value={c.jid}>
                          {c.contact_name?.trim() || c.jid.replace('@s.whatsapp.net', '')}
                          {' '}({c.jid.replace('@s.whatsapp.net', '')})
                        </option>
                      ))
                    }
                  </select>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={handleMergeChats}
                    disabled={!mergeDiscardJid || mergingChats}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {mergingChats ? 'Unificando…' : 'Unificar'}
                  </button>
                  <button
                    onClick={() => { setShowMergeModal(false); setMergeDiscardJid(''); }}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Panel de configuración del bot */}
            {showBotPanel && (
              <div className="bg-white border-b border-[#e2e8f0] px-4 py-4 flex flex-col gap-3 flex-shrink-0 shadow-sm">
                {/* Toggle activar bot */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot size={16} className="text-blue-500" />
                    <span className="text-sm font-semibold text-slate-700">Bot automático</span>
                  </div>
                  <button
                    onClick={handleToggleBot}
                    className={`relative w-11 h-6 rounded-full transition-colors ${botConfig.bot_enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${botConfig.bot_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {botConfig.bot_enabled && (
                  <>
                    {/* Selector de modo */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBotConfig(c => ({ ...c, bot_mode: 'generic' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          botConfig.bot_mode === 'generic'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        Bot Genérico
                        <span className="block text-[10px] opacity-70 font-normal mt-0.5">Usa configuración global</span>
                      </button>
                      <button
                        onClick={() => setBotConfig(c => ({ ...c, bot_mode: 'custom' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                          botConfig.bot_mode === 'custom'
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        Bot Personalizado
                        <span className="block text-[10px] opacity-70 font-normal mt-0.5">Prompt propio para este chat</span>
                      </button>
                    </div>

                    {/* Prompt personalizado */}
                    {botConfig.bot_mode === 'custom' && (
                      <textarea
                        value={botConfig.bot_prompt}
                        onChange={e => setBotConfig(c => ({ ...c, bot_prompt: e.target.value }))}
                        placeholder="Escribe las instrucciones del bot para este cliente... Ej: Eres un asesor de ventas especializado en seguros de vida. El cliente se llama Juan y tiene interés en el plan Premium."
                        rows={4}
                        className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 bg-slate-50"
                      />
                    )}

                    {/* Indicador de memoria */}
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      Memoria activa · recuerda los últimos 20 mensajes del cliente
                    </div>
                  </>
                )}

                {/* Botón guardar */}
                <button
                  onClick={handleSaveBotConfig}
                  disabled={savingBot}
                  className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {savingBot ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            )}

            {/* Mensajes */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-1"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23bfdbfe' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#e8f0fe'
              }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full gap-2">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-slate-500">Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="bg-white/80 rounded-lg px-4 py-2 text-sm text-slate-500 shadow-sm">
                    Sin mensajes en este chat
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
const fullUrl      = msg.mediaUrl || msg.metadata?.media_url || null;
const mediaMime    = msg.mediaMimetype || msg.metadata?.media_mimetype || '';
const mediaFname   = msg.mediaFilename || msg.metadata?.media_filename || msg.body || 'archivo';
const showDate     = i === 0 || Math.floor(msg.timestamp / 86400) !== Math.floor(messages[i-1]?.timestamp / 86400);
const isPdf        = mediaMime === 'application/pdf' || mediaFname.toLowerCase().endsWith('.pdf');
const isWord       = mediaMime.includes('wordprocessingml') || ['doc','docx'].includes(mediaFname.split('.').pop()?.toLowerCase());
const isExcel      = mediaMime.includes('spreadsheetml') || ['xls','xlsx'].includes(mediaFname.split('.').pop()?.toLowerCase());
const docExt       = mediaFname.split('.').pop()?.toUpperCase() || 'DOC';

const renderTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, pi) =>
    urlRegex.test(part)
      ? <a key={pi} href={part} target="_blank" rel="noreferrer" className="text-blue-500 underline break-all">{part}</a>
      : part
  );
};

                  return (
                    <React.Fragment key={i}>
                      {showDate && (
                        <div className="flex justify-center my-2">
                          <span className="bg-white/80 text-xs text-slate-500 px-3 py-1 rounded-full shadow-sm">
                            {new Date((msg.timestamp || 0) * 1000).toLocaleDateString('es-DO', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[65%] rounded-lg shadow-sm overflow-hidden ${
                            msg.fromMe ? 'bg-[#dbeafe]' : 'bg-white'
                          }`}
                          style={{ borderRadius: msg.fromMe ? '8px 0px 8px 8px' : '0px 8px 8px 8px' }}
                        >
                          {/* ── Imagen / Sticker ── */}
                          {msg.contentType === 'image' && (() => {
                            const isSticker = msg.body === '[Sticker]';
                            if (fullUrl) {
                              return (
                                <div className={isSticker ? 'p-1' : ''}>
                                  <img
                                    src={fullUrl}
                                    alt={isSticker ? 'sticker' : 'imagen'}
                                    className={`cursor-pointer block ${isSticker
                                      ? 'w-[140px] h-[140px] object-contain'
                                      : 'max-w-[280px] w-full'
                                    }`}
                                    onClick={() => window.open(fullUrl, '_blank')}
                                    onError={e => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'flex');
                                    }}
                                  />
                                  <div className="hidden items-center gap-2 px-3 py-2 text-xs text-slate-400">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v14.25c0 .414.336.75.75.75z"/>
                                    </svg>
                                    {isSticker ? 'Sticker' : 'Imagen'} no accesible
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v14.25c0 .414.336.75.75.75z"/>
                                </svg>
                                {isSticker ? 'Sticker' : 'Imagen'} no disponible
                              </div>
                            );
                          })()}

                          {/* ── Audio / Nota de voz ── */}
                          {msg.contentType === 'audio' && (() => {
                            if (fullUrl) {
                              const baseType = (mediaMime || '').split(';')[0].trim();
                              return (
                                <div className="px-3 pt-2.5 pb-2 flex items-center gap-2 min-w-[220px]">
                                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" fill="currentColor">
                                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10a1 1 0 00-2 0 5 5 0 01-10 0 1 1 0 00-2 0 7 7 0 0013.32 2.19L18 12a1 1 0 001-1z"/>
                                    </svg>
                                  </div>
                                  <audio controls preload="metadata" className="flex-1 h-9" style={{ minWidth: 0 }}>
                                    {baseType && <source src={fullUrl} type={baseType} />}
                                    <source src={fullUrl} type="audio/ogg" />
                                    <source src={fullUrl} type="audio/mpeg" />
                                    <source src={fullUrl} type="audio/mp4" />
                                  </audio>
                                </div>
                              );
                            }
                            return (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                                </svg>
                                Nota de voz no disponible
                              </div>
                            );
                          })()}

                          {/* ── Video ── */}
                          {msg.contentType === 'video' && (fullUrl ? (
                            <video controls preload="metadata" className="max-w-[280px] w-full block rounded">
                              <source src={fullUrl} type={mediaMime || 'video/mp4'} />
                              <source src={fullUrl} type="video/mp4" />
                            </video>
                          ) : (
                            <div className="px-3 py-2 text-xs text-slate-400 italic">Video no disponible</div>
                          ))}

                          {/* ── Documento ── */}
                          {msg.contentType === 'document' && (
                            <div className="flex items-center gap-3 px-3 py-2.5 min-w-[220px]">
                              {/* Icono por tipo */}
                              {isPdf ? (
                                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-red-600">PDF</span>
                                </div>
                              ) : isWord ? (
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-blue-700">DOC</span>
                                </div>
                              ) : isExcel ? (
                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-green-700">XLS</span>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[9px] font-bold text-slate-500">{docExt.slice(0,4)}</span>
                                </div>
                              )}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-slate-700 truncate max-w-[160px]">{mediaFname}</span>
                                {fullUrl ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    {isPdf && (
                                      <button
                                        onClick={() => setPdfPreview({ url: fullUrl, name: mediaFname })}
                                        className="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full font-medium transition-colors"
                                      >
                                        Previsualizar
                                      </button>
                                    )}
                                    <a
                                      href={fullUrl} target="_blank" rel="noreferrer"
                                      download={mediaFname}
                                      className="text-[10px] text-slate-500 hover:text-slate-700 underline"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      Descargar
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">No disponible</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── Texto (con URLs clickeables) ── */}
                          {msg.body
                            && msg.body !== '[Sticker]'
                            && msg.body !== '[Audio]'
                            && msg.body !== '[Video]'
                            && msg.contentType !== 'document'
                            && msg.contentType !== 'audio'
                            && (
                            <p className="px-3 py-2 text-sm text-[#111b21] leading-relaxed whitespace-pre-wrap">
                              {renderTextWithLinks(msg.body)}
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-1 px-3 pb-1 -mt-1">
                            <span className="text-[11px] text-slate-400">{formatMsgTime(msg.timestamp)}</span>
                            {msg.fromMe && (
                              <svg viewBox="0 0 16 11" className="w-3.5 h-3.5 text-blue-400" fill="currentColor">
                                <path d="M11.071.653a.45.45 0 0 0-.63 0l-5.741 5.74-2.194-2.193a.45.45 0 0 0-.63.639l2.512 2.511a.45.45 0 0 0 .63 0l6.062-6.061a.45.45 0 0 0-.009-.636z"/>
                                <path d="M15.071.653a.45.45 0 0 0-.63 0l-5.741 5.74-.508-.507a.45.45 0 0 0-.63.638l.826.826a.45.45 0 0 0 .63 0l6.062-6.061a.45.45 0 0 0-.009-.636z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Banner documentos listos para revisión ── */}
            {docRequests.length > 0 && (
              <div className="mx-4 my-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-amber-100">
                  <FileText size={14} className="text-amber-600 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-800">
                    {docRequests.length} documento{docRequests.length > 1 ? 's' : ''} listo{docRequests.length > 1 ? 's' : ''} para revisar
                  </span>
                </div>
                {docRequests.map(req => (
                  <div key={req.id} className="px-3 py-2 border-b border-amber-100 last:border-0">
                    <p className="text-xs font-semibold text-slate-700 truncate mb-2">{req.template?.name || 'Documento'}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleDownloadDoc(req)}
                        className="px-2 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
                      >
                        <FileText size={11} /> Descargar
                      </button>
                      <button
                        onClick={() => handleSendDocRequest(req.id)}
                        disabled={sendingDoc === req.id}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center gap-1"
                      >
                        <Send size={11} /> {sendingDoc === req.id ? 'Enviando…' : 'Enviar al cliente'}
                      </button>
                      <button
                        onClick={() => handleRejectDocRequest(req.id)}
                        className="px-2 py-1 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Selector de plantilla para recolección bot ── */}
            {showDocRequest && (
              <div className="mx-4 mb-2 rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
                <div className="px-3 py-2 flex items-center justify-between border-b border-indigo-100">
                  <span className="text-xs font-semibold text-indigo-800">Solicitar datos al cliente</span>
                  <button onClick={() => setShowDocRequest(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {templates.filter(t => (t.fields || []).some(f => f.source === 'manual')).length === 0 ? (
                    <p className="text-xs text-slate-500 px-3 py-3">No hay plantillas con campos manuales configurados.</p>
                  ) : (
                    templates.filter(t => (t.fields || []).some(f => f.source === 'manual')).map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => handleStartDocCollection(tpl.id)}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-100 transition-colors border-b border-indigo-100 last:border-0"
                      >
                        <p className="text-xs font-medium text-slate-700">{tpl.name}</p>
                        <p className="text-xs text-slate-400">{(tpl.fields || []).filter(f => f.source === 'manual').length} campos a recolectar</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="bg-[#ebf4ff] flex-shrink-0 border-t border-[#dbeafe]">

              {/* Quick message picker */}
              {showQuickPicker && (
                <div className="mx-4 mt-3 mb-1 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                    <Zap size={13} className="text-indigo-400 flex-shrink-0" />
                    <input
                      autoFocus
                      value={quickSearch}
                      onChange={e => setQuickSearch(e.target.value)}
                      placeholder="Buscar mensaje rápido..."
                      className="flex-1 text-sm outline-none placeholder-slate-400"
                    />
                    <button onClick={() => { setShowQuickPicker(false); setQuickSearch(''); }} className="text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {quickMessages
                      .filter(m => {
                        const q = quickSearch.toLowerCase();
                        return !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || (m.shortcut || '').toLowerCase().includes(q);
                      })
                      .map(m => (
                        <button
                          key={m.id}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setMsgText(m.content);
                            setShowQuickPicker(false);
                            setQuickSearch('');
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                        >
                          <p className="text-sm font-medium text-slate-700 truncate">{m.title}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{m.content}</p>
                        </button>
                      ))
                    }
                    {quickMessages.filter(m => {
                      const q = quickSearch.toLowerCase();
                      return !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || (m.shortcut || '').toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">Sin resultados</p>
                    )}
                  </div>
                </div>
              )}

              <div className="px-4 py-3 flex items-center gap-3">
                <input ref={fileRef} type="file" className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleSendMedia}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={sending}
                  className="p-2.5 text-blue-400 hover:bg-blue-100 rounded-full transition-colors flex-shrink-0"
                  title="Adjuntar archivo"
                >
                  <Paperclip size={20} />
                </button>

                <button
                  onClick={() => { setShowQuickPicker(p => !p); setQuickSearch(''); }}
                  className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${showQuickPicker ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-blue-100 hover:text-indigo-500'}`}
                  title="Mensajes rápidos"
                >
                  <Zap size={18} />
                </button>

                {modules.length > 0 && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowModulePicker(p => !p)}
                      className={`p-2.5 rounded-full transition-colors ${showModulePicker ? 'bg-emerald-100 text-emerald-600' : 'text-slate-400 hover:bg-blue-100 hover:text-emerald-500'}`}
                      title="Nuevo registro en módulo"
                    >
                      <ClipboardList size={18} />
                    </button>
                    {showModulePicker && (
                      <div className="absolute bottom-12 left-0 z-30 bg-white rounded-xl shadow-xl border border-slate-100 w-52 overflow-hidden">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-50">Crear registro en</p>
                        {modules.map(mod => (
                          <button key={mod.id}
                            className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors"
                            onClick={() => { setModuleModal(mod); setShowModulePicker(false); }}
                          >
                            <span className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: mod.color }}>
                              <span className="text-white text-[10px] font-bold">{mod.name[0]}</span>
                            </span>
                            <span className="text-sm text-slate-700 font-medium">{mod.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Botón Generar documento */}
                <button
                  onClick={() => setShowDocModal(true)}
                  className="p-2.5 text-slate-400 hover:bg-blue-100 hover:text-indigo-500 rounded-full transition-colors flex-shrink-0"
                  title="Generar y enviar documento"
                >
                  <FileText size={18} />
                </button>

                {/* Botón Solicitar datos al cliente (bot recolección) */}
                <button
                  onClick={() => setShowDocRequest(v => !v)}
                  className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${showDocRequest ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-blue-100 hover:text-indigo-500'}`}
                  title="Solicitar datos al cliente para documento"
                >
                  <ClipboardList size={18} />
                </button>

                <div className="flex-1 bg-white rounded-lg px-4 py-2.5 flex items-center">
                  <input
                    ref={inputRef}
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 text-sm text-[#111b21] outline-none placeholder-slate-400 bg-transparent"
                  />
                </div>

                <button
                  onClick={handleSend}
                  disabled={!msgText.trim() || sending}
                  className="p-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white rounded-full transition-colors flex-shrink-0"
                  title="Enviar"
                >
                  {sending
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={18} />
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── MODAL MÓDULO ─────────────────────────────── */}
      <ModuleRecordModal
        open={!!moduleModal}
        onClose={() => setModuleModal(null)}
        onSaved={() => {}}
        module={moduleModal}
        contactName={activeBusinessChat ? chatDisplayName(activeBusinessChat, chatList.find(c => c.jid === activeBusinessChat)?.contact_name) : ''}
        contactJid={activeBusinessChat || ''}
        sessionId={sessionId || ''}
      />

      {/* ── MODAL BROADCAST ──────────────────────────── */}
      {showBroadcast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-blue-500" />
                <p className="text-sm font-semibold text-slate-800">Envío masivo — WhatsApp Business</p>
              </div>
              <button onClick={() => { setShowBroadcast(false); setBroadcastMsg(''); setBroadcastJids([]); }} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">

              {/* Mensaje */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Mensaje</label>
                <textarea
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="Escribe el mensaje a enviar... Puedes usar {{nombre}} para personalizar."
                  rows={4}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 resize-none text-slate-700 placeholder-slate-400"
                />
              </div>

              {/* Destinatarios */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Destinatarios ({broadcastJids.length} seleccionados)
                  </label>
                  <button
                    onClick={() => {
                      const allJids = chatList.map(c => c.jid);
                      setBroadcastJids(broadcastJids.length === allJids.length ? [] : allJids);
                    }}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    {broadcastJids.length === chatList.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  {chatList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Sin contactos disponibles</p>
                  ) : (
                    chatList.map(chat => {
                      const name     = chatDisplayName(chat.jid, chat.contact_name);
                      const checked  = broadcastJids.includes(chat.jid);
                      return (
                        <label key={chat.jid} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setBroadcastJids(prev =>
                              checked ? prev.filter(j => j !== chat.jid) : [...prev, chat.jid]
                            )}
                            className="w-4 h-4 accent-blue-500 flex-shrink-0"
                          />
                          <div className={`w-7 h-7 rounded-full ${getAvatarColor(name)} text-white text-xs flex items-center justify-center font-medium flex-shrink-0`}>
                            {getInitials(chat.contact_name, chat.jid)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 font-medium truncate">{name}</p>
                            <p className="text-xs text-slate-400 truncate">{chat.jid.replace('@s.whatsapp.net', '')}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Los mensajes se envían con un intervalo de ~1.5s entre cada uno para evitar bloqueos de WhatsApp.
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setShowBroadcast(false); setBroadcastMsg(''); setBroadcastJids([]); }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBroadcast}
                disabled={!broadcastMsg.trim() || broadcastJids.length === 0 || broadcastSending}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {broadcastSending
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                  : <><Radio size={14} /> Enviar a {broadcastJids.length}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal visor PDF ── */}
      {pdfPreview && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setPdfPreview(null); }}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
            <span className="text-white text-sm font-medium truncate max-w-[70%]">{pdfPreview.name}</span>
            <div className="flex items-center gap-2">
              <a
                href={pdfPreview.url} target="_blank" rel="noreferrer" download={pdfPreview.name}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Descargar
              </a>
              <button
                onClick={() => setPdfPreview(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={pdfPreview.url}
              title={pdfPreview.name}
              className="w-full h-full border-0"
              style={{ background: '#525659' }}
            />
          </div>
        </div>
      )}
      {/* Modal generar/enviar documento */}
      {showDocModal && (
        <GenerateDocModal
          jid={activeBusinessChat}
          sessionId={sessionId}
          onClose={() => setShowDocModal(false)}
        />
      )}
    </div>
  );
}