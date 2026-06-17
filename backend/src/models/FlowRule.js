// backend/src/models/FlowRule.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FlowRule = sequelize.define('FlowRule', {
  id: {
    type:          DataTypes.INTEGER,
    primaryKey:    true,
    autoIncrement: true
  },
  name: {
    type:      DataTypes.STRING(200),
    allowNull: false
  },
  // ── Disparador ──────────────────────────────────────────────
  // catalog_sent     → bot envió catálogo X   (trigger_value = identificador)
  // catalog_any      → bot envió cualquier catálogo
  // bot_text_contains→ respuesta del bot contiene keyword   (trigger_value = keyword)
  // user_keyword     → mensaje del usuario contiene keyword  (trigger_value = keyword)
  // bot_handoff      → bot incluyó [HUMAN_NEEDED] en respuesta
  // no_bot_response  → bot no generó respuesta
  trigger_type: {
    type:      DataTypes.STRING(50),
    allowNull: false
  },
  trigger_value: {
    type:      DataTypes.STRING(500),
    allowNull: true
  },
  // ── Acción ──────────────────────────────────────────────────
  // apply_label   → añadir etiqueta al chat  (action_value = nombre de la etiqueta)
  // notify_human  → alertar a agentes vía socket
  // disable_bot   → desactivar bot en este chat
  // send_message  → enviar mensaje al cliente (action_value = texto)
  action_type: {
    type:      DataTypes.STRING(50),
    allowNull: false
  },
  action_value: {
    type:      DataTypes.TEXT,
    allowNull: true
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true
  },
  priority: {
    type:         DataTypes.INTEGER,
    defaultValue: 0
  },
  // 'whatsapp_business' | 'whatsapp' | 'all'
  channel: {
    type:         DataTypes.STRING(30),
    defaultValue: 'all'
  }
}, {
  tableName:  'flow_rules',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  'updated_at',
});

module.exports = FlowRule;
