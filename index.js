const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const { Boom } = require('@hapi/boom');

const manejarMensaje = require('./comandos');
const { registrarUsuario } = require('./anunciar');
const { enviarBienvenida } = require('./bienvenida');

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
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        try {
          const isGroup = msg.key.remoteJid.endsWith('@g.us');

          // 🟢 Registrar usuario y bienvenida solo en chats privados
          if (!isGroup) {
            registrarUsuario(msg.key.remoteJid);
            await enviarBienvenida(sock, msg, msg.key.remoteJid);
          }

          // ⚙️ Procesar mensaje en cualquier caso (privado o grupo)
          await manejarMensaje(sock, msg);
        } catch (err) {
          console.error('❌ Error manejando mensaje:', err);
          try {
            await sock.sendMessage(msg.key.remoteJid, {
              text: '⚠️ Ocurrió un error al procesar el mensaje.',
            });
          } catch (e) {
            console.error('❌ No se pudo enviar mensaje de error:', e);
          }
        }
      }
    });

    // KeepAlive ping para evitar que Render duerma el servicio
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

// 🔽 Servidor HTTP para que Render detecte el puerto abierto
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('🌐 Bot activo y funcionando\n');
}).listen(PORT, () => {
  console.log(`🌐 Servidor keepalive escuchando en el puerto ${PORT}`);
});










