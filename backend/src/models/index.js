// backend/src/models/index.js
// Punto central de todos los modelos y sus asociaciones

const { sequelize }    = require('../config/database');
const Contact          = require('./Contact');
const Conversation     = require('./Conversation');
const Message          = require('./Message');
const BotConfig        = require('./BotConfig');
const User             = require('./User');
const Campaign         = require('./Campaign');
const PaymentVoucher   = require('./PaymentVoucher');
const VoucherAuditLog  = require('./VoucherAuditLog');
const WhatsappMessage  = require('./WhatsappMessage');
const WhatsappChat     = require('./WhatsappChat');
const Integration      = require('./Integration');
const BotFile          = require('./BotFile');
const TransferCriteria = require('./TransferCriteria');
const WhatsappAccount  = require('./WhatsappAccount');
const Label            = require('./Label');
const BotCatalog       = require('./BotCatalog');
const FlowRule         = require('./FlowRule');
const QuickMessage     = require('./QuickMessage');
const CustomModule     = require('./CustomModule');
const ModuleRecord     = require('./ModuleRecord');
const Appointment        = require('./Appointment');
const BusinessSchedule   = require('./BusinessSchedule');
const DocumentTemplate   = require('./DocumentTemplate');
const DocumentRequest    = require('./DocumentRequest');
const MergeTemplate      = require('./MergeTemplate');

// ============================
// ASOCIACIONES ORIGINALES
// ============================

Contact.hasMany(Conversation, { foreignKey: 'contact_id', as: 'conversations' });
Conversation.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

User.hasMany(Conversation, { foreignKey: 'assigned_agent_id', as: 'assigned_conversations' });
Conversation.belongsTo(User, { foreignKey: 'assigned_agent_id', as: 'assigned_agent' });

// ============================
// ASOCIACIONES COMPROBANTES
// ============================

Contact.hasMany(PaymentVoucher, { foreignKey: 'contact_id', as: 'vouchers' });
PaymentVoucher.belongsTo(Contact, { foreignKey: 'contact_id', as: 'contact' });

User.hasMany(PaymentVoucher, { foreignKey: 'verified_by', as: 'verified_vouchers' });
PaymentVoucher.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });

PaymentVoucher.hasMany(VoucherAuditLog, { foreignKey: 'voucher_id', as: 'audit_logs' });
VoucherAuditLog.belongsTo(PaymentVoucher, { foreignKey: 'voucher_id', as: 'voucher' });

