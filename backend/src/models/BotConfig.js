// backend/src/models/BotConfig.js
// Configuración del chatbot por empresa/canal

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BotConfig = sequelize.define('bot_configs', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  company_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'NULL = configuración global (un solo tenant)'
  },

  // Canal al que aplica esta config
  channel: {
    type: DataTypes.ENUM('whatsapp', 'messenger', 'instagram', 'all'),
    defaultValue: 'all'
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Mi Asistente IA'
  },

  // El system prompt es lo más importante: define la personalidad del bot
  system_prompt: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: `Eres un asistente de atención al cliente amable y profesional. 
Responde de manera concisa y útil. 
Si no puedes resolver algo, ofrece escalar al equipo humano.
Siempre saluda cordialmente y despídete de manera amistosa.`
  },

  // Activar/desactivar el bot
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // Palabras que disparan escalado inmediato a humano
  escalation_keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['humano', 'agente', 'persona', 'hablar con alguien', 'ayuda urgente'],
    comment: 'Si el usuario escribe alguna de estas palabras, se escala al instante'
  },

  // Mensaje que se envía cuando se escala a humano
  escalation_message: {
    type: DataTypes.TEXT,
    defaultValue: 'Entiendo que necesitas hablar con un agente. Te estoy conectando con un miembro de nuestro equipo. Por favor espera un momento. 🙏'
  },

  // Mensaje de bienvenida automático
  welcome_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '¡Hola! 👋 Soy el asistente virtual. ¿En qué puedo ayudarte hoy?'
  },

  // Horario de atención del bot (fuera de horario, siempre escala)
  business_hours: {
    type: DataTypes.JSONB,
    defaultValue: {
      enabled: false,
      timezone: 'America/Santo_Domingo',
      schedule: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '09:00', close: '13:00' },
        sunday: null
      }
    }
  },

  // Cuántos mensajes de historial incluir en cada llamada a Claude
  max_history_messages: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    validate: { min: 5, max: 50 }
  },

  // Modelo de Claude a usar
  ai_model: {
    type: DataTypes.STRING,
    defaultValue: 'claude-sonnet-4-20250514'
  },

  // Temperatura de respuesta (0=determinístico, 1=creativo)
  ai_temperature: {
    type: DataTypes.FLOAT,
    defaultValue: 0.7,
    validate: { min: 0, max: 1 }
  }
}, {
  indexes: [
    { fields: ['company_id'] },
    { fields: ['channel'] }
  ]
});

module.exports = BotConfig;
