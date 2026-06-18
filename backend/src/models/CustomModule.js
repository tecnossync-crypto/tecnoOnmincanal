// backend/src/models/CustomModule.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomModule = sequelize.define('CustomModule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  icon:  { type: DataTypes.STRING(50), defaultValue: 'Box' },
  color: { type: DataTypes.STRING(20), defaultValue: '#6366f1' },
  description: { type: DataTypes.TEXT, allowNull: true },
  // Array of field definitions: [{ id, label, type, required, options }]
  fields_schema: { type: DataTypes.JSONB, defaultValue: [] },
  daily_limit:   { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 = sin límite
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 },
  company_id:    { type: DataTypes.UUID, allowNull: true },
}, {
  tableName:  'custom_modules',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = CustomModule;
