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
const { limpiarMembresiasVencidas } = require('./membresia');

let socketGlobal = null;

async function iniciarBot() {
  try {
    // ⏳ Conexión a MongoDB
    await conectarMongo();

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'silent' }),
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    socketGlobal = sock;

    sock.ev.on('creds.update', saveCreds);

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
          console.log('🔒 Sesión cerrada o desconectada. Eliminá "session" y escaneá nuevamente.');
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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log('📩 Evento messages.upsert tipo:', type);
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe || !msg.key.remoteJid) continue;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : msg.key.remoteJid;

        console.log('🔍 Mensaje desde:', from);
        console.log('👤 Remitente:', sender);

        if (!sender) continue;

        try {
          if (!isGroup) {
            registrarUsuario(from);
            await enviarBienvenida(sock, msg, from);
          }

          await manejarMensaje(sock, msg);
        } catch (err) {
          console.error('❌ Error procesando mensaje:', err);
          try {
            await sock.sendMessage(from, {
              text: '⚠️ Error procesando tu mensaje. Intentá nuevamente.',
            });
          } catch (e) {
            console.error('❌ No se pudo enviar mensaje de error:', e);
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
    console.error('❌ Error al iniciar el bot:', error);
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
    console.error('❌ Error al iniciar servidor HTTP:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});













