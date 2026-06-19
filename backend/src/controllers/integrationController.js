// backend/src/controllers/integrationController.js
const { Integration } = require('../models');
const chatbotService  = require('../services/chatbotService');
const logger          = require('../config/logger');

const cf = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

class IntegrationController {

  async getAll(req, res) {
    try {
      const integrations = await Integration.findAll({ where: cf(req), order: [['created_at', 'DESC']] });
      const safe = integrations.map(i => ({
        ...i.toJSON(),
        api_key: i.api_key ? `${i.api_key.slice(0, 6)}${'•'.repeat(20)}` : ''
      }));
      res.json({ success: true, data: safe });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async create(req, res) {
    try {
      const { provider, api_key, label } = req.body;
      if (!provider || !api_key)
        return res.status(400).json({ success: false, message: 'provider y api_key son requeridos' });

      const company_id = req.user?.role === 'superadmin' ? (req.body.company_id || null) : req.user?.company_id;

      // Desactivar otros de la misma empresa
      await Integration.update({ is_active: false }, { where: cf(req) });
      const integration = await Integration.create({ provider, api_key, label, is_active: true, company_id });
      logger.info(`✅ Integración creada: ${provider}`);
      res.status(201).json({ success: true, data: { ...integration.toJSON(), api_key: `${api_key.slice(0,6)}${'•'.repeat(20)}` } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async setActive(req, res) {
    try {
      await Integration.update({ is_active: false }, { where: cf(req) });
      const integration = await Integration.findOne({ where: { id: req.params.id, ...cf(req) } });
      if (!integration) return res.status(404).json({ success: false, message: 'No encontrada' });
      await integration.update({ is_active: true });
      res.json({ success: true, data: integration });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async remove(req, res) {
    try {
      const integration = await Integration.findOne({ where: { id: req.params.id, ...cf(req) } });
      if (!integration) return res.status(404).json({ success: false, message: 'No encontrada' });
      await integration.destroy();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async test(req, res) {
    try {
      const { provider, api_key, model, testMessage } = req.body;
      const response = await chatbotService.generateResponse(
        'Responde brevemente: eres un asistente de prueba.',
        testMessage || 'Hola, ¿funcionas correctamente?',
        provider,
        api_key,
        model
      );
      res.json({ success: true, data: { response } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getActive(req, res) {
    try {
      const integration = await Integration.findOne({ where: { is_active: true, ...cf(req) } });
      if (!integration) return res.json({ success: true, data: null });
      res.json({ success: true, data: { ...integration.toJSON(), api_key: undefined } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new IntegrationController();
