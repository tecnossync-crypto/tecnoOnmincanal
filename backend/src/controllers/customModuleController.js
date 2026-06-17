// backend/src/controllers/customModuleController.js
const { CustomModule } = require('../models');

const slugify = (str) =>
  str.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

const getAll = async (req, res) => {
  try {
    const modules = await CustomModule.findAll({
      where: { is_active: true, ...companyFilter(req) },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });
    res.json({ success: true, data: modules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllAdmin = async (req, res) => {
  try {
    const modules = await CustomModule.findAll({
      where: companyFilter(req),
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });
    res.json({ success: true, data: modules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const mod = await CustomModule.findOne({
      where: { slug: req.params.slug, is_active: true, ...companyFilter(req) }
    });
    if (!mod) return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, icon, color, description, fields_schema, daily_limit, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    let slug = slugify(name);
    // Ensure unique slug
    const existing = await CustomModule.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;
    const mod = await CustomModule.create({
      name: name.trim(),
      slug,
      icon:          icon        || 'Box',
      color:         color       || '#6366f1',
      description:   description?.trim() || null,
      fields_schema: Array.isArray(fields_schema) ? fields_schema : [],
      daily_limit:   Number(daily_limit) || 0,
      sort_order:    Number(sort_order)  || 0,
      is_active:     true,
      company_id:    req.user?.role === 'superadmin' ? null : req.user?.company_id
    });
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const mod = await CustomModule.findByPk(req.params.id);
    if (!mod) return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    const { name, icon, color, description, fields_schema, daily_limit, sort_order, is_active } = req.body;
    await mod.update({
      ...(name          !== undefined ? { name: name.trim() }                              : {}),
      ...(icon          !== undefined ? { icon }                                           : {}),
      ...(color         !== undefined ? { color }                                          : {}),
      ...(description   !== undefined ? { description: description?.trim() || null }       : {}),
      ...(fields_schema !== undefined ? { fields_schema: Array.isArray(fields_schema) ? fields_schema : [] } : {}),
      ...(daily_limit   !== undefined ? { daily_limit: Number(daily_limit) || 0 }          : {}),
      ...(sort_order    !== undefined ? { sort_order: Number(sort_order) || 0 }            : {}),
      ...(is_active     !== undefined ? { is_active }                                      : {}),
    });
    res.json({ success: true, data: mod });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const mod = await CustomModule.findByPk(req.params.id);
    if (!mod) return res.status(404).json({ success: false, message: 'Módulo no encontrado' });
    await mod.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, getAllAdmin, getOne, create, update, remove };
