// backend/src/middleware/errorHandler.js
const logger = require('../config/logger');

// Middleware de manejo global de errores
const errorHandler = (err, req, res, next) => {
  logger.error(`[${req.method}] ${req.path} - ${err.message}`, { stack: err.stack });

  // Errores de Sequelize (base de datos)
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: err.errors.map(e => ({ field: e.path, message: e.message }))
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Ya existe un registro con esos datos'
    });
  }

  // Error genérico
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Error del servidor' : err.message
  });
};

// Capturar rutas no encontradas
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Ruta no encontrada: ${req.path}` });
};

module.exports = { errorHandler, notFound };
