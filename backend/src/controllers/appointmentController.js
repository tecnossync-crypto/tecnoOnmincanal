const { Appointment, BusinessSchedule, User } = require('../models');
const { Op } = require('sequelize');

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// GET /appointments?month=YYYY-MM  or  ?date=YYYY-MM-DD  or  ?status=...
const getAll = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const where = { ...(companyId ? { company_id: companyId } : {}) };

    if (req.query.date) {
      where.date = req.query.date;
    } else if (req.query.month) {
      const [y, m] = req.query.month.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2,'0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end   = `${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      where.date  = { [Op.between]: [start, end] };
    }
    if (req.query.status) where.status = req.query.status;

    const rows = await Appointment.findAll({
      where,
      order: [['date', 'ASC'], ['start_time', 'ASC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /appointments
const create = async (req, res) => {
  try {
    const { title, contact_name, contact_phone, contact_jid, date, start_time, duration_minutes, notes, assigned_to, status } = req.body;
    if (!contact_name?.trim()) return res.status(400).json({ success: false, message: 'Nombre del contacto es requerido' });
    if (!date)                 return res.status(400).json({ success: false, message: 'La fecha es requerida' });
    if (!start_time)           return res.status(400).json({ success: false, message: 'La hora es requerida' });

    const appt = await Appointment.create({
      company_id:       req.user?.company_id || null,
      title:            title?.trim() || null,
      contact_name:     contact_name.trim(),
      contact_phone:    contact_phone?.trim() || null,
      contact_jid:      contact_jid?.trim() || null,
      date,
      start_time,
      duration_minutes: duration_minutes || 30,
      status:           status || 'pending',
      notes:            notes?.trim() || null,
      assigned_to:      assigned_to || null,
      created_by:       req.user?.id || null,
    });
    res.json({ success: true, data: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /appointments/:id
const update = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const where = { id: req.params.id, ...(companyId ? { company_id: companyId } : {}) };
    const appt = await Appointment.findOne({ where });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });

    const fields = ['title','contact_name','contact_phone','contact_jid','date','start_time','duration_minutes','status','notes','assigned_to'];
    const updates = {};
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    await appt.update(updates);
    res.json({ success: true, data: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /appointments/:id
const remove = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const where = { id: req.params.id, ...(companyId ? { company_id: companyId } : {}) };
    const appt = await Appointment.findOne({ where });
    if (!appt) return res.status(404).json({ success: false, message: 'Cita no encontrada' });
    await appt.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /appointments/availability?date=YYYY-MM-DD
const getAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date es requerido' });

    const companyId = req.user?.company_id;
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();

    const sched = await BusinessSchedule.findOne({
      where: { day_of_week: dayOfWeek, ...(companyId ? { company_id: companyId } : {}) }
    });

    if (!sched || !sched.is_active) {
      return res.json({ success: true, data: { slots: [], schedule: null } });
    }

    // Get existing appointments for that date
    const existing = await Appointment.findAll({
      where: {
        date,
        status: { [Op.notIn]: ['cancelled'] },
        ...(companyId ? { company_id: companyId } : {}),
      },
      attributes: ['start_time', 'duration_minutes'],
    });

    const occupied = existing.map(a => ({
      start: timeToMin(a.start_time),
      end:   timeToMin(a.start_time) + (a.duration_minutes || 30),
    }));

    const startMin = timeToMin(sched.start_time);
    const endMin   = timeToMin(sched.end_time);
    const dur      = sched.slot_duration || 30;

    const slots = [];
    for (let t = startMin; t + dur <= endMin; t += dur) {
      const conflicts = occupied.some(o => t < o.end && (t + dur) > o.start);
      if (!conflicts) slots.push(minToTime(t));
    }

    res.json({ success: true, data: { slots, schedule: sched } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /appointments/schedule
const getSchedule = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const where = companyId ? { company_id: companyId } : {};
    let rows = await BusinessSchedule.findAll({ where, order: [['day_of_week', 'ASC']] });

    if (!rows.length) {
      // Return defaults if not configured yet
      const DEFAULTS = [
        { day_of_week: 0, is_active: false, start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 1, is_active: true,  start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 2, is_active: true,  start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 3, is_active: true,  start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 4, is_active: true,  start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 5, is_active: true,  start_time: '08:00', end_time: '17:00', slot_duration: 30 },
        { day_of_week: 6, is_active: false, start_time: '08:00', end_time: '13:00', slot_duration: 30 },
      ];
      return res.json({ success: true, data: DEFAULTS });
    }

    // Fill missing days with defaults
    const mapped = [0,1,2,3,4,5,6].map(d => {
      const found = rows.find(r => r.day_of_week === d);
      return found ? found.toJSON() : { day_of_week: d, is_active: d >= 1 && d <= 5, start_time: '08:00', end_time: '17:00', slot_duration: 30, bot_scheduling_enabled: false };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /appointments/schedule  — expects { days: [...], bot_scheduling_enabled: bool }
const updateSchedule = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { days, bot_scheduling_enabled } = req.body;
    if (!Array.isArray(days)) return res.status(400).json({ success: false, message: 'days[] es requerido' });

    for (const d of days) {
      const where = { day_of_week: d.day_of_week, ...(companyId ? { company_id: companyId } : {}) };
      const [row, created] = await BusinessSchedule.findOrCreate({ where, defaults: { company_id: companyId || null } });
      await row.update({
        start_time:             d.start_time   || '08:00',
        end_time:               d.end_time     || '17:00',
        slot_duration:          d.slot_duration || 30,
        is_active:              !!d.is_active,
        bot_scheduling_enabled: bot_scheduling_enabled !== undefined ? !!bot_scheduling_enabled : row.bot_scheduling_enabled,
      });
    }

    res.json({ success: true, message: 'Horario actualizado' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /appointments/next-slots — used by chatbot to get next available slots
const getNextSlots = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const days = parseInt(req.query.days) || 5;
    const results = [];

    const schedRows = await BusinessSchedule.findAll({
      where: { ...(companyId ? { company_id: companyId } : {}), is_active: true },
    });

    const today = new Date();
    for (let i = 0; i < 14 && results.length < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const sched = schedRows.find(r => r.day_of_week === dow);
      if (!sched) continue;

      const dateStr = d.toISOString().slice(0, 10);
      const existing = await Appointment.findAll({
        where: { date: dateStr, status: { [Op.notIn]: ['cancelled'] }, ...(companyId ? { company_id: companyId } : {}) },
        attributes: ['start_time', 'duration_minutes'],
      });
      const occupied = existing.map(a => ({
        start: timeToMin(a.start_time),
        end:   timeToMin(a.start_time) + (a.duration_minutes || 30),
      }));
      const startMin = timeToMin(sched.start_time);
      const endMin   = timeToMin(sched.end_time);
      const dur      = sched.slot_duration || 30;
      const slots = [];
      for (let t = startMin; t + dur <= endMin; t += dur) {
        if (!occupied.some(o => t < o.end && (t + dur) > o.start)) slots.push(minToTime(t));
      }
      if (slots.length) results.push({ date: dateStr, slots: slots.slice(0, 4) });
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, create, update, remove, getAvailability, getSchedule, updateSchedule, getNextSlots };
