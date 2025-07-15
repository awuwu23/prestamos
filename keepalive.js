const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('✅ Bot Shelby está en línea.');
});

app.listen(PORT, () => {
  console.log(`🌐 Servidor web de keepalive escuchando en el puerto ${PORT}`);
});

// 🟢 Aquí llamamos a tu bot principal
require('./index'); // Cambia './index' por el archivo principal de tu bot
