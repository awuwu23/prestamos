// federador.js

const { botUsername, iniciarClienteTelegram } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');

// Espera 15 segundos y busca vacunas desde Telegram
async function buscarVacunasDesdeTelegram(dni, sexo) {
    // Esperar 15 segundos
    await new Promise(resolve => setTimeout(resolve, 15000));

    const client = await iniciarClienteTelegram();
    if (!client || !client.connected) {
        console.error('❌ Cliente Telegram no conectado');
        return '\n\n💉 No se pudieron consultar vacunas.';
    }

    const comando = `/federador ${dni} ${sexo}`;
    console.log('🤖 Enviando comando al bot:', comando);

    try {
        await client.sendMessage(botUsername, { message: comando });
    } catch (err) {
        console.error('❌ Error al enviar comando:', err.message);
        return '\n\n💉 Error al consultar vacunas.';
    }

    return new Promise((resolve) => {
        let timeout;

        const handler = async (event) => {
            const mensaje = event.message?.message || '';

            if (mensaje.includes('💉 Vacunas Registradas') || mensaje.includes('💉 No se encontraron vacunas')) {
                clearTimeout(timeout);
                client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

                if (mensaje.includes('💉 Vacunas Registradas')) {
                    const inicio = mensaje.indexOf('💉 Vacunas Registradas');
                    const vacunasTexto = mensaje.substring(inicio).trim();
                    resolve(`\n\n${vacunasTexto}`);
                } else if (mensaje.includes('💉 No se encontraron vacunas')) {
                    resolve('\n\n💉 No se encontraron vacunas registradas.');
                } else {
                    resolve('\n\n💉 No se obtuvo información de vacunas.');
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

        timeout = setTimeout(() => {
            client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));
            resolve('\n\n💉 No se recibió respuesta del bot de vacunas.');
        }, 15000);
    });
}

module.exports = {
    buscarVacunasDesdeTelegram
};




