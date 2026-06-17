// backend/src/models/PaymentVoucher.js
// Modelo de Comprobantes de Pago
// Usa exactamente el mismo sequelize, DataTypes y convenciones que los demás modelos del proyecto

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentVoucher = sequelize.define('payment_vouchers', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Código único legible — Formato: VCH-YYYYMMDD-XXXXX
  code: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true
  },

  // FK al contacto (cliente)
  contact_id: {
    type: DataTypes.UUID,
    allowNull: false
  },

  // FK al usuario que verificó/rechazó (nullable)
  verified_by: {
    type: DataTypes.UUID,
    allowNull: true
  },

  // Soporte multi-tenant (igual que Contact y User)
  company_id: {
    type: DataTypes.UUID,
    allowNull: true
  },

  // Datos del pago
  amount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'DOP',
    allowNull: false
  },
  payment_method: {
    type: DataTypes.ENUM('bank_transfer', 'cash', 'card', 'mobile_payment', 'crypto', 'other'),
    allowNull: false,
    defaultValue: 'bank_transfer'
  },
  reference_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Archivos adjuntos — array de objetos JSON (igual que metadata en Contact)
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: []
  },

  // Estado del comprobante
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected', 'fraud_suspected'),
    defaultValue: 'pending',
    allowNull: false
  },

  // Notas internas (solo visibles para admin/supervisor)
  internal_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Timestamps de acciones
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejected_at: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Metadata adicional — igual que Contact.metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  // underscored: true, timestamps: true, freezeTableName: true
  // vienen del define global en database.js
  indexes: [
    { unique: true, fields: ['code'] },
    { fields: ['contact_id'] },
    { fields: ['status'] },
    { fields: ['payment_date'] },
    { fields: ['company_id'] },
    { fields: ['reference_number'] }
  ]
});

module.exports = PaymentVoucher;
