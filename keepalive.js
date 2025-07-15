const express = require('express');
const http = require('http');
const app = express();

// 🌐 Puerto para que Render detecte tráfico
const PORT = process.env.PORT || 3000;

// Ruta principal para verificar que el bot está activo
app.get('/', (req, res) => {
  res.send('✅ Bot Shelby en línea en Render!');
});

// 🟢 Inicia el servidor Express
app.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});

// 🟢 KeepAlive interno: Pings cada 25 segundos
setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  http.get(url, (res) => {
    console.log(`📡 Ping interno enviado a ${url} (Status: ${res.statusCode})`);
  }).on('error', (err) => {
    console.error('❌ Error en el ping interno:', err.message);
  });
}, 25 * 1000);

// 🚀 Inicia tu bot normalmente
require('./index'); // Cambia './index' si tu archivo principal tiene otro nombre



