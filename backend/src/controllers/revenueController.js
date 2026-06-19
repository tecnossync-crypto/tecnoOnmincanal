// backend/src/controllers/revenueController.js
// Panel de ingresos exclusivo para los dueños del sistema (superadmin)
const Company  = require('../models/Company');
const { User } = require('../models');
const { sequelize } = require('../config/database');
const logger   = require('../config/logger');

// GET /api/revenue/summary
exports.getSummary = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'email', 'plan', 'billing', 'created_at'],
    });

    const today   = new Date();
    const in7     = new Date(today); in7.setDate(today.getDate() + 7);
    const in30    = new Date(today); in30.setDate(today.getDate() + 30);

    let mrr = 0, arr = 0;
    const byPlan   = {};
    const byStatus = {};
    const alerts   = [];

    for (const c of companies) {
      const plan    = c.plan || 'free';
      const billing = c.billing || {};

      byPlan[plan] = (byPlan[plan] || 0) + 1;

      const status = billing.status || 'unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;

      if (billing.price && billing.status === 'active') {
        const price = Number(billing.price) || 0;
        const isAnnual = billing.cycle === 'annual';
        mrr += isAnnual ? price / 12 : price;
        arr += isAnnual ? price : price * 12;
      }

      if (billing.next_payment && billing.status !== 'cancelled') {
        const due  = new Date(billing.next_payment);
        const diff = Math.ceil((due - today) / 86400000);
        if (diff <= 30) {
          alerts.push({
            id:           c.id,
            nombre:       c.nombre,
            email:        c.email,
            plan,
            price:        billing.price || 0,
            currency:     billing.currency || 'USD',
            next_payment: billing.next_payment,
            days_until:   diff,
            status:       billing.status,
            alert_type:   diff < 0 ? 'overdue' : diff <= 7 ? 'due_soon' : 'upcoming',
          });
        }
      }
    }

    alerts.sort((a, b) => a.days_until - b.days_until);

    res.json({
      success: true,
      data: {
        totals: {
          companies:  companies.length,
          mrr:        Math.round(mrr * 100) / 100,
          arr:        Math.round(arr * 100) / 100,
        },
        by_plan:   byPlan,
        by_status: byStatus,
        alerts,
      },
    });
  } catch (err) {
    logger.error('revenue.getSummary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/revenue/companies  — lista detallada de todas las empresas con facturación
exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'email', 'plan', 'plan_limits', 'billing', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    // Contar operadores activos por empresa
    const rows = await Promise.all(companies.map(async (c) => {
      const ops = await User.count({ where: { company_id: c.id, is_active: true } });
      return { ...c.toJSON(), active_operators: ops };
    }));

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/revenue/companies/:id/billing  — actualizar facturación de una empresa
exports.updateBilling = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const billing = {
      ...(company.billing || {}),
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    await company.update({ billing });
    logger.info(`💳 Facturación actualizada: ${company.nombre}`);
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/revenue/admins  — lista de usuarios superadmin
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.findAll({
      where: { role: 'superadmin' },
      attributes: { exclude: ['password_hash', 'reset_token', 'reset_token_expires', 'email_change_token'] },
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
