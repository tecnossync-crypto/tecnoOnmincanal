const Company = require('../models/Company');
const { User } = require('../models');
const logger   = require('../config/logger');

const PLAN_PRESETS = {
  free: {
    label: 'Gratuito',
    price: 0,
    limits: { max_operators: 2, max_conversations_month: 200, max_storage_mb: 100, max_campaigns_month: 0, max_whatsapp_accounts: 1, max_merge_templates: 5, max_custom_modules: 1 },
  },
  basic: {
    label: 'Básico',
    price: 49,
    limits: { max_operators: 5, max_conversations_month: 1000, max_storage_mb: 500, max_campaigns_month: 5, max_whatsapp_accounts: 2, max_merge_templates: 20, max_custom_modules: 3 },
  },
  pro: {
    label: 'Profesional',
    price: 99,
    limits: { max_operators: 15, max_conversations_month: 5000, max_storage_mb: 2000, max_campaigns_month: 20, max_whatsapp_accounts: 5, max_merge_templates: 100, max_custom_modules: 10 },
  },
  enterprise: {
    label: 'Empresarial',
    price: 199,
    limits: { max_operators: -1, max_conversations_month: -1, max_storage_mb: -1, max_campaigns_month: -1, max_whatsapp_accounts: -1, max_merge_templates: -1, max_custom_modules: -1 },
  },
};

// GET /api/plans/presets
exports.getPresets = (req, res) => {
  res.json({ success: true, data: PLAN_PRESETS });
};

// GET /api/plans/company/:id
exports.getCompanyPlan = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      attributes: ['id', 'nombre', 'plan', 'plan_limits', 'billing'],
    });
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    // Contar operadores actuales
    const operatorCount = await User.count({ where: { company_id: company.id, is_active: true } });

    res.json({
      success: true,
      data: { ...company.toJSON(), current_operators: operatorCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/plans/company/:id
exports.updateCompanyPlan = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ success: false, error: 'Empresa no encontrada' });

    const { plan, plan_limits, billing } = req.body;

    const updates = {};

    if (plan) {
      updates.plan = plan;
      // Si es preset conocido y no vienen límites custom, aplica los del preset
      if (PLAN_PRESETS[plan] && !plan_limits) {
        updates.plan_limits = PLAN_PRESETS[plan].limits;
      }
    }

    if (plan_limits) updates.plan_limits = plan_limits;

    if (billing !== undefined) {
      updates.billing = billing ? {
        ...(company.billing || {}),
        ...billing,
        updated_at: new Date().toISOString(),
      } : null;
    }

    await company.update(updates);
    logger.info(`📋 Plan actualizado empresa ${company.nombre}: ${plan || company.plan}`);
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/plans/billing-alerts  — empresas con pago próximo o vencido
exports.getBillingAlerts = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'email', 'plan', 'billing'],
      where: { plan: ['basic', 'pro', 'enterprise'] },
    });

    const today = new Date();
    const in7   = new Date(today); in7.setDate(today.getDate() + 7);

    const alerts = companies
      .filter(c => c.billing?.next_payment && c.billing?.status !== 'cancelled')
      .map(c => {
        const due  = new Date(c.billing.next_payment);
        const diff = Math.ceil((due - today) / 86400000);
        let alertType = null;
        if (diff < 0)  alertType = 'overdue';
        else if (diff <= 7) alertType = 'due_soon';
        return alertType ? {
          id:           c.id,
          nombre:       c.nombre,
          email:        c.email,
          plan:         c.plan,
          next_payment: c.billing.next_payment,
          price:        c.billing.price,
          currency:     c.billing.currency || 'USD',
          days_until:   diff,
          alert_type:   alertType,
          status:       c.billing.status,
        } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.days_until - b.days_until);

    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/plans/overview  — resumen general para superadmin
exports.getOverview = async (req, res) => {
  try {
    const companies = await Company.findAll({
      attributes: ['id', 'nombre', 'plan', 'billing', 'created_at'],
    });

    const byPlan = {};
    let mrr = 0;

    for (const c of companies) {
      byPlan[c.plan] = (byPlan[c.plan] || 0) + 1;
      if (c.billing?.price && c.billing?.status === 'active') {
        const p = Number(c.billing.price) || 0;
        mrr += c.billing.cycle === 'annual' ? p / 12 : p;
      }
    }

    res.json({
      success: true,
      data: {
        total:  companies.length,
        by_plan: byPlan,
        mrr:    Math.round(mrr * 100) / 100,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
