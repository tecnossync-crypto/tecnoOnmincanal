// backend/src/models/WhatsappMessage.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhatsappMessage = sequelize.define('whatsapp_messages', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  session_id: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'ID de la sesión Baileys'
  },
  jid: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'WhatsApp JID del contacto'
  },
  contact_name: {
    type:      DataTypes.STRING,
    allowNull: true
  },
  body: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  from_me: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false
  },
  timestamp: {
    type:      DataTypes.BIGINT,
    allowNull: true
  },
  external_id: {
    type:      DataTypes.STRING,
    allowNull: true,
    unique:    true
  },
  content_type: {
    type:         DataTypes.ENUM('text', 'image', 'audio', 'video', 'document'),
    defaultValue: 'text'
  },
  metadata: {
    type:         DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  indexes: [
    { fields: ['session_id'] },
    { fields: ['jid'] },
    { fields: ['session_id', 'jid'] },
    { fields: ['external_id'] },
    { fields: ['timestamp'] },
    { fields: ['created_at'] }
  ]
});

module.exports = WhatsappMessage;