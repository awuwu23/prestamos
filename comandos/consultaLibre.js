const { analizarDominio } = require('../dominio');
const { consultarPorCelular } = require('../cel');
const { buscarCVUTelegram, limpiarCVU } = require('../cvu');

async function manejarConsultaLibre(sock, comando, numero, esGrupo, senderJid, respuestaDestino, enProceso) {
    const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
    const esPatente = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) || /^[A-Z]{3}\d{3}$/.test(textoPlano);
    const soloNumeros = comando.replace(/[^0-9]/g, '');
    const esCelular = /^\d{9,12}$/.test(soloNumeros);
    const esCVU = /^\d{22}$/.test(soloNumeros);

    enProceso.add(numero); // ✅ Marcar consulta como en proceso

    // ✅ ÚNICO mensaje inicial (y opcional si quieres eliminarlo)
    const tipoConsulta = esPatente
        ? `🚗 Consultando dominio *${comando}*...`
        : esCelular
        ? `📱 Consultando celular *${comando}*...`
        : esCVU
        ? `🏦 Consultando CVU *${comando}*...`
        : null;

    if (tipoConsulta) {
        await sock.sendMessage(respuestaDestino, {
            text: `⏳ ${tipoConsulta}`,
            mentions: esGrupo ? [senderJid] : [],
        });
    }

    try {
        if (esPatente) {
            console.log(`🚗 Procesando dominio: ${comando}`);
            await analizarDominio(comando, respuestaDestino, sock);
        } else if (esCelular) {
            console.log(`📱 Procesando celular: ${comando}`);
            await new Promise(async (resolve, reject) => {
                try {
                    await consultarPorCelular(sock, comando, numero, respuestaDestino, enProceso);
                    resolve();
                } catch (err) {
                    reject(err);
                }

                // ⏱ Timeout general para la consulta de celular
                setTimeout(() => reject(new Error('⏰ Timeout en consulta de celular')), 25000);
            });
        } else if (esCVU) {
            console.log(`🏦 Procesando CVU: ${comando}`);
            const limpio = limpiarCVU(comando);
            await new Promise(async (resolve, reject) => {
                try {
                    await buscarCVUTelegram(limpio, sock, respuestaDestino, numero, enProceso);
                    resolve();
                } catch (err) {
                    reject(err);
                }

                // ⏱ Timeout general para la consulta de CVU
                setTimeout(() => reject(new Error('⏰ Timeout en consulta de CVU')), 25000);
            });
        }
    } catch (error) {
        console.error(`❌ Error durante la consulta (${comando}):`, error);

        // ✅ Mensaje único de error
        await sock.sendMessage(respuestaDestino, {
            text: `⚠️ Ocurrió un error al consultar *${comando}*. Intentalo más tarde.`,
            mentions: esGrupo ? [senderJid] : [],
        });
    } finally {
        enProceso.delete(numero); // ✅ Liberar del set de procesos
    }

    return true;
}

module.exports = manejarConsultaLibre;















