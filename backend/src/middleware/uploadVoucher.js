// backend/src/middleware/uploadVoucher.js
// Middleware de subida de archivos para comprobantes de pago
// Usa multer con disco, validación de MIME/extensión, y seguridad de paths

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const logger  = require('../config/logger');

// Directorio de uploads — configurable vía env, default relativo a /app en Docker
const UPLOAD_DIR = process.env.VOUCHER_UPLOAD_DIR
  || path.join(__dirname, '../../uploads/vouchers');

// Crear directorio al arrancar
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Tipos permitidos
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf']);

// Límites configurables
const MAX_SIZE   = (parseInt(process.env.VOUCHER_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const MAX_FILES  = parseInt(process.env.VOUCHER_MAX_FILES) || 5;

// Storage con nombre aleatorio seguro
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Subdirectorios año/mes para no aplanar la carpeta raíz
    const now  = new Date();
    const sub  = path.join(UPLOAD_DIR, `${now.getFullYear()}`, String(now.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(sub, { recursive: true });
    cb(null, sub);
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}_${rand}${ext}`);
  }
});

// Filtro MIME + extensión
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMETYPES.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    return cb(
      Object.assign(new Error('Solo se permiten JPG, PNG, WEBP, GIF y PDF.'), { code: 'INVALID_FILE_TYPE' }),
      false
    );
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE, files: MAX_FILES } });

// Middleware principal — envuelve multer con manejo de errores JSON
const handleVoucherUpload = (req, res, next) => {
  upload.array('attachments', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')  return res.status(413).json({ success: false, message: `Archivo supera ${process.env.VOUCHER_MAX_FILE_SIZE_MB || 10} MB.` });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ success: false, message: `Máximo ${MAX_FILES} archivos.` });
    if (err.code === 'INVALID_FILE_TYPE') return res.status(415).json({ success: false, message: err.message });
    logger.error('Error en subida de comprobante:', err);
    return res.status(500).json({ success: false, message: 'Error procesando archivo.' });
  });
};

// URL pública del archivo (relativa a UPLOAD_DIR)
const getFileUrl = (filePath) => {
  const relative = path.relative(UPLOAD_DIR, filePath).replace(/\\/g, '/');
  const base     = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  return `${base}/api/vouchers/files/${relative}`;
};

// Borrado seguro — verifica que el path esté dentro de UPLOAD_DIR
const deleteFile = (filePath) => {
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
      logger.warn(`⚠️  Path fuera de uploads ignorado: ${filePath}`);
      return;
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      logger.info(`🗑️  Archivo eliminado: ${resolved}`);
    }
  } catch (err) {
    logger.error('Error eliminando archivo:', err);
  }
};

module.exports = { handleVoucherUpload, getFileUrl, deleteFile, UPLOAD_DIR };
