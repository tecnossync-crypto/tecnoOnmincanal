// backend/src/controllers/quickMessageController.js
const { QuickMessage } = require('../models');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

const getAll = async (req, res) => {
  try {
    const { channel } = req.query;
    const { Op } = require('sequelize');
    const where = { is_active: true, ...companyFilter(req) };
    if (channel && channel !== 'all') {
      where.channel = { [Op.in]: [channel, 'all'] };
    }
    const messages = await QuickMessage.findAll({
      where,
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAllAdmin = async (req, res) => {
  try {
    const messages = await QuickMessage.findAll({
      where: companyFilter(req),
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { title, shortcut, content, category, channel, sort_order } = req.body;
    if (!title?.trim())   return res.status(400).json({ success: false, message: 'El título es obligatorio' });
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'El contenido es obligatorio' });
    const msg = await QuickMessage.create({
      title:      title.trim(),
      shortcut:   shortcut?.trim() || null,
      content:    content.trim(),
      category:   category?.trim() || 'General',
      channel:    channel || 'all',
      sort_order: Number(sort_order) || 0,
      is_active:  true,
      company_id: req.user?.role === 'superadmin' ? null : req.user?.company_id
    });
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const msg = await QuickMessage.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!msg) return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
    const { title, shortcut, content, category, channel, sort_order, is_active } = req.body;
    await msg.update({
      ...(title      !== undefined ? { title: title.trim() }                     : {}),
      ...(shortcut   !== undefined ? { shortcut: shortcut?.trim() || null }      : {}),
      ...(content    !== undefined ? { content: content.trim() }                 : {}),
      ...(category   !== undefined ? { category: category?.trim() || 'General' } : {}),
      ...(channel    !== undefined ? { channel }                                 : {}),
      ...(sort_order !== undefined ? { sort_order: Number(sort_order) }          : {}),
      ...(is_active  !== undefined ? { is_active }                               : {}),
    });
    res.json({ success: true, data: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const msg = await QuickMessage.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!msg) return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
    await msg.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, getAllAdmin, create, update, remove };
