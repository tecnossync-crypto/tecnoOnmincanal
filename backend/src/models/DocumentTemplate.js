const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentTemplate = sequelize.define('document_templates', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id:        { type: DataTypes.UUID, allowNull: true },
  name:              { type: DataTypes.STRING(200), allowNull: false },
  description:       { type: DataTypes.TEXT, allowNull: true },
  filename_original: { type: DataTypes.STRING(300), allowNull: false },
  filename_stored:   { type: DataTypes.STRING(300), allowNull: false },
  fields:            { type: DataTypes.JSONB, defaultValue: [] },
  trigger_keywords:  { type: DataTypes.JSONB, defaultValue: [] },
  created_by:        { type: DataTypes.UUID, allowNull: true },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['company_id'] }]
});

module.exports = DocumentTemplate;
