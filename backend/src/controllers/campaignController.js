// backend/src/controllers/campaignController.js
const campaignService = require('../services/campaignService');
const { Campaign } = require('../models');
const logger = require('../config/logger');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

class CampaignController {

  async getAll(req, res) {
    try {
      const campaigns = await Campaign.findAll({
        where: companyFilter(req),
        order: [['created_at', 'DESC']]
      });
      res.json({ success: true, data: campaigns });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const stats = await campaignService.getCampaignStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const campaign = await campaignService.createCampaign({
        ...req.body,
        created_by: req.user?.id,
        company_id: req.user?.role === 'superadmin' ? null : req.user?.company_id
      });
      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      logger.error('Error creando campaña:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async launch(req, res) {
    try {
      const campaign = await campaignService.launchCampaign(req.params.id);
      res.json({ success: true, data: campaign, message: 'Campaña lanzada exitosamente' });
    } catch (error) {
      logger.error('Error lanzando campaña:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async pause(req, res) {
    try {
      await campaignService.pauseCampaign(req.params.id);
      res.json({ success: true, message: 'Campaña pausada' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const deleted = await Campaign.destroy({ where: { id: req.params.id, status: 'draft', ...companyFilter(req) } });
      if (!deleted) return res.status(404).json({ success: false, message: 'Campaña no encontrada o no es borrador' });
      res.json({ success: true, message: 'Campaña eliminada' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new CampaignController();
