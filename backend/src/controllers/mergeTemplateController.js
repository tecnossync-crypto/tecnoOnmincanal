const { MergeTemplate, Contact, Conversation } = require('../models');
const mergeService = require('../services/mergeService');
const logger = require('../config/logger');

const companyFilter = (req) =>
  req.companyFilter || (req.user?.role === 'superadmin' ? {} : { company_id: req.user?.company_id });

class MergeTemplateController {

  async list(req, res) {
    try {
      const where = { ...companyFilter(req) };
      if (req.query.activo !== undefined) where.activo = req.query.activo === 'true';
      if (req.query.canal && req.query.canal !== 'all') {
        const { Op } = require('sequelize');
        where.canal = { [Op.in]: [req.query.canal, 'all'] };
      }
      const templates = await MergeTemplate.findAll({ where, order: [['created_at', 'DESC']] });
      res.json({ success: true, data: templates });
    } catch (error) {
      logger.error('Error listando plantillas:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getOne(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error obteniendo plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const { nombre, descripcion, canal, contenido } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
      if (!contenido?.trim()) return res.status(400).json({ success: false, message: 'El contenido es obligatorio.' });

      const variables = mergeService.extractVariables(contenido);
      const template = await MergeTemplate.create({
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || '',
        canal: canal || 'all',
        contenido: contenido.trim(),
        variables,
        created_by: req.user?.id,
        company_id: req.user?.role === 'superadmin' ? null : req.user?.company_id,
      });
      logger.info(`📝 Plantilla creada: ${template.nombre} por ${req.user?.email}`);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      logger.error('Error creando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const updates = {};
      if (req.body.nombre !== undefined) updates.nombre = req.body.nombre.trim();
      if (req.body.descripcion !== undefined) updates.descripcion = req.body.descripcion.trim();
      if (req.body.canal !== undefined) updates.canal = req.body.canal;
      if (req.body.contenido !== undefined) {
        updates.contenido = req.body.contenido.trim();
        updates.variables = mergeService.extractVariables(updates.contenido);
      }
      if (req.body.activo !== undefined) updates.activo = Boolean(req.body.activo);

      await template.update(updates);
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error actualizando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async remove(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      await template.destroy();
      res.json({ success: true, message: 'Plantilla eliminada.' });
    } catch (error) {
      logger.error('Error eliminando plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async toggleActive(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });
      await template.update({ activo: !template.activo });
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Error toggling plantilla:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getVariables(req, res) {
    try {
      const { contenido } = req.body;
      if (!contenido) return res.status(400).json({ success: false, message: 'Contenido requerido.' });
      res.json({ success: true, data: { variables: mergeService.extractVariables(contenido) } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async merge(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const { datos } = req.body;
      if (!datos || typeof datos !== 'object')
        return res.status(400).json({ success: false, message: 'Se requiere un objeto "datos".' });

      const validacion = mergeService.validate(template.contenido, datos);
      const { resultado, variablesSinValor } = mergeService.merge(template.contenido, datos);
      res.json({ success: true, data: { resultado, validacion, variablesSinValor } });
    } catch (error) {
      logger.error('Error en merge:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async preview(req, res) {
    try {
      const { contenido, datos } = req.body;
      if (!contenido) return res.status(400).json({ success: false, message: 'Contenido requerido.' });

      const datosPreview = datos || {};
      const variables = mergeService.extractVariables(contenido);
      const validacion = mergeService.validate(contenido, datosPreview);
      const { resultado, variablesSinValor } = mergeService.merge(contenido, datosPreview);
      res.json({ success: true, data: { resultado, variables, validacion, variablesSinValor } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async useInConversation(req, res) {
    try {
      const template = await MergeTemplate.findOne({ where: { id: req.params.id, ...companyFilter(req) } });
      if (!template) return res.status(404).json({ success: false, message: 'Plantilla no encontrada.' });

      const conversation = await Conversation.findByPk(req.params.conversationId, {
        include: [{ model: Contact, as: 'contact' }],
      });
      if (!conversation) return res.status(404).json({ success: false, message: 'Conversación no encontrada.' });

      const contact = conversation.contact;
      const autoData = mergeService.resolveContactData(contact);
      const manualData = req.body.datos || {};
      const datos = { ...autoData, ...manualData };

      const { resultado, variablesSinValor } = mergeService.merge(template.contenido, datos);
      const variables = mergeService.extractVariables(template.contenido);

      res.json({
        success: true,
        data: {
          resultado,
          variablesSinValor,
          variables,
          datosResueltos: datos,
        },
      });
    } catch (error) {
      logger.error('Error en useInConversation:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new MergeTemplateController();
