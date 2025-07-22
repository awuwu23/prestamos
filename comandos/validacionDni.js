// comandos/validacionDni.js

const validarIdentidad = require('../work'); // ✅ Cambiado de '../validar' a '../work'

async function manejarValidacionDni(sock, msg, comando, numero, senderJid, esGrupo, enProceso, respuestaDestino) {
    enProceso.add(numero);

    await sock.sendMessage(respuestaDestino, {
        text: '🔍 Validando identidad, por favor espere unos segundos...',
        mentions: esGrupo ? [senderJid] : [],
    });

    try {
        await validarIdentidad(comando, numero, sock, msg);
    } catch (error) {
        console.error('❌ Error durante la validación de identidad:', error);
        await sock.sendMessage(respuestaDestino, {
            text: '⚠️ Hubo un error al validar tu identidad. Intentalo más tarde.',
            mentions: esGrupo ? [senderJid] : [],
        });
    } finally {
        enProceso.delete(numero);
    }

    return true;
}

module.exports = manejarValidacionDni;


