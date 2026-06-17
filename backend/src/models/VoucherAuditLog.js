// backend/src/models/VoucherAuditLog.js
// Tabla de auditoría de comprobantes — inmutable (solo insert)
// Mismo patrón de modelo que el resto del proyecto

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VoucherAuditLog = sequelize.define('voucher_audit_logs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  voucher_id: {
    type: DataTypes.UUID,
    allowNull: false
  },

  // Snapshot del usuario — evita joins si el usuario se elimina después
  user_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_role: {
    type: DataTypes.STRING,
    allowNull: true
  },

  action: {
    type: DataTypes.ENUM(
      'created',
      'updated',
      'status_changed',
      'file_uploaded',
      'file_deleted',
      'verified',
      'rejected',
      'fraud_flagged',
      'notes_updated',
      'viewed'
    ),
    allowNull: false
  },

  previous_status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  new_status: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Qué campos cambiaron: { field: { from, to } }
  changes: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },

  ip_address: {
    type: DataTypes.STRING(45), // soporta IPv6
    allowNull: true
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  note: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  updatedAt: false, // Los logs son inmutables
  indexes: [
    { fields: ['voucher_id'] },
    { fields: ['user_id'] },
    { fields: ['action'] }
  ]
});

module.exports = VoucherAuditLog;
