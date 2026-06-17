const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhatsappAccount = sequelize.define('whatsapp_accounts', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true
  },
  company_id: {
    type:      DataTypes.UUID,
    allowNull: false,
    comment:   'FK a la empresa propietaria de esta cuenta WA Business'
  },
  waba_id: {
    type:      DataTypes.STRING(100),
    allowNull: true,
    comment:   'WhatsApp Business Account ID de Meta'
  },
  phone_number_id: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    comment:   'Phone Number ID de Meta Cloud API (requerido para enviar mensajes)'
  },
  phone_number: {
    type:      DataTypes.STRING(30),
    allowNull: true,
    comment:   'Número de teléfono en formato E.164'
  },
  display_name: {
    type:      DataTypes.STRING(150),
    allowNull: true,
    comment:   'Nombre de la cuenta WA Business mostrado en Meta'
  },
  access_token: {
    type:      DataTypes.TEXT,
    allowNull: false,
    comment:   'Token de acceso permanente de Meta (nunca se devuelve al frontend)'
  },
  app_secret: {
    type:      DataTypes.STRING(200),
    allowNull: true,
    comment:   'App Secret para validar firma HMAC del webhook'
  },
  verify_token: {
    type:      DataTypes.STRING(100),
    allowNull: true,
    comment:   'Token usado para verificar el webhook de Meta'
  },
  meta_user_id: {
    type:      DataTypes.STRING(100),
    allowNull: true,
    comment:   'Facebook User ID del admin que autorizó via Embedded Signup'
  },
  connected_via: {
    type:         DataTypes.ENUM('embedded_signup', 'manual'),
    defaultValue: 'manual',
    comment:      'Método de conexión'
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at'
});

module.exports = WhatsappAccount;
