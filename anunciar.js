const fs = require('fs');
const path = require('path');

const esperandoAnuncio = new Map(); // número → jid origen
const archivoUsuarios = path.join(__dirname, 'usuariosActivos.json');

let anuncioGuardado = null; // contenido del mensaje original (texto o multimedia)
let intervaloReenvio = null;

function normalizarNumero(numero) {
  return numero.replace(/\D/g, '');
}

function registrarUsuario(jid) {
  if (!jid.endsWith('@s.whatsapp.net')) return;

  let lista = [];
  if (fs.existsSync(archivoUsuarios)) {
    lista = JSON.parse(fs.readFileSync(archivoUsuarios));
  }

  if (!lista.includes(jid)) {
    lista.push(jid);
    fs.writeFileSync(archivoUsuarios, JSON.stringify(lista, null, 2));
    console.log(`🟢 Usuario ${jid} registrado para futuras campañas.`);
  }
}

async function reenviarAnuncio(sock) {
  if (!anuncioGuardado) {
    console.log('⛔ No hay anuncio guardado para reenviar.');
    return;
  }

  let destinos = [];
  if (fs.existsSync(archivoUsuarios)) {
    destinos = JSON.parse(fs.readFileSync(archivoUsuarios));
  }

  console.log(`🔁 Reenviando anuncio automático a ${destinos.length} usuarios...`);

  let enviados = 0;
  for (const jid of destinos) {
    try {
      await sock.copyNForward(jid, anuncioGuardado, true);
      enviados++;
      console.log(`✅ Reenviado a ${jid}`);
      await new Promise(res => setTimeout(res, 10000)); // 10s delay por usuario
    } catch (err) {
      console.warn(`❌ Error reenviando a ${jid}:`, err.message);
    }
  }

  console.log(`📤 Reenvío automático completado. Enviados: ${enviados}`);
}

async function procesarAnuncio(sock, msg, numeroRemitente) {
  const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const jidAnunciante = msg.key.remoteJid;
  const remitenteNormalizado = normalizarNumero(numeroRemitente);

  const esDueño = remitenteNormalizado === '5493813885182';
  if (!esDueño) {
    console.log(`⛔ Usuario ${remitenteNormalizado} no autorizado para anunciar.`);
    return false;
  }

  // ⛔ Comando para detener reenvíos automáticos
  if (texto.toUpperCase() === '/STOPANUNCIO') {
    if (intervaloReenvio) {
      clearInterval(intervaloReenvio);
      intervaloReenvio = null;
      await sock.sendMessage(jidAnunciante, {
        text: '🛑 Reenvío automático de anuncios detenido.',
      });
    } else {
      await sock.sendMessage(jidAnunciante, {
        text: '⚠️ No hay ningún anuncio automático activo.',
      });
    }
    return true;
  }

  // 🟢 Comando inicial /ANUNCIAR
  if (texto.toUpperCase() === '/ANUNCIAR') {
    console.log(`📣 Usuario ${remitenteNormalizado} activó /ANUNCIAR`);
    esperandoAnuncio.set(remitenteNormalizado, jidAnunciante);
    await sock.sendMessage(jidAnunciante, {
      text: '📝 *Escribí el mensaje (texto o multimedia) que querés anunciar a todos los usuarios.*',
    });
    return true;
  }

  // 🟡 Si ya está esperando el mensaje del anuncio
  if (esperandoAnuncio.has(remitenteNormalizado)) {
    esperandoAnuncio.delete(remitenteNormalizado);

    // 🧠 Guardamos el mensaje original completo
    anuncioGuardado = msg;

    try {
      let destinos = [];
      if (fs.existsSync(archivoUsuarios)) {
        destinos = JSON.parse(fs.readFileSync(archivoUsuarios));
      }

      console.log(`📨 Enviando anuncio a ${destinos.length} usuarios...`);

      if (destinos.length === 0) {
        await sock.sendMessage(jidAnunciante, {
          text: '⚠️ No se encontraron usuarios registrados para enviar el anuncio.',
        });
        return true;
      }

      let enviados = 0;
      for (const jid of destinos) {
        try {
          await sock.copyNForward(jid, msg, true); // ✅ envía multimedia o texto
          enviados++;
          console.log(`✅ Anuncio enviado a ${jid}`);
          await new Promise(res => setTimeout(res, 10000)); // 10 segundos por usuario
        } catch (err) {
          console.warn(`❌ Error al enviar a ${jid}:`, err.message);
        }
      }

      console.log(`📬 Anuncio inicial enviado a ${enviados} usuarios.`);

      await sock.sendMessage(jidAnunciante, {
        text: `✅ Anuncio enviado a ${enviados} usuario(s). Se reenviará automáticamente cada 12 horas. Podés detenerlo con /STOPANUNCIO.`,
      });

      // 🔁 Activar reenvío cada 12 horas (43200000 ms)
      if (intervaloReenvio) clearInterval(intervaloReenvio);
      intervaloReenvio = setInterval(() => reenviarAnuncio(sock), 12 * 60 * 60 * 1000);

    } catch (error) {
      console.error('❌ Error general al enviar el anuncio:', error.message);
      await sock.sendMessage(jidAnunciante, {
        text: '⚠️ Ocurrió un error al intentar enviar el anuncio.',
      });
    }

    return true;
  }

  return false;
}

module.exports = { procesarAnuncio, registrarUsuario };



