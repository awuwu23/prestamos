const { iniciarClienteTelegram } = require('./telegramClientNuevo');
const manejarMensaje = require('./comandos');
const {
    normalizarNumero,
    verificarMembresia,
    yaUsoBusquedaGratis,
    registrarBusquedaGratis
} = require('./membresia');
const { adminList } = require('./comandos/membre');

const ID_DUEÑO = '6500959070';

// 🧠 Crea un objeto compatible con comandos.js
function crearMensajeSimuladoTelegram(msg, userId, destinoId) {
    return {
        key: {
            remoteJid: destinoId.toString(),
            participant: userId.toString(),
        },
        message: {
            conversation: msg.message || '',
        }
    };
}

// ✅ Envía mensaje usando BigInt como entity directa
async function enviarMensajeTelegram(client, destinoId, texto) {
    try {
        const entity = await client.getEntity(BigInt(destinoId)); // <-- 🔥 este es el FIX clave
        await client.sendMessage(entity, {
            message: texto,
            parseMode: 'markdown',
        });
    } catch (err) {
        if (err.errorMessage === 'CHAT_WRITE_FORBIDDEN' || err.code === 403) {
            console.warn(`🚫 No se puede enviar mensaje a ${destinoId}: permisos denegados.`);
        } else if (err.message?.includes('Could not find the input entity')) {
            console.warn(`❗ No se pudo enviar mensaje a ${destinoId}: no hay chat iniciado.`);
        } else {
            console.error('❌ Error al enviar mensaje Telegram:', err);
        }
    }
}

(async () => {
    const client = await iniciarClienteTelegram();
    if (!client) {
        console.error('❌ No se pudo iniciar cliente Telegram.');
        return;
    }

    console.log('✅ Cliente Telegram conectado.');
    console.log('🤖 Bot activo en Telegram. Esperando mensajes...');

    client.addEventHandler(async (update) => {
        const msg = update.message;
        if (!msg || msg.out) return;

        const texto = msg.message?.trim();
        const userId = msg.senderId?.userId || msg.fromId?.userId;
        const chatId = msg.peerId?.channelId || msg.chatId || userId;

        if (!texto || !userId || !chatId) return;

        const userIdStr = userId.toString();
        const chatIdStr = chatId.toString();
        const esGrupo = chatIdStr.startsWith('-100');

        const numeroNormalizado = normalizarNumero(userIdStr);
        const esAdmin = adminList.includes(numeroNormalizado);
        const tieneMembresia = verificarMembresia(numeroNormalizado);
        const esDueño = userIdStr === ID_DUEÑO;

        if (esGrupo) {
            if (!esDueño && !esAdmin && !tieneMembresia) {
                console.log(`🔒 Ignorado en grupo: ${userIdStr} sin permisos.`);
                return;
            }
        } else {
            if (!esDueño && !esAdmin && !tieneMembresia) {
                if (yaUsoBusquedaGratis(numeroNormalizado)) {
                    await enviarMensajeTelegram(client, userIdStr,
                        '🔒 Ya usaste tu búsqueda gratuita. Contactá a *3813885182* para obtener membresía.');
                    return;
                }
                registrarBusquedaGratis(numeroNormalizado);
            }
        }

        const fakeMsg = crearMensajeSimuladoTelegram(msg, userIdStr, chatIdStr);

        const sockTelegram = {
            sendMessage: async (destino, contenido) => {
                const texto = contenido?.text || contenido?.message || '⚠️ Mensaje vacío';
                await enviarMensajeTelegram(client, destino, texto);
            }
        };

        try {
            await manejarMensaje(sockTelegram, fakeMsg);
        } catch (err) {
            console.error('❌ Error al manejar mensaje en Telegram:', err);
            await enviarMensajeTelegram(client, userIdStr, '⚠️ Error procesando tu mensaje.');
        }
    });
})();

















