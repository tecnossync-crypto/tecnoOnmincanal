// backend/src/routes/whatsappAccountRoutes.js
const express = require('express');
const router  = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const { WhatsappAccount, Company } = require('../models');

// ── Obtener cuenta WA de la empresa ──────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId)
      return res.status(400).json({ success: false, message: 'Sin empresa asociada' });

    const account = await WhatsappAccount.findOne({
      where:      { company_id: companyId, is_active: true },
      attributes: ['id', 'waba_id', 'phone_number_id', 'phone_number',
                   'display_name', 'is_active', 'connected_via', 'created_at']
      // access_token y app_secret NO se devuelven al frontend
    });

    res.json({ success: true, data: account });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Guardar desde Embedded Signup ────────────────────────────
router.post('/embedded-signup', auth, requireRole('admin'), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId)
      return res.status(400).json({ success: false, message: 'Sin empresa asociada' });

    const {
      code,           // código de autorización que devuelve Meta
      phone_number_id,
      waba_id,
      access_token,
      phone_number,
      display_name,
      meta_user_id
    } = req.body;

    if (!phone_number_id || !access_token)
      return res.status(400).json({ success: false, message: 'phone_number_id y access_token son requeridos' });

    // Desactivar cuenta anterior si existe
    await WhatsappAccount.update(
      { is_active: false },
      { where: { company_id: companyId } }
    );

    // Crear nueva cuenta
    const account = await WhatsappAccount.create({
      company_id:      companyId,
      waba_id,
      phone_number_id,
      phone_number,
      display_name,
      access_token,
      verify_token:    process.env.META_VERIFY_TOKEN,
      connected_via:   'embedded_signup',
      meta_user_id,
      is_active:       true
    });

    res.json({
      success: true,
      data: {
        id:              account.id,
        phone_number_id: account.phone_number_id,
        phone_number:    account.phone_number,
        display_name:    account.display_name,
        connected_via:   account.connected_via
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Guardar configuración manual ─────────────────────────────
router.post('/manual', auth, requireRole('admin'), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId)
      return res.status(400).json({ success: false, message: 'Sin empresa asociada' });

    const { phone_number_id, access_token, app_secret, verify_token, phone_number, display_name } = req.body;

    if (!phone_number_id || !access_token || !verify_token)
      return res.status(400).json({ success: false, message: 'phone_number_id, access_token y verify_token son requeridos' });

    // Desactivar cuenta anterior
    await WhatsappAccount.update(
      { is_active: false },
      { where: { company_id: companyId } }
    );

    const account = await WhatsappAccount.create({
      company_id:      companyId,
      phone_number_id,
      access_token,
      app_secret,
      verify_token,
      phone_number,
      display_name,
      connected_via:   'manual',
      is_active:       true
    });

    res.json({
      success: true,
      data: {
        id:              account.id,
        phone_number_id: account.phone_number_id,
        connected_via:   account.connected_via
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Desconectar cuenta ────────────────────────────────────────
router.delete('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    await WhatsappAccount.update(
      { is_active: false },
      { where: { company_id: companyId } }
    );
    res.json({ success: true, message: 'Cuenta desconectada' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ── Probar conexión con Meta ──────────────────────────────────
router.post('/test', auth, requireRole('admin'), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const account   = await WhatsappAccount.findOne({
      where: { company_id: companyId, is_active: true }
    });
    if (!account)
      return res.status(404).json({ success: false, message: 'Sin cuenta configurada' });

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${account.phone_number_id}?access_token=${account.access_token}`
    );
    const data = await response.json();

    if (data.error)
      return res.status(400).json({ success: false, message: data.error.message });

    res.json({
      success: true,
      data: {
        display_phone_number: data.display_phone_number,
        verified_name:        data.verified_name,
        quality_rating:       data.quality_rating
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;