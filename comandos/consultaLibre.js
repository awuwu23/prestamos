// comandos/consultaLibre.js

const { analizarDominio } = require('../dominio');

async function manejarConsultaLibre(sock, comando, numero, esGrupo, senderJid, respuestaDestino, enProceso) {
    const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
    const esPatente = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) || /^[A-Z]{3}\d{3}$/.test(textoPlano);
    const esCelular = /^\d{9,12}$/.test(comando.replace(/[^0-9]/g, ''));
    const esCVU = /^\d{22}$/.test(comando.replace(/[^0-9]/g, ''));

    if (esPatente) {
        enProceso.add(numero);

        await sock.sendMessage(respuestaDestino, {
            text: `🚗 Consultando información del vehículo con dominio *${comando}*...`,
            mentions: esGrupo ? [senderJid] : [],
        });

        try {
            await analizarDominio(comando, respuestaDestino, sock);
        } catch (error) {
            console.error('❌ Error durante la consulta de patente:', error);
            await sock.sendMessage(respuestaDestino, {
                text: '⚠️ Hubo un error al consultar el dominio. Intentalo más tarde.',
                mentions: esGrupo ? [senderJid] : [],
            });
        } finally {
            enProceso.delete(numero);
        }

        return true;
    }

    // Si querés manejar CVU o celular desde acá, agregalo.
    // Por ahora, lo dejamos en falso ya que lo maneja comandosExtra.
    if (esCelular || esCVU) {
        return false;
    }

    return false;
}

module.exports = manejarConsultaLibre;
