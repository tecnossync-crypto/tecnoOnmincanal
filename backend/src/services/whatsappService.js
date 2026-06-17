// backend/src/services/whatsappService.js
const { default: makeWASocket, DisconnectReason,
        useMultiFileAuthState, downloadMediaMessage,
        Browsers, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys')
const { Boom }   = require('@hapi/boom')
const qrcode     = require('qrcode')
const path       = require('path')
const fs         = require('fs')
const logger     = require('../config/logger')
const { WhatsappMessage, WhatsappChat } = require('../models')

const sessions    = {}
const SESSION_DIR = path.join(__dirname, '../../sessions')
const MEDIA_DIR   = path.join(__dirname, '../../uploads/whatsapp-media')

fs.mkdirSync(SESSION_DIR, { recursive: true })
fs.mkdirSync(MEDIA_DIR,   { recursive: true })

let _io = null
const setSocketIO = (io) => { _io = io }

// Mapa LID→JID autoritativo: { sessionId: { 'X@lid': 'Y@s.whatsapp.net' } }
// Se construye SOLO desde contacts.set / contacts.upsert / messaging-history.set
const lidToJid = {}
// Mapa de fallbacks numéricos: { sessionId: { 'X@lid': 'X@s.whatsapp.net' } }
// Se construye cuando llega un @lid sin mapeo autoritative (temporal, puede ser incorrecto)
const lidFallback = {}

function mimeToExt(mime) {
  const m = mime?.split(';')[0]?.trim()
  return {
    'application/pdf':  'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/3gpp': '3gp',
  }[m] || 'bin'
}

async function saveMedia(msg, contentType, innerMsg, sock = null) {
  try {
    // reuploadRequest permite a Baileys pedir nuevo CDN link si el original expiró
    const ctxOpts = sock?.updateMediaMessage
      ? { logger: require('pino')({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
      : {}
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, ctxOpts)

    if (!buffer || buffer.length === 0) {
      logger.warn(`⚠️  saveMedia [${contentType}]: buffer vacío para key=${msg.key?.id}`)
      return null
    }

    let ext, mimetype, filename
    if (contentType === 'document') {
      filename = innerMsg?.documentMessage?.fileName || 'documento'
      mimetype = innerMsg?.documentMessage?.mimetype || 'application/octet-stream'
      const parts = filename.split('.')
      ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : mimeToExt(mimetype)
    } else if (contentType === 'audio') {
      // PTT y audioMessage ambos pueden traer mimetype en audioMessage
      mimetype = innerMsg?.audioMessage?.mimetype
              || innerMsg?.pttMessage?.mimetype
              || 'audio/ogg; codecs=opus'
      // WhatsApp envía voice notes como audio/ogg o audio/mp4 — guardar como .ogg siempre funciona
      ext = mimeToExt(mimetype.split(';')[0].trim()) || 'ogg'
      filename = `audio.${ext}`
    } else if (contentType === 'image') {
      mimetype = innerMsg?.imageMessage?.mimetype
              || innerMsg?.stickerMessage?.mimetype
              || 'image/jpeg'
      ext = mimeToExt(mimetype) || 'jpg'
      filename = `image.${ext}`
    } else if (contentType === 'video') {
      mimetype = innerMsg?.videoMessage?.mimetype || 'video/mp4'
      ext = mimeToExt(mimetype) || 'mp4'
      filename = `video.${ext}`
    } else {
      ext = 'bin'; mimetype = 'application/octet-stream'; filename = 'file.bin'
    }

    const fname = `${Date.now()}_${msg.key.id}.${ext}`
    const fpath = path.join(MEDIA_DIR, fname)
    fs.writeFileSync(fpath, buffer)
    logger.info(`💾 Media guardada: ${fname} (${Math.round(buffer.length/1024)}KB) tipo=${contentType}`)
    return { url: `/uploads/whatsapp-media/${fname}`, mimetype, filename }
  } catch (e) {
    logger.error(`❌ saveMedia [${contentType}] key=${msg.key?.id}: ${e.message}`)
    return null
  }
}

// ── Helper: extrae nombre de contacto del store de Baileys ──
function resolveContactName(chat, jid, sock) {
  if (chat.name) return chat.name
  const store = sock?.store?.contacts
  if (store) {
    const c = store[jid] || store[jid.replace('@s.whatsapp.net', '@c.us')]
    if (c) return c.name || c.notify || c.verifiedName || ''
  }
  return ''
}

// ── Helper: formatea JID a número de teléfono ───────────────
function jidToPhone(jid) {
  return '+' + jid.split('@')[0]
}

// ── Extrae el texto del último mensaje de un objeto de chat Baileys ──
function extractLastMsgBody(chat) {
  try {
    const m = chat.messages?.first?.message || chat.messages?.last?.message
    if (!m) return ''
    if (m.conversation)              return m.conversation
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text
    if (m.imageMessage)              return '[Imagen]'
    if (m.audioMessage)              return '[Audio]'
    if (m.videoMessage)              return '[Video]'
    if (m.documentMessage)           return m.documentMessage.fileName || '[Documento]'
    if (m.stickerMessage)            return '[Sticker]'
  } catch (_) {}
  return ''
}

// Convierte timestamps de Baileys (puede ser número, BigInt, o Long protobuf)
function toUnixTs(val) {
  if (!val) return 0
  if (typeof val === 'number') return val
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'object') {
    if (typeof val.toNumber === 'function') return val.toNumber()
    if (val.low !== undefined) return val.low  // Long protobuf
  }
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

// ── syncChat: actualiza metadata del chat, siempre fresquea nombre y timestamp ──
async function syncChat(sessionId, chat, sessionType = 'personal', sock = null) {
  const jid = chat.id
  if (!jid) return
  if (jid === 'status@broadcast' || jid.includes('@broadcast')) return
  if (jid.endsWith('@g.us')) return
  if (jid.endsWith('@lid'))  return

  const name    = resolveContactName(chat, jid, sock)
  const ts      = toUnixTs(chat.conversationTimestamp)
  const lastMsg = extractLastMsgBody(chat)

  try {
    const [record, created] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: {
        session_id:      sessionId,
        jid,
        session_type:    sessionType,
        contact_name:    name,
        last_message:    lastMsg,
        last_message_at: ts,
        unread_count:    chat.unreadCount || 0
      }
    })
    if (!created) {
      const updates = {}
      if (name && name !== record.contact_name) updates.contact_name = name
      if (ts > (record.last_message_at || 0))   updates.last_message_at = ts
      if (lastMsg && !record.last_message)       updates.last_message    = lastMsg
      if (chat.unreadCount !== undefined && chat.unreadCount !== record.unread_count) {
        updates.unread_count = chat.unreadCount
      }
      if (Object.keys(updates).length > 0) await record.update(updates)
    }
  } catch (_) {}
}

// ── Guarda un mensaje del historial en la BD (sin media) ────
async function saveHistoryMessage(sessionId, sessionType, msg) {
  try {
    const jid       = msg.key?.remoteJid
    const fromMe    = msg.key?.fromMe || false
    const extId     = msg.key?.id
    const pushName  = msg.pushName || ''
    const timestamp = Number(msg.messageTimestamp) || 0

    if (!jid || !extId || !timestamp) return

    const innerMessage = msg.message?.ephemeralMessage?.message
                      || msg.message?.viewOnceMessage?.message
                      || msg.message?.viewOnceMessageV2?.message?.viewOnceMessage?.message
                      || msg.message

    let body = '', contentType = 'text'
    if (innerMessage.conversation)             { body = innerMessage.conversation }
    else if (innerMessage.extendedTextMessage?.text) { body = innerMessage.extendedTextMessage.text }
    else if (innerMessage.imageMessage)        { body = innerMessage.imageMessage.caption || '[Imagen]'; contentType = 'image' }
    else if (innerMessage.audioMessage || innerMessage.pttMessage) { body = '[Audio]'; contentType = 'audio' }
    else if (innerMessage.videoMessage)        { body = innerMessage.videoMessage.caption || '[Video]'; contentType = 'video' }
    else if (innerMessage.documentMessage)     { body = innerMessage.documentMessage.fileName || '[Documento]'; contentType = 'document' }
    else if (innerMessage.stickerMessage)      { body = '[Sticker]'; contentType = 'image' }
    else return // tipo desconocido, ignorar

    await WhatsappMessage.findOrCreate({
      where:    { external_id: extId },
      defaults: { session_id: sessionId, jid, contact_name: pushName, body, from_me: fromMe, timestamp, external_id: extId, content_type: contentType, metadata: {} }
    })

    // Actualizar metadata del chat si este mensaje es más reciente
    const [chatRecord] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, contact_name: pushName, session_type: sessionType, last_message_at: timestamp, last_message: body }
    })
    if (timestamp > (chatRecord.last_message_at || 0)) {
      await chatRecord.update({ last_message: body, last_message_at: timestamp, contact_name: chatRecord.contact_name || pushName })
    }
  } catch (e) {
    logger.warn(`⚠️  saveHistoryMessage error [${sessionId}]: ${e.message}`)
  }
}

