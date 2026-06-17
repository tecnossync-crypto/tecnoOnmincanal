const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const CATALOG_DIR = process.env.CATALOG_UPLOAD_DIR
  || path.join(__dirname, '../../uploads/catalogs');

fs.mkdirSync(CATALOG_DIR, { recursive: true });

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf']);

const MAX_SIZE = (parseInt(process.env.CATALOG_MAX_FILE_SIZE_MB) || 20) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CATALOG_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const rand = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}_${rand}${ext}`);
  }
});

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

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE, files: 1 } });

const handleCatalogUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE')   return res.status(413).json({ success: false, message: `Archivo supera ${process.env.CATALOG_MAX_FILE_SIZE_MB || 20} MB.` });
    if (err.code === 'INVALID_FILE_TYPE') return res.status(415).json({ success: false, message: err.message });
    return res.status(500).json({ success: false, message: 'Error procesando archivo.' });
  });
};

module.exports = { handleCatalogUpload, CATALOG_DIR };
