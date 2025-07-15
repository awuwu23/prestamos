const express = require('express');
const http = require('http');
const https = require('https');
const app = express();

// 🌐 Puerto para que Render detecte tráfico
const PORT = process.env.PORT || 3000;

// Ruta principal para verificar que el bot está activo
app.get('/', (req, res) => {
  res.send('✅ Bot Shelby en línea en Render!');
});

// 🟢 Inicia el servidor Express y abre el puerto
app.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});

// 🟢 KeepAlive interno: Pings cada 25 segundos para evitar que Render suspenda el servicio
setInterval(() => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const client = url.startsWith('https') ? https : http;

  client.get(url, (res) => {
    console.log(`📡 Ping interno enviado a ${url} (Status: ${res.statusCode})`);
  }).on('error', (err) => {
    console.error('❌ Error en el ping interno:', err.message);
  });
}, 25 * 1000);

// 🚀 Logs para verificar que keepalive.js se ejecutó
console.log('📦 keepalive.js fue ejecutado');

// 🚀 Inicia tu bot normalmente llamando a index.js
console.log('🚀 Lanzando index.js desde keepalive.js');
require('./index'); // Si tu archivo principal no se llama index.js, cambia esta línea





