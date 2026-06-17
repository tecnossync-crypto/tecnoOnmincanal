const path         = require('path');
const fs           = require('fs');
const { exec }     = require('child_process');
const PizZip       = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module');
const { DocumentTemplate } = require('../models');
const { GENERATED_DIR }    = require('../middleware/uploadTemplate');
const logger = require('../config/logger');

// ── Field sources catalog ────────────────────────────────────────────────────
const FIELD_SOURCES = [
  { value: 'contact.name',      label: 'Nombre del contacto'    },
  { value: 'contact.phone',     label: 'Teléfono del contacto'  },
  { value: 'contact.email',     label: 'Email del contacto'     },
  { value: 'date.today',        label: 'Fecha de hoy'           },
  { value: 'date.tomorrow',     label: 'Fecha de mañana'        },
  { value: 'company.name',      label: 'Nombre de la empresa'   },
  { value: 'company.address',   label: 'Dirección de la empresa'},
  { value: 'company.phone',     label: 'Teléfono de la empresa' },
  { value: 'manual',            label: 'Entrada manual'         },
];

const AUTO_MAP = {
  nombre: 'contact.name',           nombre_cliente: 'contact.name',
  cliente: 'contact.name',          name: 'contact.name',
  telefono: 'contact.phone',        celular: 'contact.phone',
  movil: 'contact.phone',           phone: 'contact.phone',
  email: 'contact.email',           correo: 'contact.email',
  fecha: 'date.today',              fecha_hoy: 'date.today',
  fecha_actual: 'date.today',       fecha_contrato: 'date.today',
  fecha_inicio: 'date.today',       fecha_firma: 'date.today',
  empresa: 'company.name',          nombre_empresa: 'company.name',
  compania: 'company.name',
  direccion_empresa: 'company.address',
  telefono_empresa: 'company.phone',
};

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ── Extract tokens from DOCX using InspectModule ─────────────────────────────
function extractTokens(filePath) {
  const content = fs.readFileSync(filePath);
  const zip     = new PizZip(content);
  const iModule = InspectModule();
  const doc     = new Docxtemplater(zip, {
    modules:        [iModule],
    paragraphLoop:  true,
    linebreaks:     true,
    nullGetter:     () => '',
  });
  try { doc.render({}); } catch (_) { /* expected — missing tags */ }
  const tags = iModule.getAllTags();
  return Object.keys(tags || {});
}

// ── Resolve field values ─────────────────────────────────────────────────────
async function resolveValues(fields, contact, manualValues = {}) {
  let company = null;
  try {
    const Company = require('../models/Company');
    company = await Company.findOne();
  } catch (_) {}

  const values = {};
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

  for (const f of fields) {
    let val = '';
    switch (f.source) {
      case 'contact.name':      val = contact?.name  || contact?.contact_name || ''; break;
      case 'contact.phone':     val = contact?.phone || contact?.contact_phone || ''; break;
      case 'contact.email':     val = contact?.email || ''; break;
      case 'date.today':        val = formatDate(new Date()); break;
      case 'date.tomorrow':     val = formatDate(tomorrow); break;
      case 'company.name':      val = company?.nombre || ''; break;
      case 'company.address':   val = [company?.direccion, company?.ciudad, company?.pais].filter(Boolean).join(', '); break;
      case 'company.phone':     val = company?.telefono || ''; break;
      case 'manual':
      default:                  val = manualValues[f.key] ?? f.default_value ?? ''; break;
    }
    values[f.key] = String(val);
  }
  return values;
}

// ── Generate filled DOCX buffer ───────────────────────────────────────────────
function generateDocx(filePath, values) {
  const content = fs.readFileSync(filePath);
  const zip     = new PizZip(content);
  const doc     = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
    nullGetter:    () => '',
  });
  doc.render(values);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── Convert DOCX buffer to PDF via LibreOffice (optional) ────────────────────
async function toPdf(docxBuf, baseName) {
  const tmpDocx = path.join(GENERATED_DIR, `${baseName}.docx`);
  fs.writeFileSync(tmpDocx, docxBuf);
  return new Promise((resolve, reject) => {
    exec(
      `soffice --headless --convert-to pdf --outdir "${GENERATED_DIR}" "${tmpDocx}"`,
      { timeout: 30000 },
      (err) => {
        try { fs.unlinkSync(tmpDocx); } catch (_) {}
        if (err) return reject(err);
        resolve(path.join(GENERATED_DIR, `${baseName}.pdf`));
      }
    );
  });
}

// ────────────────────────────────────────────────────────────────────────────
// CONTROLLER ACTIONS
// ────────────────────────────────────────────────────────────────────────────

