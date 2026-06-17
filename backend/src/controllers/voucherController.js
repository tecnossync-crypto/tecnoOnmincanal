// backend/src/controllers/voucherController.js
// Controlador de comprobantes de pago
// Mismo patrón de clase que userController.js y campaignController.js del proyecto

const voucherService = require('../services/voucherService');
const logger         = require('../config/logger');

class VoucherController {

  // GET /api/vouchers
  async list(req, res) {
    try {
      const { page, limit, status, contact_id, payment_method, date_from, date_to, search } = req.query;
      const company_id = req.user.company_id || undefined;

      const result = await voucherService.list({
        page, limit, status, contact_id,
        payment_method, date_from, date_to,
        search, company_id
      });

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error listando comprobantes:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // GET /api/vouchers/stats
  async stats(req, res) {
    try {
      const data = await voucherService.stats(req.user.company_id || undefined);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error en estadísticas de comprobantes:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // GET /api/vouchers/:id
  async getOne(req, res) {
    try {
      const voucher = await voucherService.getById(req.params.id, {
        userId: req.user.id,
        req
      });
      res.json({ success: true, data: voucher });
    } catch (error) {
      logger.error('Error obteniendo comprobante:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // POST /api/vouchers  — multipart/form-data
  async create(req, res) {
    try {
      const {
        contact_id, amount, currency, payment_method,
        payment_date, reference_number, description, metadata
      } = req.body;

      // metadata puede venir como string JSON desde FormData
      let parsedMetadata = {};
      if (metadata) {
        try { parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata; }
        catch { parsedMetadata = {}; }
      }

      const voucher = await voucherService.create({
        data: {
          contact_id,
          amount:           parseFloat(amount),
          currency:         (currency || 'DOP').toUpperCase(),
          payment_method,
          payment_date,
          reference_number: reference_number || null,
          description:      description      || null,
          metadata:         parsedMetadata,
          company_id:       req.user.company_id || null
        },
        files:  req.files || [],
        userId: req.user.id,
        req
      });

      // Emitir a sala de agentes (Socket.IO ya configurado en index.js)
      const io = req.app.get('io');
      if (io) {
        io.to('agents').emit('voucher:created', {
          id: voucher.id, code: voucher.code,
          status: voucher.status, amount: voucher.amount
        });
      }

      res.status(201).json({
        success: true,
        message: `Comprobante ${voucher.code} creado exitosamente.`,
        data:    voucher
      });
    } catch (error) {
      // Limpiar archivos subidos si el proceso falla
      if (req.files?.length) {
        const { deleteFile } = require('../middleware/uploadVoucher');
        req.files.forEach(f => deleteFile(f.path));
      }
      logger.error('Error creando comprobante:', error);
      res.status(error.status || 500).json({
        success:       false,
        message:       error.message,
        duplicateCode: error.duplicateCode || undefined
      });
    }
  }

  // PUT /api/vouchers/:id
  async update(req, res) {
    try {
      const allowed = ['amount','currency','payment_method','payment_date','reference_number','description','metadata'];
      const data    = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) data[k] = req.body[k];
      }
      if (data.amount)   data.amount = parseFloat(data.amount);
      if (data.metadata && typeof data.metadata === 'string') {
        try { data.metadata = JSON.parse(data.metadata); } catch { delete data.metadata; }
      }

      const voucher = await voucherService.update(req.params.id, {
        data,
        files:  req.files || [],
        userId: req.user.id,
        req
      });

      res.json({ success: true, message: 'Comprobante actualizado.', data: voucher });
    } catch (error) {
      if (req.files?.length) {
        const { deleteFile } = require('../middleware/uploadVoucher');
        req.files.forEach(f => deleteFile(f.path));
      }
      logger.error('Error actualizando comprobante:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // PATCH /api/vouchers/:id/status
  async changeStatus(req, res) {
    try {
      const { status, rejection_reason, internal_notes } = req.body;

      const voucher = await voucherService.changeStatus(req.params.id, {
        status, rejection_reason, internal_notes,
        userId: req.user.id, req
      });

      const io = req.app.get('io');
      if (io) {
        io.to('agents').emit('voucher:status_changed', {
          id: voucher.id, code: voucher.code, status: voucher.status
        });
      }

      const msgs = {
        verified:        `✅ Comprobante ${voucher.code} verificado.`,
        rejected:        `❌ Comprobante ${voucher.code} rechazado.`,
        fraud_suspected: `⚠️  Comprobante ${voucher.code} marcado como fraude sospechoso.`,
        pending:         `🔄 Comprobante ${voucher.code} regresado a pendiente.`
      };

      res.json({ success: true, message: msgs[status] || 'Estado actualizado.', data: voucher });
    } catch (error) {
      logger.error('Error cambiando estado de comprobante:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/vouchers/:id/attachments/:filename
  async deleteAttachment(req, res) {
    try {
      const voucher = await voucherService.deleteAttachment(
        req.params.id,
        req.params.filename,
        { userId: req.user.id, req }
      );
      res.json({ success: true, message: 'Archivo eliminado.', data: voucher });
    } catch (error) {
      logger.error('Error eliminando adjunto:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // DELETE /api/vouchers/:id
  async delete(req, res) {
    try {
      const result = await voucherService.delete(req.params.id, { userId: req.user.id, req });
      res.json({ success: true, message: `Comprobante ${result.code} eliminado.` });
    } catch (error) {
      logger.error('Error eliminando comprobante:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }

  // GET /api/vouchers/:id/audit
  async getAuditLog(req, res) {
    try {
      const result = await voucherService.getAuditLog(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error obteniendo auditoría:', error);
      res.status(error.status || 500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new VoucherController();
