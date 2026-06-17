const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BotCatalog = sequelize.define('bot_catalogs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  identificador: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    comment: 'Slug único usado en el prompt: {{catalogo:identificador}}'
  },
  descripcion: {
    type: DataTypes.STRING(300),
    allowNull: true,
    defaultValue: null
  },
  tipo: {
    type: DataTypes.STRING(40),
    defaultValue: 'general',
    comment: 'vehiculos | seguros | tarifas | productos | servicios | general'
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: ''
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  archivo_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null,
    comment: 'Ruta relativa del archivo subido: /uploads/catalogs/...'
  },
  archivo_nombre: {
    type: DataTypes.STRING(255),
    allowNull: true,
    defaultValue: null,
    comment: 'Nombre original del archivo'
  },
  archivo_tipo: {
    type: DataTypes.STRING(80),
    allowNull: true,
    defaultValue: null,
    comment: 'MIME type: application/pdf | image/jpeg | image/png | image/webp'
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['identificador'] }
  ]
});

module.exports = BotCatalog;
