// backend/src/services/chatbotService.js
const logger = require('../config/logger');
const { Message, BotConfig } = require('../models');

class ChatbotService {

  async callClaude(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
    const response  = await client.messages.create({
      model:       model || 'claude-sonnet-4-20250514',
      max_tokens:  1024,
      temperature,
      system:      systemPrompt,
      messages:    [...history, { role: 'user', content: currentMessage }]
    });
    return response.content[0]?.text || null;
  }

  async callOpenAI(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model:       model || 'gpt-4o-mini',
      max_tokens:  1024,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: currentMessage }
      ]
    });
    return response.choices[0]?.message?.content || null;
  }

  async callGemini(apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client   = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    const genModel = client.getGenerativeModel({
      model:             model || 'gemini-1.5-flash',
      systemInstruction: systemPrompt
    });
    const chat = genModel.startChat({
      history: history.map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { temperature, maxOutputTokens: 1024 }
    });
    const result = await chat.sendMessage(currentMessage);
    return result.response.text() || null;
  }

  async callAI(provider, apiKey, systemPrompt, history, currentMessage, model, temperature = 0.7) {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(apiKey, systemPrompt, history, currentMessage, model, temperature);
      case 'gemini':
        return this.callGemini(apiKey, systemPrompt, history, currentMessage, model, temperature);
      case 'claude':
      default:
        return this.callClaude(apiKey, systemPrompt, history, currentMessage, model, temperature);
    }
  }

  async getActiveIntegration() {
    const { Integration } = require('../models');
    return Integration.findOne({ where: { is_active: true } });
  }

  async generateResponse(prompt, userMessage, provider, apiKey, model) {
    if (!provider || !apiKey) {
      const integration = await this.getActiveIntegration();
      if (!integration) throw new Error('No hay integración de IA activa');
      provider = integration.provider;
      apiKey   = integration.api_key;
      model    = model || null;
    }
    const resolvedPrompt = await this.resolvePromptCatalogs(prompt);
    return this.callAI(provider, apiKey, resolvedPrompt, [], userMessage, model, 0.7);
  }

  // ─── Construye bloque de contexto con datos de la empresa ───────
  async buildCompanyContext() {
    try {
      const Company = require('../models/Company');
      const company = await Company.findOne();
      if (!company || !company.nombre) return '';

      const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
      const LABEL = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

      const lines = [`=== INFORMACIÓN DE LA EMPRESA ===`];
      lines.push(`Empresa: ${company.nombre}`);
      if (company.descripcion)           lines.push(`Descripción: ${company.descripcion}`);
      const addr = [company.direccion, company.ciudad, company.pais].filter(Boolean).join(', ');
      if (addr)                          lines.push(`Dirección: ${addr}`);
      if (company.telefono)              lines.push(`Teléfono: ${company.telefono}`);
      if (company.telefono_secundario)   lines.push(`Teléfono alternativo: ${company.telefono_secundario}`);
      if (company.email)                 lines.push(`Email: ${company.email}`);
      if (company.sitio_web)             lines.push(`Sitio web: ${company.sitio_web}`);

      if (company.horarios && typeof company.horarios === 'object') {
        lines.push(`\nHorarios de atención:`);
        for (const dia of DIAS) {
          const h = company.horarios[dia];
          if (!h) continue;
          if (h.abierto) {
            lines.push(`- ${LABEL[dia]}: ${h.desde} - ${h.hasta}`);
          } else {
            lines.push(`- ${LABEL[dia]}: Cerrado`);
          }
        }
      }

      lines.push(`=================================`);
      return lines.join('\n');
    } catch (err) {
      logger.warn('buildCompanyContext error:', err.message);
      return '';
    }
  }

  // ─── Construye bloque con plantillas de documentos disponibles ──────────────
  async buildDocumentTemplatesContext(companyId) {
    try {
      const { DocumentTemplate } = require('../models');
      const where = companyId ? { company_id: companyId } : {};
      const templates = await DocumentTemplate.findAll({ where, attributes: ['name', 'description', 'fields'] });
      if (!templates.length) return '';

      const lines = ['=== PLANTILLAS DE DOCUMENTOS DISPONIBLES ==='];
      for (const tpl of templates) {
        const manualFields = (tpl.fields || []).filter(f => f.source === 'manual');
        const desc = tpl.description ? ` — ${tpl.description}` : '';
        lines.push(`- "${tpl.name}"${desc}`);
        if (manualFields.length) {
          lines.push(`  Datos que se solicitan al cliente: ${manualFields.map(f => f.label).join(', ')}`);
        }
      }
      lines.push('');
      lines.push('Cuando el cliente solicite un documento, contrato, acuerdo o formulario formal, responde confirmando que procederás y agrega al final de tu mensaje EXACTAMENTE (sin comillas ni espacios extra):');
      lines.push('[START_DOC:Nombre exacto de la plantilla]');
      lines.push('Solo usa [START_DOC:...] cuando el cliente lo pida explícitamente, no en respuestas informativas.');
      lines.push('===========================================');
      return lines.join('\n');
    } catch (err) {
      logger.warn('buildDocumentTemplatesContext error:', err.message);
      return '';
    }
  }

  // ─── Resuelve tokens {{catalogo:identificador}} en el system prompt ──
  async resolvePromptCatalogs(systemPrompt, companyId) {
    // Prepend company context automatically
    const companyCtx = await this.buildCompanyContext();
    const docCtx     = await this.buildDocumentTemplatesContext(companyId);
    const base = [companyCtx, docCtx].filter(Boolean).join('\n\n') + (companyCtx || docCtx ? '\n\n' : '');

    if (!systemPrompt || !systemPrompt.includes('{{catalogo:')) return base + (systemPrompt || '');
    try {
      const { BotCatalog } = require('../models');
      const regex   = /\{\{catalogo:([a-z0-9_-]+)\}\}/gi;
      const matches = [...systemPrompt.matchAll(regex)];
      if (!matches.length) return base + systemPrompt;

      let resolved = systemPrompt;
      for (const [token, identifier] of matches) {
        const catalog = await BotCatalog.findOne({
          where: { identificador: identifier.toLowerCase(), activo: true }
        });
        if (catalog && catalog.contenido?.trim()) {
          let block = `\n\n=== ${catalog.nombre.toUpperCase()} ===\n${catalog.contenido}\n=== FIN ${catalog.nombre.toUpperCase()} ===\n`;
          if (catalog.archivo_url) {
            block += `\n[INSTRUCCIÓN SISTEMA: Este catálogo tiene un archivo adjunto. Cuando el cliente pida el catálogo completo, el PDF, la imagen o quiera recibir la cotización/información completa, incluye al final de tu respuesta exactamente: [SEND_FILE:${catalog.identificador}]]\n`;
          }
          resolved = resolved.split(token).join(block);
        } else if (catalog && catalog.archivo_url) {
          const block = `\n\n[INSTRUCCIÓN SISTEMA: Hay un catálogo "${catalog.nombre}" disponible como archivo adjunto. Cuando el cliente lo solicite, incluye al final de tu respuesta: [SEND_FILE:${catalog.identificador}]]\n`;
          resolved = resolved.split(token).join(block);
        } else if (catalog) {
          resolved = resolved.split(token).join('');
        }
      }
      return base + resolved;
    } catch (err) {
      logger.warn('Error resolviendo catálogos en prompt:', err.message);
      return base + systemPrompt;
    }
  }

  // ─── Extrae comando [SEND_FILE:id] de la respuesta del bot ──
  async extractFileCommand(response) {
    if (!response) return { text: response, catalogFile: null };
    const match = response.match(/\[SEND_FILE:([a-z0-9_-]+)\]/i);
    if (!match) return { text: response, catalogFile: null };

    const cleanText = response.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    try {
      const { BotCatalog } = require('../models');
      const catalog = await BotCatalog.findOne({
        where: { identificador: match[1].toLowerCase(), activo: true }
      });
      if (catalog?.archivo_url) {
        return {
          text: cleanText,
          catalogFile: {
            url:           catalog.archivo_url,
            nombre:        catalog.archivo_nombre,
            tipo:          catalog.archivo_tipo,
            identificador: catalog.identificador
          }
        };
      }
    } catch (err) {
      logger.warn('Error buscando archivo de catálogo:', err.message);
    }
    return { text: cleanText, catalogFile: null };
  }

  // ─── Detecta [HUMAN_NEEDED] en la respuesta del bot ──────────
  extractHandoff(response) {
    if (!response) return { text: response, handoff: false };
    const hasHandoff = /\[HUMAN_NEEDED\]/i.test(response);
    const clean      = response.replace(/\[HUMAN_NEEDED\]/gi, '').replace(/\s{2,}/g, ' ').trim();
    return { text: clean, handoff: hasHandoff };
  }

  // ─── Detecta [START_DOC:nombre_plantilla] en la respuesta del bot ──
  extractDocCommand(response) {
    if (!response) return { text: response, docName: null };
    const match = response.match(/\[START_DOC:([^\]]+)\]/i);
    if (!match) return { text: response, docName: null };
    const clean = response.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    return { text: clean || null, docName: match[1].trim() };
  }

  // ─── Evalúa y ejecuta las reglas de flujo tras respuesta del bot ──
  async evaluateFlowRules({ sessionId, jid, userMessage, botText, catalogFile, handoff, chatRecord, sock }, io) {
    try {
      const { FlowRule, WhatsappChat } = require('../models');
      const rules = await FlowRule.findAll({
        where: { is_active: true },
        order: [['priority', 'DESC'], ['created_at', 'ASC']]
      });
      if (!rules.length) return;

      for (const rule of rules) {
        // Filtrar por canal
        if (rule.channel !== 'all') {
          const isBusinessSession = sessionId?.startsWith('business_');
          if (rule.channel === 'whatsapp_business' && !isBusinessSession) continue;
          if (rule.channel === 'whatsapp'          &&  isBusinessSession) continue;
        }

        // Evaluar disparador
        let triggered = false;
        const tv = rule.trigger_value?.toLowerCase() || '';

        switch (rule.trigger_type) {
          case 'catalog_sent':
            triggered = !!(catalogFile && catalogFile.identificador?.toLowerCase() === tv);
            break;
          case 'catalog_any':
            triggered = !!(catalogFile);
            break;
          case 'bot_handoff':
            triggered = handoff === true;
            break;
          case 'bot_text_contains':
            triggered = !!(botText && tv && botText.toLowerCase().includes(tv));
            break;
          case 'user_keyword':
            triggered = !!(userMessage && tv && userMessage.toLowerCase().includes(tv));
            break;
          case 'no_bot_response':
            triggered = !botText && !catalogFile;
            break;
        }

        if (!triggered) continue;
        logger.info(`🔀 Regla de flujo "${rule.name}" disparada [${rule.trigger_type}] → acción: ${rule.action_type}`);

        // Ejecutar acción
        switch (rule.action_type) {

          case 'apply_label': {
            const labelName = rule.action_value?.trim();
            if (!labelName) break;
            try {
              const chat = chatRecord || (sessionId && jid ? await WhatsappChat.findOne({ where: { session_id: sessionId, jid } }) : null);
              if (chat) {
                const current = Array.isArray(chat.labels) ? chat.labels : [];
                if (!current.includes(labelName)) {
                  await chat.update({ labels: [...current, labelName] });
                  io?.to('agents').emit('whatsapp:chat_updated', { sessionId, jid, labels: [...current, labelName] });
                  logger.info(`🏷️  Etiqueta "${labelName}" aplicada a ${jid}`);
                }
              } else {
                io?.to('agents').emit('flowrule:action', { rule: rule.name, action: 'apply_label', label: labelName, jid });
                logger.info(`🏷️  Regla "${rule.name}" disparada: aplicar "${labelName}" a ${jid} (sin chat WA)`);
              }
            } catch (e) { logger.warn('FlowRule apply_label error:', e.message); }
            break;
          }

          case 'notify_human': {
            const customMsg = rule.action_value?.trim() || `El bot necesita apoyo humano para el cliente ${jid}`;
            io?.to('agents').emit('whatsapp:human_needed', {
              sessionId,
              jid,
              message:   customMsg,
              ruleName:  rule.name,
              timestamp: Math.floor(Date.now() / 1000)
            });
            logger.info(`🔔 Notificación humano enviada para ${jid} — regla: ${rule.name}`);
            break;
          }

          case 'disable_bot': {
            try {
              const chat = chatRecord || (sessionId && jid ? await WhatsappChat.findOne({ where: { session_id: sessionId, jid } }) : null);
              if (chat && chat.bot_enabled) {
                await chat.update({ bot_enabled: false });
                io?.to('agents').emit('whatsapp:chat_updated', { sessionId, jid, bot_enabled: false });
                logger.info(`🤖 Bot desactivado para ${jid} por regla "${rule.name}"`);
              }
            } catch (e) { logger.warn('FlowRule disable_bot error:', e.message); }
            break;
          }

          case 'send_message': {
            const msgText = rule.action_value?.trim();
            if (!msgText || !sock) break;
            try {
              await new Promise(r => setTimeout(r, 500));
              await sock.sendMessage(jid, { text: msgText });
              logger.info(`💬 Mensaje automático enviado a ${jid} por regla "${rule.name}"`);
            } catch (e) { logger.warn('FlowRule send_message error:', e.message); }
            break;
          }
        }
      }
    } catch (err) {
      logger.error('❌ evaluateFlowRules:', err.message);
    }
  }

  async handleMessage(conversation, incomingMessage, io) {
    try {
      if (conversation.assigned_agent_id) return null;

      const config = await this.getBotConfig(conversation.company_id, conversation.channel);
      if (!config || !config.is_active) return null;

      const messageText    = incomingMessage.content?.toLowerCase() || '';
      const shouldEscalate = this.checkEscalationKeywords(messageText, config.escalation_keywords);

      if (shouldEscalate) {
        await this.escalateToHuman(conversation, config, io);
        return config.escalation_message;
      }

      const integration = await this.getActiveIntegration();
      if (!integration) {
        logger.warn('No hay integración de IA activa — bot no responde');
        return null;
      }

      const history        = await this.buildConversationHistory(conversation.id, config.max_history_messages);
      const resolvedPrompt = await this.resolvePromptCatalogs(config.system_prompt, conversation.company_id);
      const rawResponse    = await this.callAI(
        integration.provider,
        integration.api_key,
        resolvedPrompt,
        history,
        incomingMessage.content,
        config.ai_model,
        config.ai_temperature
      );

      const { text: botText, catalogFile } = await this.extractFileCommand(rawResponse);
      logger.info(`🤖 Bot (${integration.provider}) respondió en conversación ${conversation.id}${catalogFile ? ' + archivo adjunto' : ''}`);
      return { text: botText, catalogFile };

    } catch (error) {
      logger.error('❌ ChatbotService.handleMessage:', error);
      return null;
    }
  }

  async buildConversationHistory(conversationId, maxMessages = 20) {
    const messages = await Message.findAll({
      where: { conversation_id: conversationId },
      order: [['created_at', 'ASC']],
      limit: maxMessages
    });
    const history = messages
      .filter(m => m.content)
      .map(m => ({
        role:    m.sender_type === 'bot' || m.direction === 'outbound' ? 'assistant' : 'user',
        content: m.content
      }));
    return this.normalizeHistory(history);
  }

  normalizeHistory(history) {
    if (!history.length) return [];
    const normalized = [];
    let lastRole = null;
    for (const msg of history) {
      if (msg.role !== lastRole) {
        normalized.push(msg);
        lastRole = msg.role;
      } else {
        normalized[normalized.length - 1].content += '\n' + msg.content;
      }
    }
    if (normalized[0]?.role === 'assistant') normalized.shift();
    return normalized;
  }

  checkEscalationKeywords(text, keywords = []) {
    return keywords?.some(k => text.includes(k.toLowerCase())) || false;
  }

  async escalateToHuman(conversation, config, io) {
    await conversation.update({ status: 'open' });
    io?.to('agents').emit('conversation:escalated', {
      conversationId: conversation.id,
      channel:        conversation.channel,
      reason:         'keyword_trigger'
    });
    logger.info(`🔔 Conversación ${conversation.id} escalada a humano`);
  }

  async getBotConfig(companyId, channel) {
    return await BotConfig.findOne({
      where: { company_id: companyId || null, channel, is_active: true }
    }) || await BotConfig.findOne({
      where: { channel: 'all', is_active: true }
    });
  }

  // ─── Construye contexto de disponibilidad para citas ─────────
  async buildCalendarContext(sessionId) {
    try {
      const { BusinessSchedule, Appointment } = require('../models');
      const { Op } = require('sequelize');

      // Determinar company_id desde sesión
      const { WhatsappChat } = require('../models');
      const anyChat = await WhatsappChat.findOne({ where: { session_id: sessionId }, attributes: ['company_id'] });
      const companyId = anyChat?.company_id;

      const schedRows = await BusinessSchedule.findAll({
        where: { ...(companyId ? { company_id: companyId } : {}), is_active: true, bot_scheduling_enabled: true },
      });
      if (!schedRows.length) return null;

      function timeToMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
      function minToTime(min) { return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`; }

      const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const results = [];
      const today = new Date();

      for (let i = 0; i < 14 && results.length < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dow = d.getDay();
        const sched = schedRows.find(r => r.day_of_week === dow);
        if (!sched) continue;

        const dateStr = d.toISOString().slice(0,10);
        const existing = await Appointment.findAll({
          where: { date: dateStr, status: { [Op.notIn]: ['cancelled'] }, ...(companyId ? { company_id: companyId } : {}) },
          attributes: ['start_time', 'duration_minutes'],
        });
        const occupied = existing.map(a => ({ start: timeToMin(a.start_time), end: timeToMin(a.start_time) + (a.duration_minutes||30) }));
        const dur = sched.slot_duration || 30;
        const slots = [];
        for (let t = timeToMin(sched.start_time); t + dur <= timeToMin(sched.end_time); t += dur) {
          if (!occupied.some(o => t < o.end && (t+dur) > o.start)) slots.push(minToTime(t));
        }
        if (slots.length) results.push({ date: dateStr, day: DIAS_ES[dow], slots: slots.slice(0,4) });
      }

      if (!results.length) return null;

      const lines = [`=== DISPONIBILIDAD PARA CITAS ===`];
      for (const r of results) {
        lines.push(`${r.day} ${r.date}: ${r.slots.join(', ')}`);
      }
      lines.push(`Si el cliente desea agendar, sugiere estas opciones y confirma su nombre completo y teléfono.`);
      lines.push(`=================================`);
      return lines.join('\n');
    } catch (err) {
      logger.warn('buildCalendarContext error:', err.message);
      return null;
    }
  }

  // ─── Recolección bot de campos para plantillas ────────────────────────────
  async handleDocumentCollection(sessionId, jid, body, chatRecord, io) {
    // Guard: si los modelos no están disponibles, salir silenciosamente
    let DocumentRequest, DocumentTemplate, Contact;
    try {
      const models = require('../models');
      DocumentRequest  = models.DocumentRequest;
      DocumentTemplate = models.DocumentTemplate;
      Contact          = models.Contact;
      // Verificar que los modelos existen antes de usarlos
      if (!DocumentRequest || !DocumentTemplate) return { handled: false };
    } catch (_) {
      return { handled: false };
    }

    try {
      // 1. ¿Hay una recolección activa para este jid?
      let activeReq = null;
      try {
        activeReq = await DocumentRequest.findOne({
          where:   { session_id: sessionId, jid, status: 'collecting' },
          include: [{ model: DocumentTemplate, as: 'template' }],
        });
      } catch (dbErr) {
        // Tabla no existe aún — no bloquear el bot
        logger.warn(`handleDocumentCollection: findOne falló [${jid}]: ${dbErr.message}`);
        return { handled: false };
      }

      if (activeReq) {
        // Palabras de escape: el cliente puede cancelar la recolección en cualquier momento
        const CANCEL_WORDS = ['cancelar', 'salir', 'parar', 'detener', 'cancel', 'stop', 'exit', 'no'];
        if (CANCEL_WORDS.includes(body.trim().toLowerCase())) {
          await activeReq.update({ status: 'rejected' });
          return { handled: true, reply: 'Solicitud cancelada. Si necesitas el documento en otro momento, solo escríbeme.' };
        }

        const tpl          = activeReq.template;
        const manualFields = Object.values(
          (tpl.fields || []).filter(f => f.source === 'manual')
            .reduce((acc, f) => { if (!acc[f.key]) acc[f.key] = f; return acc; }, {})
        );
        const idx          = activeReq.current_field_index;
        const collectedSoFar = activeReq.collected_fields || {};

        // ── Fase de confirmación ─────────────────────────────────────────────
        if (collectedSoFar.__awaiting_confirmation) {
          const CONFIRM_WORDS = ['si', 'sí', 'yes', 'correcto', 'confirmar', 'confirmo', 'ok', 'listo', 'exacto'];
          const bodyLow = body.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          const confirmed = CONFIRM_WORDS.some(w => bodyLow === w || bodyLow.startsWith(w + ' '));

          if (!confirmed) {
            await activeReq.update({ status: 'rejected' });
            return { handled: true, reply: 'Solicitud cancelada. Si deseas volver a intentarlo, escríbeme cuando gustes.' };
          }

          // Cliente confirmó → generar documento
          const generated = await this._generateDocument(activeReq, tpl, collectedSoFar, jid, chatRecord, io);
          return generated;
        }

        // ── Recolección de campos ────────────────────────────────────────────
        if (idx < manualFields.length) {
          const field     = manualFields[idx];
          const collected = { ...collectedSoFar, [field.key]: body.trim() };
          const nextIdx   = idx + 1;

          if (nextIdx < manualFields.length) {
            await activeReq.update({ collected_fields: collected, current_field_index: nextIdx });
            const nextField = manualFields[nextIdx];
            return { handled: true, reply: `${nextField.label}:` };
          } else {
            // Todos los campos recogidos → pedir confirmación al cliente
            await activeReq.update({ collected_fields: { ...collected, __awaiting_confirmation: true }, current_field_index: nextIdx });

            const lines = ['Estos son los datos que registré para tu documento:'];
            for (const f of manualFields) {
              lines.push(`• *${f.label}:* ${collected[f.key] || '—'}`);
            }
            lines.push('');
            lines.push('¿Todo está correcto? Responde *sí* para confirmar o *cancelar* para empezar de nuevo.');
            return { handled: true, reply: lines.join('\n') };
          }
        }
        // idx fuera de rango (no debería pasar)
        return { handled: true, reply: null };
      }

      // 2. ¿Algún mensaje dispara una plantilla por palabra clave?
      const companyId = chatRecord?.company_id;
      let templates = [];
      try {
        templates = await DocumentTemplate.findAll({
          where: { ...(companyId ? { company_id: companyId } : {}) },
        });
      } catch (dbErr) {
        logger.warn(`handleDocumentCollection: findAll templates falló: ${dbErr.message}`);
        return { handled: false };
      }

      const bodyLower = body.toLowerCase();
      let matched = null;
      for (const tpl of templates) {
        const kws = tpl.trigger_keywords || [];
        if (kws.length && kws.some(kw => bodyLower.includes(kw.toLowerCase()))) {
          matched = tpl;
          break;
        }
      }

      if (!matched) return { handled: false };

      const manualFields = Object.values(
        (matched.fields || []).filter(f => f.source === 'manual')
          .reduce((acc, f) => { if (!acc[f.key]) acc[f.key] = f; return acc; }, {})
      );
      if (!manualFields.length) return { handled: false };

      await DocumentRequest.create({
        company_id:          companyId || null,
        session_id:          sessionId,
        jid,
        template_id:         matched.id,
        collected_fields:    {},
        current_field_index: 0,
        status:              'collecting',
        initiated_by:        'bot',
      });

      // Devolver la primera pregunta — whatsappService la envía
      const firstField = manualFields[0];
      return {
        handled: true,
        reply:   `Para preparar tu "${matched.name}" necesito algunos datos (escribe *cancelar* en cualquier momento para salir).\n\n${firstField.label}:`,
      };

    } catch (err) {
      logger.error('handleDocumentCollection error:', err.message);
      return { handled: false };
    }
  }

  // ─── Genera el DOCX a partir de los campos recopilados ────────────────────
  async _generateDocument(activeReq, tpl, collected, jid, chatRecord, io) {
    try {
      const path = require('path');
      const fs   = require('fs');
      const { TEMPLATE_DIR, GENERATED_DIR } = require('../middleware/uploadTemplate');
      const PizZip        = require('pizzip');
      const Docxtemplater = require('docxtemplater');
      const models        = require('../models');
      const Contact       = models.Contact;

      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
      const contactPhone = jid.replace(/@.+/, '');
      let contactName = chatRecord?.contact_name || '';
      try {
        const contact = await Contact.findOne({ where: { phone: contactPhone } });
        if (contact) contactName = contact.name || contactName;
      } catch (_) {}

      const AUTO_RESOLVE = {
        'contact.name':  contactName,
        'contact.phone': contactPhone,
        'date.today':    dateStr,
      };

      const values = {};
      for (const f of (tpl.fields || [])) {
        if (f.source === 'manual') {
          values[f.key] = collected[f.key] ?? f.default_value ?? '';
        } else if (f.source && AUTO_RESOLVE[f.source] !== undefined) {
          values[f.key] = AUTO_RESOLVE[f.source];
        } else {
          values[f.key] = f.default_value ?? '';
        }
      }

      const tplPath = path.join(TEMPLATE_DIR, tpl.filename_stored);
      if (!fs.existsSync(tplPath)) {
        logger.error(`Archivo de plantilla no encontrado: ${tplPath}`);
        await activeReq.update({ status: 'rejected' });
        return { handled: true, reply: 'Hubo un error al preparar tu documento. Por favor contacta a un asesor.' };
      }

      const content = fs.readFileSync(tplPath);
      const zip     = new PizZip(content);
      const doc     = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks:    true,
        nullGetter:    () => '',
      });
      doc.render(values);
      const buf     = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const outName = `${Date.now()}_${tpl.filename_stored}`;
      if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
      fs.writeFileSync(path.join(GENERATED_DIR, outName), buf);

      await activeReq.update({ status: 'ready', generated_file_path: outName });
      logger.info(`📄 Documento generado para ${jid}: ${outName}`);

      io?.to('agents').emit('document:ready', {
        requestId:    activeReq.id,
        jid,
        sessionId:    activeReq.session_id,
        templateName: tpl.name,
        companyId:    chatRecord?.company_id,
      });

      return {
        handled: true,
        reply: '✅ ¡Perfecto! Tu documento está listo. Un asesor lo revisará y te lo enviará en breve.',
      };
    } catch (genErr) {
      logger.error('Error generando documento:', genErr.message, genErr.stack);
      await activeReq.update({ status: 'rejected' });
      return {
        handled: true,
        reply: 'Ocurrió un error al generar tu documento. Por favor contacta a un asesor para continuar.',
      };
    }
  }

  // ─── Bot para WhatsApp (Baileys): con memoria y modo genérico/personalizado ──
  async handleWhatsappMessage(sessionId, jid, body, chatRecord) {
    try {
      // 1. Determinar system prompt según bot_mode
      let systemPrompt;
      const botMode = chatRecord.bot_mode || 'generic';
      if (botMode === 'custom' && chatRecord.bot_prompt?.trim()) {
        systemPrompt = chatRecord.bot_prompt;
        logger.info(`🤖 Bot WA [${jid}] modo: custom`);
      } else {
        // Buscar config: primero canal 'whatsapp', luego 'all', luego cualquier activo
        const config = await BotConfig.findOne({ where: { channel: 'whatsapp', is_active: true }, order: [['created_at', 'DESC']] })
                    || await BotConfig.findOne({ where: { channel: 'all',       is_active: true }, order: [['created_at', 'DESC']] })
                    || await BotConfig.findOne({ where: {                        is_active: true }, order: [['created_at', 'DESC']] });
        if (!config) {
          logger.warn(`⚠️  Bot WA [${jid}]: no hay BotConfig activo — crea uno en Configuración > Bot`);
          return null;
        }
        if (!config.system_prompt?.trim()) {
          logger.warn(`⚠️  Bot WA [${jid}]: BotConfig ${config.id} no tiene system_prompt definido`);
          return null;
        }
        systemPrompt = config.system_prompt;
        logger.info(`🤖 Bot WA [${jid}] modo: generic — usando config ${config.id} (canal: ${config.channel})`);
      }

      // 2. Integración de IA activa
      const integration = await this.getActiveIntegration();
      if (!integration) {
        logger.warn('⚠️  Bot WA: no hay integración de IA activa');
        return null;
      }

      // 3. Historial de la conversación (memoria)
      const { WhatsappMessage } = require('../models');
      const NOISE = new Set(['[Audio]', '[Video]', '[Sticker]', '[Multimedia]', '[Documento]', '[Doc]', '[Imagen]']);
      const past = await WhatsappMessage.findAll({
        where: { session_id: sessionId, jid },
        order: [['timestamp', 'DESC']],
        limit: 20,
        attributes: ['body', 'from_me', 'content_type']
      });
      const rawHistory = past
        .reverse()
        .filter(m => m.content_type === 'text' && m.body && !NOISE.has(m.body))
        .map(m => ({ role: m.from_me ? 'assistant' : 'user', content: m.body }));

      const history = this.normalizeHistory(rawHistory);

      // 4. Resolver tokens de catálogos + contexto de calendario
      let resolvedPrompt = await this.resolvePromptCatalogs(systemPrompt, chatRecord?.company_id);
      const calendarCtx = await this.buildCalendarContext(sessionId);
      if (calendarCtx) resolvedPrompt += '\n\n' + calendarCtx;

      // 5. Llamar IA
      const rawResponse = await this.callAI(
        integration.provider,
        integration.api_key,
        resolvedPrompt,
        history,
        body,
        integration.model || null,
        0.7
      );

      if (rawResponse) {
        const hasSendFile  = /\[SEND_FILE:[^\]]+\]/.test(rawResponse);
        const hasHandoff   = /\[HUMAN_NEEDED\]/i.test(rawResponse);
        logger.info(`✅ Bot WA [${jid}] respondió (${integration.provider}) sendFile=${hasSendFile} handoff=${hasHandoff} snippet="${rawResponse.slice(0, 80).replace(/\n/g, ' ')}"`);
      } else {
        logger.warn(`⚠️  Bot WA [${jid}]: IA devolvió respuesta vacía`);
      }
      // Extraer comandos: [HUMAN_NEEDED] → [START_DOC:nombre] → [SEND_FILE:id]
      const { text: afterHandoff, handoff } = this.extractHandoff(rawResponse);
      const { text: afterDoc, docName }     = this.extractDocCommand(afterHandoff);
      const result = await this.extractFileCommand(afterDoc);
      if (result?.catalogFile) {
        logger.info(`📎 Bot WA [${jid}] archivo a enviar: ${result.catalogFile.url} (${result.catalogFile.nombre})`);
      }
      if (docName) {
        logger.info(`📄 Bot WA [${jid}] solicita recolección de doc: "${docName}"`);
      }
      return { ...result, handoff, startDoc: docName || null };

    } catch (err) {
      logger.error(`❌ ChatbotService.handleWhatsappMessage [${jid}]:`, err.message);
      return null;
    }
  }

  async testBot(systemPrompt, testMessage) {
    const integration = await this.getActiveIntegration();
    if (!integration) throw new Error('No hay integración de IA activa. Configúrala en Integraciones.');
    return this.callAI(
      integration.provider,
      integration.api_key,
      systemPrompt,
      [],
      testMessage,
      null,
      0.7
    );
  }

  // ─── Verificar criterios de transferencia ─────────────────
  async checkTransfer(messageText, messageCount, quoteSent = false) {
    const { TransferCriteria } = require('../models');
    const criteria = await TransferCriteria.findAll({
      where: { is_active: true },
      order: [['priority', 'DESC']]
    });

    for (const c of criteria) {
      switch (c.type) {
        case 'keyword':
          if ((c.config.keywords || []).some(k => messageText.toLowerCase().includes(k.toLowerCase())))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'message_count':
          if (messageCount >= (c.config.message_limit || 10))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'date_urgency':
          const urgency = ['vence', 'vencimiento', 'expira', 'próximo', 'urgente', 'pronto'];
          if (urgency.some(w => messageText.toLowerCase().includes(w)))
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
        case 'after_quote':
          if (quoteSent)
            return { transfer: true, message: c.transfer_message, reason: c.name };
          break;
      }
    }
    return { transfer: false };
  }

  // ─── Buscar archivo por reglas ────────────────────────────
  async findMatchingFile(messageText) {
    const { BotFile } = require('../models');
    const files = await BotFile.findAll({ where: { is_active: true } });

    for (const file of files) {
      const rules = file.trigger_rules || [];
      for (const rule of rules) {
        if (rule.type === 'keyword') {
          const match = (rule.values || []).some(k =>
            messageText.toLowerCase().includes(k.toLowerCase())
          );
          if (match) return file;
        }
      }
    }
    return null;
  }

  // ─── IA decide si enviar archivo ─────────────────────────
  async aiDecideFile(messageText) {
    const { BotFile } = require('../models');
    const files = await BotFile.findAll({
      where: { is_active: true, ai_can_send: true }
    });
    if (!files.length) return null;

    const fileList = files.map(f =>
      `ID: ${f.id} | Nombre: ${f.name} | Categoría: ${f.category}`
    ).join('\n');

    const decision = await this.generateResponse(
      `Dado el mensaje del cliente, decide si enviar alguno de estos archivos.
Responde SOLO con el ID del archivo si aplica, o "ninguno" si no aplica.
Archivos disponibles:\n${fileList}`,
      messageText
    );

    if (!decision || decision.trim() === 'ninguno') return null;
    const fileId = decision.trim().split('\n')[0].trim();
    return files.find(f => f.id === fileId) || null;
  }
}

module.exports = new ChatbotService();