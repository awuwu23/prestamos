const express = require('express');
const http = require('http');
const app = express();

// Puerto para mantener Render activo
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Bot Shelby en línea en Render!');
});

// Escuchar en el puerto para que Render detecte tráfico
app.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});

// 🟢 Ping interno cada 25 segundos para evitar que Render duerma el contenedor
setInterval(() => {
  http.get(process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`, (res) => {
    console.log(`📡 Ping interno enviado (${res.statusCode})`);
  }).on('error', (err) => {
    console.error('❌ Error en el ping interno:', err.message);
  });
}, 25 * 1000);

// 🟢 Inicia tu bot normalmente
require('./index'); // Cambia './index' si tu archivo principal tiene otro nombre


