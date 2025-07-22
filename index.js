const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Boom } = require('@hapi/boom');

const manejarMensaje = require('./comandos');
const { registrarUsuario } = require('./anunciar');
const { enviarBienvenida } = require('./bienvenida');
const { limpiarMembresiasVencidas } = require('./membresia'); // ✅ Nuevo

const http = require('http');
const https = require('https');

let socketGlobal = null;

async function iniciarBot() {
  try {
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
          console.log('🔒 Sesión cerrada o desconectada (código 440). Eliminá la carpeta "session" y escaneá el QR nuevamente.');
          process.exit(0);
        } else {
          console.log('🔁 Intentando reconectar en 3 segundos...');
          setTimeout(iniciarBot, 3000);
        }
      }

      if (connection === 'open') {
        console.log('✅ Bot conectado a WhatsApp');

        // 🧹 Limpiar membresías vencidas al iniciar conexión
        limpiarMembresiasVencidas(sock);

        // ⏱️ Limpiar cada 12 horas (opcional: cada 6 u 8 horas)
        setInterval(() => {
          limpiarMembresiasVencidas(sock);
        }, 12 * 60 * 60 * 1000); // 12 horas
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

        console.log('🔍 Mensaje recibido desde:', from);
        console.log('👥 Es grupo:', isGroup);
        console.log('👤 Remitente:', sender);

        if (!sender) {
          console.warn('⚠️ No se pudo determinar el remitente del mensaje.');
          continue;
        }

        try {
          if (!isGroup) {
            registrarUsuario(from);
            await enviarBienvenida(sock, msg, from);
          }

          await manejarMensaje(sock, msg);
        } catch (err) {
          console.error('❌ Error manejando mensaje:', err);
          try {
            await sock.sendMessage(from, {
              text: '⚠️ Ocurrió un error al procesar el mensaje.',
            });
          } catch (e) {
            console.error('❌ No se pudo enviar mensaje de error:', e);
          }
        }
      }
    });

    // 🔁 Keep-alive ping para evitar que Render duerma
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    setInterval(() => {
      try {
        const client = keepAliveUrl.startsWith('https') ? https : http;
        client.get(keepAliveUrl, res => {
          res.on('data', () => {});
        }).on('error', err => {
          console.error('❌ Error en keepAlive ping:', err.message);
        });
      } catch (err) {
        console.error('❌ Excepción en keepAlive:', err.message);
      }
    }, 25 * 1000);

  } catch (error) {
    console.error('❌ Error al iniciar el bot:', error);
    process.exit(1);
  }
}

iniciarBot();

// 🌐 Servidor HTTP para Render
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🌐 Bot activo y funcionando\n');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Puerto ${PORT} ya está en uso. Probablemente ya esté corriendo el servidor.`);
  } else {
    console.error('❌ Error al iniciar servidor HTTP:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});











