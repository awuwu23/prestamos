const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');
const { adminList } = require('./comandos/membre');
const {
  verificarMembresia,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis
} = require('./membresia');
const fs = require('fs');
const path = require('path');

function esCVUoCBU(texto) {
  if (!texto || typeof texto !== 'string') return false;
  return /^\d{22}$/.test(texto.replace(/\D/g, ''));
}

function limpiarCVU(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.replace(/\D/g, '').trim();
}

async function buscarCVUTelegram(cvuCrudo, sock, respuestaDestino, numeroRemitente, enProceso) {
  const cvu = limpiarCVU(cvuCrudo);

  if (!esCVUoCBU(cvu)) {
    console.warn('❌ CVU inválido recibido:', cvuCrudo);
    await sock.sendMessage(respuestaDestino, {
      text: '⚠️ El CVU/CBU ingresado no es válido. Debe contener exactamente 22 dígitos.',
    });
    return;
  }

  const remitenteNormalizado = numeroRemitente.replace(/\D/g, '');
  const esAdmin = adminList.includes(remitenteNormalizado);
  const tieneMembresia = verificarMembresia(remitenteNormalizado);

  if (!esAdmin && !tieneMembresia) {
    if (yaUsoBusquedaGratis(remitenteNormalizado)) {
      await sock.sendMessage(respuestaDestino, {
        text: '🔒 Ya usaste tu búsqueda gratuita. Contactá al *3813885182* para activar tu membresía.',
      });
      return;
    }
    registrarBusquedaGratis(remitenteNormalizado);
    console.log(`🆓 Búsqueda gratuita habilitada para ${remitenteNormalizado}`);
  } else if (esAdmin) {
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
    console.log(`📤 Enviando /cvu ${cvu} al bot de Telegram`);
    const bot = await client.getEntity(botUsername);
    await client.sendMessage(bot, { message: `/cvu ${cvu}` });

    const textos = [];
    let imagenDescargada = false;

    await new Promise((resolve, reject) => {
      let timeout;
      let procesando = false;

      const handler = async (event) => {
        const msgTelegram = event.message;
        const senderId = msgTelegram.senderId?.value || msgTelegram.senderId;
        if (String(senderId) !== String(bot.id)) return;

        if (msgTelegram.message) {
          const contenido = msgTelegram.message.trim();
          console.log('📩 Texto recibido del bot:', contenido);

          if (/buscando datos|procesando/i.test(contenido)) {
            procesando = true;
            console.log('⏳ Bot aún procesando, esperando...');
          } else {
            procesando = false;
            textos.push(contenido);
          }
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
            procesando = false;
          } catch (err) {
            console.error('❌ Error al descargar imagen:', err);
          }
        }

        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          if (procesando) {
            console.log('⏳ Timeout parcial, bot sigue procesando...');
            return;
          }
          client.removeEventHandler(handler);
          await procesarRespuestas(sock, respuestaDestino, textos, imagenDescargada);
          resolve();
        }, 15000); // ⏱️ Espera 15 segundos entre mensajes
      };

      client.addEventHandler(handler, new NewMessage({}));

      timeout = setTimeout(() => {
        client.removeEventHandler(handler);
        reject(new Error('⏰ Timeout total esperando respuesta del bot de Telegram'));
      }, 90000); // ⏱️ Espera máxima total de 90 segundos
    });

  } catch (err) {
    console.error('❌ Error durante búsqueda de CVU:', err);
    await sock.sendMessage(respuestaDestino, {
      text: '⚠️ Ocurrió un error al realizar la búsqueda del CVU/CBU.',
    });
  } finally {
    enProceso.delete(numeroRemitente);
  }
}

async function procesarRespuestas(sock, to, textos, imagen) {
  const respuesta = textos.join('\n\n').trim();
  console.log('📤 Enviando resultado final a WhatsApp...');

  if (respuesta) {
    await sock.sendMessage(to, {
      text: `🏦 *Resultado de búsqueda CVU/CBU:*\n\n${respuesta}`,
    });
  }
  if (imagen) {
    const buffer = fs.readFileSync(imagen);
    await sock.sendMessage(to, {
      image: buffer,
      caption: '📄 *Informe adjunto*',
    });
    fs.unlinkSync(imagen);
    console.log('🗑️ Imagen temporal eliminada.');
  }
}

module.exports = {
  esCVUoCBU,
  limpiarCVU,
  buscarCVUTelegram,
};





