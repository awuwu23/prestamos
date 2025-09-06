// =============================
// 📌 Importaciones
// =============================
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
        text: '🔒 Ya usaste tu búsqueda gratuita.\n\n💳 Contactá al *3813885182* para activar tu membresía y acceder a consultas ilimitadas.'
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

    // ✅ Capturar respuestas de /cel
    const resultadoCel = await capturarRespuestasTelegram(client, bot, `/cel ${celularParaTelegram}`, 40000, 15000);

    // ✅ Procesar informe de /cel
    await enviarInformeCel(sock, respuestaDestino, resultadoCel, "📱 *Informe de Celular*");

    // ✅ Ahora lanzamos /movistar
    await sock.sendMessage(respuestaDestino, {
      text: `━━━━━━━━━━━━━━━━━━\n🔍 *Buscando información en Movistar* 📡\n📱 Número: *${celularParaTelegram}*\n━━━━━━━━━━━━━━━━━━`
    });

    const resultadoMovistar = await capturarRespuestasTelegram(client, bot, `/movistar ${celularParaTelegram}`, 30000, 10000);

    await enviarInformeCel(sock, respuestaDestino, resultadoMovistar, "📡 *Informe Movistar*");

    await sock.sendMessage(respuestaDestino, {
      text: `✅ *Consulta finalizada exitosamente*`
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
 * Captura de respuestas
 * ============================ */
async function capturarRespuestasTelegram(client, bot, comando, timeoutGlobal, debounceMs) {
  return new Promise(async (resolve, reject) => {
    const textos = [];
    let imagenDescargada = null;
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

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        client.removeEventHandler(handler);
        resolve({ textos, imagen: imagenDescargada });
      }, debounceMs);
    };

    client.addEventHandler(handler, new NewMessage({}));
    await client.sendMessage(bot, { message: comando });

    timeout = setTimeout(() => {
      client.removeEventHandler(handler);
      resolve({ textos, imagen: imagenDescargada });
    }, timeoutGlobal);
  });
}

/* ============================
 * Enviar informe al usuario
 * ============================ */
async function enviarInformeCel(sock, to, datos, titulo) {
  const { textos, imagen } = datos;
  const respuesta = textos.join('\n\n').trim();

  if (respuesta) {
    await sock.sendMessage(to, {
      text: `━━━━━━━━━━━━━━━━━━\n${titulo}\n━━━━━━━━━━━━━━━━━━\n\n${respuesta}`,
    });
  }

  if (imagen) {
    const buffer = fs.readFileSync(imagen);
    await sock.sendMessage(to, {
      image: buffer,
      caption: `${titulo} 📎`,
    });
    fs.unlinkSync(imagen);
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
















