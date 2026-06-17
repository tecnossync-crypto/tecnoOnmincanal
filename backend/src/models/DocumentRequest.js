const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentRequest = sequelize.define('document_requests', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id:           { type: DataTypes.UUID, allowNull: true },
  session_id:           { type: DataTypes.STRING(100), allowNull: false },
  jid:                  { type: DataTypes.STRING(100), allowNull: false },
  template_id:          { type: DataTypes.UUID, allowNull: false },
  collected_fields:     { type: DataTypes.JSONB, defaultValue: {} },
  current_field_index:  { type: DataTypes.INTEGER, defaultValue: 0 },
  status:               { type: DataTypes.ENUM('collecting','ready','sent','rejected'), defaultValue: 'collecting' },
  generated_file_path:  { type: DataTypes.STRING(500), allowNull: true },
  initiated_by:         { type: DataTypes.ENUM('bot','agent'), defaultValue: 'bot' },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['session_id', 'jid', 'status'] },
    { fields: ['company_id', 'status'] },
  ]
});

module.exports = DocumentRequest;
