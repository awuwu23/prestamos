// =============================
// 📌 Importaciones
// =============================
const { limpiarNumero } = require('./cel');
const { manejarComandosExtra } = require('./comandos2');
const {
  tiempoRestante,
  actualizarIdGrupo,
  normalizarNumero,
  agregarMembresia
} = require('./membresia');

const {
  manejarSub,
  manejarMe,
  manejarId,
  manejarAdm,
  manejarAdmins,
  adminList
} = require('./comandos/membre');

const { manejarCel, manejarMenu, manejarCredito } = require('./comandos/utiles');
const manejarRegistrar = require('./comandos/registrar');
const manejarDnrpa = require('./comandos/dnrpa');
const manejarValidacionDni = require('./comandos/validacionDni');
const manejarConsultaLibre = require('./comandos/consultaLibre');

const { agregarConsulta, obtenerEstado, procesarSiguiente } = require('./cola');
const { mostrarMembresiasActivas } = require('./membresiactiva');

// ✅ MongoDB modelos
const { Membresia, HistorialGratis } = require('./models');

// =============================
// 📌 Configuración
// =============================
const enProceso = new Set();
const dueños = ['5493813885182']; // 🔑 tu número admin dueño
const cooldowns = new Map();
const COOLDOWN_MS = 30000;

// 📌 Set para evitar procesar duplicados
const mensajesProcesados = new Set();

function esTelegram(sock) {
  return typeof sock.sendMessage === 'function' && !sock.ev;
}

