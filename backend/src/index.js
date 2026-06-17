// backend/src/index.js
// ─────────────────────────────────────────────────────────────
// Servidor principal Tecnossync
// Modificación: crea equipo de 5 empleados en primer arranque
// ─────────────────────────────────────────────────────────────
require('dotenv').config();
const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');

const logger          = require('./config/logger');
const { connectDB }   = require('./config/database');
const { connectRedis }= require('./config/redis');
const { migrate }     = require('./models');
const routes          = require('./routes');
const messageService  = require('./services/messageService');
const whatsappService = require('./services/whatsappService');
const campaignService = require('./services/campaignService');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const fs   = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });

// Crear directorios de uploads al arrancar
const VOUCHER_DIR  = process.env.VOUCHER_UPLOAD_DIR  || path.join(__dirname, '../uploads/vouchers');
const CATALOG_DIR  = process.env.CATALOG_UPLOAD_DIR  || path.join(__dirname, '../uploads/catalogs');
fs.mkdirSync(VOUCHER_DIR,  { recursive: true });
fs.mkdirSync(CATALOG_DIR,  { recursive: true });

const app        = express();
app.set('trust proxy', 1);
const httpServer = http.createServer(app);

// ─────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    methods:     ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000
});

app.set('io', io);

io.on('connection', (socket) => {
  logger.info(`🔌 Cliente conectado: ${socket.id}`);

  socket.on('join:agents', (userId) => {
    socket.join('agents');
    socket.join(`user:${userId}`);
    logger.info(`👤 Agente ${userId} unido a sala agents (socket ${socket.id})`);
    // Enviar estado actual de sesiones WA para evitar la race condition
    // en la que el backend ya conectó antes de que el frontend uniera la sala
    const waSessions = whatsappService.getAllSessions();
    for (const s of waSessions) {
      socket.emit('whatsapp:status', {
        sessionId:   s.sessionId,
        status:      s.status,
        sessionType: s.sessionType || 'personal'
      });
    }
  });

  socket.on('join:conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('leave:conversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId });
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Cliente desconectado: ${socket.id}`);
  });

  socket.on("join:whatsapp", (sessionId) => {
    socket.join(`session:${sessionId}`);
    logger.debug(`Cliente unido a session whatsapp: ${sessionId}`);

    // Re-emit cached QR/status so late-joining clients don't miss the event
    const session = whatsappService.getSession(sessionId);
    if (session) {
      if (session.status === 'connecting' && session.qr) {
        socket.emit('whatsapp:qr', {
          sessionId,
          qr: session.qr,
          sessionType: session.sessionType
        });
      }
      socket.emit('whatsapp:status', {
        sessionId,
        status: session.status,
        sessionType: session.sessionType
      });
    }
  });
});

messageService.setSocketIO(io);
whatsappService.setSocketIO(io);


// ─────────────────────────────────────
// MIDDLEWARES
// ─────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


// Rate limiting: más restrictivo en auth, general en el resto
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,                    // 20 intentos de login por IP
  message: { success: false, message: 'Demasiados intentos. Espera 15 minutos.' }
});
app.use('/api/auth/login', authLimiter);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' }
});
app.use('/api', globalLimiter);

// Guardar rawBody para verificación de firma Meta
app.use('/api/webhook', (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { data += chunk; });
  req.on('end',  () => { req.rawBody = data; next(); });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ─────────────────────────────────────
// RUTAS
// ─────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, service: 'tecnossync-backend', version: '2.0.0' });
});

// ─────────────────────────────────────
// ARCHIVOS ESTATICOS DE UPLOADS
// IMPORTANTE: debe ir ANTES de notFound para que no sea interceptado
// ─────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────
const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    await migrate();
    campaignService.initializeProcessor();
    await seedDefaultTeam();
    await whatsappService.restoreAllSessions();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 Tecnossync Backend en http://localhost:${PORT}`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV}`);
      logger.info(`📡 Socket.io activo`);
    });
  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
};

// ─────────────────────────────────────
// EQUIPO POR DEFECTO (5 empleados)
// Solo se crea si la tabla está vacía
// ─────────────────────────────────────
const seedDefaultTeam = async () => {
  const { User } = require('./models');
  const Company  = require('./models/Company');
  const bcrypt   = require('bcryptjs');
  const { Op }   = require('sequelize');

  // ── 1. Garantizar empresa por defecto ──────────────────────
  let company = await Company.findOne({ order: [['created_at', 'ASC']] });
  if (!company) {
    company = await Company.create({
      nombre:      'Tecnossync',
      email:       'contacto@tecnossync.com',
      descripcion: 'Empresa por defecto',
    });
    logger.info(`🏢 Empresa creada: ${company.nombre} (${company.id})`);
  }
  const companyId = company.id;

  // ── 2. Cuentas obligatorias (idempotente — nunca duplica) ──
  const ensureUser = async ({ name, email, password, role, company_id }) => {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      const valid = await bcrypt.compare(password, existing.password_hash);
      if (!valid) {
        const hash = await bcrypt.hash(password, 12);
        await User.update({ password_hash: hash }, { where: { id: existing.id }, hooks: false });
        logger.info(`🔧 Contraseña reparada: ${email}`);
      }
      if (role !== 'superadmin' && !existing.company_id) {
        await User.update({ company_id }, { where: { id: existing.id }, hooks: false });
      }
      return existing;
    }
    const user = await User.create({ name, email, password_hash: password, role, company_id });
    logger.info(`👤 Usuario creado: ${email} (${role})`);
    return user;
  };

  await ensureUser({
    name: 'Super Administrador', email: 'superadmin@tecnossync.com',
    password: 'TuPassword123', role: 'superadmin', company_id: null
  });

  await ensureUser({
    name: 'Administrador', email: 'admin@tecnossync.com',
    password: 'Tecnossync2025!', role: 'admin', company_id: companyId
  });

  // ── 3. Agentes de ejemplo (solo si no hay más usuarios) ────
  const totalUsers = await User.count();
  if (totalUsers <= 2) {
    const agents = [
      { name: 'Ana García',       email: 'ana.garcia@tecnossync.com'       },
      { name: 'Carlos López',     email: 'carlos.lopez@tecnossync.com'     },
      { name: 'María Rodríguez',  email: 'maria.rodriguez@tecnossync.com'  },
      { name: 'Luis Martínez',    email: 'luis.martinez@tecnossync.com'     },
    ];
    for (const a of agents) {
      await ensureUser({ ...a, password: 'Agente2025!', role: 'agent', company_id: companyId });
    }
  }

  // ── 4. Vincular usuarios huérfanos a la empresa ────────────
  const [fixed] = await User.update(
    { company_id: companyId },
    { where: { company_id: null, role: { [Op.ne]: 'superadmin' } }, hooks: false }
  );
  if (fixed > 0) logger.info(`🔗 ${fixed} usuario(s) vinculado(s) a empresa ${company.nombre}`);

  logger.info('─────────────────────────────────────────────');
  logger.info('✅ Cuentas del sistema:');
  logger.info('   SuperAdmin: superadmin@tecnossync.com / TuPassword123');
  logger.info('   Admin:      admin@tecnossync.com / Tecnossync2025!');
  logger.warn('⚠️  CAMBIA LAS CONTRASEÑAS EN PRODUCCIÓN');
  logger.info('─────────────────────────────────────────────');
};

// ─────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  httpServer.close(() => { logger.info('Servidor cerrado'); process.exit(0); });
});

process.on('unhandledRejection', (err) => {
  logger.error('Promesa sin manejar:', err);
});

startServer();
