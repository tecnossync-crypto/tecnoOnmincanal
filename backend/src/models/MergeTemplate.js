const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MergeTemplate = sequelize.define('merge_templates', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  canal: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'all',
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  variables: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'merge_templates',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['company_id'] },
    { fields: ['activo'] },
    { fields: ['canal'] },
  ],
});

module.exports = MergeTemplate;
