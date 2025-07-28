// federador.js

const { botUsername, iniciarClienteTelegram } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');

// Espera 15 segundos y busca licencia desde Telegram
async function buscarLicenciaDesdeTelegram(dni, sexo) {
    // Esperar 15 segundos
    await new Promise(resolve => setTimeout(resolve, 15000));

    const client = await iniciarClienteTelegram();
    if (!client || !client.connected) {
        console.error('❌ Cliente Telegram no conectado');
        return '\n\n🪪 No se pudo consultar la licencia.';
    }

    const comando = `/licencia ${dni} ${sexo}`;
    console.log('🤖 Enviando comando al bot:', comando);

    try {
        await client.sendMessage(botUsername, { message: comando });
    } catch (err) {
        console.error('❌ Error al enviar comando:', err.message);
        return '\n\n🪪 Error al consultar licencia.';
    }

    return new Promise((resolve) => {
        let timeout;

        const handler = async (event) => {
            const mensaje = event.message?.message || '';

            if (
                mensaje.includes('🪪 Licencia de Conducir') ||
                mensaje.includes('❌ No se encontró información de licencia')
            ) {
                clearTimeout(timeout);
                client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

                if (mensaje.includes('🪪 Licencia de Conducir')) {
                    const inicio = mensaje.indexOf('🪪 Licencia de Conducir');
                    const licenciaTexto = mensaje.substring(inicio).trim();
                    resolve(`\n\n${licenciaTexto}`);
                } else {
                    resolve('\n\n❌ No se encontró información de licencia.');
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

        timeout = setTimeout(() => {
            client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));
            resolve('\n\n🪪 No se recibió respuesta del bot de licencias.');
        }, 15000);
    });
}

module.exports = {
    buscarLicenciaDesdeTelegram
};






