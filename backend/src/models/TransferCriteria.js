// backend/src/models/TransferCriteria.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransferCriteria = sequelize.define('transfer_criteria', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  name: {
    type:      DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('keyword', 'intent', 'message_count', 'date_urgency', 'after_quote'),
    allowNull: false
  },
  config: {
    type:         DataTypes.JSONB,
    defaultValue: {},
    comment:      'keywords:[...], message_limit:10, days_threshold:30'
  },
  transfer_message: {
    type:         DataTypes.TEXT,
    defaultValue: 'Te conecto con un asesor ahora mismo. Un momento por favor. 🙏'
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  },
  priority: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  indexes: [
    { fields: ['type'] },
    { fields: ['is_active'] }
  ]
});

module.exports = TransferCriteria;