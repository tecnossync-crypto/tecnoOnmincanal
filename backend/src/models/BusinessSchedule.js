const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BusinessSchedule = sequelize.define('business_schedules', {
  id:                     { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  company_id:             { type: DataTypes.UUID, allowNull: true },
  day_of_week:            { type: DataTypes.INTEGER, allowNull: false }, // 0=Dom ... 6=Sáb
  start_time:             { type: DataTypes.STRING(5), defaultValue: '08:00' },
  end_time:               { type: DataTypes.STRING(5), defaultValue: '17:00' },
  slot_duration:          { type: DataTypes.INTEGER, defaultValue: 30 },
  is_active:              { type: DataTypes.BOOLEAN, defaultValue: true },
  bot_scheduling_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = BusinessSchedule;
