// backend/src/models/Company.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('company', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
    defaultValue: '',
  },
  sitio_web: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  telefono: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  telefono_secundario: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmail: true },
  },
  fax: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  ciudad: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pais: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  logo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  horarios: {
    type:         DataTypes.JSONB,
    allowNull:    true,
    defaultValue: null,
  },
  active_features: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      inbox:              true,
      whatsapp_personal:  true,
      whatsapp_business:  true,
      campaigns:          true,
      vouchers:           true,
      appointments:       true,
      document_templates: true,
      bot_ai:             true,
      flow_rules:         true,
      quick_messages:     true,
      labels:             true,
      custom_modules:     true,
      bot_catalogs:       true,
      dashboard:          true,
      team_management:    true,
      merge_templates:    true,
      config_company_profile: true,
      config_info_panel:      true,
      config_import_contacts: true,
      config_messenger:       true,
      config_instagram:       true,
      config_tiktok:          true,
      config_telegram:        true,
      config_bot_response:    true,
      config_chat_routing:    true,
      config_reports:         true,
      config_integrations:    true,
      config_widgets:         true,
      config_plugins:         true,
    },
  },
}, {
  tableName: 'company',
  timestamps: true,
  underscored: true,
});

module.exports = Company;   