const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/clientes', async (req, res) => {
  try {
    const { nombre, telef_no, email, empresa_id } = req.body;

    const result = await pool.query(
      `INSERT INTO clientes (nombre, telef_no, email, empresa_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nombre, telef_no, email, empresa_id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando cliente" });
  }
});

router.get('/clientes', async (req, res) => {
  try {

    const result = await pool.query(
      'SELECT * FROM clientes ORDER BY id DESC'
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error obteniendo clientes" });

  }
});

router.get('/clientes/:id', async (req, res) => {
  try {

    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM clientes WHERE id = $1',
      [id]
    );

    res.json(result.rows[0]);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error obteniendo cliente" });

  }
});

module.exports = router;