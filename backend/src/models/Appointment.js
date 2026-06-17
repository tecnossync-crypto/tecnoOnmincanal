const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Appointment = sequelize.define('appointments', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id:       { type: DataTypes.UUID, allowNull: true },
  title:            { type: DataTypes.STRING(200), allowNull: true },
  contact_name:     { type: DataTypes.STRING(150), allowNull: false },
  contact_phone:    { type: DataTypes.STRING(50),  allowNull: true },
  contact_jid:      { type: DataTypes.STRING(100), allowNull: true },
  date:             { type: DataTypes.DATEONLY, allowNull: false },
  start_time:       { type: DataTypes.STRING(5), allowNull: false },
  duration_minutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  status:           { type: DataTypes.ENUM('pending','confirmed','cancelled','completed'), defaultValue: 'pending' },
  notes:            { type: DataTypes.TEXT, allowNull: true },
  assigned_to:      { type: DataTypes.UUID, allowNull: true },
  created_by:       { type: DataTypes.UUID, allowNull: true },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['company_id', 'date'] },
    { fields: ['date'] },
    { fields: ['status'] },
  ]
});

module.exports = Appointment;
