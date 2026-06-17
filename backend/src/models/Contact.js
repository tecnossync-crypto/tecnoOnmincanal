// backend/src/models/Contact.js
// Modelo de contactos: representa a cada cliente que escribe por cualquier canal

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Contact = sequelize.define('contacts', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Identificadores externos por canal
  whatsapp_id: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    comment: 'Número de teléfono en WhatsApp (e.g. 18095551234)'
  },
  messenger_id: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    comment: 'PSID de Facebook Messenger'
  },
  instagram_id: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    comment: 'IG-SCOPED ID de Instagram'
  },

  // Datos del contacto
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Metadata
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'Etiquetas para segmentación'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Datos adicionales del contacto'
  },
  is_blocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Para multi-tenant SaaS'
  }
}, {
  indexes: [
    { fields: ['whatsapp_id'] },
    { fields: ['messenger_id'] },
    { fields: ['instagram_id'] },
    { fields: ['company_id'] }
  ]
});

module.exports = Contact;