// POST /templates/upload
const upload = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo DOCX requerido' });

    const tokens = extractTokens(req.file.path);
    const fields = tokens.map(key => ({
      key,
      label:         key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
      source:        AUTO_MAP[key.toLowerCase()] || 'manual',
      default_value: null,
    }));

    const tpl = await DocumentTemplate.create({
      company_id:        req.user?.company_id || null,
      name:              req.body.name?.trim() || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      description:       req.body.description?.trim() || null,
      filename_original: req.file.originalname,
      filename_stored:   req.file.filename,
      fields,
      created_by:        req.user?.id || null,
    });

    res.json({ success: true, data: tpl });
  } catch (err) {
    logger.error('Template upload error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /templates
const list = async (req, res) => {
  try {
    const where = req.user?.company_id ? { company_id: req.user.company_id } : {};
    const rows  = await DocumentTemplate.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /templates/:id
const getOne = async (req, res) => {
  try {
    const where = { id: req.params.id, ...(req.user?.company_id ? { company_id: req.user.company_id } : {}) };
    const tpl   = await DocumentTemplate.findOne({ where });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    res.json({ success: true, data: { ...tpl.toJSON(), fieldSources: FIELD_SOURCES } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /templates/:id
const update = async (req, res) => {
  try {
    const where = { id: req.params.id, ...(req.user?.company_id ? { company_id: req.user.company_id } : {}) };
    const tpl   = await DocumentTemplate.findOne({ where });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    const { name, description, fields } = req.body;
    await tpl.update({
      ...(name        !== undefined ? { name: name.trim() }        : {}),
      ...(description !== undefined ? { description }              : {}),
      ...(fields      !== undefined ? { fields }                   : {}),
    });
    res.json({ success: true, data: tpl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /templates/:id
const remove = async (req, res) => {
  try {
    const where = { id: req.params.id, ...(req.user?.company_id ? { company_id: req.user.company_id } : {}) };
    const tpl   = await DocumentTemplate.findOne({ where });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });
    const { TEMPLATE_DIR } = require('../middleware/uploadTemplate');
    const filePath = path.join(TEMPLATE_DIR, tpl.filename_stored);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    await tpl.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /templates/:id/generate   body: { contactId?, manualFields, format: 'docx'|'pdf' }
const generate = async (req, res) => {
  try {
    const where = { id: req.params.id, ...(req.user?.company_id ? { company_id: req.user.company_id } : {}) };
    const tpl   = await DocumentTemplate.findOne({ where });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const { TEMPLATE_DIR } = require('../middleware/uploadTemplate');
    const filePath = path.join(TEMPLATE_DIR, tpl.filename_stored);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Archivo de plantilla no encontrado' });

    // Resolve contact
    let contact = null;
    if (req.body.contactId) {
      const { Contact } = require('../models');
      contact = await Contact.findByPk(req.body.contactId);
    }

    const values  = await resolveValues(tpl.fields, contact, req.body.manualFields || {});
    const docxBuf = generateDocx(filePath, values);
    const format  = req.body.format === 'pdf' ? 'pdf' : 'docx';
    const baseName = `${tpl.name.replace(/[^a-z0-9]/gi,'_')}_${Date.now()}`;

    if (format === 'pdf') {
      try {
        const pdfPath = await toPdf(docxBuf, baseName);
        const pdfBuf  = fs.readFileSync(pdfPath);
        try { fs.unlinkSync(pdfPath); } catch (_) {}
        res.set({
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        });
        return res.send(pdfBuf);
      } catch (pdfErr) {
        logger.warn('PDF conversion failed, fallback to DOCX:', pdfErr.message);
        // Fallback to DOCX
      }
    }

    res.set({
      'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${baseName}.docx"`,
    });
    res.send(docxBuf);
  } catch (err) {
    logger.error('Template generate error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /templates/:id/send   body: { sessionId, jid, contactId?, manualFields, format }
const send = async (req, res) => {
  try {
    const where = { id: req.params.id, ...(req.user?.company_id ? { company_id: req.user.company_id } : {}) };
    const tpl   = await DocumentTemplate.findOne({ where });
    if (!tpl) return res.status(404).json({ success: false, message: 'Plantilla no encontrada' });

    const { sessionId, jid, manualFields = {}, format = 'docx', contactId } = req.body;
    if (!jid) return res.status(400).json({ success: false, message: 'jid es requerido' });

    const { TEMPLATE_DIR } = require('../middleware/uploadTemplate');
    const filePath = path.join(TEMPLATE_DIR, tpl.filename_stored);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Archivo de plantilla no encontrado' });

    let contact = null;
    if (contactId) {
      const { Contact } = require('../models');
      contact = await Contact.findByPk(contactId);
    }

    const values   = await resolveValues(tpl.fields, contact, manualFields);
    const docxBuf  = generateDocx(filePath, values);
    const baseName = `${tpl.name.replace(/[^a-z0-9]/gi,'_')}_${Date.now()}`;

    // Intentar Baileys primero (personal y business); Meta API como fallback
    const whatsappService = require('../services/whatsappService');
    const session = whatsappService.getSession(sessionId);
    if (session?.sock) {
      await session.sock.sendMessage(jid, {
        document: docxBuf,
        fileName: `${tpl.name}.docx`,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    } else {
      const metaService = require('../services/metaService');
      const savedPath = path.join(GENERATED_DIR, `${baseName}.docx`);
      fs.writeFileSync(savedPath, docxBuf);
      const phone = jid.replace(/@.+/, '');
      await metaService.sendWhatsAppDocument(phone, {
        url:    `/uploads/generated/${baseName}.docx`,
        nombre: `${tpl.name}.docx`,
        tipo:   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }, req.user?.company_id);
      setTimeout(() => { try { fs.unlinkSync(savedPath); } catch (_) {} }, 60000);
    }

    res.json({ success: true, message: 'Documento enviado' });
  } catch (err) {
    logger.error('Template send error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /templates/field-sources  — returns the available source types
const fieldSources = (req, res) => res.json({ success: true, data: FIELD_SOURCES });

module.exports = { upload, list, getOne, update, remove, generate, send, fieldSources };
