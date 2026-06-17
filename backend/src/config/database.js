// backend/src/config/database.js
// Configuración de Sequelize para PostgreSQL

const { Sequelize } = require('sequelize');
const logger = require('./logger');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'omnichannel',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: (msg) => {
      // Solo logear queries en desarrollo
      if (process.env.NODE_ENV === 'development') {
        logger.debug(msg);
      }
    },
    pool: {
      max: 10,        // máximo de conexiones simultáneas
      min: 0,
      acquire: 30000, // ms antes de lanzar error
      idle: 10000     // ms antes de liberar conexión inactiva
    },
    define: {
      timestamps: true,          // createdAt y updatedAt automáticos
      underscored: true,         // snake_case en la BD
      freezeTableName: true      // no pluralizar nombres de tabla
    }
  }
);

// Función para conectar y probar la conexión
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL conectado correctamente');
  } catch (error) {
    logger.error('❌ Error conectando a PostgreSQL:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
