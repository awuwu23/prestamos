// 🌱 Cargar variables de entorno
require('dotenv').config();

const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Boom } = require('@hapi/boom');
const http = require('http');
const https = require('https');

const conectarMongo = require('./mongo');
const manejarMensaje = require('./comandos');
const { registrarUsuario } = require('./anunciar');
const { enviarBienvenida } = require('./bienvenida');
const { limpiarMembresiasVencidas, verificarMembresia, tiempoRestante, vincularIdExtendido } = require('./membresia');

let socketGlobal = null;

// 📌 Set para evitar procesar mensajes duplicados
const mensajesProcesados = new Set();

// 🔧 Función para limpiar IDs (quita @lid, @s.whatsapp.net, @g.us)
function limpiarJid(jid) {
  if (!jid) return null;
  return jid
    .toString()
    .replace('@s.whatsapp.net', '')
    .replace('@lid', '')
    .replace('@g.us', '');
}

async function iniciarBot() {
  try {
    console.log('⏳ Iniciando bot...');

    // ⏳ Conexión a MongoDB
    await conectarMongo();
    console.log('✅ Conectado a MongoDB');

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'silent' }), // 🚫 No spamea logs de Baileys
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    socketGlobal = sock;

    sock.ev.on('creds.update', saveCreds);

    // 🔗 Eventos de conexión
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('📲 Escaneá el código QR para iniciar sesión.');
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : 0;

        console.log(`❌ Conexión cerrada. Código: ${code}`);

        if (code === DisconnectReason.loggedOut || code === 440) {
          console.log('🔒 Sesión cerrada. Eliminá la carpeta "session" y escaneá nuevamente.');
          process.exit(0);
        } else {
          console.log('🔁 Reintentando conexión en 3s...');
          setTimeout(iniciarBot, 3000);
        }
      }

      if (connection === 'open') {
        console.log('✅ Bot conectado a WhatsApp');

        // 🧹 Limpiar membresías vencidas al conectar
        limpiarMembresiasVencidas(sock);

        // ⏱️ Y cada 12 horas
        setInterval(() => limpiarMembresiasVencidas(sock), 12 * 60 * 60 * 1000);
      }
    });

    // 📩 Manejo de mensajes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return; // procesar solo notify

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe || !msg.key.remoteJid) {
          continue; // 🚫 No mostrar mensajes vacíos o duplicados
        }

        // 📌 Evitar mensajes duplicados
        const idMensaje = msg.key.id;
        if (mensajesProcesados.has(idMensaje)) continue;
        mensajesProcesados.add(idMensaje);
        setTimeout(() => mensajesProcesados.delete(idMensaje), 60000);

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : msg.key.remoteJid;

        if (!sender) continue;

        // 🔧 Normalizar IDs
        const remitenteLimpio = limpiarJid(sender);
        const chatLimpio = limpiarJid(from);

        try {
          // 🛡️ Log y verificación de membresía
          const tieneMembresia = await verificarMembresia(remitenteLimpio);
          if (tieneMembresia) {
            const tiempo = await tiempoRestante(remitenteLimpio);
            console.log(`✅ Usuario ${remitenteLimpio} con membresía activa. Restante: ${tiempo?.dias || 0}d ${tiempo?.horas || 0}h`);
          } else {
            console.warn(`⛔ Usuario ${remitenteLimpio} aparece SIN membresía activa.`);
          }

          // 🧩 Vincular automáticamente IDs raros (@lid)
          if (sender.includes('@lid')) {
            console.log(`🔗 Detectado @lid para ${remitenteLimpio}, intentando vincular con su número real...`);
            await vincularIdExtendido(remitenteLimpio, sender);
          }

          // 🏠 Solo en chats privados
          if (!isGroup) {
            registrarUsuario(remitenteLimpio);
            await enviarBienvenida(sock, msg, remitenteLimpio);
          }

          // 🚀 Pasar al manejador de comandos
          await manejarMensaje(sock, msg, remitenteLimpio, chatLimpio, isGroup);
        } catch (err) {
          console.error('❌ Error procesando mensaje:', err.message);
          try {
            await sock.sendMessage(from, {
              text: '⚠️ Error procesando tu mensaje. Intentá nuevamente.',
            });
          } catch (e) {
            console.error('❌ No se pudo enviar mensaje de error:', e.message);
          }
        }
      }
    });

    // 🔁 Keep-alive ping para Render
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    setInterval(() => {
      const client = keepAliveUrl.startsWith('https') ? https : http;
      client.get(keepAliveUrl, res => res.on('data', () => {}))
        .on('error', err => console.error('❌ Error en keepAlive:', err.message));
    }, 25 * 1000);

  } catch (error) {
    console.error('❌ Error al iniciar el bot:', error.message);
    process.exit(1);
  }
}

iniciarBot();

// 🌐 Servidor HTTP para mantener Render activo
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🌐 Bot activo y funcionando\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Puerto ${PORT} ya está en uso.`);
  } else {
    console.error('❌ Error al iniciar servidor HTTP:', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});














