// backend/src/controllers/flowRuleController.js
const { FlowRule } = require('../models');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

const getAll = async (req, res) => {
  try {
    const rules = await FlowRule.findAll({
      where: companyFilter(req),
      order: [['priority', 'DESC'], ['created_at', 'ASC']]
    });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { name, trigger_type, trigger_value, action_type, action_value, channel, priority } = req.body;
    if (!name?.trim())         return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    if (!trigger_type?.trim()) return res.status(400).json({ success: false, message: 'El disparador es obligatorio' });
    if (!action_type?.trim())  return res.status(400).json({ success: false, message: 'La acción es obligatoria' });
    const rule = await FlowRule.create({
      name:          name.trim(),
      trigger_type:  trigger_type.trim(),
      trigger_value: trigger_value?.trim() || null,
      action_type:   action_type.trim(),
      action_value:  action_value?.trim() || null,
      channel:       channel || 'all',
      priority:      Number(priority) || 0,
      is_active:     true,
      company_id:    req.user?.role === 'superadmin' ? null : req.user?.company_id
    });
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const rule = await FlowRule.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!rule) return res.status(404).json({ success: false, message: 'Regla no encontrada' });
    const { name, trigger_type, trigger_value, action_type, action_value, channel, priority, is_active } = req.body;
    await rule.update({
      ...(name          !== undefined ? { name: name.trim() }                       : {}),
      ...(trigger_type  !== undefined ? { trigger_type: trigger_type.trim() }       : {}),
      ...(trigger_value !== undefined ? { trigger_value: trigger_value?.trim()||null }: {}),
      ...(action_type   !== undefined ? { action_type: action_type.trim() }         : {}),
      ...(action_value  !== undefined ? { action_value: action_value?.trim()||null } : {}),
      ...(channel       !== undefined ? { channel }                                 : {}),
      ...(priority      !== undefined ? { priority: Number(priority) }              : {}),
      ...(is_active     !== undefined ? { is_active }                               : {}),
    });
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const toggle = async (req, res) => {
  try {
    const rule = await FlowRule.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!rule) return res.status(404).json({ success: false, message: 'Regla no encontrada' });
    await rule.update({ is_active: !rule.is_active });
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const rule = await FlowRule.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
    if (!rule) return res.status(404).json({ success: false, message: 'Regla no encontrada' });
    await rule.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, create, update, toggle, remove };
