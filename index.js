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
      printQRInTerminal: false, // El QR lo mostramos con qrcode-terminal
      logger: P({ level: 'silent' }),
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    socketGlobal = sock;

    // Guardar credenciales actualizadas
    sock.ev.on('creds.update', saveCreds);

    // Manejo de conexión y QR
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

        if (code === DisconnectReason.loggedOut) {
          console.log('🔒 Sesión cerrada. Eliminá la carpeta "session" y escaneá el QR nuevamente.');
          process.exit(0); // Detener para evitar reconexión infinita
        } else {
          console.log('🔁 Intentando reconectar en 3 segundos...');
          setTimeout(iniciarBot, 3000);
        }
      }

      if (connection === 'open') {
        console.log('✅ Bot conectado a WhatsApp');
      }
    });

    // Escuchar mensajes entrantes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        try {
          // Registrar usuario si es chat privado
          if (!msg.key.remoteJid.endsWith('@g.us')) {
            registrarUsuario(msg.key.remoteJid);
            await enviarBienvenida(sock, msg, msg.key.remoteJid);
          }

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

    // KeepAlive ping para Render
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    setInterval(() => {
      try {
        const client = keepAliveUrl.startsWith('https') ? https : http;
        client.get(keepAliveUrl, res => {
          // Consumir datos para evitar memory leaks
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







