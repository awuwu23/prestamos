const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');

// ✅ Importamos helpers en lugar de adminList
const { esAdmin } = require('./comandos/membre');
const {
  verificarMembresia,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis
} = require('./membresia');

const fs = require('fs');
const path = require('path');

/* ============================
 * Utils
 * ============================ */

// 🟢 Normaliza cualquier número a formato argentino internacional
function limpiarNumero(input) {
  let n = input.replace(/\D/g, '');
  if (n.startsWith('54')) return n;
  if (n.length >= 13 && !n.startsWith('54')) return '54' + n;
  if (n.length >= 10 && !n.startsWith('54')) return '54' + n;
  return n;
}

// 🔢 Devuelve los últimos 10 dígitos para el bot de Telegram
function obtenerDiezDigitos(numero) {
  const limpio = numero.replace(/\D/g, '');
  return limpio.slice(-10); // ej: de 5493816611745 → 3816611745
}

function esNumeroCelularValido(numero) {
  const limpio = limpiarNumero(numero);
  return /^\d{9,15}$/.test(limpio);
}

/* ============================
 * Lógica principal
 * ============================ */
async function consultarPorCelular(sock, comando, numeroRemitente, respuestaDestino, enProceso) {
  const numeroNormalizado = limpiarNumero(comando);
  const celularParaTelegram = obtenerDiezDigitos(numeroNormalizado);
  const remitenteNormalizado = limpiarNumero(numeroRemitente);

  // ✅ Usamos helpers en vez de adminList
  const esAdminUser = await esAdmin(remitenteNormalizado);
  const tieneMembresia = await verificarMembresia(remitenteNormalizado);

  if (!esAdminUser && !tieneMembresia) {
    if (yaUsoBusquedaGratis(remitenteNormalizado)) {
      await sock.sendMessage(respuestaDestino, {
        text: '🔒 Ya usaste tu búsqueda gratuita. Contactá al *3813885182* para activar tu membresía.'
      });
      return;
    }
    registrarBusquedaGratis(remitenteNormalizado);
    console.log(`🆓 Búsqueda gratuita habilitada para ${remitenteNormalizado}`);
  } else if (esAdminUser) {
    console.log('👑 Usuario administrador, búsqueda sin restricciones.');
  }

  const client = await iniciarClienteTelegram();
  if (!client || typeof client.sendMessage !== 'function') {
    console.error('❌ Cliente Telegram no válido.');
    await sock.sendMessage(respuestaDestino, {
      text: '❌ No se pudo conectar con el sistema de verificación.',
    });
    return;
  }

  try {
    console.log(`📲 Enviando /cel ${celularParaTelegram} al bot de Telegram`);
    const bot = await client.getEntity(botUsername);
    await client.sendMessage(bot, { message: `/cel ${celularParaTelegram}` });

    const textos = [];
    let imagenDescargada = false;

    // Configuración de tiempos extendidos
    const DEBOUNCE_MS = 15000;       // 15 segundos de espera entre mensajes
    const TIMEOUT_GLOBAL_MS = 40000; // Timeout máximo 40 segundos

    await new Promise((resolve, reject) => {
      let timeout;

      const handler = async (event) => {
        const msgTelegram = event.message;
        const senderId = msgTelegram.senderId?.value || msgTelegram.senderId;
        if (String(senderId) !== String(bot.id)) return;

        if (msgTelegram.message) {
          const contenido = msgTelegram.message.trim();
          console.log('📩 Texto recibido del bot:', contenido);
          textos.push(contenido);
        }

        if (msgTelegram.media) {
          console.log('🖼️ Imagen recibida del bot, descargando...');
          try {
            const buffer = await client.downloadMedia(msgTelegram);
            const nombreArchivo = `informe_${Date.now()}.jpg`;
            const rutaArchivo = path.join(__dirname, nombreArchivo);
            fs.writeFileSync(rutaArchivo, buffer);
            imagenDescargada = rutaArchivo;
            console.log('✅ Imagen descargada en', rutaArchivo);
          } catch (err) {
            console.error('❌ Error al descargar imagen:', err);
          }
        }

        // Reinicia timeout para esperar más mensajes
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          client.removeEventHandler(handler);
          await procesarRespuestas(sock, respuestaDestino, textos, imagenDescargada);
          resolve();
        }, DEBOUNCE_MS);
      };

      client.addEventHandler(handler, new NewMessage({}));

      // Timeout global por si no llega ninguna respuesta
      timeout = setTimeout(() => {
        client.removeEventHandler(handler);
        reject(new Error('⏰ Timeout esperando respuesta del bot de Telegram'));
      }, TIMEOUT_GLOBAL_MS);
    });

  } catch (err) {
    console.error('❌ Error durante la búsqueda /cel:', err);
    await sock.sendMessage(respuestaDestino, {
      text: '⚠️ Ocurrió un error al realizar la búsqueda del celular.',
    });
  } finally {
    enProceso.delete(numeroRemitente);
  }
}

/* ============================
 * Procesar respuestas
 * ============================ */
async function procesarRespuestas(sock, to, textos, imagen) {
  const respuesta = textos.join('\n\n').trim();
  console.log('📤 Enviando resultado final a WhatsApp...');

  if (respuesta) {
    await sock.sendMessage(to, {
      text: `🔍 *Resultado de búsqueda:*\n\n${respuesta}`,
    });
  }
  if (imagen) {
    const buffer = fs.readFileSync(imagen);
    await sock.sendMessage(to, {
      image: buffer,
      caption: '📄 *Informe adjunto*',
    });
    fs.unlinkSync(imagen); // elimina archivo temporal
    console.log('🗑️ Imagen temporal eliminada.');
  }
}

/* ============================
 * Exports
 * ============================ */
module.exports = {
  limpiarNumero,
  esNumeroCelularValido,
  consultarPorCelular
};
















