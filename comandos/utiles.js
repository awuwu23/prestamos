// comandos/utiles.js /cel /credito /menu

const { limpiarNumero } = require('../cel');
const { manejarComandosExtra } = require('../comandos2');
const { simularCredito } = require('../credito');

async function manejarCel(sock, msg, comando, numero) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage || {};
    const citadoTexto = Object.values(quoted).find(v => typeof v === 'string') || '';
    const citadoNumeroRaw = contextInfo?.participant || '';

    const citadoTextoLimpio = citadoTexto.replace(/[^0-9]/g, '');
    if (citadoTextoLimpio.length >= 9 && citadoTextoLimpio.length <= 12) {
        await manejarComandosExtra(sock, msg, citadoTextoLimpio, numero);
        return true;
    }

    const matchNumero = citadoNumeroRaw.match(/^\d+/);
    if (matchNumero) {
        const numeroCitado = matchNumero[0];
        const numeroLimpio = limpiarNumero(numeroCitado);
        await manejarComandosExtra(sock, msg, numeroLimpio, numero);
        return true;
    }

    await sock.sendMessage(msg.key.remoteJid, {
        text: '⚠️ No se detectó ningún número válido en el mensaje citado.',
    });
    return true;
}

async function manejarMenu(sock, respuestaDestino, senderJid, esGrupo) {
    await sock.sendMessage(respuestaDestino, {
        text:
            `📋 *Menú de comandos disponibles:*

` +
            `• Enviar solo DNI → Validación automática
` +
            `• Enviar patente (ej: ABC123) → Consulta de vehículo
` +
            `• /credito [monto] → Simular préstamo semanal
` +
            `• /registrar → Registrarse si fue aprobado
` +
            `• /dnrpa [patente] → Consultar datos de vehículo directamente
` +
            `• Enviar número celular o CVU → Verificar en base externa
` +
            `• /cel (citando mensaje) → Buscar número del usuario citado
` +
            `• /me → Ver estado de tu membresía`,
        mentions: esGrupo ? [senderJid] : [],
    });
    return true;
}

async function manejarCredito(sock, comando, respuestaDestino, senderJid, esGrupo) {
    const valor = comando.substring(9).trim();
    const monto = parseFloat(valor);
    const respuesta = simularCredito(monto);
    await sock.sendMessage(respuestaDestino, {
        text: respuesta,
        mentions: esGrupo ? [senderJid] : [],
    });
    return true;
}

module.exports = {
    manejarCel,
    manejarMenu,
    manejarCredito
};
