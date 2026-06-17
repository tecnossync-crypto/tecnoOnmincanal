// backend/src/middleware/auth.js
const jwt    = require('jsonwebtoken');
const { User } = require('../models');
const logger   = require('../config/logger');

// ── 1. Verificar JWT y cargar req.user ───────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Token de acceso requerido' });

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'tecnossync' });
    } catch (err) {
      const msg =
        err.name === 'TokenExpiredError' ? 'Sesión expirada. Vuelve a iniciar sesión.' :
        err.name === 'JsonWebTokenError' ? 'Token inválido.'                           :
                                           'Error de autenticación.';
      return res.status(401).json({ success: false, message: msg });
    }

    const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires'] } });
    if (!user)           return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Cuenta desactivada. Contacta al administrador.' });

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en middleware auth:', error);
    res.status(500).json({ success: false, message: 'Error interno de autenticación.' });
  }
};

// ── 2. Verificar rol ─────────────────────────────────────────────────────────
// superadmin siempre pasa (es el único que está por encima de todos)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'superadmin') return next(); // superadmin bypasses all role checks
  if (!roles.includes(req.user.role)) {
    logger.warn(`🚫 Acceso denegado: ${req.user.email} (${req.user.role}) → ${req.method} ${req.path}`);
    return res.status(403).json({ success: false, message: `Acción restringida. Se requiere: ${roles.join(' o ')}.` });
  }
  next();
};

// ── 3. Solo superadmin ───────────────────────────────────────────────────────
const requireSuperAdmin = (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role !== 'superadmin')
    return res.status(403).json({ success: false, message: 'Acción reservada para superadmin.' });
  next();
};

// ── 4. Filtro de empresa (multi-tenant) ──────────────────────────────────────
// Inyecta req.companyFilter:
//   superadmin → {} (ve todo)
//   admin/agent → { company_id: req.user.company_id }
const companyScope = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  req.companyFilter = req.user.role === 'superadmin'
    ? {}
    : { company_id: req.user.company_id };
  next();
};

// ── 5. Filtro de conversaciones por agente + empresa ─────────────────────────
const scopeConversations = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  const companyFilter = req.user.role === 'superadmin'
    ? {}
    : { company_id: req.user.company_id };

  if (req.user.role === 'agent') {
    req.conversationFilter = { ...companyFilter, assigned_agent_id: req.user.id };
  } else {
    req.conversationFilter = companyFilter;
  }
  next();
};

// ── 6. Acceso a una conversación concreta ────────────────────────────────────
const requireConversationAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  if (req.user.role === 'admin' || req.user.role === 'superadmin') return next();

  try {
    const { Conversation } = require('../models');
    const companyFilter = { company_id: req.user.company_id };

    const conv = await Conversation.findOne({
      where: { id: req.params.id, assigned_agent_id: req.user.id, ...companyFilter }
    });

    if (!conv) {
      logger.warn(`🚫 Agente ${req.user.id} intentó acceder a conversación ${req.params.id}`);
      return res.status(403).json({ success: false, message: 'No tienes acceso a esta conversación.' });
    }

    req.conversation = conv;
    next();
  } catch (error) {
    logger.error('Error en requireConversationAccess:', error);
    res.status(500).json({ success: false, message: 'Error verificando acceso.' });
  }
};

// ── 7. Feature Flag: bloquea si la empresa no tiene el módulo activo ────────────
// superadmin siempre pasa (gestiona el sistema completo)
const requireFeature = (featureName) => async (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });

  // El superadmin nunca es bloqueado por features
  if (req.user.role === 'superadmin') return next();

  if (!req.user.company_id)
    return res.status(403).json({ success: false, message: 'Usuario sin empresa asignada.' });

  try {
    const Company = require('../models/Company');
    const company = await Company.findByPk(req.user.company_id, {
      attributes: ['id', 'active_features'],
    });

    if (!company)
      return res.status(403).json({ success: false, message: 'Empresa no encontrada.' });

    const features = company.active_features || {};
    if (features[featureName] !== true) {
      logger.warn(`🚫 Feature bloqueada: "${featureName}" para empresa ${req.user.company_id} (${req.user.email})`);
      return res.status(403).json({
        success: false,
        message: `El módulo "${featureName}" no está habilitado para tu empresa.`,
        feature: featureName,
      });
    }
    next();
  } catch (error) {
    logger.error('Error en requireFeature:', error);
    res.status(500).json({ success: false, message: 'Error verificando permisos del módulo.' });
  }
};

module.exports = { auth, requireRole, requireSuperAdmin, companyScope, scopeConversations, requireConversationAccess, requireFeature };
