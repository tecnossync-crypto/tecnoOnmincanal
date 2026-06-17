// backend/src/models/Integration.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Integration = sequelize.define('integrations', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  provider: {
    type:      DataTypes.ENUM('claude', 'openai', 'gemini'),
    allowNull: false,
    comment:   'Proveedor de IA'
  },
  api_key: {
    type:      DataTypes.TEXT,
    allowNull: false,
    comment:   'API Key del cliente'
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
    comment:      'Solo un proveedor activo a la vez'
  },
  label: {
    type:      DataTypes.STRING,
    allowNull: true,
    comment:   'Nombre descriptivo'
  }
}, {
  indexes: [
    { fields: ['provider'] },
    { fields: ['is_active'] }
  ]
});

module.exports = Integration;