// =============================
// 📌 Manejador principal
// =============================
async function manejarMensaje(sock, msg) {
  try {
    // Evitar duplicados
    const idMensaje = msg.key?.id;
    if (idMensaje) {
      if (mensajesProcesados.has(idMensaje)) return;
      mensajesProcesados.add(idMensaje);
      setTimeout(() => mensajesProcesados.delete(idMensaje), 60000);
    }

    const mensaje =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';
    if (!mensaje.trim()) return;

    const texto = mensaje.trim();
    const comando = texto.toUpperCase();
    const from = msg.key.remoteJid;

    const esGrupoTelegram = esTelegram(sock) && from && from.startsWith('-100');
    const esGrupoWhatsApp = from?.endsWith?.('@g.us') || false;
    const esGrupo = esGrupoTelegram || esGrupoWhatsApp;

    const senderJid = esGrupo ? msg.key.participant : msg.key.remoteJid;
    if (!senderJid) return;

    const rawSender = senderJid.includes('@')
      ? senderJid.split('@')[0]
      : senderJid;
    const numeroSimple = normalizarNumero(rawSender);
    const idUsuario = numeroSimple;
    const respuestaDestino = from;
    const fakeSenderJid = esTelegram(sock)
      ? `${numeroSimple}`
      : `${numeroSimple}@s.whatsapp.net`;

    const esAdmin = adminList.includes(numeroSimple);
    const esDueño = dueños.includes(numeroSimple);

    console.log('\n📥 Nuevo mensaje recibido');
    console.log('📍 Es grupo:', esGrupo);
    console.log('📨 Remitente:', numeroSimple);
    console.log('👑 ¿Es admin?:', esAdmin);
    console.log('📦 Comando recibido:', comando);

    // =============================
    // 📌 Revisar membresía
    // =============================
    let tieneMembresia = false;
    const miembro = await Membresia.findOne({
      $or: [{ numero: idUsuario }, { idGrupo: idUsuario }, { ids: idUsuario }],
      vence: { $gt: Date.now() }
    });

    if (miembro) {
      tieneMembresia = true;
      if (!miembro.idGrupo || miembro.idGrupo !== idUsuario) {
        await actualizarIdGrupo(miembro.numero, idUsuario);
      }
    }

    // Si es grupo de Telegram y no tiene permisos → salir
    if (esGrupoTelegram && !esDueño && !esAdmin && !tieneMembresia) return;

    // =============================
    // 📌 Validaciones extra
    // =============================
    const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
    const esDNI = /^\d{7,8}$/.test(comando);
    const esPatente =
      /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) ||
      /^[A-Z]{3}\d{3}$/.test(textoPlano);
    const esCelular = /^\d{9,12}$/.test(comando.replace(/\D/g, ''));
    const esCVU = /^\d{22}$/.test(comando.replace(/\D/g, ''));
    const esConsulta = esDNI || esPatente || esCelular || esCVU;

    // =============================
    // 📌 Comandos principales
    // =============================
    if (comando === '/ID') {
      return await manejarId(
        sock,
        idUsuario,
        respuestaDestino,
        fakeSenderJid,
        esGrupo
      );
    }

    if (comando === '/ADMINS') {
      return await manejarAdmins(sock, respuestaDestino);
    }

    if (comando === '/ME') {
      // /ME ahora muestra también el JID crudo
      let estadoMsg = `📊 *Estado de tu membresía*\n\n`;
      estadoMsg += `🔑 JID crudo: ${senderJid}\n`;
      estadoMsg += `🧹 ID limpio: ${rawSender}\n`;
      estadoMsg += `📱 Número normalizado: ${idUsuario}\n\n`;

      if (tieneMembresia) {
        const tiempo = await tiempoRestante(idUsuario);
        estadoMsg += `✅ Membresía activa\n⏳ Restante: ${tiempo?.dias || 0} días, ${tiempo?.horas || 0} horas.`;
      } else {
        estadoMsg += `⛔ No tenés membresía activa.`;
      }
      return await sock.sendMessage(respuestaDestino, { text: estadoMsg });
    }

    if (comando.startsWith('/ADM ') || comando === '/ADM') {
      if (texto.trim() === '/ADM') {
        return await sock.sendMessage(respuestaDestino, {
          text: '⚠️ *Usá el comando correctamente:*\n\n📌 Ejemplo: /adm 5493815440516 Juan'
        });
      }
      return await manejarAdm(sock, idUsuario, texto, respuestaDestino, adminList);
    }

    if (comando.startsWith('/SUB ')) {
      // Sintaxis: /SUB numero [lid] nombre dias
      const args = texto.split(/\s+/);
      if (args.length < 4) {
        return await sock.sendMessage(respuestaDestino, {
          text: '⚠️ Uso correcto: /SUB <numero> [lid] <nombre> <dias>'
        });
      }

      const numero = normalizarNumero(args[1]);
      let lid = null;
      let nombre = '';
      let dias = 30;

      if (/^\d{11,15}$/.test(args[2])) {
        // si es un lid
        lid = args[2];
        nombre = args[3] || 'Usuario';
        dias = parseInt(args[4] || '30', 10);
      } else {
        nombre = args[2];
        dias = parseInt(args[3] || '30', 10);
      }

      await agregarMembresia(numero, lid, nombre, dias, idUsuario);

      return await sock.sendMessage(respuestaDestino, {
        text: `✅ Membresía asignada a ${numero}\n👤 Nombre: ${nombre}\n📆 Duración: ${dias} días\n${
          lid ? `🔗 Vinculado con ID extendido: ${lid}` : ''
        }`
      });
    }

    if (comando === '/CEL')
      return await manejarCel(sock, msg, comando, idUsuario);
    if (comando === '/MENU')
      return await manejarMenu(sock, respuestaDestino, fakeSenderJid, esGrupo);
    if (comando === '/REGISTRAR')
      return await manejarRegistrar(sock, msg, idUsuario);
    if (comando.startsWith('/DNRPA'))
      return await manejarDnrpa(
        sock,
        comando,
        respuestaDestino,
        fakeSenderJid,
        esGrupo,
        idUsuario
      );
    if (comando.startsWith('/CREDITO '))
      return await manejarCredito(
        sock,
        comando,
        respuestaDestino,
        fakeSenderJid,
        esGrupo
      );

    if (comando === '/MEMBRESIAS') {
      if (!esDueño) {
        return await sock.sendMessage(respuestaDestino, {
          text: '⛔ *Solo el dueño puede usar este comando.*'
        });
      }
      return await mostrarMembresiasActivas(sock, respuestaDestino);
    }

    // =============================
    // 📌 Consultas
    // =============================
    if (esConsulta) {
      if (!esAdmin && !esDueño && !tieneMembresia) {
        const yaUso = await HistorialGratis.findOne({ numero: idUsuario });
        if (yaUso) {
          return await sock.sendMessage(respuestaDestino, {
            text: '🔒 *Ya usaste tu búsqueda gratuita.*\n\n📞 Contactá al *3813885182* para adquirir una membresía.'
          });
        } else {
          await HistorialGratis.create({ numero: idUsuario });
        }
      }

      // Cooldown
      if (cooldowns.has(idUsuario)) {
        const restante = Date.now() - cooldowns.get(idUsuario);
        if (restante < COOLDOWN_MS) {
          const segundos = Math.ceil((COOLDOWN_MS - restante) / 1000);
          return await sock.sendMessage(respuestaDestino, {
            text: `⏳ Esperá ${segundos}s antes de hacer otra consulta.`
          });
        }
      }
      cooldowns.set(idUsuario, Date.now());

      agregarConsulta(sock, {
        idUsuario,
        destino: respuestaDestino,
        fn: async () => {
          if (esDNI) {
            await manejarValidacionDni(
              sock,
              msg,
              comando,
              idUsuario,
              fakeSenderJid,
              esGrupo,
              enProceso,
              respuestaDestino
            );
          } else {
            await manejarConsultaLibre(
              sock,
              comando,
              idUsuario,
              esGrupo,
              fakeSenderJid,
              respuestaDestino,
              enProceso
            );
          }
          procesarSiguiente(sock);
        }
      });

      const estado = obtenerEstado();
      if (estado.tamaño === 1) {
        return await sock.sendMessage(respuestaDestino, {
          text: '⏳ *Procesando tu consulta...*'
        });
      }

      return await sock.sendMessage(respuestaDestino, {
        text: `⏳ *Consulta añadida a la fila!*\n📌 Posición: *${estado.tamaño}*`
      });
    }

    // =============================
    // 📌 Comandos extra
    // =============================
    const manejado = await manejarComandosExtra(sock, msg, texto, idUsuario);
    if (manejado) return;

    if (enProceso.has(idUsuario)) return;

    if (esGrupo && !comando.startsWith('/') && !esConsulta) {
      return;
    }

    if (!esGrupo) {
      return await sock.sendMessage(from, {
        text: '❓ *Comando no reconocido.*\n\n📖 Escribí */menu* para ver las opciones disponibles.'
      });
    }
  } catch (err) {
    console.error('❌ Error al manejar mensaje:', err);
    await sock.sendMessage(msg.key.remoteJid, {
      text: '⚠️ *Ocurrió un error procesando tu mensaje.*\n\n❌ Intentá nuevamente.'
    });
  }
}

module.exports = manejarMensaje;





























































