const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');
const { adminList } = require('./comandos/membre');
const {
  verificarMembresia,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis
} = require('./membresia');

function limpiarNumero(input) {
  return input
    .replace(/[^0-9]/g, '')   // solo números
    .replace(/^549/, '')      // +54 9...
    .replace(/^54/, '')       // +54...
    .replace(/^9/, '')        // 9...
    .trim();
}

function esNumeroCelularValido(numero) {
  const limpio = limpiarNumero(numero);
  return /^\d{9,12}$/.test(limpio);
}

async function buscarCelularTelegram(celular, sock, from, numeroRemitente) {
  const remitenteNormalizado = limpiarNumero(numeroRemitente);
  const esAdmin = adminList.includes(remitenteNormalizado);
  const tieneMembresia = verificarMembresia(remitenteNormalizado);

  if (!esAdmin && !tieneMembresia) {
    if (yaUsoBusquedaGratis(remitenteNormalizado)) {
      await sock.sendMessage(from, {
        text: '🔒 Ya usaste tu búsqueda gratuita. Contactá al *3813885182* para activar tu membresía.'
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
    await sock.sendMessage(from, {
      text: '❌ No se pudo conectar con el sistema de verificación.',
    });
    return;
  }

  try {
    const bot = await client.getEntity(botUsername);
    await client.sendMessage(bot, { message: `/cel ${celular}` });

    const textos = [];
    const handler = async (event) => {
      const msgTelegram = event.message;
      const fromBot = msgTelegram.senderId && msgTelegram.senderId.equals(bot.id);
      if (!fromBot || msgTelegram.media) return;

      const contenido = msgTelegram.message?.trim();
      if (contenido) {
        console.log('📩 Mensaje recibido del bot:', contenido);
        textos.push(contenido);
      }
    };

    client.addEventHandler(handler, new NewMessage({}));

    await new Promise(resolve => setTimeout(resolve, 10000));
    client.removeEventHandler(handler);

    if (textos.length === 0) {
      await sock.sendMessage(from, {
        text: '⚠️ El sistema no respondió con información útil para ese número.',
      });
      return;
    }

    const respuesta = textos.join('\n\n').trim();

    await sock.sendMessage(from, {
      text: `🔍 *Resultado de búsqueda:*\n\n${respuesta}`,
    });

  } catch (err) {
    console.error('❌ Error durante la búsqueda /cel:', err);
    await sock.sendMessage(from, {
      text: '⚠️ Ocurrió un error al realizar la búsqueda del celular.',
    });
  }
}

module.exports = {
  limpiarNumero,
  esNumeroCelularValido,
  buscarCelularTelegram,
};










