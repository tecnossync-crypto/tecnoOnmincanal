// backend/src/controllers/messageController.js
// ─────────────────────────────────────────────────────────────
// Controlador de mensajes y conversaciones
// Usa req.conversationFilter inyectado por scopeConversations
// para que agentes solo vean sus conversaciones asignadas
// ─────────────────────────────────────────────────────────────
const messageService = require('../services/messageService');
const { Conversation, Message, Contact, User } = require('../models');
const logger = require('../config/logger');

class MessageController {

  // GET /conversations
  async getConversations(req, res) {
    try {
      const { page = 1, limit = 20, status, channel, search } = req.query;

      // req.conversationFilter viene de scopeConversations:
      //   admin → {}
      //   agent → { assigned_agent_id: req.user.id }
      const scopeFilter = req.conversationFilter || {};

      const result = await messageService.getConversations({
        page: +page,
        limit: +limit,
        status,
        channel,
        search,
        extraFilter: scopeFilter        // nuevo parámetro que messageService debe respetar
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error getConversations:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /conversations/:id
  async getConversation(req, res) {
    try {
      // Si requireConversationAccess ya cargó la conv, la reutilizamos
      const conversation = req.conversation || await Conversation.findByPk(req.params.id, {
        include: [
          { model: Contact, as: 'contact' },
          { model: User,    as: 'assigned_agent', attributes: ['id', 'name', 'avatar_url', 'role'] }
        ]
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /conversations/:id/messages
  async getMessages(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const result = await messageService.getMessages(req.params.id, { page: +page, limit: +limit });

      // Resetear contador de no leídos
      await Conversation.update({ unread_count: 0 }, { where: { id: req.params.id } });

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/messages
  async sendMessage(req, res) {
    try {
      const { text } = req.body;
      const conversationId = req.params.id;

      if (!text?.trim()) {
        return res.status(400).json({ success: false, message: 'El mensaje no puede estar vacío.' });
      }

      const message = await messageService.sendOutgoingMessage({
        conversationId,
        text:        text.trim(),
        senderType:  'agent',
        senderId:    req.user?.id
      });

      res.json({ success: true, data: message });
    } catch (error) {
      logger.error('Error sendMessage:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/assign  (solo admin — ver routes)
  async assignConversation(req, res) {
    try {
      const { agentId } = req.body;

      if (agentId) {
        const agent = await User.findOne({ where: { id: agentId, role: 'agent', is_active: true } });
        if (!agent) {
          return res.status(400).json({ success: false, message: 'Agente no válido o inactivo.' });
        }
      }

      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });

      await conversation.update({
        assigned_agent_id: agentId || null,
        status: agentId ? 'assigned' : 'open'
      });

      const io = req.app.get('io');
      if (io) {
        io.to('agents').emit('conversation:assigned', {
          conversationId: conversation.id,
          agentId
        });
        // Notificar específicamente al agente asignado
        if (agentId) {
          io.to(`user:${agentId}`).emit('conversation:assigned_to_you', {
            conversationId: conversation.id
          });
        }
      }

      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /conversations/:id/resolve
  async resolveConversation(req, res) {
    try {
      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });

      await conversation.update({ status: 'resolved', assigned_agent_id: null });
      res.json({ success: true, data: conversation });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new MessageController();
