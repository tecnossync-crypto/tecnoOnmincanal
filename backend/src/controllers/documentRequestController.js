const path   = require('path');
const fs     = require('fs');
const { DocumentRequest, DocumentTemplate } = require('../models');
const { GENERATED_DIR } = require('../middleware/uploadTemplate');
const logger = require('../config/logger');

// ── helper: send WhatsApp message via Baileys or Meta ────────────────────────
async function sendWA(sessionId, jid, text, companyId) {
  try {
    const whatsappService = require('../services/whatsappService');
    const session = whatsappService.getSession(sessionId);
    if (session?.sock) {
      await session.sock.sendMessage(jid, { text });
    } else if (!sessionId?.startsWith('business_')) {
      // Solo Meta API para sesiones no-Baileys
      const metaService = require('../services/metaService');
      const phone = jid.replace(/@.+/, '');
      await metaService.sendWhatsAppMessage(phone, text, companyId);
    }
  } catch (err) {
    logger.warn('documentRequestController sendWA error:', err.message);
  }
}

// ── GET /document-requests  (query: status, jid, sessionId) ─────────────────
const list = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const companyId = req.user?.company_id;
    const where = { ...(companyId ? { company_id: companyId } : {}) };
    if (req.query.status)    where.status     = req.query.status;
    if (req.query.jid)       where.jid        = req.query.jid;
    if (req.query.sessionId) where.session_id = req.query.sessionId;

    const rows = await DocumentRequest.findAll({
      where,
      include: [{ model: DocumentTemplate, as: 'template', attributes: ['id','name','fields'] }],
      order:   [['created_at', 'DESC']],
      limit:   100,
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /document-requests/start  { templateId, jid, sessionId } ───────────
const start = async (req, res) => {
  try {
    const { templateId, jid, sessionId } = req.body;
    if (!templateId || !jid || !sessionId)
      return res.status(400).json({ success: false, message: 'templateId, jid y sessionId son requeridos' });

    const companyId = req.user?.company_id;
    const tpl = await DocumentTemplate.findOne({
      where: { id: templateId, ...(companyId ? { company_id: companyId } : {}) }
    });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    // Cancel any existing active request for this jid
    await DocumentRequest.update(
      { status: 'rejected' },
      { where: { session_id: sessionId, jid, status: 'collecting' } }
    );

    const manualFields = (tpl.fields || []).filter(f => f.source === 'manual');
    if (!manualFields.length)
      return res.status(400).json({ success: false, message: 'Esta plantilla no tiene campos manuales' });

    const docReq = await DocumentRequest.create({
      company_id:          companyId || null,
      session_id:          sessionId,
      jid,
      template_id:         templateId,
      collected_fields:    {},
      current_field_index: 0,
      status:              'collecting',
      initiated_by:        'agent',
    });

    // Send first question to client
    const firstField = manualFields[0];
    const intro = `Hola, necesito algunos datos para preparar tu documento "${tpl.name}".\n\n${firstField.label}:`;
    await sendWA(sessionId, jid, intro, companyId);

    res.json({ success: true, data: docReq });
  } catch (err) {
    logger.error('documentRequest start error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /document-requests/:id/send ────────────────────────────────────────
const send = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const docReq = await DocumentRequest.findOne({
      where: { id: req.params.id, ...(companyId ? { company_id: companyId } : {}) },
      include: [{ model: DocumentTemplate, as: 'template' }],
    });
    if (!docReq) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    if (docReq.status !== 'ready')
      return res.status(400).json({ success: false, message: 'El documento aún no está listo' });

    const filePath = path.join(GENERATED_DIR, docReq.generated_file_path);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, message: 'Archivo generado no encontrado' });

    const sessionId = docReq.session_id;
    const jid       = docReq.jid;
    const fileName  = `${docReq.template?.name || 'documento'}.docx`;
    const whatsappService = require('../services/whatsappService');
    const session = whatsappService.getSession(sessionId);

    logger.info(`📤 Enviando doc a ${jid} via sesión ${sessionId} — sock=${!!session?.sock}`);

    if (session?.sock) {
      const buf = fs.readFileSync(filePath);
      await session.sock.sendMessage(jid, {
        document: buf,
        fileName,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    } else {
      // getSession devolvió null o sin sock — buscar cualquier sesión business conectada
      const sessionList = whatsappService.getBusinessSessions ? whatsappService.getBusinessSessions() : [];
      let fallbackSock = null;
      let fallbackId   = null;
      for (const s of sessionList) {
        if (s.status === 'connected') {
          const full = whatsappService.getSession(s.sessionId);
          if (full?.sock) { fallbackSock = full.sock; fallbackId = s.sessionId; break; }
        }
      }
      if (fallbackSock) {
        logger.info(`📤 Usando sesión fallback ${fallbackId} para enviar doc a ${jid}`);
        const buf = fs.readFileSync(filePath);
        await fallbackSock.sendMessage(jid, {
          document: buf,
          fileName,
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
      } else {
        logger.error(`❌ No hay sesión Baileys disponible para enviar doc a ${jid} (sessionId=${sessionId})`);
        return res.status(503).json({ success: false, message: 'Sesión de WhatsApp no disponible. Verifica que WhatsApp Business esté conectado.' });
      }
    }

    await docReq.update({ status: 'sent' });
    res.json({ success: true });
  } catch (err) {
    logger.error('documentRequest send error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /document-requests/:id/reject ──────────────────────────────────────
const reject = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const docReq = await DocumentRequest.findOne({
      where: { id: req.params.id, ...(companyId ? { company_id: companyId } : {}) }
    });
    if (!docReq) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    // Clean up generated file if exists
    if (docReq.generated_file_path) {
      try { fs.unlinkSync(path.join(GENERATED_DIR, docReq.generated_file_path)); } catch (_) {}
    }
    await docReq.update({ status: 'rejected' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /document-requests/:id/download ─────────────────────────────────────
const download = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const docReq = await DocumentRequest.findOne({
      where: { id: req.params.id, ...(companyId ? { company_id: companyId } : {}) },
      include: [{ model: DocumentTemplate, as: 'template', attributes: ['name'] }],
    });
    if (!docReq || !docReq.generated_file_path)
      return res.status(404).json({ success: false, message: 'Documento no disponible' });

    const filePath = path.join(GENERATED_DIR, docReq.generated_file_path);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });

    const baseName  = path.basename(filePath, '.docx');
    const docName   = docReq.template?.name || 'documento';
    const wantPdf   = req.query.format === 'pdf';

    if (wantPdf) {
      const { exec } = require('child_process');
      const pdfPath  = path.join(GENERATED_DIR, `${baseName}.pdf`);
      exec(
        `soffice --headless --convert-to pdf --outdir "${GENERATED_DIR}" "${filePath}"`,
        { timeout: 30000 },
        (err) => {
          if (err || !fs.existsSync(pdfPath)) {
            // LibreOffice no disponible — devolver DOCX como fallback
            res.set({
              'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'Content-Disposition': `attachment; filename="${docName}.docx"`,
            });
            return fs.createReadStream(filePath).pipe(res);
          }
          res.set({
            'Content-Type':        'application/pdf',
            'Content-Disposition': `attachment; filename="${docName}.pdf"`,
          });
          const stream = fs.createReadStream(pdfPath);
          stream.pipe(res);
          stream.on('end', () => { try { fs.unlinkSync(pdfPath); } catch (_) {} });
        }
      );
      return;
    }

    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${docName}.docx"`,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { list, start, send, reject, download };
