// backend/src/routes/companyRoutes.js
const express  = require('express');
const router   = express.Router();
const {
  getCompany, updateCompany, updateLogo,
  listCompanies, createCompany, deleteCompany,
  getFeatures, updateFeatures
} = require('../controllers/companyController');
const { auth, requireRole, requireSuperAdmin } = require('../middleware/auth');

// GET  /api/company          → admin/agent ve su empresa
router.get('/', auth, requireRole('admin', 'agent', 'supervisor'), getCompany);

// PUT  /api/company          → admin actualiza su empresa
router.put('/', auth, requireRole('admin'), updateCompany);

// ── Superadmin: gestión de todas las empresas ─────────────────────────────
router.get('/all',         auth, requireSuperAdmin, listCompanies);
router.post('/create',     auth, requireSuperAdmin, createCompany);
router.delete('/:id',      auth, requireSuperAdmin, deleteCompany);

// ── Superadmin: feature flags por empresa ────────────────────────────────
// GET  /api/company/:id/features   → leer active_features de una empresa
// PUT  /api/company/:id/features   → actualizar active_features de una empresa
router.get   ('/:id/features', auth, requireSuperAdmin, getFeatures);
router.put   ('/:id/features', auth, requireSuperAdmin, updateFeatures);

module.exports = router;
