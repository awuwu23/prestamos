const fs = require('fs');
const path = require('path');
const mime = require('mime-types'); // Asegurate de tener este paquete instalado

const archivoUsuarios = path.join(__dirname, 'usuariosBienvenida.json');
const rutaImagen = path.join(__dirname, 'ayeofgod.png');

function normalizarNumero(numero) {
  return numero.replace(/\D/g, '');
}

function yaRecibioBienvenida(numero) {
  if (!fs.existsSync(archivoUsuarios)) return false;
  try {
    const lista = JSON.parse(fs.readFileSync(archivoUsuarios));
    return lista.includes(numero);
  } catch (error) {
    console.error('Error al leer el archivo de usuarios:', error);
    return false;
  }
}

function registrarBienvenida(numero) {
  let lista = [];
  try {
    if (fs.existsSync(archivoUsuarios)) {
      lista = JSON.parse(fs.readFileSync(archivoUsuarios));
    }
    if (!lista.includes(numero)) {
      lista.push(numero);
      fs.writeFileSync(archivoUsuarios, JSON.stringify(lista, null, 2));
      console.log(`👋 Usuario ${numero} registrado como bienvenido.`);
    }
  } catch (error) {
    console.error('Error al registrar al usuario:', error);
  }
}

async function enviarBienvenida(sock, msg, numeroRemitente) {
  const numero = normalizarNumero(numeroRemitente);
  const from = msg.key.remoteJid;

  if (yaRecibioBienvenida(numero)) return;

  registrarBienvenida(numero);

  const texto = `
🌟 *¡Bienvenido al* 𝘽𝙤𝙩 𝙄𝙣𝙩𝙚𝙡𝙞𝙜𝙚𝙣𝙩𝙚 *de Consultas!* 🌟

Este sistema te permite acceder a información *verificada*, de forma rápida y *automática*.

🔍 *Consultas disponibles:*
• DNI ➤ Datos, domicilio, vehículos, laboral, familiares  
• CBU/CVU ➤ Titular y banco  
• Celular ➤ Operadora , titulares (full datos) y tipo  
• Patente ➤ Titular, vehículo, deudas, inhibiciones , informes policial  
• Vacunas ➤ Registradas por DNI  
• PDF (Veraz/Nosis) ➤ Análisis automático
• Escribe /me para saber el estado de tu membresia

💳 *Membresía*: Solo $15.000/mes – consultas ilimitadas, soporte y acceso completo  

🎁 *¡Primera búsqueda GRATIS!*

📲 Consultá al *3813885182* para activar tu membresía y usar todo el potencial del sistema.

#BOTINTELIGENTE #CONSULTAS #AUTOMATIZACION
`;

  try {
    // Leer la imagen como Buffer
    const buffer = fs.readFileSync(rutaImagen);
    const mimetype = mime.lookup(rutaImagen);

    // Enviar mensaje con imagen
    await sock.sendMessage(from, {
      image: buffer,          // Usar el buffer directamente
      mimetype: mimetype,     // Tipo MIME detectado de la imagen
      caption: texto.trim(),  // Texto con bienvenida
    });
  } catch (error) {
    console.error('Error al enviar el mensaje de bienvenida con imagen:', error);
  }
}

module.exports = { enviarBienvenida };

