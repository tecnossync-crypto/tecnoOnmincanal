const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const clientesRoutes = require('./routes/clientes.routes');
const conversacionesRoutes = require('./routes/conversaciones.routes');
const mensajesRoutes = require('./routes/mensajes.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', clientesRoutes);
app.use('/api', conversacionesRoutes);
app.use('/api', mensajesRoutes);

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()');
  res.json(result.rows);
});

app.listen(3000, () => {
  console.log('Servidor corriendo en puerto 3000');
});