// backend/src/models/QuickMessage.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuickMessage = sequelize.define('QuickMessage', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true
  },
  title: {
    type:      DataTypes.STRING(100),
    allowNull: false
  },
  shortcut: {
    type:      DataTypes.STRING(50),
    allowNull: true
  },
  content: {
    type:      DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type:         DataTypes.STRING(50),
    allowNull:    true,
    defaultValue: 'General'
  },
  // 'all' | 'whatsapp_business' | 'inbox'
  channel: {
    type:         DataTypes.STRING(30),
    defaultValue: 'all',
    allowNull:    false
  },
  sort_order: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName:  'quick_messages',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = QuickMessage;
