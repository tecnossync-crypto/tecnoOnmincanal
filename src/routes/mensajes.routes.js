const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.post('/mensajes', async (req, res) => {

  try {

    const { conversacion_id, emisor, contenido, tipo } = req.body;

    const result = await pool.query(
      `INSERT INTO mensajes (conversacion_id, emisor, contenido, tipo)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [conversacion_id, emisor, contenido, tipo]
    );

    res.json(result.rows[0]);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error enviando mensaje" });

  }

});


router.get('/mensajes/:conversacion_id', async (req, res) => {

  try {

    const { conversacion_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM mensajes
       WHERE conversacion_id = $1
       ORDER BY created_at ASC`,
      [conversacion_id]
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);
    res.status(500).json({ error: "Error obteniendo mensajes" });

  }

});

module.exports = router;