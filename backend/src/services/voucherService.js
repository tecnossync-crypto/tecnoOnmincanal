// backend/src/services/voucherService.js
// Lógica de negocio de comprobantes de pago
// Mismo estilo que campaignService y messageService del proyecto

const { Op }     = require('sequelize');
const crypto     = require('crypto');
const logger     = require('../config/logger');

// Los modelos se cargan desde el index central (igual que los otros servicios)
const {
  PaymentVoucher,
  VoucherAuditLog,
  Contact,
  User
} = require('../models');

const { getFileUrl, deleteFile } = require('../middleware/uploadVoucher');

class VoucherService {

  // ────────────────────────────────────────────────────────────
  // Generación de código único: VCH-YYYYMMDD-XXXXX
  // ────────────────────────────────────────────────────────────
  async generateUniqueCode() {
    const now  = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < 10; i++) {
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
      const code   = `VCH-${date}-${suffix}`;
      const exists = await PaymentVoucher.findOne({ where: { code } });
      if (!exists) return code;
    }
    throw new Error('No se pudo generar un código único. Intenta de nuevo.');
  }

  // ────────────────────────────────────────────────────────────
  // Detección de duplicados
  // Mismo contact + amount + fecha + referencia (si tiene)
  // ────────────────────────────────────────────────────────────
  async checkDuplicate({ contact_id, amount, payment_date, reference_number, excludeId = null }) {
    const where = {
      contact_id,
      amount,
      payment_date,
      status: { [Op.ne]: 'rejected' }
    };
    if (excludeId)        where.id               = { [Op.ne]: excludeId };
    if (reference_number) where.reference_number = reference_number;

    return PaymentVoucher.findOne({ where });
  }

  // ────────────────────────────────────────────────────────────
  // Auditoría — siempre llama sin await para no bloquear flujo
  // ────────────────────────────────────────────────────────────
  async _audit({ voucherId, userId, action, prevStatus, newStatus, changes, note, req }) {
    try {
      let userName = null;
      let userRole = null;

      if (userId) {
        const user = await User.findByPk(userId, { attributes: ['name', 'role'] });
        if (user) { userName = user.name; userRole = user.role; }
      }

      // Extraer IP real detrás de proxy (igual que Nginx del proyecto)
      const ip = (req?.headers?.['x-forwarded-for'] || req?.ip || '').split(',')[0].trim() || null;

      await VoucherAuditLog.create({
        voucher_id:      voucherId,
        user_id:         userId    || null,
        user_name:       userName,
        user_role:       userRole,
        action,
        previous_status: prevStatus || null,
        new_status:      newStatus  || null,
        changes:         changes    || {},
        ip_address:      ip,
        user_agent:      req?.get?.('user-agent') || null,
        note:            note       || null
      });
    } catch (err) {
      logger.error('Error registrando auditoría de comprobante:', err);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Includes reutilizables (evita repetición)
  // ────────────────────────────────────────────────────────────
  get _includes() {
    return [
      {
        model:      Contact,
        as:         'contact',
        attributes: ['id', 'name', 'phone', 'email', 'whatsapp_id', 'avatar_url']
      },
      {
        model:      User,
        as:         'verifier',
        attributes: ['id', 'name', 'email', 'role'],
        required:   false
      }
    ];
  }

  // ────────────────────────────────────────────────────────────
  // CREAR
  // ────────────────────────────────────────────────────────────
  async create({ data, files, userId, req }) {
    // Verificar que el contacto existe
    const contact = await Contact.findByPk(data.contact_id);
    if (!contact) {
      const err = new Error('El cliente no existe.');
      err.status = 404;
      throw err;
    }

    // Detectar duplicado
    const duplicate = await this.checkDuplicate({
      contact_id:       data.contact_id,
      amount:           data.amount,
      payment_date:     data.payment_date,
      reference_number: data.reference_number
    });
    if (duplicate) {
      const err = new Error(`Posible comprobante duplicado detectado (código: ${duplicate.code}).`);
      err.status        = 409;
      err.duplicateCode = duplicate.code;
      throw err;
    }

    // Generar código único
    const code = await this.generateUniqueCode();

    // Procesar archivos
    const attachments = (files || []).map(f => ({
      filename:     f.filename,
      originalname: f.originalname,
      mimetype:     f.mimetype,
      size:         f.size,
      path:         f.path,
      url:          getFileUrl(f.path)
    }));

    const voucher = await PaymentVoucher.create({
      ...data,
      code,
      attachments,
      status: 'pending'
    });

    this._audit({ voucherId: voucher.id, userId, action: 'created', newStatus: 'pending', note: `Código: ${code}`, req });

    logger.info(`✅ Comprobante creado: ${code}`);
    return voucher;
  }

  // ────────────────────────────────────────────────────────────
  // LISTAR con filtros y paginación
  // ────────────────────────────────────────────────────────────
  async list({ page = 1, limit = 20, status, contact_id, payment_method, date_from, date_to, search, company_id }) {
    const where = {};

    if (company_id)     where.company_id     = company_id;
    if (status)         where.status         = status;
    if (contact_id)     where.contact_id     = contact_id;
    if (payment_method) where.payment_method = payment_method;

    if (date_from || date_to) {
      where.payment_date = {};
      if (date_from) where.payment_date[Op.gte] = date_from;
      if (date_to)   where.payment_date[Op.lte] = date_to;
    }

    if (search) {
      where[Op.or] = [
        { code:             { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } },
        { description:      { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await PaymentVoucher.findAndCountAll({
      where,
      include: this._includes,
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
      order:   [['created_at', 'DESC']]
    });

    return {
      vouchers:   rows,
      total:      count,
      page:       parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    };
  }

  // ────────────────────────────────────────────────────────────
  // OBTENER POR ID
  // ────────────────────────────────────────────────────────────
  async getById(id, { userId, req } = {}) {
    const voucher = await PaymentVoucher.findByPk(id, { include: this._includes });
    if (!voucher) {
      const err = new Error('Comprobante no encontrado.');
      err.status = 404; throw err;
    }
    if (userId) this._audit({ voucherId: id, userId, action: 'viewed', req });
    return voucher;
  }

  // ────────────────────────────────────────────────────────────
  // ACTUALIZAR (solo pending)
  // ────────────────────────────────────────────────────────────
  async update(id, { data, files, userId, req }) {
    const voucher = await PaymentVoucher.findByPk(id);
    if (!voucher) { const e = new Error('Comprobante no encontrado.'); e.status = 404; throw e; }

    if (voucher.status !== 'pending') {
      const e = new Error('Solo se pueden editar comprobantes en estado "pending".');
      e.status = 422; throw e;
    }

    // Detectar duplicado excluyendo el actual
    const dup = await this.checkDuplicate({
      contact_id:       data.contact_id       || voucher.contact_id,
      amount:           data.amount           !== undefined ? data.amount : voucher.amount,
      payment_date:     data.payment_date     || voucher.payment_date,
      reference_number: data.reference_number || voucher.reference_number,
      excludeId:        id
    });
    if (dup) {
      const e = new Error(`Posible duplicado con comprobante ${dup.code}.`);
      e.status = 409; throw e;
    }

    // Registrar diff para auditoría
    const changes = {};
    const fields  = ['amount','currency','payment_method','reference_number','payment_date','description'];
    for (const f of fields) {
      if (data[f] !== undefined && String(data[f]) !== String(voucher[f])) {
        changes[f] = { from: voucher[f], to: data[f] };
      }
    }

    // Nuevos archivos
    if (files?.length) {
      const newAtts = files.map(f => ({
        filename:     f.filename,
        originalname: f.originalname,
        mimetype:     f.mimetype,
        size:         f.size,
        path:         f.path,
        url:          getFileUrl(f.path)
      }));
      data.attachments = [...(voucher.attachments || []), ...newAtts];
      changes.attachments_added = newAtts.map(a => a.originalname);
    }

    await voucher.update(data);
    this._audit({ voucherId: id, userId, action: 'updated', changes, req });

    return voucher.reload({ include: this._includes });
  }

  // ────────────────────────────────────────────────────────────
  // CAMBIAR ESTADO — máquina de estados estricta
  // ────────────────────────────────────────────────────────────
  async changeStatus(id, { status, rejection_reason, internal_notes, userId, req }) {
    const voucher = await PaymentVoucher.findByPk(id);
    if (!voucher) { const e = new Error('Comprobante no encontrado.'); e.status = 404; throw e; }

    const prev = voucher.status;
    if (prev === status) {
      const e = new Error(`El comprobante ya está en estado "${status}".`);
      e.status = 422; throw e;
    }

    // Transiciones permitidas
    const allowed = {
      pending:         ['verified', 'rejected', 'fraud_suspected'],
      verified:        ['fraud_suspected'],
      rejected:        ['pending'],
      fraud_suspected: ['rejected']
    };
    if (!allowed[prev]?.includes(status)) {
      const e = new Error(`No se puede cambiar de "${prev}" a "${status}".`);
      e.status = 422; throw e;
    }

    const updates = { status, verified_by: userId };
    if (internal_notes) updates.internal_notes = internal_notes;

    if (['rejected', 'fraud_suspected'].includes(status)) {
      updates.rejection_reason = rejection_reason;
      updates.rejected_at      = new Date();
    }
    if (status === 'verified') {
      updates.verified_at      = new Date();
      updates.rejection_reason = null;
    }
    if (status === 'pending') {
      updates.verified_by      = null;
      updates.rejection_reason = null;
      updates.rejected_at      = null;
      updates.verified_at      = null;
    }

    await voucher.update(updates);

    const actionMap = {
      verified: 'verified', rejected: 'rejected',
      fraud_suspected: 'fraud_flagged', pending: 'status_changed'
    };
    this._audit({
      voucherId: id, userId, action: actionMap[status],
      prevStatus: prev, newStatus: status,
      note: rejection_reason || internal_notes, req
    });

    logger.info(`📋 Comprobante ${voucher.code}: ${prev} → ${status}`);
    return voucher;
  }

  // ────────────────────────────────────────────────────────────
  // ELIMINAR ARCHIVO ADJUNTO
  // ────────────────────────────────────────────────────────────
  async deleteAttachment(voucherId, filename, { userId, req }) {
    const voucher = await PaymentVoucher.findByPk(voucherId);
    if (!voucher) { const e = new Error('Comprobante no encontrado.'); e.status = 404; throw e; }
    if (voucher.status !== 'pending') {
      const e = new Error('Solo se pueden eliminar archivos de comprobantes pendientes.');
      e.status = 422; throw e;
    }

    const att = voucher.attachments?.find(a => a.filename === filename);
    if (!att) { const e = new Error('Archivo no encontrado.'); e.status = 404; throw e; }

    deleteFile(att.path);
    await voucher.update({ attachments: voucher.attachments.filter(a => a.filename !== filename) });
    this._audit({ voucherId, userId, action: 'file_deleted', changes: { deleted: att.originalname }, req });
    return voucher;
  }

  // ────────────────────────────────────────────────────────────
  // ELIMINAR COMPROBANTE (solo pending o rejected)
  // ────────────────────────────────────────────────────────────
  async delete(id, { userId, req }) {
    const voucher = await PaymentVoucher.findByPk(id);
    if (!voucher) { const e = new Error('Comprobante no encontrado.'); e.status = 404; throw e; }

    if (!['pending', 'rejected'].includes(voucher.status)) {
      const e = new Error('Solo se pueden eliminar comprobantes en estado "pending" o "rejected".');
      e.status = 422; throw e;
    }

    for (const att of voucher.attachments || []) deleteFile(att.path);
    await this._audit({ voucherId: id, userId, action: 'status_changed', note: 'Comprobante eliminado', req });
    await voucher.destroy();

    logger.info(`🗑️  Comprobante ${voucher.code} eliminado`);
    return { code: voucher.code };
  }

  // ────────────────────────────────────────────────────────────
  // HISTORIAL DE AUDITORÍA
  // ────────────────────────────────────────────────────────────
  async getAuditLog(voucherId) {
    const voucher = await PaymentVoucher.findByPk(voucherId, { attributes: ['id', 'code'] });
    if (!voucher) { const e = new Error('Comprobante no encontrado.'); e.status = 404; throw e; }

    const logs = await VoucherAuditLog.findAll({
      where:  { voucher_id: voucherId },
      order:  [['created_at', 'DESC']],
      limit:  200
    });

    return { voucher, logs };
  }

  // ────────────────────────────────────────────────────────────
  // ESTADÍSTICAS
  // ────────────────────────────────────────────────────────────
  async stats(company_id) {
    const { sequelize } = require('../models');
    const where = company_id ? { company_id } : {};

    const [totals, byStatus, byMethod] = await Promise.all([
      PaymentVoucher.findOne({
        where,
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
          [sequelize.fn('SUM',   sequelize.col('amount')), 'total_amount']
        ],
        raw: true
      }),
      PaymentVoucher.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM',   sequelize.col('amount')), 'amount']
        ],
        group: ['status'],
        raw:   true
      }),
      PaymentVoucher.findAll({
        where,
        attributes: [
          'payment_method',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['payment_method'],
        raw:   true
      })
    ]);

    return { totals, byStatus, byMethod };
  }
}

module.exports = new VoucherService();
