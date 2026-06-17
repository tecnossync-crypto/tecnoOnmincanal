// backend/src/config/redis.js
// Configuración de Redis para caché y cola de trabajos (Bull)

const Redis = require('ioredis');
const logger = require('./logger');

// Opciones de conexión compartidas
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    // Reintentar hasta 10 veces con espera exponencial
    if (times > 10) {
      logger.error('❌ Redis: demasiados reintentos, abandonando');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true
};

// Cliente principal de Redis
const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => logger.info('✅ Redis conectado'));
redisClient.on('error', (err) => logger.error('❌ Redis error:', err.message));
redisClient.on('reconnecting', () => logger.warn('⚠️  Redis reconectando...'));

// Función para conectar
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('❌ Error conectando a Redis:', error.message);
    process.exit(1);
  }
};

// Configuración para Bull (necesita opciones de conexión, no la instancia)
const bullRedisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,   // requerido por Bull
    enableReadyCheck: false       // requerido por Bull
  }
};

module.exports = { redisClient, connectRedis, bullRedisConfig };
