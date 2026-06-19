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
  },
  // Cambio de email pendiente de verificación
  pending_email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email_change_token: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  email_change_expires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Tracking de tiempo en línea
  online_started_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  total_online_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // ── Información personal extendida ──────────────────────────
  cedula: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  identificacion: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  genero: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  fecha_nacimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  fecha_incorporacion: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  idioma_preferido: {
    type: DataTypes.STRING(10),
    defaultValue: 'es',
    allowNull: true,
  },
  zona_horaria: {
    type: DataTypes.STRING(60),
    defaultValue: 'America/Santo_Domingo',
    allowNull: true,
  },
  movil: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  telefono: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  extension_telefono: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  // ── OTP de inicio de sesión ──────────────────────────────────
  login_otp: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  login_otp_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Verificación de email al crear cuenta
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  email_verification_code: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  email_verification_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
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