// ── Resuelve un JID @lid al JID real @s.whatsapp.net ───
// Revisa primero el mapa autoritativo (contacts.set), luego el de fallbacks numéricos.
function resolveLidJid(msg, sock, sessionId) {
  // 1. participant puede traer el JID real (en mensajes de grupo)
  const participant = msg.key?.participant
  if (participant && !participant.endsWith('@lid')) return participant

  const lidJid = msg.key?.remoteJid

  // 2. Mapa autoritativo (contacts.set / contacts.upsert / messaging-history.set)
  const authMap = lidToJid[sessionId]
  if (authMap?.[lidJid]) return authMap[lidJid]

  // 3. Mapa de fallbacks numéricos (temporal, puede ser incorrecto)
  const fallMap = lidFallback[sessionId]
  if (fallMap?.[lidJid]) return fallMap[lidJid]

  // 4. sock.contacts (Baileys 7.x sin makeInMemoryStore)
  const sockContacts = sock?.contacts
  if (sockContacts && typeof sockContacts === 'object') {
    const direct = sockContacts[lidJid]
    if (direct?.id && !direct.id.endsWith('@lid')) return direct.id
    // Buscar por lid en todos los contactos
    for (const c of Object.values(sockContacts)) {
      if (c?.lid === lidJid && c?.id && !c.id.endsWith('@lid')) return c.id
    }
  }

  // 5. Baileys store (legacy makeInMemoryStore)
  const store = sock?.store?.contacts
  if (store) {
    const contact = store[lidJid]
    if (contact?.id && !contact.id.endsWith('@lid')) return contact.id
    const entries = Object.values(store)
    const match   = entries.find(c => c.lid === lidJid || c.lid === lidJid?.split('@')[0])
    if (match?.id && !match.id.endsWith('@lid')) return match.id
  }

  // 6. Retornar el @lid mismo para no descartar el mensaje
  return lidJid
}

