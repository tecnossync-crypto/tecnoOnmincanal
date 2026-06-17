// backend/src/routes/voucherRoutes.js
// Rutas REST de comprobantes de pago
// Registrado en routes/index.js bajo /api/vouchers
// RBAC:
//   - auth (todos los autenticados): leer, crear
//   - requireRole('admin','supervisor'): verificar/rechazar, estadísticas, auditoría
//   - requireRole('admin'): eliminar comprobante

const express    = require('express');
const path       = require('path');
const router     = express.Router();

const voucherController = require('../controllers/voucherController');
const { auth, requireRole } = require('../middleware/auth');
const { handleVoucherUpload, UPLOAD_DIR } = require('../middleware/uploadVoucher');
const {
  validateCreateVoucher,
  validateUpdateVoucher,
  validateStatusChange,
  validateListVouchers
} = require('../middleware/validateVoucher');

// ─────────────────────────────────────────────────────────────
// SERVIR ARCHIVOS PROTEGIDOS POR JWT
// Ruta: GET /api/vouchers/files/*
// Nginx hace proxy de /api → backend:3001, así que los archivos
// solo se sirven si el usuario tiene un JWT válido
// ─────────────────────────────────────────────────────────────
router.get('/files/*', auth, (req, res) => {
  const relativePath = req.params[0];

  // Prevenir path traversal
  if (!relativePath || relativePath.includes('..') || relativePath.includes('\0')) {
    return res.status(400).json({ success: false, message: 'Ruta de archivo inválida.' });
  }

  const fullPath     = path.join(UPLOAD_DIR, relativePath);
  const resolvedPath = path.resolve(fullPath);

  // Verificar que el path resuelto esté dentro del directorio de uploads
  if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ success: false, message: 'Acceso denegado.' });
  }

  res.sendFile(resolvedPath, (err) => {
    if (err) res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
  });
});

// ─────────────────────────────────────────────────────────────
// ESTADÍSTICAS — ANTES de /:id para que "stats" no se capture
// como UUID
// ─────────────────────────────────────────────────────────────
router.get('/stats',
  auth,
  requireRole('admin', 'supervisor'),
  voucherController.stats.bind(voucherController)
);

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

// Listar con filtros y paginación
router.get('/',
  auth,
  validateListVouchers,
  voucherController.list.bind(voucherController)
);

// Crear (multipart/form-data para archivos)
router.post('/',
  auth,
  handleVoucherUpload,
  validateCreateVoucher,
  voucherController.create.bind(voucherController)
);

// Detalle
router.get('/:id',
  auth,
  voucherController.getOne.bind(voucherController)
);

// Actualizar datos (solo si está pending)
router.put('/:id',
  auth,
  handleVoucherUpload,
  validateUpdateVoucher,
  voucherController.update.bind(voucherController)
);

// Cambiar estado (admin o supervisor)
router.patch('/:id/status',
  auth,
  requireRole('admin', 'supervisor'),
  validateStatusChange,
  voucherController.changeStatus.bind(voucherController)
);

// Eliminar archivo adjunto
router.delete('/:id/attachments/:filename',
  auth,
  voucherController.deleteAttachment.bind(voucherController)
);

// Eliminar comprobante completo (solo admin)
router.delete('/:id',
  auth,
  requireRole('admin'),
  voucherController.delete.bind(voucherController)
);

// Historial de auditoría
router.get('/:id/audit',
  auth,
  requireRole('admin', 'supervisor'),
  voucherController.getAuditLog.bind(voucherController)
);

module.exports = router;
