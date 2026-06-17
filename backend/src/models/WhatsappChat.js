// backend/src/models/WhatsappChat.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhatsappChat = sequelize.define('whatsapp_chats', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  session_id: {
    type:      DataTypes.STRING,
    allowNull: false
  },
  jid: {
    type:      DataTypes.STRING,
    allowNull: false
  },
  // ── NUEVO: diferencia personal vs business ──────────────
  session_type: {
    type:         DataTypes.ENUM('personal', 'business'),
    allowNull:    false,
    defaultValue: 'personal',
    comment:      'personal = Baileys QR personal | business = WhatsApp Business del asesor'
  },
  contact_name: {
    type:      DataTypes.STRING,
    allowNull: true
  },
  bot_enabled: {
    type:         DataTypes.BOOLEAN,
    defaultValue: false
  },
  bot_mode: {
    type:         DataTypes.STRING(20),
    defaultValue: 'generic',
    allowNull:    false,
    comment:      'generic = usa BotConfig global | custom = usa bot_prompt del chat'
  },
  bot_prompt: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  unread_count: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  },
  last_message: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  last_message_at: {
    type:      DataTypes.BIGINT,
    allowNull: true
  },
  labels: {
    type:         DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    allowNull:    false
  },
  lid: {
    type:      DataTypes.STRING(100),
    allowNull: true,
    comment:   'WhatsApp @lid JID → mapeo persistente LID→real JID'
  }
}, {
  indexes: [
    { unique: true, fields: ['session_id', 'jid'] },
    { fields: ['session_id'] },
    { fields: ['session_type'] },
    { fields: ['bot_enabled'] },
    { fields: ['last_message_at'] }
  ]
});

module.exports = WhatsappChat;