async function processWAMessage(msg, isRealtime, sessionId, sessionType, sock) {
  const msgKeys = msg?.message ? Object.keys(msg.message).join(',') : 'NULL'

  if (!msg?.message) {
    const stubType = msg?.messageStubType
    const label = stubType === 2 ? '🔐 CIPHERTEXT' : '🚫 sin msg.message'
    logger.info(`${label} [${sessionId}] key=${msg?.key?.id} fromMe=${msg?.key?.fromMe} jid=${msg?.key?.remoteJid} stub=${stubType ?? 'none'}`)
    return
  }
  if (msg.message.protocolMessage) {
    logger.info(`🚫 [${sessionId}] filtrado: protocolMessage type=${msg.message.protocolMessage.type}`)
    return
  }
  if (msg.message.reactionMessage)   { logger.info(`🚫 [${sessionId}] filtrado: reactionMessage`);   return }
  if (msg.message.pollUpdateMessage) { logger.info(`🚫 [${sessionId}] filtrado: pollUpdateMessage`); return }

  let jid      = msg.key.remoteJid
  const fromMe = msg.key.fromMe || false
  const extId  = msg.key.id

  if (!jid)                        { logger.info(`🚫 [${sessionId}] filtrado: sin jid`); return }
  if (jid.endsWith('@g.us'))       { logger.info(`🚫 [${sessionId}] filtrado: grupo ${jid}`); return }
  if (jid === 'status@broadcast')  { logger.info(`🚫 [${sessionId}] filtrado: status@broadcast`); return }
  if (jid.includes('@broadcast'))  { logger.info(`🚫 [${sessionId}] filtrado: @broadcast ${jid}`); return }

  // ── Manejo @lid: resolver al JID real ──────────────────────
  // Si contacts.set/upsert dio el mapeo autoritativo → usarlo.
  // Si NO hay mapeo → mantener el @lid como JID (Baileys tiene la sesión Signal
  // para ese LID y puede entregar mensajes aunque no conozcamos el número).
  // NUNCA inventar un número de teléfono a partir del prefijo del @lid.
  let origLid = null
  if (jid.endsWith('@lid')) {
    origLid = jid
    const resolvedJid = resolveLidJid(msg, sock, sessionId)
    if (resolvedJid && !resolvedJid.endsWith('@lid')) {
      logger.info(`🔄 [${sessionId}] @lid resuelto: ${origLid} → ${resolvedJid}`)
      jid = resolvedJid
      msg.key.remoteJid = resolvedJid
    } else {
      // Sin mapeo: usar el @lid tal cual — Baileys lo entrega internamente
      logger.info(`🆔 [${sessionId}] @lid sin mapeo autoritativo — usando @lid directo: ${jid}`)
    }
  }

  const pushName  = msg.pushName || ''
  const timestamp = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000)

  if (!isRealtime && (Date.now() / 1000 - timestamp) > 172800) {
    logger.info(`🚫 [${sessionId}] filtrado: append >48h jid=${jid} ts=${timestamp}`)
    return
  }

  logger.info(`📩 Msg [${sessionId}]: jid=${jid} fromMe=${fromMe} extId=${extId} keys=${msgKeys}`)

  const innerMessage = msg.message.ephemeralMessage?.message
                    || msg.message.viewOnceMessage?.message
                    || msg.message.viewOnceMessageV2?.message?.viewOnceMessage?.message
                    || msg.message

  let body        = ''
  let contentType = 'text'
  let mediaMeta   = null   // { url, mimetype, filename }

  if (innerMessage.conversation) {
    body = innerMessage.conversation; contentType = 'text'
  } else if (innerMessage.extendedTextMessage?.text) {
    body = innerMessage.extendedTextMessage.text; contentType = 'text'
  } else if (innerMessage.imageMessage) {
    body = innerMessage.imageMessage.caption || ''; contentType = 'image'
    mediaMeta = await saveMedia(msg, 'image', innerMessage, sock)
  } else if (innerMessage.audioMessage || innerMessage.pttMessage) {
    body = '[Audio]'; contentType = 'audio'
    mediaMeta = await saveMedia(msg, 'audio', innerMessage, sock)
  } else if (innerMessage.videoMessage) {
    body = innerMessage.videoMessage.caption || ''; contentType = 'video'
    mediaMeta = await saveMedia(msg, 'video', innerMessage, sock)
  } else if (innerMessage.documentMessage) {
    body = innerMessage.documentMessage.fileName || '[Documento]'; contentType = 'document'
    mediaMeta = await saveMedia(msg, 'document', innerMessage, sock)
  } else if (innerMessage.stickerMessage) {
    body = '[Sticker]'; contentType = 'image'
    mediaMeta = await saveMedia(msg, 'image', innerMessage, sock)
  } else if (innerMessage.buttonsResponseMessage) {
    body = innerMessage.buttonsResponseMessage.selectedDisplayText
        || innerMessage.buttonsResponseMessage.selectedButtonId
        || '[Respuesta]'; contentType = 'text'
  } else if (innerMessage.listResponseMessage) {
    body = innerMessage.listResponseMessage.singleSelectReply?.selectedTitle
        || innerMessage.listResponseMessage.singleSelectReply?.selectedRowId
        || '[Selección]'; contentType = 'text'
  } else if (innerMessage.templateButtonReplyMessage) {
    body = innerMessage.templateButtonReplyMessage.selectedDisplayText
        || innerMessage.templateButtonReplyMessage.selectedId
        || '[Respuesta]'; contentType = 'text'
  } else {
    logger.info(`🚫 [${sessionId}] filtrado: tipo desconocido jid=${jid} innerKeys=${Object.keys(innerMessage).join(',')}`)
    return
  }

  const mediaUrl = mediaMeta?.url || null
  const metadata = mediaMeta
    ? { media_url: mediaMeta.url, media_mimetype: mediaMeta.mimetype, media_filename: mediaMeta.filename }
    : {}

  try {
    await WhatsappMessage.findOrCreate({
      where:    { external_id: extId },
      defaults: {
        session_id:   sessionId,
        jid,
        contact_name: pushName,
        body,
        from_me:      fromMe,
        timestamp,
        external_id:  extId,
        content_type: contentType,
        metadata
      }
    })
    const { Op } = require('sequelize')
    const cutoff = await WhatsappMessage.findOne({
      where:  { session_id: sessionId, jid },
      order:  [['timestamp', 'DESC']],
      offset: 99,
      attributes: ['timestamp']
    })
    if (cutoff) {
      await WhatsappMessage.destroy({
        where: { session_id: sessionId, jid, timestamp: { [Op.lt]: cutoff.timestamp } }
      })
    }
  } catch (_) {}

  try {
    const [chatRecord] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, contact_name: pushName, session_type: sessionType }
    })
    const nameToKeep = chatRecord.contact_name || pushName || ''
    await chatRecord.update({
      contact_name:    nameToKeep,
      last_message:    body,
      last_message_at: timestamp,
      unread_count:    fromMe ? 0 : (chatRecord.unread_count || 0) + 1
    })

    const isOldMessage = (Date.now() / 1000 - timestamp) > 86400
    const botEnabled = chatRecord.bot_enabled === true || chatRecord.bot_enabled === 1
    logger.info(`🤖 Bot check [${jid}]: fromMe=${fromMe} type=${contentType} botEnabled=${botEnabled} isOld=${isOldMessage} realtime=${isRealtime}`)
    if (!fromMe && contentType === 'text' && body.trim() && botEnabled && !isOldMessage && isRealtime) {
      try {
        const chatbotService = require('./chatbotService')

        // ── Prioridad 1: recolección de datos para plantilla de documento ──
        const docResult = await chatbotService.handleDocumentCollection(sessionId, jid, body, chatRecord, _io)
        if (docResult?.handled) {
          if (docResult.reply) {
            const activeSock = sessions[sessionId]?.sock || sock
            if (sessions[sessionId]?.status !== 'connected') {
              logger.warn(`⚠️  Doc collect [${jid}]: sesión no conectada — reply abortado`)
            } else {
              const sentDoc  = await activeSock.sendMessage(jid, { text: docResult.reply })
              const docTs    = Math.floor(Date.now() / 1000)
              const docExtId = sentDoc?.key?.id || `doc_${docTs}_${jid}`
              await WhatsappMessage.findOrCreate({
                where:    { external_id: docExtId },
                defaults: { session_id: sessionId, jid, contact_name: nameToKeep, body: docResult.reply, from_me: true, timestamp: docTs, content_type: 'text', metadata: {} }
              })
              await chatRecord.update({ last_message: docResult.reply, last_message_at: docTs })
              _io?.to('agents').emit('whatsapp:message', {
                sessionId, from: jid, body: docResult.reply,
                timestamp: docTs, externalId: docExtId,
                fromMe: true, pushName: 'Bot', contentType: 'text', mediaUrl: null, sessionType
              })
            }
          }
          return // no invocar la IA para este mensaje
        }

        // ── Prioridad 2: bot IA normal ──
        const result      = await chatbotService.handleWhatsappMessage(sessionId, jid, body, chatRecord)
        const aiResponse  = result?.text        || null
        const catalogFile = result?.catalogFile || null
        const handoff     = result?.handoff     || false
        const startDoc    = result?.startDoc    || null

        if (aiResponse) {
          // Re-verificar JID: contacts.upsert pudo haber llegado mientras la IA procesaba
          if (origLid && lidToJid[sessionId]?.[origLid] && lidToJid[sessionId][origLid] !== jid) {
            const correctedJid = lidToJid[sessionId][origLid]
            logger.info(`🔄 Bot WA: @lid corregido post-AI ${jid} → ${correctedJid}`)
            jid = correctedJid
          }

          // Usar el sock activo al momento de enviar — si hubo reconexión durante la IA, sessions[sessionId].sock es el nuevo
          const activeSock = sessions[sessionId]?.sock || sock
          if (sessions[sessionId]?.sock && sessions[sessionId].sock !== sock) {
            logger.info(`🔄 Bot WA [${jid}]: sock actualizado tras reconexión — usando sock fresco`)
          }
          const sessionStatus = sessions[sessionId]?.status
          logger.info(`📡 Bot WA [${jid}] enviando... sessionStatus=${sessionStatus} sockMatch=${sessions[sessionId]?.sock === sock} destJid=${jid}`)
          if (sessionStatus !== 'connected') {
            logger.warn(`⚠️  Bot WA [${jid}]: sesión ${sessionId} no está conectada (status=${sessionStatus}) — mensaje abortado`)
            return
          }
          const sentMsg  = await activeSock.sendMessage(jid, { text: aiResponse })
          const botTs    = Math.floor(Date.now() / 1000)
          const botExtId = sentMsg?.key?.id || `bot_${botTs}_${jid}`
          logger.info(`📤 Bot WA [${jid}] enviado OK — msgId=${sentMsg?.key?.id || 'SIN_ID'} status=${sentMsg?.status ?? 'n/a'}`)
          await WhatsappMessage.findOrCreate({
            where:    { external_id: botExtId },
            defaults: {
              session_id:   sessionId,
              jid,
              contact_name: nameToKeep,
              body:         aiResponse,
              from_me:      true,
              timestamp:    botTs,
              content_type: 'text',
              metadata:     {}
            }
          })
          await chatRecord.update({ last_message: aiResponse, last_message_at: botTs })
          _io?.to('agents').emit('whatsapp:message', {
            sessionId, from: jid, body: aiResponse,
            timestamp: botTs, externalId: botExtId,
            fromMe: true, pushName: 'Bot', contentType: 'text', mediaUrl: null,
            sessionType
          })
        } else if (!startDoc && !catalogFile) {
          logger.warn(`⚠️  Bot WA [${jid}]: sin respuesta. Verifica que haya un BotConfig activo y una Integración de IA activa.`)
        }

        // ── Iniciar recolección de documento si la IA devolvió [START_DOC:nombre] ──
        if (startDoc) {
          try {
            const { DocumentTemplate, DocumentRequest } = require('../models')
            const { Op } = require('sequelize')
            const companyWhere = chatRecord.company_id ? { company_id: chatRecord.company_id } : {}
            // Primero buscar coincidencia exacta, luego parcial
            let tpl = await DocumentTemplate.findOne({
              where: { name: { [Op.iLike]: startDoc }, ...companyWhere }
            })
            if (!tpl) {
              tpl = await DocumentTemplate.findOne({
                where: { name: { [Op.iLike]: `%${startDoc}%` }, ...companyWhere }
              })
            }
            if (tpl) {
              const manualFields = Object.values(
                (tpl.fields || []).filter(f => f.source === 'manual')
                  .reduce((acc, f) => { if (!acc[f.key]) acc[f.key] = f; return acc; }, {})
              )
              if (manualFields.length > 0) {
                await DocumentRequest.update(
                  { status: 'rejected' },
                  { where: { session_id: sessionId, jid, status: 'collecting' } }
                )
                await DocumentRequest.create({
                  company_id:          chatRecord.company_id || null,
                  session_id:          sessionId,
                  jid,
                  template_id:         tpl.id,
                  collected_fields:    {},
                  current_field_index: 0,
                  status:              'collecting',
                  initiated_by:        'bot',
                })
                const firstField       = manualFields[0]
                const introMsg         = `Para preparar tu "${tpl.name}" necesito algunos datos (escribe *cancelar* en cualquier momento para salir).\n\n${firstField.label}:`
                const activeSockDoc    = sessions[sessionId]?.sock || sock
                const sessionStatusDoc = sessions[sessionId]?.status
                if (sessionStatusDoc !== 'connected') {
                  logger.warn(`⚠️  StartDoc [${jid}]: sesión no conectada — intro abortada`)
                } else {
                  const sentDocMsg = await activeSockDoc.sendMessage(jid, { text: introMsg })
                  const docTs      = Math.floor(Date.now() / 1000)
                  const docExtId   = sentDocMsg?.key?.id || `startdoc_${docTs}_${jid}`
                  await WhatsappMessage.findOrCreate({
                    where:    { external_id: docExtId },
                    defaults: {
                      session_id:   sessionId,
                      jid,
                      contact_name: nameToKeep,
                      body:         introMsg,
                      from_me:      true,
                      timestamp:    docTs,
                      content_type: 'text',
                      metadata:     {}
                    }
                  })
                  await chatRecord.update({ last_message: introMsg, last_message_at: docTs })
                  _io?.to('agents').emit('whatsapp:message', {
                    sessionId, from: jid, body: introMsg,
                    timestamp: docTs, externalId: docExtId,
                    fromMe: true, pushName: 'Bot', contentType: 'text', mediaUrl: null,
                    sessionType
                  })
                  logger.info(`📄 Doc recolección iniciada por IA [${jid}]: plantilla "${tpl.name}"`)
                }
              } else {
                logger.warn(`⚠️  Bot WA [${jid}]: plantilla "${startDoc}" no tiene campos manuales`)
              }
            } else {
              logger.warn(`⚠️  Bot WA [${jid}]: [START_DOC] plantilla "${startDoc}" no encontrada`)
            }
          } catch (e) {
            logger.error(`Error iniciando recolección de doc desde IA [${jid}]:`, e.message)
          }
        }

        // Enviar archivo de catálogo si la IA devolvió [SEND_FILE:id]
        if (catalogFile?.url) {
          try {
            const fsBot    = require('fs')
            const pathBot  = require('path')
            const UPLOADS_ROOT = process.env.UPLOADS_DIR || pathBot.join(__dirname, '../../uploads')
            const filePath = pathBot.join(UPLOADS_ROOT, catalogFile.url.replace(/^\/uploads\//, ''))
            logger.info(`📎 [${sessionId}] Buscando catálogo en: ${filePath}`)
            if (fsBot.existsSync(filePath)) {
              const buf    = fsBot.readFileSync(filePath)
              const isImg  = catalogFile.tipo?.startsWith('image/')
              const msgObj = isImg
                ? { image:    buf, caption:  catalogFile.nombre || '', mimetype: catalogFile.tipo }
                : { document: buf, fileName: catalogFile.nombre || 'archivo.pdf', mimetype: catalogFile.tipo || 'application/pdf' }
              await new Promise(r => setTimeout(r, 800))
              const sentFile  = await activeSock.sendMessage(jid, msgObj)
              const fileTs    = Math.floor(Date.now() / 1000)
              const fileExtId = sentFile?.key?.id || `cat_${fileTs}_${jid}`
              await WhatsappMessage.findOrCreate({
                where:    { external_id: fileExtId },
                defaults: {
                  session_id:   sessionId,
                  jid,
                  contact_name: nameToKeep,
                  body:         catalogFile.nombre || '[Catálogo]',
                  from_me:      true,
                  timestamp:    fileTs,
                  content_type: isImg ? 'image' : 'document',
                  metadata:     {}
                }
              })
              await chatRecord.update({ last_message: catalogFile.nombre || '[Catálogo]', last_message_at: fileTs })
              logger.info(`✅ Catálogo "${catalogFile.nombre}" enviado a ${jid}`)
            } else {
              logger.warn(`⚠️  Catálogo no encontrado en disco: ${filePath}`)
            }
          } catch (fileErr) {
            logger.warn(`⚠️  Error enviando catálogo a ${jid}: ${fileErr.message}`)
          }
        }

        // Evaluar reglas de flujo después de que el bot respondió
        await chatbotService.evaluateFlowRules({
          sessionId,
          jid,
          userMessage: body,
          botText:     aiResponse,
          catalogFile,
          handoff,
          chatRecord,
          sock: sessions[sessionId]?.sock || sock
        }, _io)

      } catch (e) {
        logger.error('Bot Baileys error:', e.message)
      }
    } else if (!fromMe && contentType === 'text' && body.trim() && !isOldMessage && isRealtime) {
      // Bot desactivado: evaluar reglas de flujo igualmente (triggers como user_keyword funcionan sin bot)
      try {
        const chatbotService = require('./chatbotService')
        await chatbotService.evaluateFlowRules({
          sessionId,
          jid,
          userMessage: body,
          botText:     null,
          catalogFile: null,
          handoff:     false,
          chatRecord,
          sock: sessions[sessionId]?.sock || sock
        }, _io)
      } catch (e) {
        logger.error('FlowRules (bot off) error:', e.message)
      }
    }
  } catch (e) {
    logger.error('Error actualizando chat:', e.message)
  }

  if (!fromMe) {
    logger.info(`📤 Emitiendo whatsapp:message a agents: from=${jid} body="${body?.slice(0,50)}"`)
    _io?.to('agents').emit('whatsapp:message', {
      sessionId, from: jid, body, timestamp,
      pushName, fromMe: false, contentType, mediaUrl,
      mediaMimetype: mediaMeta?.mimetype || null,
      mediaFilename: mediaMeta?.filename || null,
      sessionType, externalId: extId
    })
    if (sessions[sessionId]) sessions[sessionId].lastNotifyAt = Date.now()
  }
}

