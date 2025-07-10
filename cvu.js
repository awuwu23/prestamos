const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');
const { adminList } = require('./comandos/membre');
const {
  verificarMembresia,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis
} = require('./membresia');

// Verifica si el texto es un posible CVU/CBU (22 dígitos)
function esCVUoCBU(texto) {
  if (!texto || typeof texto !== 'string') return false;
  return /^\d{22}$/.test(texto.replace(/[^0-9]/g, ''));
}

// Normaliza el número de CVU/CBU (quita espacios o símbolos)
function limpiarCVU(texto) {
  if (!texto || typeof texto !== 'string') return '';
  return texto.replace(/[^0-9]/g, '').trim();
}

async function buscarCVUTelegram(cvu, sock, from, numeroRemitente) {
  if (!cvu || typeof cvu !== 'string') {
    console.warn('❌ CVU inválido recibido:', cvu);
    await sock.sendMessage(from, {
      text: '⚠️ El CVU/CBU ingresado no es válido.',
    });
    return;
  }

  const remitenteNormalizado = numeroRemitente.replace(/\D/g, '');
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
    await client.sendMessage(bot, { message: `/cvu ${cvu}` });

    const textos = [];
    let resolved = false;

    const handler = async (event) => {
      const msgTelegram = event.message;
      const fromBot = msgTelegram.senderId && msgTelegram.senderId.equals(bot.id);
      if (!fromBot || msgTelegram.media) return;

      console.log('📨 Capturado mensaje del bot Telegram:', msgTelegram.message);
      textos.push(msgTelegram.message);
    };

    client.addEventHandler(handler, new NewMessage({}));

    setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        client.removeEventHandler(handler);

        if (textos.length <= 1) {
          await sock.sendMessage(from, {
            text: '⚠️ El sistema no devolvió datos suficientes para ese CVU.',
          });
        } else {
          const respuesta = textos.slice(1).join('\n\n').trim();
          await sock.sendMessage(from, {
            text: `🏦 Resultado de CVU/CBU:\n\n${respuesta}`,
          });
        }
      }
    }, 5000);
  } catch (err) {
    console.error('❌ Error durante búsqueda de CVU:', err);
    await sock.sendMessage(from, {
      text: '⚠️ Ocurrió un error al realizar la búsqueda del CVU/CBU.',
    });
  }
}

module.exports = {
  esCVUoCBU,
  limpiarCVU,
  buscarCVUTelegram,
};

