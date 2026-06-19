// backend/src/services/campaignService.js
// Servicio de campañas masivas usando Bull + Redis para la cola

const Bull = require('bull');
const { bullRedisConfig } = require('../config/redis');
const { Campaign, Contact } = require('../models');
const metaService = require('./metaService');
const logger = require('../config/logger');

// Crear la cola de campañas (se ejecuta en Redis)
const campaignQueue = new Bull('campaigns', bullRedisConfig);

class CampaignService {

  /**
   * Inicia el procesador de la cola
   * Llamar esto una vez al arrancar el servidor
   */
  initializeProcessor() {
    // Procesar 5 trabajos en paralelo como máximo
    campaignQueue.process(5, async (job) => {
      const { campaignId, contactId, recipientId, channel, text } = job.data;
      
      try {
        logger.debug(`📤 Enviando mensaje campaña ${campaignId} a ${recipientId}`);
        await metaService.sendMessage(channel, recipientId, text);
        
        // Actualizar contador de enviados
        await Campaign.increment('sent_count', { where: { id: campaignId } });
        
        return { success: true, recipientId };
      } catch (error) {
        logger.error(`❌ Error enviando a ${recipientId}:`, error.message);
        await Campaign.increment('failed_count', { where: { id: campaignId } });
        throw error;  // Bull marcará este job como fallido
      }
    });

    // Eventos de la cola
    campaignQueue.on('completed', (job, result) => {
      logger.debug(`✅ Job ${job.id} completado`);
    });

    campaignQueue.on('failed', (job, err) => {
      logger.error(`❌ Job ${job.id} falló:`, err.message);
    });

    campaignQueue.on('stalled', (job) => {
      logger.warn(`⚠️  Job ${job.id} se atascó`);
    });

    logger.info('✅ Procesador de campañas inicializado');
  }

  /**
   * Crea una nueva campaña
   */
  async createCampaign(data) {
    const campaign = await Campaign.create(data);
    logger.info(`📊 Campaña creada: ${campaign.id} - ${campaign.name}`);
    return campaign;
  }

  /**
   * Lanza una campaña: agrega todos los mensajes a la cola
   */
  async launchCampaign(campaignId) {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');
    
    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new Error(`No se puede lanzar campaña en estado: ${campaign.status}`);
    }

    // Obtener contactos según filtros de la campaña
    const contacts = await this.getAudience(campaign);
    
    if (contacts.length === 0) {
      throw new Error('No hay contactos en la audiencia de esta campaña');
    }

    logger.info(`🚀 Lanzando campaña ${campaign.name} para ${contacts.length} contactos`);

    // Actualizar estado
    await campaign.update({
      status: 'running',
      total_recipients: contacts.length,
      started_at: new Date()
    });

    // Calcular delay entre mensajes según la velocidad configurada
    // Ej: 60 msg/min = 1 seg entre cada uno
    const delayMs = Math.floor(60000 / campaign.messages_per_minute);

    // Agregar cada mensaje a la cola con delay incremental
    const jobs = contacts.map((contact, index) => {
      const recipientId = this.getChannelId(contact, campaign.channel);
      if (!recipientId) return null;

      const personalizedText = this.personalizeMessage(
        campaign.message_template,
        contact
      );

      return {
        name: `msg-${campaignId}-${contact.id}`,
        data: {
          campaignId,
          contactId: contact.id,
          recipientId,
          channel: campaign.channel,
          text: personalizedText
        },
        opts: {
          delay: index * delayMs,      // envío escalonado
          attempts: 3,                  // reintentar hasta 3 veces
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false           // guardar trabajos fallidos para depuración
        }
      };
    }).filter(Boolean);

    // Agregar todos a la cola en una sola operación (más eficiente)
    await campaignQueue.addBulk(jobs);

    logger.info(`✅ ${jobs.length} mensajes en cola para campaña ${campaign.name}`);
    return campaign;
  }

  /**
   * Pausa una campaña en curso
   */
  async pauseCampaign(campaignId) {
    await campaignQueue.pause();
    await Campaign.update({ status: 'paused' }, { where: { id: campaignId } });
    logger.info(`⏸️  Campaña ${campaignId} pausada`);
  }

  /**
   * Obtiene los contactos para una campaña según sus filtros
   */
  async getAudience(campaign) {
    const { Op } = require('sequelize');
    const where  = {};
    const filter = campaign.audience_filter || {};

    // Aislar contactos de la empresa de la campaña
    if (campaign.company_id) where.company_id = campaign.company_id;

    // Filtrar por canal (solo contactos que tienen ID en ese canal)
    const channelField = `${campaign.channel}_id`;
    where[channelField] = { [Op.ne]: null };

    // Filtrar por tags si se especificaron
    if (filter.tags && filter.tags.length > 0) {
      where.tags = { [Op.overlap]: filter.tags };
    }

    return Contact.findAll({ where, limit: 10000 });
  }

  /**
   * Personaliza el mensaje con datos del contacto
   * Variables soportadas: {{nombre}}, {{telefono}}, {{email}}
   */
  personalizeMessage(template, contact) {
    return template
      .replace(/{{nombre}}/g, contact.name || 'Cliente')
      .replace(/{{telefono}}/g, contact.phone || '')
      .replace(/{{email}}/g, contact.email || '');
  }

  getChannelId(contact, channel) {
    const map = {
      whatsapp: contact.whatsapp_id,
      messenger: contact.messenger_id,
      instagram: contact.instagram_id
    };
    return map[channel];
  }

  /**
   * Estadísticas de una campaña
   */
  async getCampaignStats(campaignId) {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) throw new Error('Campaña no encontrada');

    const queuedJobs = await campaignQueue.getJobCounts();

    return {
      campaign: campaign.toJSON(),
      queue: queuedJobs
    };
  }
}

module.exports = new CampaignService();
