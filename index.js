const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');
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
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Cambiado a false para evitar el warning deprecated
        logger: P({ level: 'silent' }),
        syncFullHistory: false,
        markOnlineOnConnect: true,
    });

    socketGlobal = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('📲 Escaneá el código QR para iniciar sesión.');
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error instanceof Boom
                ? lastDisconnect.error.output.statusCode
                : 0;

            const debeReconectar = code !== DisconnectReason.loggedOut;
            console.log(`❌ Conexión cerrada. Código: ${code}`);

            if (debeReconectar) {
                console.log('🔁 Reconectando en 3 segundos...');
                setTimeout(iniciarBot, 3000);
            } else {
                console.log('🔒 Usuario deslogueado. Escaneá el código QR nuevamente.');
            }
        }

        if (connection === 'open') {
            console.log('✅ Bot conectado a WhatsApp');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) return;

            try {
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
                res.on('data', () => {}); // Consumir respuesta para evitar memory leaks
            }).on('error', err => {
                console.error('❌ Error en keepAlive ping:', err.message);
            });
        } catch (err) {
            console.error('❌ Excepción en keepAlive:', err.message);
        }
    }, 25 * 1000);
}

iniciarBot();




