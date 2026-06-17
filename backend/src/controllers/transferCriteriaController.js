// backend/src/controllers/transferCriteriaController.js
const { TransferCriteria } = require('../models');

class TransferCriteriaController {

  async getAll(req, res) {
    try {
      const criteria = await TransferCriteria.findAll({
        order: [['priority', 'DESC'], ['created_at', 'ASC']]
      });
      res.json({ success: true, data: criteria });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async create(req, res) {
    try {
      const criteria = await TransferCriteria.create(req.body);
      res.status(201).json({ success: true, data: criteria });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async update(req, res) {
    try {
      const criteria = await TransferCriteria.findByPk(req.params.id);
      if (!criteria) return res.status(404).json({ success: false, message: 'No encontrado' });
      await criteria.update(req.body);
      res.json({ success: true, data: criteria });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async remove(req, res) {
    try {
      const criteria = await TransferCriteria.findByPk(req.params.id);
      if (!criteria) return res.status(404).json({ success: false, message: 'No encontrado' });
      await criteria.destroy();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new TransferCriteriaController();