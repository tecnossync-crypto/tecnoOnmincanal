// backend/src/config/logger.js
// Logger centralizado usando Winston - todos los logs del sistema pasan por aquí

const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Formato personalizado para los logs
const logFormat = printf((info) => {
  const { level, message, timestamp, stack, ...rest } = info;
  let line = `${timestamp} [${level}]: ${message || '(sin mensaje)'}`;
  if (stack) line += `\n${stack}`;

  const original = rest.original || rest.parent;
  if (original?.message && original.message !== message) {
    line += `\n  ↳ original: ${original.message}`;
  }
  return line;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),   // captura stack traces
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Consola con colores en desarrollo
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        logFormat
      )
    }),
    // Archivo para errores
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    }),
    // Archivo para todos los logs
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  // No crashear en excepciones no capturadas en producción
  exitOnError: false
});

module.exports = logger;