// IDs de mensajes ya emitidos vía history→realtime — persiste entre reconexiones del mismo sessionId
const realtimeEmitted = {}

// ── createSession ahora recibe sessionType ───────────────────
async function createSession(sessionId, sessionType = 'personal') {
  const sessionPath = path.join(SESSION_DIR, sessionId)
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  if (!realtimeEmitted[sessionId]) realtimeEmitted[sessionId] = new Set()

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      // makeCacheableSignalKeyStore garantiza que las sesiones Signal se persisten correctamente
      // entre mensajes — sin esto cada mensaje tiene pendingPreKey (primera sesión) y no llega al cliente
      keys: makeCacheableSignalKeyStore(state.keys, require('pino')({ level: 'silent' }))
    },
    browser:           Browsers.macOS('Desktop'),
    printQRInTerminal: false,
    logger:            require('pino')({ level: 'silent' }),
    syncFullHistory:   false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    // getMessage permite a Baileys descifrar mensajes reintentados (CIPHERTEXT retry)
    getMessage: async (key) => {
      try {
        const msg = await WhatsappMessage.findOne({ where: { session_id: sessionId, external_id: key.id } })
        if (msg?.body) return { conversation: msg.body }
      } catch (_) {}
      return { conversation: '' }
    }
  })

  sessions[sessionId] = { sock, status: 'connecting', sessionType, qr: null, historyBatches: 0, lastNotifyAt: 0 }

  // Timeout de 90 s: si no hay QR ni conexión, credenciales corruptas → limpiar y notificar
  let connectResolved = false
  const connectTimeout = setTimeout(() => {
    if (connectResolved) return
    if (sessions[sessionId]?.status === 'connecting') {
      logger.warn(`⏱️ [${sessionId}] Sin respuesta de WA en 90s — credenciales inválidas, limpiando`)
      delete sessions[sessionId]
      delete realtimeEmitted[sessionId]
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
      _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'not_found', sessionType })
      try { sock.end(undefined) } catch (_) {}
    }
  }, 90000)

  // ── Conexión ─────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    // Guard: ignorar eventos de sockets obsoletos (sesión reemplazada por una nueva)
    if (sessions[sessionId] && sessions[sessionId].sock !== sock) return

    if (qr) {
      connectResolved = true
      clearTimeout(connectTimeout)
      logger.info(`📱 QR generado para ${sessionId} — esperando escaneo`)
      const qrImage = await qrcode.toDataURL(qr)
      if (sessions[sessionId]) sessions[sessionId].qr = qrImage
      _io?.to(`session:${sessionId}`).emit('whatsapp:qr', { sessionId, qr: qrImage, sessionType })
      _io?.to('agents').emit('whatsapp:qr', { sessionId, qr: qrImage, sessionType })
    }

    if (connection === 'open') {
      connectResolved = true
      clearTimeout(connectTimeout)
      if (sessions[sessionId]) {
        sessions[sessionId].status = 'connected'
        sessions[sessionId].qr = null
        sessions[sessionId].historyBatches = 0  // reset para nueva conexión
      }
      _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'connected', sessionType })
      _io?.to(`session:${sessionId}`).emit('whatsapp:status', { sessionId, status: 'connected', sessionType })
      logger.info(`✅ WhatsApp ${sessionType} conectado: ${sessionId}`)

      // ── Cargar mappings LID→JID persistidos en whatsapp_chats.lid ────
      // Al reconectar, no siempre llega contacts.set. Guardamos el mapeo en BD
      // para recuperarlo sin depender de Baileys.
      try {
        const { Op } = require('sequelize')
        const chatsConLid = await WhatsappChat.findAll({
          where: { session_id: sessionId, lid: { [Op.ne]: null } },
          attributes: ['jid', 'lid']
        })
        if (!lidToJid[sessionId]) lidToJid[sessionId] = {}
        for (const c of chatsConLid) {
          lidToJid[sessionId][c.lid] = c.jid
          logger.info(`🗄️  LID cargado desde BD [${sessionId}]: ${c.lid} → ${c.jid}`)
        }
      } catch (e) {
        logger.warn(`⚠️  Error cargando LID mappings desde BD: ${e.message}`)
      }

      // fetchStatus('@all') eliminado — causa bloqueo de 60+ segundos innecesariamente.
      // Los nombres de contactos llegan via contacts.set / contacts.upsert / messaging-history.

      // ── Keep-alive liviano cada 3 minutos con detección de conexión muerta ──
      // Si 3 keep-alives seguidos fallan, la conexión está zombie → forzar reconexión.
      let keepAliveFails = 0
      const keepAliveTimer = setInterval(async () => {
        if (!sessions[sessionId] || sessions[sessionId].sock !== sock) {
          clearInterval(keepAliveTimer)
          return
        }
        if (sessions[sessionId].status !== 'connected') return
        try {
          await sock.fetchBlocklist()
          keepAliveFails = 0
          logger.info(`💓 [${sessionId}] Keep-alive OK`)
        } catch (e) {
          keepAliveFails++
          logger.warn(`💓 [${sessionId}] Keep-alive falló (${keepAliveFails}/3): ${e.message}`)
          if (keepAliveFails >= 3) {
            logger.warn(`💀 [${sessionId}] Conexión zombie detectada — forzando reconexión`)
            clearInterval(keepAliveTimer)
            if (sessions[sessionId]) sessions[sessionId].status = 'disconnected'
            _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'disconnected', sessionType })
            try { sock.end(undefined) } catch (_) {}
            // connection.update con 'close' se encargará de reconectar
          }
        }
      }, 3 * 60 * 1000) // cada 3 minutos
    }

    if (connection === 'close') {
      const code   = new Boom(lastDisconnect?.error)?.output?.statusCode
      const reason = lastDisconnect?.error?.message || 'desconocido'
      logger.info(`🔌 WA desconectado [${sessionId}]: code=${code} reason="${reason}"`)
      if (sessions[sessionId]) { sessions[sessionId].status = 'disconnected'; sessions[sessionId].qr = null }
      _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'disconnected', sessionType })
      _io?.to(`session:${sessionId}`).emit('whatsapp:status', { sessionId, status: 'disconnected', sessionType })
      const sessionPath = path.join(SESSION_DIR, sessionId)
      if (code === DisconnectReason.loggedOut || code === 401) {
        // Credenciales inválidas: limpiar todo y notificar al frontend para mostrar botón de conectar
        logger.warn(`🚫 [${sessionId}] WA rechazó la sesión (credenciales inválidas), limpiando...`)
        delete sessions[sessionId]
        delete realtimeEmitted[sessionId]
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
        _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'not_found', sessionType })
      } else if (sessions[sessionId] && fs.existsSync(sessionPath)) {
        logger.info(`🔄 Reconectando sesión ${sessionType}: ${sessionId}`)
        createSession(sessionId, sessionType)
      } else if (sessions[sessionId] && !fs.existsSync(sessionPath)) {
        delete sessions[sessionId]
        delete realtimeEmitted[sessionId]
        logger.info(`🧹 Sesión ${sessionId} limpiada de memoria (archivos eliminados)`)
      }
    }
  })

  // Guard: no guardar credenciales si la sesión ya fue eliminada (logout)
  sock.ev.on('creds.update', async () => {
    if (sessions[sessionId]) await saveCreds()
  })

  // ── Seguimiento de estado de entrega de mensajes enviados ──
  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      if (key.fromMe && update.status !== undefined) {
        // 1=PENDING 2=SERVER_ACK 3=DELIVERY_ACK 4=READ
        const labels = { 1: 'PENDING', 2: 'SERVER_ACK', 3: 'DELIVERY_ACK', 4: 'READ' }
        logger.info(`📬 [${sessionId}] msg ${key.id} → ${labels[update.status] || update.status}`)
        if (update.status === 2) {
          logger.info(`✅ Servidor confirmó entrega: ${key.id}`)
        }
      }
    }
  })

  // ── chats.set ────────────────────────────────────────────
  sock.ev.on('chats.set', async ({ chats }) => {
    logger.info(`📋 chats.set: ${chats.length} chats para ${sessionId} (${sessionType})`)
    for (const chat of chats) await syncChat(sessionId, chat, sessionType, sock)
    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
  })

  // ── chats.upsert ─────────────────────────────────────────
  sock.ev.on('chats.upsert', async (chats) => {
    logger.info(`📋 chats.upsert: ${chats.length} chats para ${sessionId} (${sessionType})`)
    for (const chat of chats) await syncChat(sessionId, chat, sessionType, sock)
    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
  })

  // ── messaging-history.set ────────────────────────────────
  // Sincroniza chats, contactos y guarda mensajes recientes (últimas 48h).
  sock.ev.on('messaging-history.set', async ({ chats, contacts, messages }) => {
    // Zombie guard: ignorar si este socket fue reemplazado
    if (sessions[sessionId] && sessions[sessionId].sock !== sock) {
      logger.info(`🧟 [${sessionId}] messaging-history.set de socket zombi — ignorado`)
      return
    }

    if (sessions[sessionId]) sessions[sessionId].historyBatches = (sessions[sessionId].historyBatches || 0) + 1
    const batchNum = sessions[sessionId]?.historyBatches || 1

    logger.info(`📋 messaging-history [batch ${batchNum}]: chats=${chats?.length || 0} contacts=${contacts?.length || 0} msgs=${messages?.length || 0} para ${sessionId}`)

    // Batches 3+: ignorar completamente — evita miles de operaciones DB con historial antiguo.
    // Los primeros 2 batches contienen los mensajes más recientes (últimas 48-72h).
    if (batchNum > 2) {
      logger.info(`⏭️  [${sessionId}] Batch ${batchNum}: ignorado — solo procesar primeros 2 batches`)
      return
    }

    // Sincronizar metadata de chats (last_message_at, nombre) — solo primeros 2 batches
    for (const chat of (chats || [])) {
      logger.info(`📋 [${sessionId}] history-chat: id=${chat.id} name="${chat.name || ''}"`)
      await syncChat(sessionId, chat, sessionType, sock)
    }

    // Actualizar nombres de contactos + poblar mapa LID
    for (const contact of (contacts || [])) {
      const jid  = contact.id
      const name = contact.name || contact.notify || contact.verifiedName || ''
      // Diagnóstico: loguear cada contacto de messaging-history con su lid (si tiene)
      logger.info(`📇 [${sessionId}] history-contact: id=${contact.id} lid=${contact.lid || 'NONE'} name="${name}"`)

      // Poblar mapa LID→JID si el contacto tiene propiedad .lid
      if (contact.lid && jid && !jid.endsWith('@lid')) {
        if (!lidToJid[sessionId]) lidToJid[sessionId] = {}
        const lid = contact.lid.includes('@') ? contact.lid : `${contact.lid}@lid`
        if (!lidToJid[sessionId][lid]) {
          lidToJid[sessionId][lid] = jid
          // ── Unificar chat @lid con chat real si existen los dos ────────
          // Si el @lid ya tenía mensajes guardados, migrarlos al JID real y eliminar el @lid
          try {
            const lidChat  = await WhatsappChat.findOne({ where: { session_id: sessionId, jid: lid } })
            const realChat = await WhatsappChat.findOne({ where: { session_id: sessionId, jid } })
            if (lidChat) {
              if (!realChat) {
                // No existe el real aún: simplemente renombrar el @lid al JID real
                await lidChat.update({ jid })
                await WhatsappMessage.update({ jid }, { where: { session_id: sessionId, jid: lid } })
                logger.info(`🔀 [${sessionId}] Chat @lid renombrado: ${lid} → ${jid}`)
              } else {
                // Existen ambos: mover mensajes del @lid al real y eliminar el duplicado
                await WhatsappMessage.update({ jid }, { where: { session_id: sessionId, jid: lid } })
                // Actualizar last_message del real si el @lid era más reciente
                if ((lidChat.last_message_at || 0) > (realChat.last_message_at || 0)) {
                  await realChat.update({
                    last_message:    lidChat.last_message,
                    last_message_at: lidChat.last_message_at,
                    unread_count:    (realChat.unread_count || 0) + (lidChat.unread_count || 0),
                    contact_name:    realChat.contact_name || lidChat.contact_name || name
                  })
                }
                await lidChat.destroy()
                logger.info(`🔀 [${sessionId}] Chats unificados: ${lid} → ${jid} (mensajes migrados, @lid eliminado)`)
              }
            }
          } catch (mergeErr) {
            logger.warn(`⚠️  [${sessionId}] Error unificando @lid ${lid}: ${mergeErr.message}`)
          }
        }
      }

      if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@lid') || jid.includes('@broadcast')) continue
      if (!name) continue
      try {
        // findOrCreate: persistir TODOS los contactos con nombre (aunque no tengan mensajes)
        const [record, created] = await WhatsappChat.findOrCreate({
          where:    { session_id: sessionId, jid },
          defaults: {
            session_id:      sessionId,
            jid,
            session_type:    sessionType,
            contact_name:    name,
            last_message_at: 0,
            unread_count:    0
          }
        })
        if (!created && !record.contact_name) {
          await record.update({ contact_name: name })
        }
      } catch (_) {}
    }

    // Guardar mensajes recientes (últimas 48h) para que aparezcan al abrir el chat
    const cutoffTs    = Math.floor(Date.now() / 1000) - 172800 // 48 horas
    const recentMsgs  = (messages || []).filter(m => {
      const ts = Number(m.messageTimestamp) || 0
      if (ts < cutoffTs) return false
      if (!m.message) return false
      if (m.message.protocolMessage || m.message.reactionMessage || m.message.pollUpdateMessage) return false
      const jid = m.key?.remoteJid
      return jid && !jid.endsWith('@g.us') && jid !== 'status@broadcast' && !jid.endsWith('@lid') && !jid.includes('@broadcast')
    }).slice(0, 300) // máximo 300 mensajes por batch

    if (recentMsgs.length > 0) {
      logger.info(`💾 Guardando ${recentMsgs.length} mensajes recientes (48h) en BD para ${sessionId}`)
      for (const m of recentMsgs) await saveHistoryMessage(sessionId, sessionType, m)

      // Emitir al panel los mensajes que llegaron en los últimos 60 min
      const realtimeCutoff = Math.floor(Date.now() / 1000) - 3600
      const emittedSet = realtimeEmitted[sessionId] || new Set()
      for (const m of recentMsgs) {
        const ts = Number(m.messageTimestamp) || 0
        if (ts < realtimeCutoff) continue
        if (m.key?.fromMe) continue
        const jid = m.key?.remoteJid
        if (!jid) continue
        const msgId = m.key?.id
        if (msgId && emittedSet.has(msgId)) continue  // Evitar duplicados entre batches
        if (msgId) emittedSet.add(msgId)
        const inner = m.message?.ephemeralMessage?.message
                   || m.message?.viewOnceMessage?.message
                   || m.message
        const body = inner?.conversation || inner?.extendedTextMessage?.text || ''
        if (!body) continue
        logger.info(`📤 history→realtime: jid=${jid} body="${body.slice(0,40)}"`)
        _io?.to('agents').emit('whatsapp:message', {
          sessionId, from: jid, body,
          timestamp: ts,
          pushName: m.pushName || '',
          fromMe: false, contentType: 'text', mediaUrl: null,
          sessionType
        })
      }
    }

    // ── Bot para mensajes recientes (< 5 min) que llegaron durante el sync ──
    const botCutoff = Math.floor(Date.now() / 1000) - 300
    const latestIncoming = {}
    for (const m of recentMsgs) {
      const ts = Number(m.messageTimestamp) || 0
      if (ts < botCutoff) continue
      if (m.key?.fromMe) continue
      const jid = m.key?.remoteJid
      if (!jid) continue
      const inner = m.message?.ephemeralMessage?.message
                 || m.message?.viewOnceMessage?.message
                 || m.message
      const body = inner?.conversation || inner?.extendedTextMessage?.text || ''
      if (!body?.trim()) continue
      if (!latestIncoming[jid] || ts > latestIncoming[jid].ts) {
        latestIncoming[jid] = { ts, body }
      }
    }
    for (const [jid, { ts, body }] of Object.entries(latestIncoming)) {
      try {
        const chatRecord = await WhatsappChat.findOne({ where: { session_id: sessionId, jid } })
        if (!chatRecord?.bot_enabled) continue
        const { Op } = require('sequelize')
        const yaRespondio = await WhatsappMessage.findOne({
          where: { session_id: sessionId, jid, from_me: true, timestamp: { [Op.gt]: ts } }
        })
        if (yaRespondio) continue
        logger.info(`🤖 Bot (sync) [${jid}]: "${body.slice(0,50)}"`)
        const chatbotService = require('./chatbotService')
        const result = await chatbotService.handleWhatsappMessage(sessionId, jid, body, chatRecord)
        const aiResponse = result?.text || null
        if (aiResponse) {
          const syncSock = sessions[sessionId]?.sock || sock
          const sentSync  = await syncSock.sendMessage(jid, { text: aiResponse })
          const botTs     = Math.floor(Date.now() / 1000)
          const syncExtId = sentSync?.key?.id || `bot_sync_${botTs}_${jid}`
          await WhatsappMessage.findOrCreate({
            where:    { external_id: syncExtId },
            defaults: {
              session_id:   sessionId, jid, contact_name: chatRecord.contact_name || '',
              body:         aiResponse, from_me: true, timestamp: botTs,
              content_type: 'text', metadata: {}
            }
          })
          _io?.to('agents').emit('whatsapp:message', {
            sessionId, from: jid, body: aiResponse, timestamp: botTs,
            fromMe: true, pushName: 'Bot', contentType: 'text', mediaUrl: null, sessionType
          })
          logger.info(`✅ Bot (sync) respondió a ${jid}`)
        } else {
          logger.warn(`⚠️  Bot sync [${jid}]: sin respuesta. Verifica BotConfig activo e Integración de IA.`)
        }
      } catch (e) {
        logger.error(`Bot sync error [${jid}]: ${e.message}`)
      }
    }

    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
    logger.info(`✅ messaging-history sincronizado: ${sessionId} (${sessionType})`)

    // Ping al servidor de WA para despertar la entrega de mensajes en tiempo real.
    setTimeout(async () => {
      try {
        if (sessions[sessionId]?.status === 'connected' && sessions[sessionId].sock === sock) {
          await sock.fetchBlocklist()
          logger.info(`🔔 [${sessionId}] Ping post-sync enviado — esperando mensajes en tiempo real`)
        }
      } catch (_) {}
    }, 3000)
  })

  // ── contacts.set / upsert: guarda TODOS los contactos del teléfono ──
  async function syncContactName(contact) {
    const jid  = contact.id
    const name = contact.name || contact.notify || contact.verifiedName || ''

    // Poblar mapa LID→JID autoritativo si el contacto tiene propiedad .lid
    if (contact.lid && jid && !jid.endsWith('@lid')) {
      if (!lidToJid[sessionId]) lidToJid[sessionId] = {}
      const lid = contact.lid.includes('@') ? contact.lid : `${contact.lid}@lid`

      // Solo procesar si es un mapeo nuevo (guard original seguro)
      if (!lidToJid[sessionId][lid]) {
        lidToJid[sessionId][lid] = jid
        logger.info(`🗺️  LID map [${sessionId}]: ${lid} → ${jid}`)

        // Persistir el mapeo en BD para que sobreviva reinicios
        try {
          await WhatsappChat.update({ lid }, { where: { session_id: sessionId, jid } })
        } catch (_) {}

        // ── Caso 1: había un fallback numérico incorrecto para este lid ────
        const fallbackJid = lidFallback[sessionId]?.[lid]
        if (fallbackJid && fallbackJid !== jid) {
          logger.info(`🔄 [${sessionId}] Corrigiendo fallback: ${lid} (${fallbackJid} → ${jid})`)
          try {
            const wrongChat   = await WhatsappChat.findOne({ where: { session_id: sessionId, jid: fallbackJid } })
            const correctChat = await WhatsappChat.findOne({ where: { session_id: sessionId, jid } })
            if (wrongChat) {
              await WhatsappMessage.update({ jid }, { where: { session_id: sessionId, jid: fallbackJid } })
              if (!correctChat) {
                await wrongChat.update({ jid, contact_name: wrongChat.contact_name || name })
                logger.info(`🔀 [${sessionId}] Fallback chat renombrado: ${fallbackJid} → ${jid}`)
              } else {
                if ((wrongChat.last_message_at || 0) > (correctChat.last_message_at || 0)) {
                  await correctChat.update({
                    last_message:    wrongChat.last_message,
                    last_message_at: wrongChat.last_message_at,
                    unread_count:    (correctChat.unread_count || 0) + (wrongChat.unread_count || 0),
                    contact_name:    correctChat.contact_name || wrongChat.contact_name || name
                  })
                }
                await wrongChat.destroy()
                logger.info(`🔀 [${sessionId}] Fallback chat fusionado: ${fallbackJid} → ${jid}`)
              }
            }
          } catch (e) {
            logger.warn(`⚠️  [${sessionId}] Error corrigiendo fallback @lid: ${e.message}`)
          }
          if (lidFallback[sessionId]) delete lidFallback[sessionId][lid]
        }

        // ── Caso 2: había un chat guardado con el @lid como JID crudo ──────
        try {
          const lidChat = await WhatsappChat.findOne({ where: { session_id: sessionId, jid: lid } })
          if (lidChat) {
            const realChat = await WhatsappChat.findOne({ where: { session_id: sessionId, jid } })
            await WhatsappMessage.update({ jid }, { where: { session_id: sessionId, jid: lid } })
            if (!realChat) {
              await lidChat.update({ jid, contact_name: lidChat.contact_name || name })
            } else {
              await lidChat.destroy()
            }
            logger.info(`🔀 [${sessionId}] @lid chat migrado: ${lid} → ${jid}`)
          }
        } catch (e) {
          logger.warn(`⚠️  [${sessionId}] Error migrando @lid chat: ${e.message}`)
        }
      }
    }

    if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast' || jid.endsWith('@lid') || jid.includes('@broadcast')) return
    if (!name) return

    try {
      // Upsert: crear la fila si no existe (last_message_at: 0 → no aparece en lista de chats)
      const [record, created] = await WhatsappChat.findOrCreate({
        where:    { session_id: sessionId, jid },
        defaults: {
          session_id:      sessionId,
          jid,
          session_type:    sessionType,
          contact_name:    name,
          last_message_at: 0,
          unread_count:    0
        }
      })
      // Si ya existía pero el nombre es diferente, actualizar
      if (!created && name !== record.contact_name) {
        await record.update({ contact_name: name })
      }
    } catch (_) {}
  }

  sock.ev.on('contacts.set', async ({ contacts }) => {
    logger.info(`👤 contacts.set: ${contacts.length} contactos para ${sessionId}`)
    for (const contact of contacts) await syncContactName(contact)
    _io?.to('agents').emit('whatsapp:chats_synced', { sessionId, sessionType })
  })

  sock.ev.on('contacts.upsert', async (contacts) => {
    logger.info(`👤 contacts.upsert [${sessionId}]: ${contacts.length} contacto(s) — ${contacts.map(c => `${c.id}${c.lid ? ' lid='+c.lid : ''}`).join(', ')}`)
    for (const contact of contacts) await syncContactName(contact)
  })

  // ── messages.upsert ──────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Zombie guard: ignorar si este socket fue reemplazado por uno nuevo
    if (sessions[sessionId] && sessions[sessionId].sock !== sock) {
      logger.info(`🧟 [${sessionId}] messages.upsert de socket zombi (type=${type}) — ignorado`)
      return
    }
    logger.info(`📨 messages.upsert [${sessionId}]: type=${type}, count=${messages?.length}`)
    const isRealtime = type === 'notify'
    if (type !== 'notify' && type !== 'append') return
    for (const msg of messages) {
      try {
        await processWAMessage(msg, isRealtime, sessionId, sessionType, sock)
      } catch (e) {
        logger.error(`💥 processWAMessage error [${sessionId}]: ${e.message}`, e.stack?.split('\n')[1] || '')
      }
    }
  })

  return sock
}

