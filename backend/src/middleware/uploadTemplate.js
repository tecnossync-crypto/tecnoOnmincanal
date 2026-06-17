const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const TEMPLATE_DIR  = path.join(__dirname, '../../uploads/templates');
const GENERATED_DIR = path.join(__dirname, '../../uploads/generated');

[TEMPLATE_DIR, GENERATED_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMPLATE_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    cb(null, `tpl_${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.docx', '.doc'].includes(ext)) return cb(null, true);
    cb(new Error('Solo se permiten archivos DOCX'));
  }
});

module.exports = { upload, TEMPLATE_DIR, GENERATED_DIR };
