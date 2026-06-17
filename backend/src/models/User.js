// backend/src/models/User.js
// Usuarios del sistema (agentes y administradores)

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('superadmin', 'admin', 'agent', 'supervisor'),
    defaultValue: 'agent'
  },
  avatar_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  company_id: {
    type: DataTypes.UUID,
    allowNull: true   // NULL solo para superadmin
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  reset_token: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  reset_token_expires: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  hooks: {
    // Hash automático de contraseña antes de guardar
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    }
  }
});

// Método para comparar contraseña (no se guarda en JSON)
User.prototype.comparePassword = async function(plainPassword) {
  return bcrypt.compare(plainPassword, this.password_hash);
};

// No incluir el hash en respuestas JSON
User.prototype.toJSON = function() {
  const values = { ...this.get() };
  delete values.password_hash;
  return values;
};

module.exports = User;
