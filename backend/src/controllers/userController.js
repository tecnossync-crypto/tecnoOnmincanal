// backend/src/controllers/userController.js
const { User } = require('../models');
const logger   = require('../config/logger');

class UserController {

  // GET /users
  async list(req, res) {
    try {
      const where = req.companyFilter || (req.user.role === 'superadmin'
        ? {}
        : { company_id: req.user.company_id });

      const users = await User.findAll({
        where,
        attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires'] },
        order: [['created_at', 'ASC']]
      });
      res.json({ success: true, data: { users, total: users.length } });
    } catch (error) {
      logger.error('Error listing users:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // POST /users
  async create(req, res) {
    try {
      const { name, email, password, role = 'agent', company_id } = req.body;

      if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos.' });

      if (password.length < 8)
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });

      const allowedRoles = req.user.role === 'superadmin'
        ? ['superadmin', 'admin', 'agent', 'supervisor']
        : ['admin', 'agent', 'supervisor'];

      if (!allowedRoles.includes(role))
        return res.status(400).json({ success: false, message: `Rol inválido. Permitidos: ${allowedRoles.join(', ')}` });

      const existing = await User.findOne({ where: { email: email.toLowerCase() } });
      if (existing)
        return res.status(409).json({ success: false, message: 'Este email ya está registrado.' });

      // Admin asigna usuarios a su propia empresa; superadmin puede indicar otra
      const assignedCompany = req.user.role === 'superadmin'
        ? (company_id || null)
        : req.user.company_id;

      if (role !== 'superadmin' && !assignedCompany)
        return res.status(400).json({ success: false, message: 'Se requiere company_id.' });

      const user = await User.create({
        name,
        email:         email.toLowerCase(),
        password_hash: password,
        role,
        company_id:    role === 'superadmin' ? null : assignedCompany
      });

      logger.info(`✅ Usuario creado: ${email} (${role}) empresa: ${assignedCompany} por ${req.user.email}`);
      res.status(201).json({ success: true, data: user.toJSON() });
    } catch (error) {
      logger.error('Error creating user:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PUT /users/:id
  async update(req, res) {
    try {
      const user = await this._findInScope(req.params.id, req);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      const { name, email, role } = req.body;

      if (role && role !== 'admin' && user.role === 'admin') {
        const adminCount = await User.count({
          where: { role: 'admin', is_active: true, company_id: user.company_id }
        });
        if (adminCount <= 1)
          return res.status(400).json({ success: false, message: 'No puedes degradar al único administrador activo de esta empresa.' });
      }

      const allowedRoles = req.user.role === 'superadmin'
        ? ['superadmin', 'admin', 'agent', 'supervisor']
        : ['admin', 'agent', 'supervisor'];

      const updates = {};
      if (name)  updates.name  = name;
      if (email) updates.email = email.toLowerCase();
      if (role && allowedRoles.includes(role)) updates.role = role;

      await user.update(updates);
      res.json({ success: true, data: user.toJSON() });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /users/:id/toggle
  async toggleActive(req, res) {
    try {
      const user = await this._findInScope(req.params.id, req);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      if (user.id === req.user.id)
        return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta.' });

      await user.update({ is_active: !user.is_active });
      const status = user.is_active ? 'activada' : 'desactivada';
      res.json({ success: true, data: user.toJSON(), message: `Cuenta ${status}.` });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // DELETE /users/:id
  async remove(req, res) {
    try {
      const user = await this._findInScope(req.params.id, req);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      if (user.id === req.user.id)
        return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo.' });

      await user.update({ is_active: false, email: `deleted_${Date.now()}_${user.email}` });
      logger.warn(`🗑️  Usuario ${user.email} eliminado por ${req.user.email}`);
      res.json({ success: true, message: 'Usuario eliminado.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // PATCH /users/:id/password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const targetId = req.params.id;

      if (req.user.role !== 'admin' && req.user.role !== 'superadmin' && req.user.id !== targetId)
        return res.status(403).json({ success: false, message: 'Solo puedes cambiar tu propia contraseña.' });

      const user = await this._findInScope(targetId, req);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

      if (req.user.id === targetId) {
        if (!currentPassword)
          return res.status(400).json({ success: false, message: 'Debes proporcionar la contraseña actual.' });
        const valid = await user.comparePassword(currentPassword);
        if (!valid)
          return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta.' });
      }

      if (!newPassword || newPassword.length < 8)
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres.' });

      await user.update({ password_hash: newPassword });
      res.json({ success: true, message: 'Contraseña actualizada.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Busca un usuario respetando el scope de empresa
  async _findInScope(id, req) {
    const where = { id };
    if (req.user.role !== 'superadmin') where.company_id = req.user.company_id;
    return User.findOne({ where, attributes: { exclude: ['reset_token', 'reset_token_expires'] } });
  }
}

module.exports = new UserController();