// ============================
// FUNCIÓN DE MIGRACIÓN
// ============================
const migrate = async () => {
  const logger     = require('../config/logger');
  const { DataTypes: DT } = require('sequelize');

  const qi = sequelize.getQueryInterface();
  const safeAdd = async (table, column, def) => {
    try {
      await qi.addColumn(table, column, def);
      logger.info(`  ✅ ${table}.${column} agregada`);
    } catch (e) {
      const msg = e.original?.message || e.message || '';
      if (!msg.includes('already exists') && e.original?.code !== '42701') {
        logger.warn(`  ⚠️  No se pudo agregar ${table}.${column}: ${msg}`);
      }
    }
  };

  try {
    await sequelize.sync({ force: false });

    // Garantizar que las tablas de módulos existan SIEMPRE, independientemente del alter
    await CustomModule.sync({ force: false });
    await ModuleRecord.sync({ force: false });

    // Columnas de archivo en bot_catalogs — corren siempre (idempotente vía safeAdd)
    await safeAdd('bot_catalogs', 'archivo_url',    { type: DT.STRING(500), allowNull: true, defaultValue: null });
    await safeAdd('bot_catalogs', 'archivo_nombre', { type: DT.STRING(255), allowNull: true, defaultValue: null });
    await safeAdd('bot_catalogs', 'archivo_tipo',   { type: DT.STRING(80),  allowNull: true, defaultValue: null });

    // Tablas de calendario y plantillas — cada sync es independiente para no bloquear la migración
    const safeSync = async (Model) => {
      try { await Model.sync({ force: false }); }
      catch (e) { logger.warn(`⚠️  safeSync ${Model.tableName}: ${e.original?.message || e.message}`); }
    };
    await safeSync(Appointment);
    await safeSync(BusinessSchedule);
    await safeSync(DocumentTemplate);
    await safeSync(DocumentRequest);
    await safeSync(MergeTemplate);
    await safeAdd('merge_templates', 'canal', { type: DT.STRING(30), allowNull: false, defaultValue: 'all' });

    // Agregar trigger_keywords a document_templates si no existe
    await safeAdd('document_templates', 'trigger_keywords', { type: DT.JSONB, defaultValue: [] });

    // Corregir columnas INTEGER → UUID en appointments y document_templates
    // PostgreSQL no permite cambiar INTEGER a UUID directamente; drop + add es seguro en tablas nuevas
    for (const [table, col] of [['appointments','created_by'],['appointments','assigned_to'],['document_templates','created_by']]) {
      try {
        await sequelize.query(`
          DO $$ BEGIN
            IF EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name='${table}' AND column_name='${col}'
                AND data_type='integer'
            ) THEN
              ALTER TABLE "${table}" DROP COLUMN "${col}";
              ALTER TABLE "${table}" ADD COLUMN "${col}" UUID;
            END IF;
          END $$;
        `);
      } catch (e) { logger.warn(`No se pudo corregir ${table}.${col}:`, e.message); }
    }

    try {
      await sequelize.sync({ alter: { drop: false } });
      logger.info('✅ Tablas sincronizadas con la base de datos');
    } catch (alterErr) {
      const errDetail = alterErr.original?.message || alterErr.message || String(alterErr);
      logger.warn('⚠️  sync alter falló, aplicando columnas manualmente:', errDetail);

      await safeAdd('whatsapp_chats', 'labels',       { type: DT.ARRAY(DT.STRING), defaultValue: [], allowNull: false });
      await safeAdd('whatsapp_chats', 'session_type', { type: DT.STRING(20), defaultValue: 'personal', allowNull: false });
      await safeAdd('whatsapp_chats', 'bot_mode',     { type: DT.STRING(20), defaultValue: 'generic',  allowNull: false });
      await safeAdd('whatsapp_chats', 'bot_prompt',   { type: DT.TEXT,       defaultValue: '',          allowNull: true  });
      await safeAdd('whatsapp_chats', 'unread_count', { type: DT.INTEGER,    defaultValue: 0,           allowNull: false });
      await safeAdd('whatsapp_chats', 'lid',          { type: DT.STRING(100), allowNull: true });

      logger.info('✅ Tablas sincronizadas (modo manual)');
    }

    // ── Columnas de archivo en bot_catalogs ──────────────────────────────
    await safeAdd('bot_catalogs', 'archivo_url',    { type: DT.STRING(500), allowNull: true, defaultValue: null });
    await safeAdd('bot_catalogs', 'archivo_nombre', { type: DT.STRING(255), allowNull: true, defaultValue: null });
    await safeAdd('bot_catalogs', 'archivo_tipo',   { type: DT.STRING(80),  allowNull: true, defaultValue: null });

    // ── LID mapping para WhatsApp multi-device ───────────────────────────
    await safeAdd('whatsapp_chats', 'lid', { type: DT.STRING(100), allowNull: true });

    // ── active_features en company (multi-tenant feature flags) ─────────
    const Company = require('./Company');
    await safeAdd('company', 'active_features', {
      type: DT.JSONB,
      allowNull: false,
      defaultValue: {
        inbox: true, whatsapp_personal: true, whatsapp_business: true,
        campaigns: true, vouchers: true, appointments: true,
        document_templates: true, bot_ai: true, flow_rules: true,
        quick_messages: true, labels: true, custom_modules: true,
        bot_catalogs: true, dashboard: true, team_management: true, merge_templates: true,
      },
    });
    // Poblar active_features en empresas existentes que lo tengan NULL
    try {
      await sequelize.query(`
        UPDATE company SET active_features = '{"inbox":true,"whatsapp_personal":true,"whatsapp_business":true,"campaigns":true,"vouchers":true,"appointments":true,"document_templates":true,"bot_ai":true,"flow_rules":true,"quick_messages":true,"labels":true,"custom_modules":true,"bot_catalogs":true,"dashboard":true,"team_management":true,"merge_templates":true}'::jsonb
        WHERE active_features IS NULL
      `);
    } catch (_) {}

    // Agregar merge_templates a empresas existentes que no lo tengan
    try {
      await sequelize.query(`
        UPDATE company SET active_features = active_features || '{"merge_templates":true}'::jsonb
        WHERE active_features IS NOT NULL AND NOT (active_features ? 'merge_templates')
      `);
    } catch (_) {}

    // ── Migración multi-tenant y recuperación de contraseña ──────────────
    // Nuevas columnas en users
    await safeAdd('users', 'reset_token',         { type: DT.STRING(200), allowNull: true });
    await safeAdd('users', 'reset_token_expires',  { type: DT.DATE,       allowNull: true });

    // company_id en tablas que aún no lo tengan
    const tablasTenant = [
      'whatsapp_chats', 'campaigns', 'labels',
      'quick_messages', 'custom_modules', 'module_records'
    ];
    for (const t of tablasTenant) {
      await safeAdd(t, 'company_id', { type: DT.UUID, allowNull: true });
    }

    // Agregar 'superadmin' al ENUM de roles si aún no existe
    try {
      await sequelize.query(`ALTER TYPE "enum_users_role" ADD VALUE IF NOT EXISTS 'superadmin'`);
    } catch (_) { /* ya existe o no es ENUM */ }

    // Poblar company_id en registros existentes con la primera empresa
    try {
      const Company = require('./Company');
      const firstCompany = await Company.findOne({ order: [['created_at', 'ASC']] });
      if (firstCompany) {
        const cid = firstCompany.id;
        const tablasPoblar = [
          { t: 'users',          extra: `AND role != 'superadmin'` },
          { t: 'contacts',       extra: '' },
          { t: 'conversations',  extra: '' },
          { t: 'whatsapp_chats', extra: '' },
          { t: 'campaigns',      extra: '' },
          { t: 'labels',         extra: '' },
          { t: 'quick_messages', extra: '' },
          { t: 'custom_modules', extra: '' },
          { t: 'module_records', extra: '' },
          { t: 'payment_vouchers', extra: '' },
          { t: 'bot_configs',    extra: '' },
        ];
        for (const { t, extra } of tablasPoblar) {
          try {
            await sequelize.query(
              `UPDATE "${t}" SET company_id = '${cid}' WHERE company_id IS NULL ${extra}`
            );
          } catch (_) { /* tabla puede no existir aún */ }
        }
        logger.info(`✅ company_id asignado a registros existentes → ${firstCompany.nombre || cid}`);
      }
    } catch (e) {
      logger.warn('⚠️  No se pudo poblar company_id:', e.message);
    }

  } catch (error) {
    logger.error('❌ Error en migración:', error);
    throw error;
  }
};
WhatsappChat.hasMany(WhatsappMessage, {
  foreignKey:  'session_id',
  sourceKey:   'session_id',
  as:          'messages',
  constraints: false, // session_id no es única en whatsapp_chats (la única lo es junto con jid);
                       // esta relación es lógica, se filtra por session_id + jid en las queries,
                       // así que no debe crear una FK real a nivel de Postgres
  scope:       { }
});

DocumentTemplate.hasMany(DocumentRequest, { foreignKey: 'template_id', as: 'requests' });
DocumentRequest.belongsTo(DocumentTemplate, { foreignKey: 'template_id', as: 'template' });

module.exports = {
  sequelize,
  Contact,
  Conversation,
  Message,
  BotConfig,
  User,
  Campaign,
  PaymentVoucher,
  VoucherAuditLog,
  WhatsappMessage,
  WhatsappChat,
  WhatsappAccount,
  Integration,
  BotFile,
  TransferCriteria,
  Label,
  BotCatalog,
  FlowRule,
  QuickMessage,
  CustomModule,
  ModuleRecord,
  Appointment,
  BusinessSchedule,
  DocumentTemplate,
  DocumentRequest,
  MergeTemplate,
  migrate
};
