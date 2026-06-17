const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Campaign = sequelize.define('campaign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'draft',
  },
  channel: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'whatsapp',
  },
  message_template: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '',
  },
  audience_filter: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {},
  },
  messages_per_minute: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  total_recipients: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  sent_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  failed_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  started_at: {
    type: DataTypes.DATE,
    allowNull: true,
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
  tableName: 'campaigns',
  timestamps: true,
  underscored: true,
});

module.exports = Campaign;
