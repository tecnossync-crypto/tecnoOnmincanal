// backend/src/controllers/companyController.js
const Company = require('../models/Company');
const { User } = require('../models');
const logger   = require('../config/logger');

// ── Admin/Agent: obtiene SU empresa ──────────────────────────────────────────
const getCompany = async (req, res) => {
  try {
    const where = req.user.role === 'superadmin'
      ? { id: req.query.company_id }    // superadmin puede consultar cualquiera
      : { id: req.user.company_id };

    if (!where.id)
      return res.status(400).json({ success: false, message: 'company_id requerido.' });

    let company = await Company.findOne({ where });
    if (!company)
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error('Error getCompany:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Admin: actualiza SU empresa ───────────────────────────────────────────────
const updateCompany = async (req, res) => {
  try {
    const companyId = req.user.role === 'superadmin'
      ? (req.body.id || req.query.company_id)
      : req.user.company_id;

    if (!companyId)
      return res.status(400).json({ success: false, message: 'company_id requerido.' });

    const company = await Company.findByPk(companyId);
    if (!company)
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

    const { nombre, sitio_web, telefono, telefono_secundario, email,
            fax, direccion, ciudad, pais, descripcion, horarios } = req.body;

    await company.update({
      nombre, sitio_web, telefono, telefono_secundario, email,
      fax, direccion, ciudad, pais, descripcion,
      ...(horarios !== undefined ? { horarios } : {})
    });

    res.json({ success: true, data: company, message: 'Empresa actualizada.' });
  } catch (error) {
    logger.error('Error updateCompany:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Logo ──────────────────────────────────────────────────────────────────────
const updateLogo = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: 'No se recibió archivo.' });

    const companyId = req.user.role === 'superadmin'
      ? req.body.company_id
      : req.user.company_id;

    const company = await Company.findByPk(companyId);
    if (!company)
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

    const logo_url = `/uploads/${req.file.filename}`;
    await company.update({ logo_url });
    res.json({ success: true, data: { logo_url }, message: 'Logo actualizado.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUPERADMIN: listar todas las empresas ────────────────────────────────────
const listCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({ order: [['created_at', 'ASC']] });

    // Agregar conteo de usuarios por empresa
    const withStats = await Promise.all(companies.map(async (c) => {
      const userCount = await User.count({ where: { company_id: c.id, is_active: true } });
      return { ...c.toJSON(), user_count: userCount };
    }));

    res.json({ success: true, data: withStats });
  } catch (error) {
    logger.error('Error listCompanies:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUPERADMIN: crear empresa + admin inicial ─────────────────────────────────
const createCompany = async (req, res) => {
  try {
    const {
      nombre, sitio_web, telefono, email, descripcion,
      admin_name, admin_email, admin_password
    } = req.body;

    if (!nombre?.trim())
      return res.status(400).json({ success: false, message: 'El nombre de empresa es obligatorio.' });
    if (!admin_email || !admin_password)
      return res.status(400).json({ success: false, message: 'Email y contraseña del administrador son requeridos.' });
    if (admin_password.length < 8)
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres.' });

    const existingEmail = await User.findOne({ where: { email: admin_email.toLowerCase() } });
    if (existingEmail)
      return res.status(409).json({ success: false, message: 'El email del administrador ya está registrado.' });

    const company = await Company.create({
      nombre: nombre.trim(), sitio_web, telefono, email, descripcion
    });

    const adminUser = await User.create({
      name:          admin_name || `Admin ${nombre}`,
      email:         admin_email.toLowerCase(),
      password_hash: admin_password,
      role:          'admin',
      company_id:    company.id
    });

    logger.info(`🏢 Empresa creada: ${nombre} (${company.id}) por superadmin ${req.user.email}`);
    logger.info(`👤 Admin creado: ${admin_email} para empresa ${company.id}`);

    res.status(201).json({
      success: true,
      data: {
        company:  company.toJSON(),
        adminUser: adminUser.toJSON()
      },
      message: `Empresa "${nombre}" creada con su administrador.`
    });
  } catch (error) {
    logger.error('Error createCompany:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUPERADMIN: eliminar empresa ──────────────────────────────────────────────
const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company)
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

    // Desactivar todos sus usuarios (no borrar datos)
    await User.update({ is_active: false }, { where: { company_id: company.id } });
    await company.destroy();

    logger.warn(`🗑️  Empresa ${company.nombre} (${company.id}) eliminada por ${req.user.email}`);
    res.json({ success: true, message: 'Empresa eliminada y usuarios desactivados.' });
  } catch (error) {
    logger.error('Error deleteCompany:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── SUPERADMIN: leer/actualizar active_features de una empresa ───────────────
const ALLOWED_FEATURES = [
  'inbox', 'whatsapp_personal', 'whatsapp_business', 'campaigns',
  'vouchers', 'appointments', 'document_templates', 'bot_ai',
  'flow_rules', 'quick_messages', 'labels', 'custom_modules',
  'bot_catalogs', 'dashboard', 'team_management', 'merge_templates',
];

const getFeatures = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, { attributes: ['id', 'nombre', 'active_features'] });
    if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    res.json({ success: true, data: { id: company.id, nombre: company.nombre, active_features: company.active_features || {} } });
  } catch (error) {
    logger.error('Error getFeatures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateFeatures = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });

    const { features } = req.body;
    if (!features || typeof features !== 'object')
      return res.status(400).json({ success: false, message: 'El campo "features" debe ser un objeto.' });

    // Sólo se permiten keys del catálogo definido
    const sanitized = {};
    for (const key of ALLOWED_FEATURES) {
      if (key in features) sanitized[key] = Boolean(features[key]);
      else sanitized[key] = (company.active_features?.[key] ?? true);
    }

    await company.update({ active_features: sanitized });
    logger.info(`✅ Features actualizadas para ${company.nombre} por ${req.user.email}`);
    res.json({ success: true, data: { id: company.id, nombre: company.nombre, active_features: sanitized }, message: 'Features actualizadas.' });
  } catch (error) {
    logger.error('Error updateFeatures:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCompany, updateCompany, updateLogo, listCompanies, createCompany, deleteCompany, getFeatures, updateFeatures, ALLOWED_FEATURES };
