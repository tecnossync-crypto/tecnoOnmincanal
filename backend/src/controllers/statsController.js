// backend/src/controllers/statsController.js
// ─────────────────────────────────────────────────────────────
// Estadísticas para el Dashboard de Tecnossync
// GET /stats?desde=2024-01-01&hasta=2024-12-31
// ─────────────────────────────────────────────────────────────
const { User, Conversation, Message, Contact } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const logger = require('../config/logger');

class StatsController {

  async getDashboard(req, res) {
    try {
      const { desde, hasta, intervalo = 'mes' } = req.query;

      // ── Rango de fechas ──────────────────────────────────
      const ahora = new Date();
      let fechaDesde, fechaHasta;

      if (desde && hasta) {
        fechaDesde = new Date(desde);
        fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
      } else {
        fechaHasta = new Date(ahora);
        fechaHasta.setHours(23, 59, 59, 999);
        fechaDesde = new Date(ahora);

        switch (intervalo) {
          case 'hoy':
            fechaDesde.setHours(0, 0, 0, 0);
            break;
          case 'semana':
            fechaDesde.setDate(ahora.getDate() - 7);
            break;
          case 'mes':
            fechaDesde.setDate(1);
            fechaDesde.setHours(0, 0, 0, 0);
            break;
          case 'trimestre':
            fechaDesde.setMonth(ahora.getMonth() - 3);
            break;
          default:
            fechaDesde.setDate(1);
            fechaDesde.setHours(0, 0, 0, 0);
        }
      }

      const filtroFecha = { created_at: { [Op.between]: [fechaDesde, fechaHasta] } };

      // ── 1. Asesores con estado online ───────────────────
      const usuarios = await User.findAll({
        attributes: { exclude: ['password_hash'] },
        order: [['created_at', 'ASC']],
      });

      // ── 2. Conversaciones por canal ─────────────────────
      const conversaciones = await Conversation.findAll({
        where: filtroFecha,
        attributes: ['channel', 'status', 'assigned_agent_id', 'created_at'],
      });

      // ── 3. Total chats ──────────────────────────────────
      const totalChats = conversaciones.length;

      // ── 4. Leads por canal ──────────────────────────────
      const canales = ['whatsapp', 'messenger', 'instagram'];
      const leadsPorCanal = {};

      for (const canal of canales) {
        const delCanal = conversaciones.filter(c => c.channel === canal);
        leadsPorCanal[canal] = {
          total:       delCanal.length,
          convertidos: delCanal.filter(c => c.status === 'resolved').length,
          prospectos:  delCanal.filter(c => c.status === 'open').length,
          nuevos:      delCanal.filter(c => c.status === 'pending').length,
        };
      }

      // ── 5. Hora de entrada de clientes ──────────────────
      const horasBucket = {};
      for (let h = 6; h <= 20; h++) horasBucket[h] = 0;

      conversaciones.forEach(c => {
        const hora = new Date(c.created_at).getHours();
        if (hora >= 6 && hora <= 20) horasBucket[hora]++;
      });

      const horasEntrada = Object.entries(horasBucket).map(([hora, chats]) => ({
        hora: `${hora}:00`,
        chats,
      }));

      // ── 6. Chats por asesor ─────────────────────────────
      const asesores = usuarios
        .filter(u => u.role === 'agent' || u.role === 'admin')
        .map(u => {
          const chatsAsesor = conversaciones.filter(
            c => String(c.assigned_agent_id) === String(u.id)
          );
          return {
            id:          u.id,
            nombre:      u.name,
            email:       u.email,
            role:        u.role,
            online:      u.is_active,
            chats:       chatsAsesor.length,
            convertidos: chatsAsesor.filter(c => c.status === 'resolved').length,
            prospectos:  chatsAsesor.filter(c => c.status === 'open').length,
          };
        });

      // ── 7. Totales globales ─────────────────────────────
      const totalLeads      = conversaciones.length;
      const totalConvertidos = conversaciones.filter(c => c.status === 'resolved').length;
      const totalProspectos  = conversaciones.filter(c => c.status === 'open').length;
      const tasaConversion   = totalLeads > 0
        ? Math.round((totalConvertidos / totalLeads) * 100)
        : 0;

      // ── 8. Total contactos ──────────────────────────────
      const totalContactos = await Contact.count();

      // ── Respuesta ───────────────────────────────────────
      res.json({
        success: true,
        data: {
          periodo: { desde: fechaDesde, hasta: fechaHasta, intervalo },
          resumen: {
            totalChats,
            totalLeads,
            totalConvertidos,
            totalProspectos,
            tasaConversion,
            totalContactos,
          },
          leadsPorCanal,
          horasEntrada,
          asesores,
        }
      });

    } catch (error) {
      logger.error('Error en stats dashboard:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new StatsController();