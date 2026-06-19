// backend/src/models/BotFile.js
// Archivos que el bot puede enviar automáticamente
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BotFile = sequelize.define('bot_files', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  name: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'Nombre descriptivo ej: Cotización seguro básico'
  },
  category: {
    type:      DataTypes.STRING,
    allowNull: true,
    comment:   'Ej: Cotizaciones, Tarifas, Contratos'
  },
  file_path: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'Ruta del archivo en el servidor'
  },
  file_name: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'Nombre original del archivo'
  },
  file_type: {
    type:      DataTypes.STRING,
    allowNull: false,
    comment:   'MIME type del archivo'
  },
  file_size: {
    type:      DataTypes.INTEGER,
    allowNull: true
  },
  // Reglas que disparan el envío de este archivo
  trigger_rules: {
    type:         DataTypes.JSONB,
    defaultValue: [],
    comment:      '[{type: "keyword", values: ["cotización", "precio"]}, {type: "intent", value: "solicitar_cotizacion"}]'
  },
  // Mensaje que acompaña al archivo
  caption: {
    type:      DataTypes.TEXT,
    allowNull: true,
    comment:   'Mensaje que el bot envía junto al archivo'
  },
  // Si el bot puede decidir enviarlo sin regla explícita
  ai_can_send: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
    comment:      'Si la IA puede decidir enviar este archivo según contexto'
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  },
  sort_order: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  },
  company_id: {
    type:      DataTypes.UUID,
    allowNull: true,
    comment:   'Empresa propietaria del archivo'
  }
}, {
  indexes: [
    { fields: ['category'] },
    { fields: ['is_active'] },
    { fields: ['company_id'] },
  ]
});

module.exports = BotFile;