// comandos/dnrpa.js
const { iniciarClienteTelegram, botUsername } = require('../telegramClientNuevo');
const { consultarDominio } = require('../dominio');

async function manejarDnrpa(sock, comando, respuestaDestino, senderJid, esGrupo, numero) {
    const partes = comando.split(' ');
    const dominio = partes[1]?.trim();

    if (!dominio || (!/^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(dominio) && !/^[A-Z]{3}\d{3}$/.test(dominio))) {
        await sock.sendMessage(respuestaDestino, {
            text: '❌ Formato de patente inválido. Ej: ABC123 o AB123CD.',
            mentions: esGrupo ? [senderJid] : [],
        });
        return true;
    }

    await sock.sendMessage(respuestaDestino, {
        text: `🚗 Consultando datos del vehículo con dominio *${dominio}*...`,
        mentions: esGrupo ? [senderJid] : [],
    });

    try {
        const client = await iniciarClienteTelegram();
        if (!client) {
            await sock.sendMessage(respuestaDestino, {
                text: '❌ No se pudo iniciar conexión con Telegram.',
                mentions: esGrupo ? [senderJid] : [],
            });
            return true;
        }

        const bot = await client.getEntity(botUsername);
        const resultado = await consultarDominio(dominio, client, bot);

        if (!resultado) {
            await sock.sendMessage(respuestaDestino, {
                text: '⚠️ No se obtuvo información del dominio. Verificá que esté bien escrito.',
                mentions: esGrupo ? [senderJid] : [],
            });
        } else {
            if (resultado.imagen) {
                await sock.sendMessage(respuestaDestino, {
                    image: resultado.imagen,
                    caption: `📷 Imagen final del informe DNRPA para *${dominio}*.`,
                    mentions: esGrupo ? [senderJid] : [],
                });
            }
            const mensaje = `📄 *Datos del dominio ${dominio}:*\n\n${resultado.textoPlano}`;
            await sock.sendMessage(respuestaDestino, {
                text: mensaje,
                mentions: esGrupo ? [senderJid] : [],
            });
        }
    } catch (err) {
        console.error('❌ Error al consultar dominio /dnrpa:', err);
        await sock.sendMessage(respuestaDestino, {
            text: '❌ Ocurrió un error al procesar la patente.',
            mentions: esGrupo ? [senderJid] : [],
        });
    }
    return true;
}

module.exports = manejarDnrpa;
