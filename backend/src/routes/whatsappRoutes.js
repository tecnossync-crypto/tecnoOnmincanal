// backend/src/routes/whatsappRoutes.js
const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const multer   = require('multer');
const { auth, requireRole, requireFeature } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const { WhatsappChat, WhatsappMessage } = require('../models');
const { Op } = require('sequelize');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/whatsapp-media')
});

// ═══════════════════════════════════════════════════════
// SESIONES PERSONALES (lo que ya tenías, sin cambios)
// ═══════════════════════════════════════════════════════

// ── Iniciar sesión personal ───────────────────────────
router.post('/session/start', auth, requireFeature('whatsapp_personal'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId requerido' });
    await whatsappService.createSession(sessionId, 'personal');
    res.json({ success: true, message: `Sesión personal ${sessionId} iniciando` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Todas las sesiones ────────────────────────────────
router.get('/sessions', auth, async (req, res) => {
  try {
    const all = whatsappService.getAllSessions();
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: all });
    }
    const mine = all.filter(s =>
      s.sessionId.toLowerCase().includes(req.user.name?.split(' ')[0]?.toLowerCase()) ||
      s.sessionId.toLowerCase().includes(req.user.email?.split('@')[0]?.toLowerCase())
    );
    res.json({ success: true, data: mine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Estado de sesión ──────────────────────────────────
router.get('/session/:sessionId/status', auth, (req, res) => {
  const status = whatsappService.getSessionStatus(req.params.sessionId);
  res.json({ success: true, data: { sessionId: req.params.sessionId, status } });
});

// ── Desconectar sesión ────────────────────────────────
router.delete('/session/:sessionId', auth, async (req, res) => {
  whatsappService.disconnectSession(req.params.sessionId);
  res.json({ success: true, message: 'Sesión desconectada' });
});

// ── Chats de una sesión personal ──────────────────────
router.get('/session/:sessionId/chats', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    const myJid   = session?.sock?.user?.id?.replace(/:\d+/, '') || '';

    const rows = await WhatsappChat.findAll({
      where: {
        session_id:   sessionId,
        session_type: 'personal',
        last_message_at: { [Op.gt]: 0 },
        jid: {
          [Op.and]: [
            { [Op.notLike]: '%@g.us'      },
            { [Op.notLike]: '%@broadcast' },
            { [Op.notLike]: '%status%'    },
          ]
        }
      },
      order:      [['last_message_at', 'DESC']],
      limit:      100,
      attributes: ['id', 'jid', 'contact_name', 'last_message',
                   'last_message_at', 'unread_count', 'bot_enabled', 'session_type']
    });

    const chats = rows.map(c => {
      const plain = c.get({ plain: true });
      return {
        ...plain,
        display_name: plain.contact_name || ('+' + plain.jid.split('@')[0])
      };
    });

    res.json({ success: true, data: { chats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Historial de mensajes ─────────────────────────────
router.get('/session/:sessionId/chat/:jid', auth, async (req, res) => {
  try {
    const { sessionId }  = req.params;
    const jid            = decodeURIComponent(req.params.jid);
    const { limit = 100 } = req.query;
    const messages = await WhatsappMessage.findAll({
      where: { session_id: sessionId, jid },
      order: [['timestamp', 'DESC']],
      limit: Math.min(+limit, 500)
    });
    res.json({ success: true, data: { messages: messages.reverse() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Config del chat (bot) ─────────────────────────────
router.get('/session/:sessionId/chat/:jid/config', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const jid           = decodeURIComponent(req.params.jid);
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, bot_enabled: false, session_type: 'personal' }
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Toggle bot ────────────────────────────────────────
router.patch('/session/:sessionId/chat/:jid/bot', auth, async (req, res) => {
  try {
    const { sessionId }                         = req.params;
    const jid                                   = decodeURIComponent(req.params.jid);
    const { bot_enabled, bot_prompt, bot_mode } = req.body;
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, session_type: 'personal' }
    });
    await chat.update({
      ...(bot_enabled !== undefined && { bot_enabled }),
      ...(bot_prompt  !== undefined && { bot_prompt }),
      ...(bot_mode    !== undefined && { bot_mode })
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar mensaje texto ──────────────────────────────
router.post('/send', auth, async (req, res) => {
  try {
    const { sessionId, to, message } = req.body;
    await whatsappService.sendMessage(sessionId, to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar archivo multimedia ─────────────────────────
router.post('/send-media', auth, upload.single('file'), async (req, res) => {
  try {
    const { sessionId, to, caption } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Archivo requerido' });

    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesión no conectada' });

    const jid  = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const mime = file.mimetype;
    const buf  = fs.readFileSync(file.path);

    if (mime.startsWith('image/')) {
      await session.sock.sendMessage(jid, { image: buf, caption: caption || '', mimetype: mime });
    } else if (mime.startsWith('audio/')) {
      await session.sock.sendMessage(jid, { audio: buf, mimetype: mime, ptt: false });
    } else if (mime.startsWith('video/')) {
      await session.sock.sendMessage(jid, { video: buf, caption: caption || '', mimetype: mime });
    } else {
      await session.sock.sendMessage(jid, { document: buf, fileName: file.originalname, mimetype: mime });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Limpiar mensajes basura ───────────────────────────
router.delete('/cleanup', auth, requireRole('admin'), async (req, res) => {
  try {
    const deleted = await WhatsappMessage.destroy({
      where: {
        body: { [Op.in]: ['[multimedia]', '[Audio]', '[Video]', '[Sticker]', '[Multimedia]'] }
      }
    });
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Sincronizar nombres de contactos ──────────────────
router.post('/session/:sessionId/sync-contacts', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesion no conectada' });

    const store    = session.sock.store;
    const contacts = store?.contacts || {};

    let updated = 0;
    for (const [jid, contact] of Object.entries(contacts)) {
      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
      const name = contact.name || contact.notify || contact.verifiedName || '';
      if (!name) continue;
      const rows = await WhatsappChat.update(
        { contact_name: name },
        { where: { session_id: sessionId, jid } }
      );
      if (rows[0] > 0) updated++;
    }

    res.json({ success: true, updated, message: `${updated} contactos actualizados` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ═══════════════════════════════════════════════════════
// SESIONES BUSINESS (nuevas rutas para asesores)
// ═══════════════════════════════════════════════════════

// ── Iniciar sesión business del asesor ────────────────
router.post('/business/session/start', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const current   = whatsappService.getSessionStatus(sessionId);

    // Si ya hay una sesión activa o conectándose, no crear otra
    if (current === 'connected') {
      return res.json({ success: true, sessionId, status: 'connected', message: 'Sesión ya conectada' });
    }
    if (current === 'connecting') {
      return res.json({ success: true, sessionId, status: 'connecting', message: 'Sesión conectándose' });
    }

    await whatsappService.createSession(sessionId, 'business');
    res.json({ success: true, sessionId, message: `Sesión business iniciando para ${req.user.name || req.user.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Estado de la sesión business del asesor ───────────
router.get('/business/session/status', auth, (req, res) => {
  const sessionId = `business_${req.user.id}`;
  const status    = whatsappService.getSessionStatus(sessionId);
  res.json({ success: true, data: { sessionId, status } });
});

// ── Todas las sesiones business (admin ve todas) ──────
router.get('/business/sessions', auth, async (req, res) => {
  try {
    const all = whatsappService.getBusinessSessions();
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: all });
    }
    // El asesor solo ve la suya
    const mine = all.filter(s => s.sessionId === `business_${req.user.id}`);
    res.json({ success: true, data: mine });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Desconectar sesión business (suave, conserva credenciales) ──
router.delete('/business/session', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    whatsappService.disconnectSession(sessionId);
    res.json({ success: true, message: 'Sesión business desconectada' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Logout completo (borra credenciales, próximo inicio pide QR nuevo) ──
router.delete('/business/session/logout', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    await whatsappService.logoutSession(sessionId);
    res.json({ success: true, message: 'Sesión business cerrada y credenciales eliminadas' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Chats de la sesión business del asesor ────────────
router.get('/business/chats', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;

    const rows = await WhatsappChat.findAll({
      where: {
        session_id:   sessionId,
        session_type: 'business',
        // Solo chats con actividad real (evitar contactos sin conversación)
        last_message_at: { [Op.gt]: 0 },
        jid: {
          [Op.and]: [
            { [Op.notLike]: '%@g.us'      },
            { [Op.notLike]: '%@broadcast' },
            { [Op.notLike]: '%status%'    },
          ]
        }
      },
      order:      [['last_message_at', 'DESC']],
      limit:      100,
      attributes: ['id', 'jid', 'contact_name', 'last_message',
                   'last_message_at', 'unread_count', 'bot_enabled', 'bot_mode', 'session_type', 'labels']
    });

    // Para chats sin preview, buscar el último mensaje guardado en DB
    const jidsSinPreview = rows.filter(c => !c.last_message).map(c => c.jid);
    let lastMsgMap = {};
    if (jidsSinPreview.length > 0) {
      const lastMsgs = await WhatsappMessage.findAll({
        attributes: ['jid', 'body', 'timestamp'],
        where: { session_id: sessionId, jid: { [Op.in]: jidsSinPreview } },
        order: [['timestamp', 'DESC']],
        raw: true
      });
      // Solo quedarse con el más reciente por jid
      for (const m of lastMsgs) {
        if (!lastMsgMap[m.jid]) lastMsgMap[m.jid] = m.body;
      }
    }

    const chats = rows.map(c => {
      const plain = c.get({ plain: true });
      return {
        ...plain,
        last_message: plain.last_message || lastMsgMap[plain.jid] || '',
        display_name: plain.contact_name?.trim() || ('+' + plain.jid.split('@')[0])
      };
    });

    res.json({ success: true, data: { chats, sessionId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Historial de mensajes business ───────────────────
router.get('/business/chat/:jid', auth, async (req, res) => {
  try {
    const sessionId      = `business_${req.user.id}`;
    const jid            = decodeURIComponent(req.params.jid);
    const { limit = 100 } = req.query;

    const messages = await WhatsappMessage.findAll({
      where: { session_id: sessionId, jid },
      order: [['timestamp', 'DESC']],
      limit: Math.min(+limit, 500)
    });
    res.json({ success: true, data: { messages: messages.reverse(), sessionId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Config del bot por chat business ─────────────────
router.get('/business/chat/:jid/config', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const jid       = decodeURIComponent(req.params.jid);
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, bot_enabled: false, session_type: 'business', bot_mode: 'generic' }
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/business/chat/:jid/bot', auth, async (req, res) => {
  try {
    const sessionId                             = `business_${req.user.id}`;
    const jid                                   = decodeURIComponent(req.params.jid);
    const { bot_enabled, bot_prompt, bot_mode } = req.body;
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, session_type: 'business', bot_mode: 'generic' }
    });
    await chat.update({
      ...(bot_enabled !== undefined && { bot_enabled }),
      ...(bot_prompt  !== undefined && { bot_prompt }),
      ...(bot_mode    !== undefined && { bot_mode })
    });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Actualizar nombre de contacto business ────────────
router.patch('/business/chat/:jid/contact-name', auth, async (req, res) => {
  try {
    const sessionId    = `business_${req.user.id}`;
    const jid          = decodeURIComponent(req.params.jid);
    const { contact_name } = req.body;
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, session_type: 'business', contact_name: contact_name || '' }
    });
    await chat.update({ contact_name: contact_name || '' });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Etiquetas del chat business ───────────────────────
router.patch('/business/chat/:jid/labels', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const jid       = decodeURIComponent(req.params.jid);
    const { labels } = req.body;
    if (!Array.isArray(labels)) return res.status(400).json({ success: false, message: 'labels debe ser un arreglo' });
    const [chat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, session_type: 'business', labels: [] }
    });
    await chat.update({ labels });
    res.json({ success: true, data: chat });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Envío masivo (broadcast) business ─────────────────
router.post('/business/broadcast', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const { message, jids, delay_ms = 1500 } = req.body;
    if (!message?.trim())      return res.status(400).json({ success: false, message: 'message es requerido' });
    if (!Array.isArray(jids) || jids.length === 0)
      return res.status(400).json({ success: false, message: 'jids debe ser un arreglo no vacío' });
    if (jids.length > 500)     return res.status(400).json({ success: false, message: 'Máximo 500 destinatarios por envío' });

    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesión business no conectada' });

    // Responder inmediatamente — el envío corre en background
    res.json({ success: true, message: `Iniciando envío a ${jids.length} contactos`, total: jids.length });

    // Enviar con delay entre cada mensaje para evitar bloqueos
    const safeDelay = Math.max(delay_ms, 800);
    ;(async () => {
      let sent = 0, failed = 0;
      for (const rawJid of jids) {
        const target = rawJid.includes('@') ? rawJid : `${rawJid}@s.whatsapp.net`;
        try {
          await whatsappService.sendMessage(sessionId, target, message);
          sent++;
        } catch (e) {
          failed++;
        }
        await new Promise(r => setTimeout(r, safeDelay));
      }
      require('../config/logger').info(`📢 Broadcast ${sessionId}: ${sent} enviados, ${failed} fallidos`);
    })();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Todos los contactos del teléfono (con y sin conversación) ──
router.get('/business/contacts', auth, async (req, res) => {
  try {
    const sessionId       = `business_${req.user.id}`;
    const { search = '' } = req.query;

    const where = {
      session_id:   sessionId,
      contact_name: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
      jid: {
        [Op.and]: [
          { [Op.notLike]: '%@g.us'      },
          { [Op.notLike]: '%@lid'       },
          { [Op.notLike]: '%@broadcast' },
          { [Op.notLike]: '%status%'    },
        ]
      }
    };

    if (search.trim()) {
      where[Op.or] = [
        { contact_name: { [Op.iLike]: `%${search.trim()}%` } },
        { jid:          { [Op.like]:  `%${search.trim()}%`  } }
      ];
    }

    const rows = await WhatsappChat.findAll({
      where,
      order:      [['contact_name', 'ASC']],
      limit:      500,
      attributes: ['jid', 'contact_name', 'last_message_at']
    });

    const contacts = rows.map(c => ({
      jid:          c.jid,
      contact_name: c.contact_name,
      display_name: c.contact_name?.trim() || ('+' + c.jid.split('@')[0]),
      has_chat:     (c.last_message_at || 0) > 0
    }));

    res.json({ success: true, data: { contacts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Unificar dos conversaciones business en una ───────
router.post('/business/merge-chats', auth, async (req, res) => {
  try {
    const sessionId              = `business_${req.user.id}`;
    const { keepJid, discardJid } = req.body;
    if (!keepJid || !discardJid)
      return res.status(400).json({ success: false, message: 'keepJid y discardJid son requeridos' });
    if (keepJid === discardJid)
      return res.status(400).json({ success: false, message: 'Los JIDs deben ser diferentes' });

    // 1. Mover mensajes del chat descartado al chat que se conserva
    await WhatsappMessage.update(
      { jid: keepJid },
      { where: { session_id: sessionId, jid: discardJid } }
    );

    // 2. Actualizar last_message del chat que se conserva si el descartado era más reciente
    const keepChat    = await WhatsappChat.findOne({ where: { session_id: sessionId, jid: keepJid } });
    const discardChat = await WhatsappChat.findOne({ where: { session_id: sessionId, jid: discardJid } });

    if (keepChat && discardChat) {
      if ((discardChat.last_message_at || 0) > (keepChat.last_message_at || 0)) {
        await keepChat.update({
          last_message:    discardChat.last_message,
          last_message_at: discardChat.last_message_at,
          contact_name:    keepChat.contact_name || discardChat.contact_name || ''
        });
      } else if (!keepChat.contact_name && discardChat.contact_name) {
        await keepChat.update({ contact_name: discardChat.contact_name });
      }
      await discardChat.destroy();
    }

    res.json({ success: true, message: 'Conversaciones unificadas correctamente' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar mensaje business ───────────────────────────
router.post('/business/send', auth, async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const { to, message } = req.body;
    if (!to || !message)
      return res.status(400).json({ success: false, message: 'to y message son requeridos' });

    const result = await whatsappService.sendMessage(sessionId, to, message);
    res.json({ success: true, data: { timestamp: result.timestamp, externalId: result.externalId } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Enviar multimedia business ────────────────────────
router.post('/business/send-media', auth, upload.single('file'), async (req, res) => {
  try {
    const sessionId = `business_${req.user.id}`;
    const { to, caption } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'Archivo requerido' });

    const session = whatsappService.getSession(sessionId);
    if (!session || session.status !== 'connected')
      return res.status(400).json({ success: false, message: 'Sesión business no conectada' });

    const jid  = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const mime = file.mimetype;
    const buf  = fs.readFileSync(file.path);

    if (mime.startsWith('image/')) {
      await session.sock.sendMessage(jid, { image: buf, caption: caption || '', mimetype: mime });
    } else if (mime.startsWith('audio/')) {
      await session.sock.sendMessage(jid, { audio: buf, mimetype: mime, ptt: false });
    } else if (mime.startsWith('video/')) {
      await session.sock.sendMessage(jid, { video: buf, caption: caption || '', mimetype: mime });
    } else {
      await session.sock.sendMessage(jid, { document: buf, fileName: file.originalname, mimetype: mime });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;