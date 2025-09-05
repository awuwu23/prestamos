const { analizarDominio } = require('../dominio');
const { consultarPorCelular } = require('../cel');
const { buscarCVUTelegram, limpiarCVU } = require('../cvu');

/* ============================
 * Manejo de consultas libres
 * ============================ */
async function manejarConsultaLibre(sock, comando, numero, esGrupo, senderJid, respuestaDestino, enProceso) {
  const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
  const esPatente =
    /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) || /^[A-Z]{3}\d{3}$/.test(textoPlano);

  const soloNumeros = comando.replace(/[^0-9]/g, '');
  const esCelular = /^\d{9,12}$/.test(soloNumeros);
  const esCVU = /^\d{22}$/.test(soloNumeros);

  // 🚦 Marcar consulta como en proceso
  enProceso.add(numero);

  // 📩 Mensaje inicial de tipo de consulta
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

        // Timeout general por seguridad
        setTimeout(() => reject(new Error('⏰ Timeout en consulta de celular')), 30000);
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

        // Timeout general por seguridad
        setTimeout(() => reject(new Error('⏰ Timeout en consulta de CVU')), 30000);
      });
    } else {
      console.warn(`❌ Consulta inválida: ${comando}`);
      await sock.sendMessage(respuestaDestino, {
        text: `⚠️ El dato ingresado *${comando}* no parece un dominio, celular o CVU válido.`,
        mentions: esGrupo ? [senderJid] : [],
      });
    }

  } catch (error) {
    console.error(`❌ Error durante la consulta (${comando}):`, error);
    await sock.sendMessage(respuestaDestino, {
      text: `⚠️ Ocurrió un error al consultar *${comando}*. Intentalo más tarde.`,
      mentions: esGrupo ? [senderJid] : [],
    });
  } finally {
    // 🔓 Liberar del set de procesos siempre
    enProceso.delete(numero);
  }

  return true;
}

/* ============================
 * Exports
 * ============================ */
module.exports = manejarConsultaLibre;















