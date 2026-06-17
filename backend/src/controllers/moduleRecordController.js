// backend/src/controllers/moduleRecordController.js
const { ModuleRecord, CustomModule } = require('../models');
const { Op } = require('sequelize');

const getAll = async (req, res) => {
  try {
    const { module_id, status, search, page = 1, limit = 50 } = req.query;
    if (!module_id) return res.status(400).json({ success: false, message: 'module_id requerido' });

    const where = { module_id: Number(module_id) };
    if (status) where.status = status;
    if (search) {
      where.contact_name = { [Op.iLike]: `%${search}%` };
    }

    let count, rows;
    try {
      ({ count, rows } = await ModuleRecord.findAndCountAll({
        where,
        order:  [['created_at', 'DESC']],
        limit:  Number(limit),
        offset: (Number(page) - 1) * Number(limit)
      }));
    } catch (dbErr) {
      const msg = dbErr.original?.message || dbErr.message || '';
      if (msg.includes('does not exist') || msg.includes('no existe') || dbErr.name === 'SequelizeDatabaseError') {
        await ModuleRecord.sync({ force: false });
        count = 0; rows = [];
      } else {
        throw dbErr;
      }
    }

    res.json({ success: true, data: { records: rows, total: count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const { module_id, contact_name, contact_jid, session_id, conversation_id, data, notes } = req.body;
    if (!module_id) return res.status(400).json({ success: false, message: 'module_id requerido' });

    const mod = await CustomModule.findByPk(module_id);
    if (!mod) return res.status(404).json({ success: false, message: 'Módulo no encontrado' });

    // Verificar límite diario
    if (mod.daily_limit > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await ModuleRecord.count({
        where: { module_id: Number(module_id), created_at: { [Op.gte]: today } }
      });
      if (count >= mod.daily_limit) {
        return res.status(429).json({
          success: false,
          message: `Límite diario de ${mod.daily_limit} registro(s) alcanzado para el módulo "${mod.name}"`
        });
      }
    }

    let record;
    try {
      record = await ModuleRecord.create({
        module_id:       Number(module_id),
        contact_name:    contact_name?.trim() || null,
        contact_jid:     contact_jid  || null,
        session_id:      session_id   || null,
        conversation_id: conversation_id ? Number(conversation_id) : null,
        data:            data || {},
        status:          'pending',
        notes:           notes?.trim() || null,
        created_by:      req.user?.id || null
      });
    } catch (createErr) {
      // Si la tabla no existe (p.ej. contenedor antiguo), crearla y reintentar
      const msg = createErr.original?.message || createErr.message || '';
      if (msg.includes('does not exist') || msg.includes('no existe') || createErr.name === 'SequelizeDatabaseError') {
        await ModuleRecord.sync({ force: false });
        record = await ModuleRecord.create({
          module_id:       Number(module_id),
          contact_name:    contact_name?.trim() || null,
          contact_jid:     contact_jid  || null,
          session_id:      session_id   || null,
          conversation_id: conversation_id ? Number(conversation_id) : null,
          data:            data || {},
          status:          'pending',
          notes:           notes?.trim() || null,
          created_by:      req.user?.id || null
        });
      } else {
        throw createErr;
      }
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const record = await ModuleRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    const { data, status, notes, contact_name } = req.body;
    await record.update({
      ...(data         !== undefined ? { data }                                 : {}),
      ...(status       !== undefined ? { status }                               : {}),
      ...(notes        !== undefined ? { notes: notes?.trim() || null }         : {}),
      ...(contact_name !== undefined ? { contact_name: contact_name?.trim() || null } : {}),
    });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const record = await ModuleRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    await record.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDailyStats = async (req, res) => {
  try {
    const { module_id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await ModuleRecord.count({
      where: { module_id: Number(module_id), created_at: { [Op.gte]: today } }
    });
    const mod = await CustomModule.findByPk(module_id);
    res.json({ success: true, data: { today_count: count, daily_limit: mod?.daily_limit || 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, create, update, remove, getDailyStats };
