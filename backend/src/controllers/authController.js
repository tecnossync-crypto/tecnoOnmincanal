// backend/src/controllers/authController.js
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { User } = require('../models');
const Company  = require('../models/Company');
const logger   = require('../config/logger');
const { Op }   = require('sequelize');

// Carga active_features de la empresa del usuario (null para superadmin)
const loadActiveFeatures = async (user) => {
  if (user.role === 'superadmin' || !user.company_id) return null;
  try {
    const company = await Company.findByPk(user.company_id, { attributes: ['active_features'] });
    return company?.active_features || null;
  } catch { return null; }
};

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h', issuer: 'tecnossync', algorithm: 'HS256' }
  );

class AuthController {

  // POST /auth/login
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res.status(400).json({ success: false, message: 'Email y contraseña requeridos.' });

      const user = await User.findOne({
        where: { email: email.toLowerCase().trim(), is_active: true }
      });

      if (!user)
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        logger.warn(`⚠️  Login fallido: ${email}`);
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });
      }

      await user.update({ is_online: true });
      const token = generateToken(user);
      const activeFeatures = await loadActiveFeatures(user);
      logger.info(`✅ Login: ${email} (${user.role}) empresa: ${user.company_id || 'superadmin'}`);

      res.json({
        success: true,
        data: {
          token,
          user: { ...user.toJSON(), permissions: buildPermissions(user.role), active_features: activeFeatures }
        }
      });
    } catch (error) {
      logger.error('Error en login:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
  }

  // POST /auth/logout
  async logout(req, res) {
    try {
      if (req.user) await User.update({ is_online: false }, { where: { id: req.user.id } });
      res.json({ success: true, message: 'Sesión cerrada.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /auth/me
  async me(req, res) {
    const activeFeatures = await loadActiveFeatures(req.user);
    res.json({
      success: true,
      data: { ...req.user.toJSON(), permissions: buildPermissions(req.user.role), active_features: activeFeatures }
    });
  }

  // POST /auth/register — solo admin (crea usuarios en SU empresa) o superadmin
  async register(req, res) {
    try {
      const { name, email, password, role = 'agent', company_id } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos.' });

      if (password.length < 8)
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });

      // Roles permitidos según quien crea
      const allowedRoles = req.user.role === 'superadmin'
        ? ['superadmin', 'admin', 'agent', 'supervisor']
        : ['admin', 'agent', 'supervisor'];

      if (!allowedRoles.includes(role))
        return res.status(400).json({ success: false, message: `Rol inválido. Permitidos: ${allowedRoles.join(', ')}` });

      const existing = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existing)
        return res.status(409).json({ success: false, message: 'Email ya registrado.' });

      // El admin asigna su propia empresa; superadmin puede especificar otra
      const assignedCompany = req.user.role === 'superadmin'
        ? (company_id || null)
        : req.user.company_id;

      if (role !== 'superadmin' && !assignedCompany)
        return res.status(400).json({ success: false, message: 'Se requiere company_id para este rol.' });

      const user = await User.create({
        name, email: email.toLowerCase(), password_hash: password, role,
        company_id: role === 'superadmin' ? null : assignedCompany
      });

      logger.info(`👤 Usuario creado: ${email} (${role}) por ${req.user.email}`);
      res.status(201).json({ success: true, data: { user: user.toJSON() } });
    } catch (error) {
      logger.error('Error en registro:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/forgot-password  { email }
  // Genera token de recuperación. Si SMTP está configurado, envía email.
  // Si no, devuelve el link en la respuesta (modo admin/consola).
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email)
        return res.status(400).json({ success: false, message: 'Email requerido.' });

      const user = await User.findOne({
        where: { email: email.toLowerCase().trim(), is_active: true }
      });

      // No revelar si el email existe o no (seguridad)
      if (!user) {
        return res.json({ success: true, message: 'Si el correo existe, recibirás las instrucciones.' });
      }

      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await user.update({ reset_token: token, reset_token_expires: expires });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const resetLink   = `${frontendUrl}/reset-password/${token}`;

      logger.info(`🔑 Reset password solicitado para: ${email}`);

      // ── Envío de email (requiere SMTP configurado en .env) ────────────
      // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
      let emailEnviado = false;
      if (process.env.SMTP_HOST) {
        try {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          });
          await transporter.sendMail({
            from:    process.env.SMTP_FROM || process.env.SMTP_USER,
            to:      email,
            subject: 'Recuperación de contraseña — Tecnossync',
            html: `
              <h2>Recuperación de contraseña</h2>
              <p>Haz clic en el siguiente enlace para restablecer tu contraseña.<br>
              Este enlace expira en 1 hora.</p>
              <a href="${resetLink}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin:16px 0">
                Restablecer contraseña
              </a>
              <p>Si no solicitaste esto, ignora este mensaje.</p>
            `
          });
          emailEnviado = true;
          logger.info(`📧 Email de recuperación enviado a: ${email}`);
        } catch (mailErr) {
          logger.warn('⚠️  No se pudo enviar email de recuperación:', mailErr.message);
        }
      } else {
        // Sin SMTP — loguear el link para que el admin lo comparta manualmente
        logger.info(`🔗 Link de recuperación (sin SMTP): ${resetLink}`);
      }

      res.json({
        success: true,
        message: emailEnviado
          ? 'Se enviaron las instrucciones al correo registrado.'
          : 'Instrucciones generadas. Si no llega email, contacta al administrador.',
        // En modo sin SMTP devolvemos el link para que el admin lo comparta
        ...(process.env.SMTP_HOST ? {} : { resetLink })
      });
    } catch (error) {
      logger.error('Error en forgotPassword:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
  }

  // POST /auth/reset-password  { token, newPassword }
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword)
        return res.status(400).json({ success: false, message: 'Token y nueva contraseña requeridos.' });

      if (newPassword.length < 8)
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });

      const user = await User.findOne({
        where: {
          reset_token:         token,
          reset_token_expires: { [Op.gt]: new Date() }
        }
      });

      if (!user)
        return res.status(400).json({ success: false, message: 'El enlace de recuperación es inválido o ha expirado.' });

      await user.update({
        password_hash:       newPassword,
        reset_token:         null,
        reset_token_expires: null
      });

      logger.info(`✅ Contraseña restablecida para: ${user.email}`);
      res.json({ success: true, message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
    } catch (error) {
      logger.error('Error en resetPassword:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
  }
}

function buildPermissions(role) {
  if (role === 'superadmin') {
    return {
      canViewInbox:             true,
      canSendMessages:          true,
      canViewBotConfig:         true,
      canEditBotConfig:         true,
      canViewCampaigns:         true,
      canManageCampaigns:       true,
      canManageUsers:           true,
      canAssignConversations:   true,
      canViewAllConversations:  true,
      canManageCompanies:       true,
    };
  }

  const base = {
    canViewInbox:             true,
    canSendMessages:          true,
    canViewBotConfig:         false,
    canEditBotConfig:         false,
    canViewCampaigns:         false,
    canManageCampaigns:       false,
    canManageUsers:           false,
    canAssignConversations:   false,
    canViewAllConversations:  false,
    canManageCompanies:       false,
  };

  if (role === 'admin') {
    return {
      ...base,
      canViewBotConfig:        true,
      canEditBotConfig:        true,
      canViewCampaigns:        true,
      canManageCampaigns:      true,
      canManageUsers:          true,
      canAssignConversations:  true,
      canViewAllConversations: true,
    };
  }

  return base;
}

module.exports = new AuthController();
