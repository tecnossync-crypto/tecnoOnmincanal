// backend/src/routes/index.js
// ─────────────────────────────────────────────────────────────
// Todas las rutas de Tecnossync con RBAC aplicado
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

const webhookController   = require('../controllers/webhookController');
const messageController   = require('../controllers/messageController');
const authController      = require('../controllers/authController');
const botConfigController = require('../controllers/botConfigController');
const campaignController  = require('../controllers/campaignController');
const userController      = require('../controllers/userController');
const statsController     = require('../controllers/statsController');
const companyRoutes       = require('./companyRoutes');
const voucherRoutes       = require('./voucherRoutes');
const whatsappRoutes      = require('./whatsappRoutes');
const whatsappAccountRoutes = require('./whatsappAccountRoutes');
const integrationController = require('../controllers/integrationController');
const { controller: botFileController, upload: botFileUpload } = require('../controllers/botFileController');
const transferCriteriaController = require('../controllers/transferCriteriaController');
const flowRuleController   = require('../controllers/flowRuleController');
const quickMessageController  = require('../controllers/quickMessageController');
const customModuleController  = require('../controllers/customModuleController');
const moduleRecordController  = require('../controllers/moduleRecordController');
const appointmentCtrl         = require('../controllers/appointmentController');
const templateCtrl            = require('../controllers/documentTemplateController');
const docRequestCtrl          = require('../controllers/documentRequestController');
const mergeTemplateCtrl       = require('../controllers/mergeTemplateController');
const { upload: tplUpload }   = require('../middleware/uploadTemplate');
const { handleCatalogUpload, CATALOG_DIR } = require('../middleware/uploadCatalog');

const {
  auth,
  requireRole,
  requireSuperAdmin,
  companyScope,
  scopeConversations,
  requireConversationAccess,
  requireFeature
} = require('../middleware/auth');

// ─────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Tecnossync', timestamp: new Date().toISOString(), version: '2.0.0' });
});
router.get('/stats', auth, requireRole('admin'), requireFeature('dashboard'), statsController.getDashboard.bind(statsController));

// ─────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────
router.post('/auth/login',           authController.login.bind(authController));
router.post('/auth/logout',          auth, authController.logout.bind(authController));
router.get ('/auth/me',              auth, authController.me.bind(authController));
router.post('/auth/forgot-password', authController.forgotPassword.bind(authController));
router.post('/auth/reset-password',  authController.resetPassword.bind(authController));

// Registro: admin crea cuentas para su empresa; superadmin puede crear en cualquier empresa
router.post('/auth/register', auth, requireRole('admin'), authController.register.bind(authController));

// ─────────────────────────────────────
// GESTIÓN DE USUARIOS (solo admin)
// ─────────────────────────────────────
router.get   ('/users',              auth, requireRole('admin'), requireFeature('team_management'), companyScope, userController.list.bind(userController));
router.post  ('/users',              auth, requireRole('admin'), requireFeature('team_management'), companyScope, userController.create.bind(userController));
router.put   ('/users/:id',          auth, requireRole('admin'), requireFeature('team_management'), companyScope, userController.update.bind(userController));
router.patch ('/users/:id/toggle',   auth, requireRole('admin'), requireFeature('team_management'), companyScope, userController.toggleActive.bind(userController));
router.delete('/users/:id',          auth, requireRole('admin'), requireFeature('team_management'), companyScope, userController.remove.bind(userController));
router.patch ('/users/:id/password', auth,                       companyScope, userController.changePassword.bind(userController));

// ─────────────────────────────────────
// WEBHOOKS META (sin auth — validados por HMAC)
// ─────────────────────────────────────
router.get ('/webhook/:channel', webhookController.verify.bind(webhookController));
router.post('/webhook/:channel', webhookController.receive.bind(webhookController));
router.use('/whatsapp-accounts', whatsappAccountRoutes);


