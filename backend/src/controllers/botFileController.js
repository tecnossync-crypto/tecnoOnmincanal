// backend/src/controllers/botFileController.js
const { BotFile } = require('../models');
const path        = require('path');
const fs          = require('fs');
const multer      = require('multer');
const logger      = require('../config/logger');

const BOT_FILES_DIR = path.join(__dirname, '../../uploads/bot-files');
fs.mkdirSync(BOT_FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BOT_FILES_DIR),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

class BotFileController {

  async getAll(req, res) {
    try {
      const { category } = req.query;
      const where = {};
      if (category) where.category = category;
      const files = await BotFile.findAll({
        where,
        order: [['category', 'ASC'], ['sort_order', 'ASC'], ['name', 'ASC']]
      });
      res.json({ success: true, data: files });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async create(req, res) {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: 'Archivo requerido' });

      const { name, category, caption, trigger_rules, ai_can_send, sort_order } = req.body;

      const botFile = await BotFile.create({
        name:          name || file.originalname,
        category:      category || 'General',
        file_path:     `/uploads/bot-files/${file.filename}`,
        file_name:     file.originalname,
        file_type:     file.mimetype,
        file_size:     file.size,
        caption:       caption || '',
        trigger_rules: trigger_rules ? JSON.parse(trigger_rules) : [],
        ai_can_send:   ai_can_send !== 'false',
        sort_order:    sort_order || 0
      });

      logger.info(`✅ Archivo de bot creado: ${botFile.name}`);
      res.status(201).json({ success: true, data: botFile });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async update(req, res) {
    try {
      const botFile = await BotFile.findByPk(req.params.id);
      if (!botFile) return res.status(404).json({ success: false, message: 'No encontrado' });

      const updates = { ...req.body };
      if (updates.trigger_rules && typeof updates.trigger_rules === 'string') {
        updates.trigger_rules = JSON.parse(updates.trigger_rules);
      }
      if (req.file) {
        // Eliminar archivo anterior
        const oldPath = path.join(__dirname, '../..', botFile.file_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        updates.file_path  = `/uploads/bot-files/${req.file.filename}`;
        updates.file_name  = req.file.originalname;
        updates.file_type  = req.file.mimetype;
        updates.file_size  = req.file.size;
      }

      await botFile.update(updates);
      res.json({ success: true, data: botFile });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async remove(req, res) {
    try {
      const botFile = await BotFile.findByPk(req.params.id);
      if (!botFile) return res.status(404).json({ success: false, message: 'No encontrado' });
      const filePath = path.join(__dirname, '../..', botFile.file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await botFile.destroy();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

const controller = new BotFileController();
module.exports   = { controller, upload };