// comandos2.js actualizado con múltiples administradores y sin límites para ellos

const { limpiarNumero, buscarCelularTelegram } = require('./cel');
const { esCVUoCBU, limpiarCVU, buscarCVUTelegram } = require('./cvu');
const {
  agregarMembresia,
  verificarMembresia,
  tiempoRestante,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis
} = require('./membresia');
const { adminList } = require('./comandos/membre');
const { procesarAnuncio } = require('./anunciar'); // ✅ Se importa desde anunciar.js

/**
 * Normaliza número quitando el + y cualquier otro caracter no numérico
 */
function normalizarNumero(numero) {
  return numero.replace(/\D/g, '');
}

/**
 * Maneja comandos adicionales como CVU, celular y membresía.
 * Devuelve true si el comando fue procesado.
 */
async function manejarComandosExtra(sock, msg, texto, numeroRemitente) {
  const from = msg.key.remoteJid;
  const comando = texto.toUpperCase();
  const esGrupo = from.endsWith('@g.us');

  // 🟢 Procesar comando /anunciar si corresponde
  if (await procesarAnuncio(sock, msg, numeroRemitente)) return true;

  console.log(`📩 Comando recibido: "${comando}" desde ${numeroRemitente}`);

  const remitenteNormalizado = normalizarNumero(numeroRemitente);
  const esAdmin = adminList.includes(remitenteNormalizado);
  const tieneMembresiaActiva = verificarMembresia(remitenteNormalizado);

  // 🧾 Comando /SUB (solo administrador)
  if (comando.startsWith('/SUB')) {
    console.log('📥 Ejecutando /SUB');
    if (!esAdmin) {
      console.warn('⛔ Usuario no autorizado para /SUB:', numeroRemitente);
      await sock.sendMessage(from, { text: '⛔ No estás autorizado para usar este comando.' });
      return true;
    }

    const partes = texto.split(' ');
    const destino = partes[1];
    if (!destino || !/^\d{9,12}$/.test(destino)) {
      console.warn('⚠️ Número inválido proporcionado en /SUB:', destino);
      await sock.sendMessage(from, { text: '⚠️ Número inválido para membresía.' });
      return true;
    }

    agregarMembresia(destino);
    const tiempo = tiempoRestante(destino);

    await sock.sendMessage(from, {
      text: `✅ Membresía activada para ${destino}.\n📆 Vence en ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).`
    });
    return true;
  }

  // 🧾 Comando /ME (estado de membresía)
  if (comando === '/ME') {
    console.log('📥 Ejecutando /ME');
    if (tieneMembresiaActiva || esAdmin) {
      const tiempo = tiempoRestante(remitenteNormalizado);
      await sock.sendMessage(from, {
        text: `🕓 Tu membresía está activa. Vence en ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).`
      });
    } else {
      await sock.sendMessage(from, {
        text: '🔒 No tenés membresía activa. Solo podrás hacer 1 búsqueda gratuita.'
      });
    }
    return true;
  }

  // ✅ Solo aplicar límites si NO es comando administrativo
  const textoLimpio = texto?.trim() || '';
  const esCVU = esCVUoCBU(textoLimpio);
  const esCel = /^\d{9,12}$/.test(limpiarNumero(textoLimpio));
  const esConsulta = esCVU || esCel;

  if (esConsulta && !esAdmin && !tieneMembresiaActiva) {
    if (yaUsoBusquedaGratis(remitenteNormalizado)) {
      console.warn(`🔒 Usuario ${numeroRemitente} ya usó su búsqueda gratuita`);
      await sock.sendMessage(from, {
        text: '🔒 Ya usaste tu búsqueda gratuita. Contactá al *3813885182* para activar tu membresía.'
      });
      return true;
    }
    registrarBusquedaGratis(remitenteNormalizado);
    console.log(`🆓 Búsqueda gratuita habilitada para ${numeroRemitente}`);
  } else if (esAdmin) {
    console.log('👑 Usuario administrador, se permite la búsqueda sin restricciones.');
  }

  // 🔍 Detectar si es CVU o CBU
  if (esCVU) {
    const numeroCVU = limpiarCVU(textoLimpio);
    if (!numeroCVU || numeroCVU.length !== 22) {
      await sock.sendMessage(from, {
        text: '⚠️ El número ingresado no es un CVU/CBU válido (22 dígitos).',
      });
      return true;
    }

    console.log('🏦 Consultando CVU/CBU:', numeroCVU);
    await buscarCVUTelegram(numeroCVU, sock, from, remitenteNormalizado);
    return true;
  }

  // 🔍 Detectar si es número celular
  const numeroLimpio = limpiarNumero(textoLimpio);
  if (/^\d{9,12}$/.test(numeroLimpio)) {
    const celular = numeroLimpio.length <= 10
      ? '381' + numeroLimpio.slice(-7)
      : numeroLimpio;

    console.log('📲 Celular normalizado:', celular);
    await buscarCelularTelegram(celular, sock, from, numeroRemitente);
    return true;
  }

  // 🚫 No fue reconocido como comando extra
  console.log('⛔ No se detectó ningún comando válido en comandos2.js');
  return false;
}

module.exports = { manejarComandosExtra };










