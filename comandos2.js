const { limpiarNumero, buscarCelularTelegram } = require('./cel');
const { esCVUoCBU, limpiarCVU, buscarCVUTelegram } = require('./cvu');
const {
  agregarMembresia,
  verificarMembresia,
  tiempoRestante
} = require('./membresia');
const { adminList } = require('./comandos/membre');
const { procesarAnuncio } = require('./anunciar');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { iniciarClienteTelegram } = require('./telegramClientNuevo');

const API_URL = 'https://smmsat.com/api/v2';
const API_KEY = 'c13032a392f3c76dbddc07d89d8e62b6';

// ✅ Dueños (agrega número con y sin prefijo para grupo y privado)
const dueños = [
  '5493813885182', // Dueño privado
  '54927338121162993', // Dueño en grupo (ID extendido)
  '3813885182', // Fallback sin prefijo
  '27338121162993' // Fallback grupo sin prefijo
];

// 📁 Tokens
const tokensFile = path.join(__dirname, './tokens.json');
let tokens = {};
if (fs.existsSync(tokensFile)) {
  tokens = JSON.parse(fs.readFileSync(tokensFile));
}
function guardarTokens() {
  fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
}
function obtenerTokens(numero) {
  const num = normalizarNumero(numero);
  return tokens[num] || 0;
}
function agregarTokens(numero, cantidad) {
  const num = normalizarNumero(numero);
  tokens[num] = (tokens[num] || 0) + cantidad;
  guardarTokens();
}
function descontarTokens(numero, cantidad) {
  const num = normalizarNumero(numero);
  tokens[num] = Math.max((tokens[num] || 0) - cantidad, 0);
  guardarTokens();
}
function normalizarNumero(numero) {
  let n = numero.replace(/\D/g, '');

  // 🔥 Evitar agregar otro 54 si ya existe
  if (n.startsWith('54')) return n;

  // 🔥 Si es un ID largo de grupo (>13 dígitos), no modificar
  if (n.length > 13) return n;

  // 🔥 Agregar prefijo si es un número local
  if (n.length >= 10 && !n.startsWith('54')) return '54' + n;

  return n;
}

// 🕓 Pedidos pendientes por usuario
let pedidosSeguidores = {};

// 🔥 Cliente Telegram persistente
let telegramClient = null;
async function obtenerClienteTelegram() {
  if (!telegramClient) {
    console.log('📡 Iniciando cliente de Telegram...');
    telegramClient = await iniciarClienteTelegram();
  }
  return telegramClient;
}

// 🟢 Verificar si es dueño
function esDueño(idUsuario) {
  const id = normalizarNumero(idUsuario);
  const es = dueños.includes(id);
  console.log(`👑 Verificando dueño: ${id} => ${es}`);
  return es;
}

// 🟢 Verificar si es admin
function esAdmin(idUsuario) {
  const id = normalizarNumero(idUsuario);
  const es = adminList.includes(id);
  console.log(`🛡️ Verificando admin: ${id} => ${es}`);
  return es;
}

