// backend/src/controllers/webhookController.js
// Controlador de webhooks: recibe y procesa eventos de Meta (WhatsApp, Messenger, Instagram)

const crypto = require('crypto');
const logger = require('../config/logger');
const messageService = require('../services/messageService');
const metaService = require('../services/metaService');

class WebhookController {

  /**
   * Verificación del webhook (Meta lo llama una vez para confirmar el endpoint)
   * GET /webhook/:channel?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
   */
  verify(req, res) {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      logger.info(`✅ Webhook verificado para canal: ${req.params.channel}`);
      return res.status(200).send(challenge);
    }

    logger.warn(`❌ Verificación de webhook fallida. Token recibido: ${token}`);
    return res.sendStatus(403);
  }

  /**
   * Recepción de eventos del webhook
   * POST /webhook/:channel
   * 
   * Meta envía un objeto con todos los mensajes y eventos del lote
   */
  async receive(req, res) {
    // IMPORTANTE: Responder 200 inmediatamente a Meta
    // Si tardamos más de 20 segundos, Meta marcará el webhook como fallido
    res.sendStatus(200);

    const { channel } = req.params;
    const body = req.body;

    // Verificar firma para seguridad
    const signature = req.headers['x-hub-signature-256'];
    if (signature && process.env.META_APP_SECRET) {
      const rawBody = req.rawBody;  // guardado por el middleware
      if (!metaService.verifySignature(rawBody, signature)) {
        logger.error('❌ Firma del webhook inválida - posible ataque');
        return;  // Ya respondimos 200, solo logueamos
      }
    }

    try {
      // Cada canal tiene su propia estructura de payload
      switch (channel) {
        case 'whatsapp':
          await this.processWhatsAppWebhook(body);
          break;
        case 'messenger':
          await this.processMessengerWebhook(body);
          break;
        case 'instagram':
          await this.processInstagramWebhook(body);
          break;
        default:
          logger.warn(`Canal desconocido: ${channel}`);
      }
    } catch (error) {
      logger.error('❌ Error procesando webhook:', error);
      // No lanzamos el error - ya respondimos 200
    }
  }

  /**
   * Procesa el payload de WhatsApp Cloud API
   * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
   */
  async processWhatsAppWebhook(body) {
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const messages = value?.messages || [];
        const contacts = value?.contacts || [];

        for (const message of messages) {
          // Obtener nombre del contacto si está disponible
          const contactInfo = contacts.find(c => c.wa_id === message.from);
          const senderName = contactInfo?.profile?.name;

          // Extraer contenido según tipo de mensaje
          const { text, mediaUrl, contentType } = this.extractWhatsAppContent(message);

          logger.info(`📱 WhatsApp de ${message.from}: ${text?.substring(0, 50)}`);

          await messageService.processIncomingMessage({
            channel: 'whatsapp',
            senderId: message.from,
            senderName,
            text,
            mediaUrl,
            contentType,
            externalId: message.id,
            timestamp: message.timestamp
          });
        }

        // Procesar actualizaciones de estado (entregado, leído)
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          await this.handleWhatsAppStatusUpdate(status);
        }
      }
    }
  }

  /**
   * Extrae el contenido de un mensaje de WhatsApp según su tipo
   */
  extractWhatsAppContent(message) {
    switch (message.type) {
      case 'text':
        return { text: message.text?.body, contentType: 'text' };
      case 'image':
        return { text: message.image?.caption, mediaUrl: message.image?.id, contentType: 'image' };
      case 'audio':
        return { text: '[Audio]', mediaUrl: message.audio?.id, contentType: 'audio' };
      case 'video':
        return { text: message.video?.caption || '[Video]', mediaUrl: message.video?.id, contentType: 'video' };
      case 'document':
        return { text: message.document?.filename || '[Documento]', mediaUrl: message.document?.id, contentType: 'document' };
      case 'location':
        const loc = message.location;
        return { text: `📍 Ubicación: ${loc?.latitude}, ${loc?.longitude}`, contentType: 'text' };
      case 'interactive':
        // Respuestas a botones o listas
        const interactiveText = message.interactive?.button_reply?.title 
          || message.interactive?.list_reply?.title 
          || '[Respuesta interactiva]';
        return { text: interactiveText, contentType: 'interactive' };
      default:
        return { text: `[${message.type}]`, contentType: 'text' };
    }
  }

  /**
   * Actualiza el estado de un mensaje (sent/delivered/read)
   */
  async handleWhatsAppStatusUpdate(status) {
    try {
      const { Message } = require('../models');
      await Message.update(
        { status: status.status },
        { where: { external_id: status.id } }
      );
    } catch (error) {
      logger.debug('Estado de mensaje no actualizado:', error.message);
    }
  }

  /**
   * Procesa el payload de Messenger
   */
  async processMessengerWebhook(body) {
    if (body.object !== 'page') return;

    for (const entry of (body.entry || [])) {
      for (const event of (entry.messaging || [])) {
        // Solo procesar mensajes (no postbacks, deliveries, etc.)
        if (!event.message || event.message.is_echo) continue;

        const senderId = event.sender.id;
        const text = event.message.text;
        const messageId = event.message.mid;

        logger.info(`💬 Messenger de ${senderId}: ${text?.substring(0, 50)}`);

        await messageService.processIncomingMessage({
          channel: 'messenger',
          senderId,
          text,
          externalId: messageId,
          contentType: event.message.attachments ? 'image' : 'text',
          timestamp: event.timestamp
        });
      }
    }
  }

  /**
   * Procesa el payload de Instagram Direct Messages
   */
  async processInstagramWebhook(body) {
    // Instagram usa la misma estructura que Messenger
    if (body.object !== 'instagram') return;

    for (const entry of (body.entry || [])) {
      for (const event of (entry.messaging || [])) {
        if (!event.message || event.message.is_echo) continue;

        const senderId = event.sender.id;
        const text = event.message.text;
        const messageId = event.message.mid;

        logger.info(`📸 Instagram DM de ${senderId}: ${text?.substring(0, 50)}`);

        await messageService.processIncomingMessage({
          channel: 'instagram',
          senderId,
          text,
          externalId: messageId,
          contentType: 'text',
          timestamp: event.timestamp
        });
      }
    }
  }
}

module.exports = new WebhookController();
