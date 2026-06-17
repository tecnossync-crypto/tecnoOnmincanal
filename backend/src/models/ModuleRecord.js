// backend/src/models/ModuleRecord.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ModuleRecord = sequelize.define('ModuleRecord', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  module_id:   { type: DataTypes.INTEGER, allowNull: false },
  contact_name:{ type: DataTypes.STRING(150), allowNull: true },
  contact_jid: { type: DataTypes.STRING(100), allowNull: true },
  session_id:  { type: DataTypes.STRING(100), allowNull: true },
  conversation_id: { type: DataTypes.INTEGER, allowNull: true },
  // Dynamic field values: { fieldId: value, ... }
  data:        { type: DataTypes.JSONB, defaultValue: {} },
  // Built-in status: pending | in_progress | completed | cancelled
  status:      { type: DataTypes.STRING(30), defaultValue: 'pending' },
  notes:       { type: DataTypes.TEXT, allowNull: true },
  created_by:  { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName:  'module_records',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = ModuleRecord;