async function manejarComandosExtra(sock, msg, texto) {
  const from = msg.key.remoteJid;

  // 🔥 Detectar remitente correctamente para privado o grupo
  let rawID = '';
  if (msg.key.participant) {
    // Grupo
    rawID = msg.key.participant.split('@')[0];
  } else if (msg.key.remoteJid.includes('@s.whatsapp.net')) {
    // Chat privado
    rawID = msg.key.remoteJid.split('@')[0];
  } else {
    rawID = '0000000000'; // Fallback
  }

  const idUsuario = normalizarNumero(rawID);

  const comando = texto.toUpperCase();
  const dueño = esDueño(idUsuario);
  const admin = esAdmin(idUsuario);

  console.log(`📩 Comando recibido: "${comando}" desde ${idUsuario}`);
  console.log(`✅ ¿Es dueño?: ${dueño}`);
  console.log(`✅ ¿Es admin?: ${admin}`);

  // 🟢 Procesar comando /anunciar
  if (await procesarAnuncio(sock, msg, idUsuario)) return true;

  // 🧾 Comando /TOKENS para ver saldo
  if (comando === '/TOKENS') {
    const saldo = obtenerTokens(idUsuario);
    await sock.sendMessage(from, {
      text: `💰 *Tus tokens disponibles:* ${saldo}\n\n📌 100 tokens = $2000 ARS\n🎯 Cada 100 seguidores = 10 tokens`
    });
    return true;
  }

  // 🧾 Comando /SUB (activar membresía)
  if (comando.startsWith('/SUB')) {
    if (!dueño && !admin) {
      await sock.sendMessage(from, {
        text: '⛔ No estás autorizado para usar este comando.'
      });
      return true;
    }
    const partes = texto.split(' ');
    const destino = partes[1];
    if (!destino || !/^[0-9]{9,20}$/.test(destino)) {
      await sock.sendMessage(from, {
        text: '⚠️ Número inválido para membresía. Ejemplo: /sub 5493813885182'
      });
      return true;
    }
    agregarMembresia(destino);
    const tiempo = tiempoRestante(destino);
    await sock.sendMessage(from, {
      text: `✅ Membresía activada para ${destino}.\n📆 Vence en ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).`
    });
    return true;
  }

  // 🧾 Comando /ME para membresía
  if (comando === '/ME') {
    if (verificarMembresia(idUsuario) || admin || dueño) {
      const tiempo = tiempoRestante(idUsuario);
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

  // 🔗 Detectar links de redes sociales
  if (texto.startsWith('http') && (
      texto.includes('instagram.com') ||
      texto.includes('tiktok.com') ||
      texto.includes('youtube.com'))) {

    console.log('🔗 URL detectada para carga de seguidores');

    // Detectar plataforma automáticamente
    let plataforma = '';
    if (texto.includes('instagram.com')) plataforma = 'instagram';
    else if (texto.includes('tiktok.com')) plataforma = 'tiktok';
    else if (texto.includes('youtube.com')) plataforma = 'youtube';

    // Guardar pedido temporalmente
    pedidosSeguidores[idUsuario] = {
      url: texto,
      plataforma,
      paso: 'esperandoCantidad'
    };

    await sock.sendMessage(from, {
      text: `👥 *¿Cuántos seguidores quieres para ${plataforma.toUpperCase()}?*\n💡 Escribe solo el número (ejemplo: 100, 500, 1000).`
    });
    return true;
  }

  // 🟢 Paso 2: Esperar cantidad
  if (pedidosSeguidores[idUsuario] && pedidosSeguidores[idUsuario].paso === 'esperandoCantidad') {
    const cantidad = parseInt(texto);
    if (isNaN(cantidad) || cantidad <= 0) {
      await sock.sendMessage(from, {
        text: '⚠️ Ingresa una cantidad válida de seguidores (ejemplo: 100, 500, 1000).'
      });
      return true;
    }

    const pedido = pedidosSeguidores[idUsuario];
    const tokensNecesarios = Math.ceil((cantidad / 100) * 10);
    const saldo = obtenerTokens(idUsuario);

    if (saldo < tokensNecesarios && !admin && !dueño) {
      await sock.sendMessage(from, {
        text: `🚫 No tienes suficientes tokens.\n\n💰 Tokens: *${saldo}*\n📦 Necesarios: *${tokensNecesarios}*\n\n💵 Usa /tokens o pedí a un admin que cargue con /tokens.`
      });
      delete pedidosSeguidores[idUsuario];
      return true;
    }

    pedido.cantidad = cantidad;
    pedido.tokens = tokensNecesarios;
    pedido.paso = 'esperandoConfirmacion';

    // 📸 Enviar imagen de instrucciones
    const instructivoPath = path.join(__dirname, 'seguidores.jpg');
    try {
      const imagenBuffer = fs.readFileSync(instructivoPath);
      await sock.sendMessage(from, {
        image: imagenBuffer,
        caption: `📄 *Instrucciones para cargar seguidores*\n\n✅ Antes de confirmar:\n- 📱 Poné tu cuenta en *público*\n- ✅ Seguí los pasos de la imagen\n\n✏️ Escribe *"SI"* para confirmar o *"NO"* para cancelar.`
      });
      console.log('✅ Imagen enviada junto al mensaje de confirmación.');
    } catch (err) {
      console.error('❌ Error al enviar la imagen de instrucciones:', err);
      await sock.sendMessage(from, {
        text: '⚠️ No se pudo enviar la imagen. Escribe *"SI"* para confirmar o *"NO"* para cancelar.'
      });
    }
    return true;
  }

  // 🟢 Paso 3: Confirmación
  if (pedidosSeguidores[idUsuario] && pedidosSeguidores[idUsuario].paso === 'esperandoConfirmacion') {
    const respuesta = texto.trim().toUpperCase();
    const pedido = pedidosSeguidores[idUsuario];

    if (respuesta === 'NO') {
      delete pedidosSeguidores[idUsuario];
      await sock.sendMessage(from, { text: '❌ Pedido cancelado.' });
      return true;
    }

    if (respuesta === 'SI') {
      try {
        const servicios = await axios.post(API_URL, {
          key: API_KEY,
          action: 'services'
        });

        const servicio = servicios.data.find(s =>
          s.name.toLowerCase().includes('followers') &&
          s.name.toLowerCase().includes(pedido.plataforma)
        );

        if (!servicio) {
          await sock.sendMessage(from, {
            text: `🚫 No hay servicio disponible para *${pedido.plataforma}*.`
          });
          delete pedidosSeguidores[idUsuario];
          return true;
        }

        const respuestaAPI = await axios.post(API_URL, {
          key: API_KEY,
          action: 'add',
          service: servicio.service,
          link: pedido.url,
          quantity: pedido.cantidad
        });

        const idOrden = respuestaAPI.data.order;

        if (!admin && !dueño) descontarTokens(idUsuario, pedido.tokens);

        await sock.sendMessage(from, {
          text: `🎉 *Pedido realizado con éxito*\n\n🆔 ID: *${idOrden}*\n📱 Plataforma: *${pedido.plataforma.toUpperCase()}*\n👥 Seguidores: *${pedido.cantidad}*\n💳 Tokens usados: *${pedido.tokens}*\n📦 Estado: *Pendiente...*`
        });
      } catch (error) {
        console.error('❌ Error al procesar seguidores:', error);
        await sock.sendMessage(from, {
          text: '❌ Ocurrió un error al realizar el pedido. Intenta más tarde.'
        });
      }

      delete pedidosSeguidores[idUsuario];
      return true;
    }
  }

  // 🟢 Detectar búsquedas CVU o Celular
  const textoLimpio = texto.trim().replace(/[^0-9]/g, ''); // 🔥 normaliza texto
  const esCVU = esCVUoCBU(textoLimpio);
  const esCel = /^\d{9,15}$/.test(limpiarNumero(textoLimpio));

  console.log('🧪 Analizando texto para búsqueda:', textoLimpio);
  console.log('🔍 ¿Es CVU?:', esCVU);
  console.log('📱 ¿Es Celular?:', esCel);

  if (esCVU) {
    const numeroCVU = limpiarCVU(textoLimpio);
    if (!numeroCVU || numeroCVU.length !== 22) {
      await sock.sendMessage(from, {
        text: '⚠️ El número ingresado no es un CVU/CBU válido (22 dígitos).'
      });
      return true;
    }
    const client = await obtenerClienteTelegram();
    await buscarCVUTelegram(numeroCVU, sock, from, idUsuario, client);
    return true;
  }

  if (esCel) {
    const celular = limpiarNumero(textoLimpio);
    const client = await obtenerClienteTelegram();
    await buscarCelularTelegram(celular, sock, from, idUsuario, client);
    return true;
  }

  return false; // 👈 Si no es ningún caso, devuelve false
}

module.exports = { manejarComandosExtra };



