// ─────────────────────────────────────
// ARCHIVOS DEL BOT
// ─────────────────────────────────────
router.get   ('/bot-configs/active', auth, botConfigController.getActive.bind(botConfigController));  // ← AQUÍ PRIMERO
router.get   ('/bot-configs',      auth, botConfigController.getAll.bind(botConfigController));
router.get   ('/bot-configs/:id',  auth, botConfigController.getOne.bind(botConfigController));
router.post  ('/bot-configs',      auth, requireRole('admin'), botConfigController.create.bind(botConfigController));
router.put   ('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.update.bind(botConfigController));
router.delete('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.delete.bind(botConfigController));
router.post  ('/bot-configs/test', auth, botConfigController.test.bind(botConfigController));
// ─────────────────────────────────────
// CRITERIOS DE TRANSFERENCIA
// ─────────────────────────────────────
router.get   ('/transfer-criteria',      auth, requireRole('admin'), transferCriteriaController.getAll.bind(transferCriteriaController));
router.post  ('/transfer-criteria',      auth, requireRole('admin'), transferCriteriaController.create.bind(transferCriteriaController));
router.put   ('/transfer-criteria/:id',  auth, requireRole('admin'), transferCriteriaController.update.bind(transferCriteriaController));
router.delete('/transfer-criteria/:id',  auth, requireRole('admin'), transferCriteriaController.remove.bind(transferCriteriaController));

// ─────────────────────────────────────
// REGLAS DE FLUJO DEL BOT
// ─────────────────────────────────────
router.get   ('/flow-rules',          auth, requireFeature('flow_rules'), companyScope, flowRuleController.getAll);
router.post  ('/flow-rules',          auth, requireRole('admin'), requireFeature('flow_rules'), companyScope, flowRuleController.create);
router.put   ('/flow-rules/:id',      auth, requireRole('admin'), requireFeature('flow_rules'), companyScope, flowRuleController.update);
router.patch ('/flow-rules/:id/toggle', auth, requireRole('admin'), requireFeature('flow_rules'), companyScope, flowRuleController.toggle);
router.delete('/flow-rules/:id',      auth, requireRole('admin'), requireFeature('flow_rules'), companyScope, flowRuleController.remove);

// ─────────────────────────────────────
// MÓDULOS PERSONALIZADOS
// ─────────────────────────────────────
router.get   ('/custom-modules',              auth, requireFeature('custom_modules'), companyScope, customModuleController.getAll);
router.get   ('/custom-modules/admin',        auth, requireRole('admin'), requireFeature('custom_modules'), companyScope, customModuleController.getAllAdmin);
router.get   ('/custom-modules/:slug',        auth, requireFeature('custom_modules'), companyScope, customModuleController.getOne);
router.post  ('/custom-modules',              auth, requireRole('admin'), requireFeature('custom_modules'), companyScope, customModuleController.create);
router.put   ('/custom-modules/:id',          auth, requireRole('admin'), requireFeature('custom_modules'), companyScope, customModuleController.update);
router.delete('/custom-modules/:id',          auth, requireRole('admin'), requireFeature('custom_modules'), companyScope, customModuleController.remove);

router.get   ('/module-records',              auth, requireFeature('custom_modules'), companyScope, moduleRecordController.getAll);
router.get   ('/module-records/stats/:module_id', auth, requireFeature('custom_modules'), companyScope, moduleRecordController.getDailyStats);
router.post  ('/module-records',              auth, requireFeature('custom_modules'), companyScope, moduleRecordController.create);
router.put   ('/module-records/:id',          auth, requireFeature('custom_modules'), companyScope, moduleRecordController.update);
router.delete('/module-records/:id',          auth, requireRole('admin'), requireFeature('custom_modules'), companyScope, moduleRecordController.remove);

// ─────────────────────────────────────
// MENSAJES RÁPIDOS
// ─────────────────────────────────────
router.get   ('/quick-messages',        auth, requireFeature('quick_messages'), companyScope, quickMessageController.getAll);
router.get   ('/quick-messages/admin',  auth, requireRole('admin'), requireFeature('quick_messages'), companyScope, quickMessageController.getAllAdmin);
router.post  ('/quick-messages',        auth, requireRole('admin'), requireFeature('quick_messages'), companyScope, quickMessageController.create);
router.put   ('/quick-messages/:id',    auth, requireRole('admin'), requireFeature('quick_messages'), companyScope, quickMessageController.update);
router.delete('/quick-messages/:id',    auth, requireRole('admin'), requireFeature('quick_messages'), companyScope, quickMessageController.remove);

// ─────────────────────────────────────
// CONVERSACIONES
// ─────────────────────────────────────
router.get('/conversations',
  auth, scopeConversations,
  messageController.getConversations.bind(messageController));

router.get('/conversations/:id',
  auth, requireConversationAccess,
  messageController.getConversation.bind(messageController));

router.get('/conversations/:id/messages',
  auth, requireConversationAccess,
  messageController.getMessages.bind(messageController));

router.post('/conversations/:id/messages',
  auth, requireConversationAccess,
  messageController.sendMessage.bind(messageController));

router.post('/conversations/:id/assign',
  auth, requireRole('admin'),
  messageController.assignConversation.bind(messageController));

router.post('/conversations/:id/resolve',
  auth, requireConversationAccess,
  messageController.resolveConversation.bind(messageController));

// ─────────────────────────────────────
// CONFIGURACIÓN DEL BOT
// ─────────────────────────────────────
router.get   ('/bot-configs',      auth, botConfigController.getAll.bind(botConfigController));
router.get   ('/bot-configs/:id',  auth, botConfigController.getOne.bind(botConfigController));
router.post  ('/bot-configs',      auth, requireRole('admin'), botConfigController.create.bind(botConfigController));
router.put   ('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.update.bind(botConfigController));
router.delete('/bot-configs/:id',  auth, requireRole('admin'), botConfigController.delete.bind(botConfigController));
router.post  ('/bot-configs/test', auth, botConfigController.test.bind(botConfigController));

// ─────────────────────────────────────
// CAMPAÑAS MASIVAS — solo admin
// ─────────────────────────────────────
router.get   ('/campaigns',             auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.getAll.bind(campaignController));
router.get   ('/campaigns/:id',         auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.getOne.bind(campaignController));
router.post  ('/campaigns',             auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.create.bind(campaignController));
router.post  ('/campaigns/:id/launch',  auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.launch.bind(campaignController));
router.post  ('/campaigns/:id/pause',   auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.pause.bind(campaignController));
router.delete('/campaigns/:id',         auth, requireRole('admin'), requireFeature('campaigns'), companyScope, campaignController.delete.bind(campaignController));

// ─────────────────────────────────────
// INTEGRACIONES CON PLATAFORMAS EXTERNAS
// ─────────────────────────────────────

router.get   ('/integrations/active',       auth, requireFeature('bot_ai'), integrationController.getActive.bind(integrationController));
router.post  ('/integrations/test',         auth, requireRole('admin'), requireFeature('bot_ai'), integrationController.test.bind(integrationController));
router.get   ('/integrations',              auth, requireRole('admin'), requireFeature('bot_ai'), integrationController.getAll.bind(integrationController));
router.post  ('/integrations',              auth, requireRole('admin'), requireFeature('bot_ai'), integrationController.create.bind(integrationController));
router.patch ('/integrations/:id/activate', auth, requireRole('admin'), requireFeature('bot_ai'), integrationController.setActive.bind(integrationController));
router.delete('/integrations/:id',          auth, requireRole('admin'), requireFeature('bot_ai'), integrationController.remove.bind(integrationController));

// ─────────────────────────────────────
// CONTACTOS — ambos roles (lectura)
// ─────────────────────────────────────
const { Contact, Conversation, Label, BotCatalog } = require('../models');
const { Op }                                       = require('sequelize');

router.get('/contacts', auth, companyScope, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const companyFilter = req.companyFilter || {};
    const where = { ...companyFilter };
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Contact.findAndCountAll({
      where,
      limit:  +limit,
      offset: (+page - 1) * +limit,
      order:  [['created_at', 'DESC']]
    });

    res.json({ success: true, data: { contacts: rows, total: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/contacts/:id', auth, companyScope, async (req, res) => {
  try {
    const contact = await Contact.findOne({
      where: { id: req.params.id, ...req.companyFilter }
    });
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/contacts/:id', auth, companyScope, async (req, res) => {
  try {
    const contact = await Contact.findOne({
      where: { id: req.params.id, ...req.companyFilter }
    });
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    await contact.update(req.body);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ─────────────────────────────────────
// CATÁLOGOS DEL BOT
// ─────────────────────────────────────
router.get('/bot-catalogs', auth, requireFeature('bot_catalogs'), async (req, res) => {
  try {
    const catalogs = await BotCatalog.findAll({ order: [['created_at', 'DESC']] });
    res.json({ success: true, data: catalogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/bot-catalogs', auth, requireRole('admin'), requireFeature('bot_catalogs'), async (req, res) => {
  try {
    const { nombre, identificador, tipo, descripcion, contenido } = req.body;
    if (!nombre?.trim())        return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    if (!identificador?.trim()) return res.status(400).json({ success: false, message: 'El identificador es obligatorio' });
    const slug = identificador.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const catalog = await BotCatalog.create({
      nombre: nombre.trim(),
      identificador: slug,
      tipo:          tipo || 'general',
      descripcion:   descripcion?.trim() || null,
      contenido:     contenido || ''
    });
    res.json({ success: true, data: catalog });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Ya existe un catálogo con ese identificador' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/bot-catalogs/:id', auth, requireRole('admin'), requireFeature('bot_catalogs'), async (req, res) => {
  try {
    const catalog = await BotCatalog.findByPk(req.params.id);
    if (!catalog) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
    const updates = {};
    const { nombre, identificador, tipo, descripcion, contenido, activo } = req.body;
    if (nombre        !== undefined) updates.nombre        = nombre.trim();
    if (identificador !== undefined) updates.identificador = identificador.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (tipo          !== undefined) updates.tipo          = tipo;
    if (descripcion   !== undefined) updates.descripcion   = descripcion?.trim() || null;
    if (contenido     !== undefined) updates.contenido     = contenido;
    if (activo        !== undefined) updates.activo        = activo;
    await catalog.update(updates);
    res.json({ success: true, data: catalog });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, message: 'Ya existe un catálogo con ese identificador' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Subir archivo a un catálogo (POST crea/reemplaza, DELETE quita el archivo)
router.post('/bot-catalogs/:id/file',
  auth, requireRole('admin'), requireFeature('bot_catalogs'),
  handleCatalogUpload,
  async (req, res) => {
    const pathMod = require('path');
    const fs      = require('fs');
    const logger  = require('../config/logger');
    try {
      const catalog = await BotCatalog.findByPk(req.params.id);
      if (!catalog) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
      if (!req.file)  return res.status(400).json({ success: false, message: 'Archivo requerido' });

      // Eliminar archivo previo si existe
      if (catalog.archivo_url) {
        const oldPath = pathMod.join(__dirname, '../..', catalog.archivo_url);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) { logger.warn('No se pudo eliminar archivo anterior:', e.message); }
        }
      }

      const updates = {
        archivo_url:    `/uploads/catalogs/${req.file.filename}`,
        archivo_nombre: req.file.originalname,
        archivo_tipo:   req.file.mimetype,
      };

      // Extraer texto si es PDF
      if (req.file.mimetype === 'application/pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const buffer   = fs.readFileSync(req.file.path);
          const parsed   = await pdfParse(buffer);
          const extracted = parsed.text?.trim();
          if (extracted) {
            updates.contenido = extracted;
            logger.info(`📄 PDF "${req.file.originalname}" → ${extracted.length} caracteres extraídos`);
          }
        } catch (pdfErr) {
          logger.warn('Error extrayendo texto del PDF:', pdfErr.message);
        }
      }

      await catalog.update(updates);
      res.json({ success: true, data: catalog });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.delete('/bot-catalogs/:id/file', auth, requireRole('admin'), requireFeature('bot_catalogs'), async (req, res) => {
  try {
    const pathMod = require('path');
    const fs      = require('fs');
    const catalog = await BotCatalog.findByPk(req.params.id);
    if (!catalog) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
    if (catalog.archivo_url) {
      const filePath = pathMod.join(__dirname, '../..', catalog.archivo_url);
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (e) { /* non-fatal */ } }
    }
    await catalog.update({ archivo_url: null, archivo_nombre: null, archivo_tipo: null });
    res.json({ success: true, data: catalog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/bot-catalogs/:id', auth, requireRole('admin'), requireFeature('bot_catalogs'), async (req, res) => {
  try {
    const pathMod = require('path');
    const fs      = require('fs');
    const catalog = await BotCatalog.findByPk(req.params.id);
    if (!catalog) return res.status(404).json({ success: false, message: 'Catálogo no encontrado' });
    // Eliminar archivo físico asociado
    if (catalog.archivo_url) {
      const filePath = pathMod.join(__dirname, '../..', catalog.archivo_url);
      if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (e) { /* non-fatal */ } }
    }
    await catalog.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────
// ETIQUETAS
// ─────────────────────────────────────
router.get('/labels', auth, requireFeature('labels'), companyScope, async (req, res) => {
  try {
    const labels = await Label.findAll({
      where: req.companyFilter,
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: labels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/labels', auth, requireRole('admin'), requireFeature('labels'), companyScope, async (req, res) => {
  try {
    const { nombre, descripcion, color } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    const label = await Label.create({
      nombre:      nombre.trim(),
      descripcion: descripcion?.trim() || null,
      color:       color || '#6366f1',
      company_id:  req.user.role === 'superadmin' ? null : req.user.company_id,
      updated_by:  req.user?.name || req.user?.email || 'Sistema'
    });
    res.json({ success: true, data: label });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/labels/:id', auth, requireRole('admin'), requireFeature('labels'), companyScope, async (req, res) => {
  try {
    const label = await Label.findOne({ where: { id: req.params.id, ...req.companyFilter } });
    if (!label) return res.status(404).json({ success: false, message: 'Etiqueta no encontrada' });
    const { nombre, descripcion, color, activo } = req.body;
    await label.update({
      ...(nombre      !== undefined ? { nombre: nombre.trim() }                   : {}),
      ...(descripcion !== undefined ? { descripcion: descripcion?.trim() || null } : {}),
      ...(color       !== undefined ? { color }                                   : {}),
      ...(activo      !== undefined ? { activo }                                  : {}),
      updated_by: req.user?.name || req.user?.email || 'Sistema'
    });
    res.json({ success: true, data: label });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/labels/:id', auth, requireRole('admin'), requireFeature('labels'), companyScope, async (req, res) => {
  try {
    const label = await Label.findOne({ where: { id: req.params.id, ...req.companyFilter } });
    if (!label) return res.status(404).json({ success: false, message: 'Etiqueta no encontrada' });
    await label.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────
// PATCH conversación — notas, etiquetas, metadata
// ─────────────────────────────────────
router.patch('/conversations/:id',
  auth, requireConversationAccess,
  async (req, res) => {
    try {
      const conv = await Conversation.findByPk(req.params.id);
      if (!conv) return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
      const { metadata: metaPatch } = req.body;
      if (metaPatch && typeof metaPatch === 'object') {
        const merged = { ...(conv.metadata || {}), ...metaPatch };
        await conv.update({ metadata: merged });
        await conv.reload();
      }
      res.json({ success: true, data: conv });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ─────────────────────────────────────
// CALENDARIO DE CITAS
// ─────────────────────────────────────
router.get   ('/appointments/availability', auth, requireFeature('appointments'), appointmentCtrl.getAvailability);
router.get   ('/appointments/schedule',     auth, requireFeature('appointments'), appointmentCtrl.getSchedule);
router.put   ('/appointments/schedule',     auth, requireRole('admin'), requireFeature('appointments'), appointmentCtrl.updateSchedule);
router.get   ('/appointments/next-slots',   auth, requireFeature('appointments'), appointmentCtrl.getNextSlots);
router.get   ('/appointments',              auth, requireFeature('appointments'), appointmentCtrl.getAll);
router.post  ('/appointments',              auth, requireFeature('appointments'), appointmentCtrl.create);
router.put   ('/appointments/:id',          auth, requireFeature('appointments'), appointmentCtrl.update);
router.delete('/appointments/:id',          auth, requireRole('admin'), requireFeature('appointments'), appointmentCtrl.remove);

// ─────────────────────────────────────
// PLANTILLAS DE DOCUMENTOS
// ─────────────────────────────────────
router.get   ('/templates/field-sources',   auth, requireFeature('document_templates'), templateCtrl.fieldSources);
router.get   ('/templates',                 auth, requireFeature('document_templates'), templateCtrl.list);
router.post  ('/templates/upload',          auth, requireRole('admin'), requireFeature('document_templates'), tplUpload.single('file'), templateCtrl.upload);
router.get   ('/templates/:id',             auth, requireFeature('document_templates'), templateCtrl.getOne);
router.put   ('/templates/:id',             auth, requireRole('admin'), requireFeature('document_templates'), templateCtrl.update);
router.delete('/templates/:id',             auth, requireRole('admin'), requireFeature('document_templates'), templateCtrl.remove);
router.post  ('/templates/:id/generate',    auth, requireFeature('document_templates'), templateCtrl.generate);
router.post  ('/templates/:id/send',        auth, requireFeature('document_templates'), templateCtrl.send);

// ─────────────────────────────────────
// SOLICITUDES DE DOCUMENTOS (colección bot)
// ─────────────────────────────────────
router.get   ('/document-requests',                auth, requireFeature('document_templates'), docRequestCtrl.list);
router.post  ('/document-requests/start',          auth, requireFeature('document_templates'), docRequestCtrl.start);
router.get   ('/document-requests/:id/download',   auth, requireFeature('document_templates'), docRequestCtrl.download);
router.post  ('/document-requests/:id/send',       auth, requireFeature('document_templates'), docRequestCtrl.send);
router.post  ('/document-requests/:id/reject',     auth, requireFeature('document_templates'), docRequestCtrl.reject);

// Servir archivos generados
router.use('/uploads/generated', require('express').static(
  require('path').join(__dirname, '../../uploads/generated')
));

// ─────────────────────────────────────
// PLANTILLAS MERGE
// ─────────────────────────────────────
router.post  ('/merge-templates/variables',    auth, requireFeature('merge_templates'), mergeTemplateCtrl.getVariables.bind(mergeTemplateCtrl));
router.post  ('/merge-templates/preview',      auth, requireFeature('merge_templates'), mergeTemplateCtrl.preview.bind(mergeTemplateCtrl));
router.post  ('/merge-templates/detect-map',   auth, requireFeature('merge_templates'), mergeTemplateCtrl.detectAndMap.bind(mergeTemplateCtrl));
router.get   ('/merge-templates',              auth, requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.list.bind(mergeTemplateCtrl));
router.post  ('/merge-templates',              auth, requireRole('admin'), requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.create.bind(mergeTemplateCtrl));
router.get   ('/merge-templates/:id',          auth, requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.getOne.bind(mergeTemplateCtrl));
router.put   ('/merge-templates/:id',          auth, requireRole('admin'), requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.update.bind(mergeTemplateCtrl));
router.delete('/merge-templates/:id',          auth, requireRole('admin'), requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.remove.bind(mergeTemplateCtrl));
router.patch ('/merge-templates/:id/toggle',   auth, requireRole('admin'), requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.toggleActive.bind(mergeTemplateCtrl));
router.put   ('/merge-templates/:id/mapping',  auth, requireRole('admin'), requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.updateMapping.bind(mergeTemplateCtrl));
router.post  ('/merge-templates/:id/merge',    auth, requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.merge.bind(mergeTemplateCtrl));
router.post  ('/merge-templates/:id/use/:conversationId', auth, requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.useInConversation.bind(mergeTemplateCtrl));
router.post  ('/merge-templates/auto-merge/:conversationId', auth, requireFeature('merge_templates'), companyScope, mergeTemplateCtrl.autoMergeForConversation.bind(mergeTemplateCtrl));

// ─────────────────────────────────────
// COMPROBANTES DE PAGO
// ─────────────────────────────────────
router.use('/vouchers', auth, requireFeature('vouchers'), voucherRoutes);
console.log('✅ WhatsApp routes cargadas');
router.use('/whatsapp', whatsappRoutes);
// ─────────────────────────────────────
// EMPRESA
// ─────────────────────────────────────
router.use('/company', companyRoutes);

module.exports = router;