async function sendMessage(sessionId, to, text) {
  const session = sessions[sessionId]
  if (!session || session.status !== 'connected')
    throw new Error('Sesión no conectada')

  // Normalizar JID: si es @lid intentar resolver al JID real antes de enviar
  let jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
  if (jid.endsWith('@lid')) {
    const map = lidToJid[sessionId]
    const resolved = map?.[jid]
    if (resolved && !resolved.endsWith('@lid')) {
      logger.info(`🔄 sendMessage: @lid resuelto ${jid} → ${resolved}`)
      jid = resolved
    } else {
      // Sin mapeo autoritativo: mantener @lid — Baileys tiene la sesión Signal y puede entregarlo
      logger.info(`🆔 sendMessage: @lid sin mapeo autoritativo — enviando directo a ${jid}`)
    }
  }

  const sentMsg = await session.sock.sendMessage(jid, { text })
  const msgTs   = Math.floor(Date.now() / 1000)
  const extId   = sentMsg?.key?.id || `agent_${msgTs}_${jid}`

  // Pre-guardar en BD para que el eco de WA no cree un duplicado
  try {
    await WhatsappMessage.findOrCreate({
      where:    { external_id: extId },
      defaults: {
        session_id: sessionId, jid, contact_name: '',
        body: text, from_me: true, timestamp: msgTs,
        content_type: 'text', metadata: {}
      }
    })
    const [agentChat] = await WhatsappChat.findOrCreate({
      where:    { session_id: sessionId, jid },
      defaults: { session_id: sessionId, jid, contact_name: '', session_type: session.sessionType || 'personal' }
    })
    await agentChat.update({ last_message: text, last_message_at: msgTs })
    // Emitir via socket con externalId para que el frontend pueda deduplicar
    _io?.to('agents').emit('whatsapp:message', {
      sessionId, from: jid, body: text, timestamp: msgTs,
      fromMe: true, pushName: '', contentType: 'text', mediaUrl: null,
      sessionType: session.sessionType || 'personal', externalId: extId
    })
  } catch (_) {}

  return { key: sentMsg?.key, timestamp: msgTs, externalId: extId }
}

