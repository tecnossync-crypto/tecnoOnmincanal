const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/conversaciones', async (req, res) => {
  try {

    const { cliente_id, canal, asignado_a } = req.body;

    const result = await pool.query(
      `INSERT INTO conversaciones (cliente_id, canal, asignado_a)
       VALUES ($1,$2,$3) RETURNING *`,
      [cliente_id, canal, asignado_a]
    );

    res.json(result.rows[0]);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error creando conversación" });

  }
});


router.get('/conversaciones', async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT * FROM conversaciones
       ORDER BY created_at DESC`
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error obteniendo conversaciones" });

  }
});


module.exports = router;