// backend/src/middleware/validateVoucher.js
// Validaciones para comprobantes usando express-validator (ya es dep del proyecto)

const { body, query, param, validationResult } = require('express-validator');

// Helper centralizado — mismo patrón que el proyecto usa internamente
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

// ── Crear comprobante ────────────────────────────────────────
const validateCreateVoucher = [
  body('contact_id')
    .notEmpty().withMessage('El ID del cliente es requerido.')
    .isUUID().withMessage('El ID del cliente debe ser un UUID válido.'),

  body('amount')
    .notEmpty().withMessage('El monto es requerido.')
    .isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0.'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('La moneda debe ser un código ISO de 3 letras.')
    .isAlpha().withMessage('La moneda solo puede contener letras.'),

  body('payment_method')
    .notEmpty().withMessage('El método de pago es requerido.')
    .isIn(['bank_transfer', 'cash', 'card', 'mobile_payment', 'crypto', 'other'])
    .withMessage('Método de pago inválido.'),

  body('payment_date')
    .notEmpty().withMessage('La fecha de pago es requerida.')
    .isDate().withMessage('La fecha de pago debe tener formato YYYY-MM-DD.')
    .custom((value) => {
      const d    = new Date(value);
      const now  = new Date(); now.setHours(23, 59, 59, 999);
      const old  = new Date(); old.setFullYear(old.getFullYear() - 2);
      if (d > now) throw new Error('La fecha no puede ser futura.');
      if (d < old) throw new Error('La fecha es demasiado antigua (máx. 2 años).');
      return true;
    }),

  body('reference_number')
    .optional()
    .isLength({ max: 100 }).withMessage('La referencia no puede superar 100 caracteres.')
    .trim(),

  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('La descripción no puede superar 1000 caracteres.')
    .trim(),

  handleValidationErrors
];

// ── Actualizar comprobante ───────────────────────────────────
const validateUpdateVoucher = [
  param('id').isUUID().withMessage('ID de comprobante inválido.'),

  body('amount')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0.'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 }).withMessage('Código ISO de 3 letras.'),

  body('payment_method')
    .optional()
    .isIn(['bank_transfer', 'cash', 'card', 'mobile_payment', 'crypto', 'other'])
    .withMessage('Método de pago inválido.'),

  body('payment_date')
    .optional()
    .isDate().withMessage('La fecha debe tener formato YYYY-MM-DD.'),

  body('reference_number')
    .optional()
    .isLength({ max: 100 }).trim(),

  body('description')
    .optional()
    .isLength({ max: 1000 }).trim(),

  handleValidationErrors
];

// ── Cambio de estado ─────────────────────────────────────────
const validateStatusChange = [
  param('id').isUUID().withMessage('ID de comprobante inválido.'),

  body('status')
    .notEmpty().withMessage('El estado es requerido.')
    .isIn(['pending', 'verified', 'rejected', 'fraud_suspected'])
    .withMessage('Estado inválido.'),

  body('rejection_reason')
    .if(body('status').isIn(['rejected', 'fraud_suspected']))
    .notEmpty().withMessage('El motivo es requerido al rechazar o marcar fraude.')
    .isLength({ min: 10, max: 500 }).withMessage('El motivo debe tener entre 10 y 500 caracteres.'),

  body('internal_notes')
    .optional()
    .isLength({ max: 1000 }).withMessage('Las notas no pueden superar 1000 caracteres.'),

  handleValidationErrors
];

// ── Listado / búsqueda ───────────────────────────────────────
const validateListVouchers = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'verified', 'rejected', 'fraud_suspected']),
  query('contact_id').optional().isUUID(),
  query('payment_method').optional().isIn(['bank_transfer', 'cash', 'card', 'mobile_payment', 'crypto', 'other']),
  query('date_from').optional().isDate(),
  query('date_to').optional().isDate(),
  handleValidationErrors
];

module.exports = {
  validateCreateVoucher,
  validateUpdateVoucher,
  validateStatusChange,
  validateListVouchers
};
