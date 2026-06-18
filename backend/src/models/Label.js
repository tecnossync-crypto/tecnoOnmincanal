const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Label = sequelize.define('labels', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  descripcion: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  color: {
    type: DataTypes.STRING(20),
    defaultValue: '#6366f1'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  updated_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Label;
