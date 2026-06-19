// backend/src/controllers/googleCalendarController.js
const { Company } = require('../models');
const gcalService = require('../services/googleCalendarService');
const logger      = require('../config/logger');

class GoogleCalendarController {

  // GET /api/gcal/connect — redirige al consentimiento de Google
  async connect(req, res) {
    try {
      const companyId = req.user.company_id;
      if (!companyId) return res.status(403).json({ success: false, message: 'Se requiere empresa' });

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ success: false, message: 'Google Calendar no configurado (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)' });
      }

      const authUrl = gcalService.getAuthUrl(companyId);
      res.redirect(authUrl);
    } catch (err) {
      logger.error('GCal connect error:', err);
      const front = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${front}/calendar?gcal=error`);
    }
  }

  // GET /api/gcal/callback — recibe el code de Google
  async callback(req, res) {
    const front = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      const { code, state: companyId, error } = req.query;
      if (error) throw new Error(error);
      if (!code || !companyId) throw new Error('Parámetros inválidos');

      const company = await Company.findByPk(companyId);
      if (!company) throw new Error('Empresa no encontrada');

      // Intercambio de código por tokens
      const tokens  = await gcalService.exchangeCode(code);
      const info    = await gcalService.getUserInfo(tokens.access_token);

      await company.update({
        google_calendar_tokens: {
          ...tokens,
          email:        info.email,
          display_name: info.name,
          timezone:     'America/Santo_Domingo',
          connected_at: new Date().toISOString(),
        },
      });

      res.redirect(`${front}/calendar?gcal=connected`);
    } catch (err) {
      logger.error('GCal callback error:', err);
      res.redirect(`${front}/calendar?gcal=error`);
    }
  }

  // GET /api/gcal/status
  async status(req, res) {
    try {
      const company = await Company.findByPk(req.user.company_id);
      if (!company) return res.json({ success: true, data: { connected: false } });

      const tokens = company.google_calendar_tokens;
      res.json({
        success: true,
        data: {
          connected:    !!tokens?.access_token,
          email:        tokens?.email || null,
          display_name: tokens?.display_name || null,
          connected_at: tokens?.connected_at || null,
        },
      });
    } catch (err) {
      logger.error('GCal status error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // DELETE /api/gcal/disconnect
  async disconnect(req, res) {
    try {
      const company = await Company.findByPk(req.user.company_id);
      if (!company) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });

      await company.update({ google_calendar_tokens: null });
      res.json({ success: true, message: 'Google Calendar desconectado' });
    } catch (err) {
      logger.error('GCal disconnect error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  // GET /api/gcal/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
  async getEvents(req, res) {
    try {
      const company = await Company.findByPk(req.user.company_id);
      if (!company?.google_calendar_tokens?.access_token) {
        return res.json({ success: true, data: [] });
      }

      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'startDate y endDate requeridos' });
      }

      const events = await gcalService.getCalendarEvents(company, startDate, endDate);
      res.json({ success: true, data: events });
    } catch (err) {
      logger.error('GCal getEvents error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new GoogleCalendarController();