function getSession(sessionId)       { return sessions[sessionId] || null }
function getSessionStatus(sessionId) { return sessions[sessionId]?.status || 'not_found' }
function getSessionQr(sessionId)     { return sessions[sessionId]?.qr || null }

function getAllSessions() {
  return Object.entries(sessions).map(([id, s]) => ({
    sessionId:   id,
    status:      s.status,
    sessionType: s.sessionType || 'personal'
  }))
}

// ── Filtros por tipo ─────────────────────────────────────────
function getPersonalSessions() {
  return getAllSessions().filter(s => s.sessionType === 'personal')
}

function getBusinessSessions() {
  return getAllSessions().filter(s => s.sessionType === 'business')
}

// Desconexión suave: conserva credenciales en disco, sin auto-reconexión
function disconnectSession(sessionId) {
  const session = sessions[sessionId]
  if (session) {
    delete sessions[sessionId]          // Eliminar PRIMERO para que connection.update no reconecte
    _io?.to('agents').emit('whatsapp:status', { sessionId, status: 'disconnected', sessionType: session.sessionType || 'personal' })
    try { session.sock.end(undefined) } catch (_) {}
  }
}

// Logout completo: borra credenciales de disco y BD, próximo inicio pide QR
async function logoutSession(sessionId) {
  const session = sessions[sessionId]
  delete sessions[sessionId]       // Eliminar de memoria PRIMERO (evita zombie reconnect)
  delete realtimeEmitted[sessionId]
  delete lidToJid[sessionId]
  delete lidFallback[sessionId]

  // Limpiar mensajes y chats en BD para evitar duplicados al escanear QR nuevo
  try {
    await WhatsappMessage.destroy({ where: { session_id: sessionId } })
    await WhatsappChat.destroy({ where: { session_id: sessionId } })
    logger.info(`🗑️  BD limpiada para ${sessionId} (mensajes y chats eliminados)`)
  } catch (e) {
    logger.error(`Error limpiando BD para ${sessionId}: ${e.message}`)
  }

  const sessionPath = path.join(SESSION_DIR, sessionId)
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true })
    logger.info(`🗑️  Sesión ${sessionId} eliminada del disco`)
  }

  if (session) {
    try { session.sock.end(undefined) } catch (_) {}
  }
}

async function restoreAllSessions() {
  if (!fs.existsSync(SESSION_DIR)) return
  const dirs = fs.readdirSync(SESSION_DIR).filter(f =>
    fs.statSync(path.join(SESSION_DIR, f)).isDirectory()
  )
  logger.info(`🔄 Restaurando ${dirs.length} sesión(es) de WhatsApp...`)
  for (const sessionId of dirs) {
    try {
      const sessionType = sessionId.startsWith('business_') ? 'business' : 'personal'
      await createSession(sessionId, sessionType)
      logger.info(`✅ Sesión ${sessionType} restaurada: ${sessionId}`)
    } catch (e) {
      logger.error(`❌ Error restaurando sesión ${sessionId}: ${e.message}`)
    }
  }
}

module.exports = {
  createSession, sendMessage, getSession,
  getSessionStatus, getSessionQr, getAllSessions,
  getPersonalSessions, getBusinessSessions,
  disconnectSession, logoutSession, setSocketIO, restoreAllSessions
}