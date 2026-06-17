// backend/src/models/Message.js
// Mensaje individual dentro de una conversación

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('messages', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Relaciones
  conversation_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'conversations', key: 'id' },
    onDelete: 'CASCADE'
  },

  // ID del mensaje en la plataforma de Meta (para deduplicación)
  external_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    comment: 'ID del mensaje en WhatsApp/Messenger/Instagram'
  },

  // Dirección del mensaje
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    comment: 'inbound=recibido del cliente, outbound=enviado por nosotros'
  },

  // Origen del mensaje saliente
  sender_type: {
    type: DataTypes.ENUM('contact', 'agent', 'bot'),
    allowNull: false,
    defaultValue: 'contact'
  },
  sender_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID del agente si sender_type=agent'
  },

  // Contenido del mensaje
  content_type: {
    type: DataTypes.ENUM('text', 'image', 'audio', 'video', 'document', 'template', 'interactive'),
    defaultValue: 'text'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Texto del mensaje'
  },
  media_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL del archivo multimedia'
  },
  media_mime_type: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Estado de entrega
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
    defaultValue: 'pending'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Timestamp del mensaje original de Meta
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Metadata adicional (botones, listas, etc.)
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    { fields: ['conversation_id'] },
    { fields: ['external_id'] },
    { fields: ['direction'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Message;
