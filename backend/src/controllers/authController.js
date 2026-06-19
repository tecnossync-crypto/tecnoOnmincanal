// backend/src/controllers/authController.js
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { User } = require('../models');
const Company  = require('../models/Company');
const logger   = require('../config/logger');
const { Op }   = require('sequelize');
const { sendPasswordReset, sendWelcomeEmail, sendLoginOTP } = require('../services/emailService');

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

      // Bloquear si el email no ha sido verificado (null = usuario pre-feature → dejar pasar)
      if (user.email_verified === false && user.email_verification_code !== null) {
        logger.warn(`⚠️  Login bloqueado (email no verificado): ${email}`);
        return res.status(403).json({
          success: false,
          code:    'EMAIL_NOT_VERIFIED',
          message: 'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.',
        });
      }

      // ── OTP de segundo factor ────────────────────────────────
      const otp     = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
      await user.update({ login_otp: otp, login_otp_expires: expires });

      // Enviar OTP por email (best-effort — si falla el SMTP el login sigue)
      const otpSent = await sendLoginOTP({ toEmail: user.email, userName: user.name, otp });

      logger.info(`🔐 OTP generado para ${email} (enviado: ${otpSent})`);
      res.json({
        success:   true,
        needs_otp: true,
        otp_sent:  otpSent,
        // En dev sin SMTP, devolvemos el OTP en la respuesta para poder probar
        ...(process.env.NODE_ENV !== 'production' && !otpSent ? { debug_otp: otp } : {}),
      });
    } catch (error) {
      logger.error('Error en login:', error);
      res.status(500).json({ success: false, message: 'Error del servidor.' });
    }
  }

  // POST /auth/logout
  async logout(req, res) {
    try {
      if (req.user) {
        const user = await User.findByPk(req.user.id);
        if (user) {
          const extraMinutes = user.online_started_at
            ? Math.round((Date.now() - new Date(user.online_started_at).getTime()) / 60000)
            : 0;
          await user.update({
            is_online:             false,
            online_started_at:     null,
            total_online_minutes:  (user.total_online_minutes || 0) + extraMinutes,
          });
        }
      }
      res.json({ success: true, message: 'Sesión cerrada.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/request-email-change  { newEmail, currentPassword }
  async requestEmailChange(req, res) {
    try {
      const { newEmail, currentPassword } = req.body;
      if (!newEmail || !currentPassword)
        return res.status(400).json({ success: false, message: 'Nuevo email y contraseña actual son requeridos.' });

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      const valid = await user.comparePassword(currentPassword);
      if (!valid)
        return res.status(401).json({ success: false, message: 'Contraseña incorrecta. Verifica tu identidad.' });

      const normalizedEmail = newEmail.toLowerCase().trim();
      const existing = await User.findOne({ where: { email: normalizedEmail } });
      if (existing)
        return res.status(409).json({ success: false, message: 'Este correo ya está en uso.' });

      const token   = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      await user.update({
        pending_email:        normalizedEmail,
        email_change_token:   token,
        email_change_expires: expires,
      });

      const frontendUrl  = process.env.FRONTEND_URL || 'http://localhost:3000';
      const confirmLink  = `${frontendUrl}/confirm-email-change/${token}`;

      const { sendPasswordReset } = require('../services/emailService');
      await sendPasswordReset(normalizedEmail, confirmLink, user.name, 'email_change');

      logger.info(`📧 Cambio de email solicitado: ${user.email} → ${normalizedEmail}`);
      res.json({ success: true, message: `Se envió un correo de confirmación a ${normalizedEmail}.` });
    } catch (error) {
      logger.error('Error requestEmailChange:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // GET /auth/confirm-email-change/:token
  async confirmEmailChange(req, res) {
    try {
      const { token } = req.params;
      const user = await User.findOne({
        where: {
          email_change_token:   token,
          email_change_expires: { [Op.gt]: new Date() },
        },
      });

      if (!user)
        return res.status(400).json({ success: false, message: 'El enlace de confirmación es inválido o ha expirado.' });

      await user.update({
        email:                user.pending_email,
        pending_email:        null,
        email_change_token:   null,
        email_change_expires: null,
      });

      logger.info(`✅ Email cambiado correctamente para usuario ${user.id}`);
      res.json({ success: true, message: 'Correo actualizado correctamente. Ya puedes iniciar sesión con el nuevo correo.' });
    } catch (error) {
      logger.error('Error confirmEmailChange:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/verify-login-otp  — segundo paso del login: valida OTP y devuelve token
  async verifyLoginOTP(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp)
        return res.status(400).json({ success: false, message: 'Email y código OTP requeridos.' });

      const user = await User.findOne({
        where: { email: email.toLowerCase().trim(), is_active: true }
      });
      if (!user)
        return res.status(401).json({ success: false, message: 'Credenciales inválidas.' });

      if (!user.login_otp || user.login_otp !== String(otp).trim())
        return res.status(400).json({ success: false, message: 'Código OTP incorrecto.' });

      if (user.login_otp_expires && new Date() > new Date(user.login_otp_expires))
        return res.status(400).json({ success: false, code: 'OTP_EXPIRED', message: 'El código expiró. Inicia sesión de nuevo para recibir uno nuevo.' });

      // OTP válido → completar login
      await user.update({
        login_otp:         null,
        login_otp_expires: null,
        is_online:         true,
        online_started_at: new Date(),
      });

      const token = generateToken(user);
      const activeFeatures = await loadActiveFeatures(user);
      logger.info(`✅ Login OTP verificado: ${user.email} (${user.role})`);

      res.json({
        success: true,
        data: {
          token,
          user: { ...user.toJSON(), permissions: buildPermissions(user.role), active_features: activeFeatures },
        },
      });
    } catch (error) {
      logger.error('Error verifyLoginOTP:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/resend-login-otp  — reenvía el OTP de login
  async resendLoginOTP(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email requerido.' });

      const user = await User.findOne({ where: { email: email.toLowerCase().trim(), is_active: true } });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      const otp     = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000);
      await user.update({ login_otp: otp, login_otp_expires: expires });

      const sent = await sendLoginOTP({ toEmail: user.email, userName: user.name, otp });
      logger.info(`📧 OTP de login reenviado a: ${user.email}`);

      res.json({
        success: true,
        otp_sent: sent,
        ...(process.env.NODE_ENV !== 'production' && !sent ? { debug_otp: otp } : {}),
        message: sent ? 'Código reenviado. Revisa tu correo.' : 'No se pudo enviar el correo. Inténtalo de nuevo.',
      });
    } catch (error) {
      logger.error('Error resendLoginOTP:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/verify-email  — verifica el código de 6 dígitos enviado al correo
  async verifyEmail(req, res) {
    try {
      const { email, code } = req.body;
      if (!email || !code)
        return res.status(400).json({ success: false, message: 'Email y código son requeridos.' });

      const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (!user)
        return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      if (user.email_verified)
        return res.status(400).json({ success: false, message: 'Este correo ya está verificado.' });

      if (!user.email_verification_code || user.email_verification_code !== String(code).trim())
        return res.status(400).json({ success: false, message: 'Código incorrecto.' });

      if (user.email_verification_expires && new Date() > new Date(user.email_verification_expires))
        return res.status(400).json({ success: false, code: 'CODE_EXPIRED', message: 'El código ha expirado. Solicita uno nuevo.' });

      await user.update({
        email_verified:             true,
        email_verification_code:    null,
        email_verification_expires: null,
        is_online:                  true,
        online_started_at:          new Date(),
      });

      // Auto-login: devolvemos token para que el frontend inicie sesión directo
      const token = generateToken(user);
      const Company = require('../models/Company');
      let activeFeatures = null;
      if (user.company_id) {
        const company = await Company.findByPk(user.company_id, { attributes: ['active_features'] });
        activeFeatures = company?.active_features || null;
      }

      logger.info(`✅ Email verificado: ${user.email}`);
      res.json({
        success: true,
        message: '¡Correo verificado! Bienvenido/a a Tecnossync.',
        data:    { token, user: { ...user.toJSON(), permissions: buildPermissions(user.role), active_features: activeFeatures } },
      });
    } catch (error) {
      logger.error('Error verifyEmail:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /auth/resend-verification  — reenvía código de verificación
  async resendVerification(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email requerido.' });

      const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      if (user.email_verified) return res.status(400).json({ success: false, message: 'El correo ya está verificado.' });

      const verificationCode    = String(Math.floor(100000 + Math.random() * 900000));
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await user.update({ email_verification_code: verificationCode, email_verification_expires: verificationExpires });

      const Company = require('../models/Company');
      let companyName = null;
      if (user.company_id) {
        const company = await Company.findByPk(user.company_id, { attributes: ['nombre'] });
        companyName = company?.nombre || null;
      }

      await sendWelcomeEmail({
        toEmail:          user.email,
        userName:         user.name,
        companyName,
        password:         '(tu contraseña actual)',
        verificationCode,
      });

      logger.info(`📧 Código reenviado a: ${user.email}`);
      res.json({ success: true, message: 'Código reenviado. Revisa tu correo.' });
    } catch (error) {
      logger.error('Error resendVerification:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PUT /auth/change-password  — usuario cambia su propia contraseña (requiere contraseña actual)
  async changeOwnPassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'currentPassword y newPassword son requeridos' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
      }
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

      const valid = await user.comparePassword(currentPassword);
      if (!valid) return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });

      await user.update({ password_hash: newPassword }); // el hook de User hashea automáticamente
      logger.info(`🔑 Contraseña cambiada por usuario ${user.id}`);
      res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      logger.error('Error changeOwnPassword:', error);
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

      const emailEnviado = await sendPasswordReset(email, resetLink, user.name);
      if (!emailEnviado) {
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
