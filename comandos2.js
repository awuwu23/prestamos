const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { adminList } = require('./comandos/membre');
const { procesarAnuncio } = require('./anunciar');
const { iniciarClienteTelegram } = require('./telegramClientNuevo');

const API_URL = 'https://smmsat.com/api/v2';
const API_KEY = 'c13032a392f3c76dbddc07d89d8e62b6';

// ✅ Dueños autorizados
const dueños = [
  '5493813885182',
  '54927338121162993',
  '3813885182',
  '27338121162993'
];

// 📁 Archivo donde guardamos los tokens
const tokensFile = path.join(__dirname, './tokens.json');
let tokens = {};
if (fs.existsSync(tokensFile)) {
  tokens = JSON.parse(fs.readFileSync(tokensFile));
}
function guardarTokens() {
  fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
}
function normalizarNumero(numero) {
  let n = numero.replace(/\D/g, '');
  if (n.startsWith('54')) return n;
  if (n.length > 13) return n;
  if (n.length >= 10 && !n.startsWith('54')) return '54' + n;
  return n;
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

// 🕓 Pedidos de seguidores en proceso
let pedidosSeguidores = {};

// 🔥 Cliente de Telegram persistente
let telegramClient = null;
async function obtenerClienteTelegram() {
  if (!telegramClient) {
    console.log('📡 Iniciando cliente de Telegram...');
    telegramClient = await iniciarClienteTelegram();
  }
  return telegramClient;
}

// 🟢 Verificar si es dueño o admin
function esDueño(idUsuario) {
  const id = normalizarNumero(idUsuario);
  return dueños.includes(id);
}
function esAdmin(idUsuario) {
  const id = normalizarNumero(idUsuario);
  return adminList.includes(id);
}

// 🚀 Manejo de comandos extra
async function manejarComandosExtra(sock, msg, texto) {
  const from = msg.key.remoteJid;

  // 📌 Ignorar mensajes vacíos
  if (!texto || !texto.trim()) return false;

  let rawID = '';
  if (msg.key.participant) {
    rawID = msg.key.participant.split('@')[0];
  } else if (msg.key.remoteJid.includes('@s.whatsapp.net')) {
    rawID = msg.key.remoteJid.split('@')[0];
  } else {
    rawID = '0000000000';
  }
  const idUsuario = normalizarNumero(rawID);

  const comando = texto.toUpperCase();
  const dueño = esDueño(idUsuario);
  const admin = esAdmin(idUsuario);

  console.log(`📩 Extra: "${comando}" desde ${idUsuario}`);

  // 🟢 Comando /anunciar
  if (await procesarAnuncio(sock, msg, idUsuario)) return true;

  // 💰 Comando /TOKENS (ver saldo)
  if (comando === '/TOKENS') {
    const saldo = obtenerTokens(idUsuario);
    await sock.sendMessage(from, {
      text: `💰 *Tus tokens disponibles:* ${saldo}\n\n📌 100 tokens = $2000 ARS\n🎯 Cada 100 seguidores = 10 tokens`
    });
    return true;
  }

  // 🔗 Detección de links (Instagram, TikTok, YouTube)
  if (texto.startsWith('http') && (
    texto.includes('instagram.com') ||
    texto.includes('tiktok.com') ||
    texto.includes('youtube.com'))) {

    console.log('🔗 URL detectada para carga de seguidores');

    let plataforma = '';
    if (texto.includes('instagram.com')) plataforma = 'instagram';
    else if (texto.includes('tiktok.com')) plataforma = 'tiktok';
    else if (texto.includes('youtube.com')) plataforma = 'youtube';

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

  // 🟢 Paso 2: esperar cantidad
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

    const instructivoPath = path.join(__dirname, 'seguidores.jpg');
    try {
      const imagenBuffer = fs.readFileSync(instructivoPath);
      await sock.sendMessage(from, {
        image: imagenBuffer,
        caption: `📄 *Instrucciones para cargar seguidores*\n\n✅ Antes de confirmar:\n- 📱 Poné tu cuenta en *público*\n- ✅ Seguí los pasos de la imagen\n\n✏️ Escribe *"SI"* para confirmar o *"NO"* para cancelar.`
      });
    } catch {
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

  return false;
}

module.exports = { manejarComandosExtra, agregarTokens, obtenerTokens, descontarTokens };












