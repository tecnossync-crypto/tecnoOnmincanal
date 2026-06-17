// backend/src/models/Conversation.js
// Conversación: agrupa los mensajes de un contacto en un canal específico

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('conversations', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Relaciones
  contact_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'contacts', key: 'id' },
    onDelete: 'CASCADE'
  },
  assigned_agent_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Usuario (agente) asignado. NULL = chatbot maneja'
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true
  },

  // Canal de comunicación
  channel: {
    type: DataTypes.ENUM('whatsapp', 'messenger', 'instagram'),
    allowNull: false
  },

  // Estado de la conversación
  status: {
    type: DataTypes.ENUM('open', 'assigned', 'resolved', 'bot'),
    defaultValue: 'bot',
    comment: 'bot=manejado por IA, open=sin asignar, assigned=con agente, resolved=cerrado'
  },

  // Datos de la última interacción
  last_message_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_message_preview: {
    type: DataTypes.STRING(500),
    allowNull: true
  },

  // Contador para UI
  unread_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // Prioridad para agentes
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal'
  },

  // Metadata adicional
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    { fields: ['contact_id'] },
    { fields: ['channel'] },
    { fields: ['status'] },
    { fields: ['assigned_agent_id'] },
    { fields: ['last_message_at'] },
    { fields: ['company_id'] }
  ]
});

module.exports = Conversation;
