const fs = require('fs');
const path = require('path');
const {
  agregarMembresia,
  actualizarIdGrupo,
  tiempoRestante,
  normalizarNumero,
  verificarMembresia
} = require('../membresia');

// 📂 Rutas de archivos locales
const adminFile = path.join(__dirname, '../admines.json');
const adminDetalleFile = path.join(__dirname, '../admines_detalle.json');
const ventasPath = path.join(__dirname, '../ventas_admin.json');

// 👑 Listas de admins y dueños
let adminList = ['5493813885182'];
const dueños = ['5493813885182'];
let adminDetalle = {};

// 📥 Cargar admins si existen archivos
if (fs.existsSync(adminFile)) {
  try {
    adminList = JSON.parse(fs.readFileSync(adminFile));
  } catch (err) {
    console.error('⚠️ Error al leer admines.json:', err);
  }
}

if (fs.existsSync(adminDetalleFile)) {
  try {
    adminDetalle = JSON.parse(fs.readFileSync(adminDetalleFile));
  } catch (err) {
    console.error('⚠️ Error al leer admines_detalle.json:', err);
  }
}

// 💾 Guardar admins
function guardarAdmins() {
  try {
    fs.writeFileSync(adminFile, JSON.stringify(adminList, null, 2));
    fs.writeFileSync(adminDetalleFile, JSON.stringify(adminDetalle, null, 2));
  } catch (err) {
    console.error('❌ Error al guardar admines:', err);
  }
}

// 📥 Cargar ventas
function cargarVentas() {
  if (!fs.existsSync(ventasPath)) fs.writeFileSync(ventasPath, '{}');
  try {
    return JSON.parse(fs.readFileSync(ventasPath));
  } catch {
    return {};
  }
}

// 💾 Guardar ventas
function guardarVentas(ventas) {
  fs.writeFileSync(ventasPath, JSON.stringify(ventas, null, 2));
}

// =============================
// 📌 Manejo de /sub
// =============================
async function manejarSub(sock, numeroAdmin, texto, respuestaDestino) {
  const adminNormalizado = normalizarNumero(numeroAdmin);

  if (!adminList.includes(adminNormalizado)) {
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\n❌ No estás autorizado para usar este comando.'
    });
    return true;
  }

  const partes = texto.trim().split(/\s+/);
  if (partes.length < 3) {
    await sock.sendMessage(respuestaDestino, {
      text: `📖 *Uso del comando /sub:*\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ /sub <número> <id?> <nombre> <días?>\n\n📌 Ejemplo:\n/sub 3812345678 47215263391931 Juan 30`
    });
    return true;
  }

  const numeroPrincipal = normalizarNumero(partes[1]);
  let idExtendido = null;
  let nombre = '';
  let dias = 30;

  // Caso: /sub numero lid nombre dias
  if (/^\d{11,15}$/.test(partes[2])) {
    idExtendido = normalizarNumero(partes[2]);
    nombre = partes.slice(3, partes.length - 1).join(' ');
    dias = parseInt(partes[partes.length - 1]) || 30;
  } else {
    // Caso: /sub numero nombre dias
    nombre = partes.slice(2, partes.length - 1).join(' ');
    dias = parseInt(partes[partes.length - 1]) || 30;
  }

  if (!nombre) nombre = 'Usuario';
  if (dias > 60) dias = 60;

  const adminInfo = adminDetalle[adminNormalizado] || {
    nombre: 'Admin desconocido',
    id: '-'
  };

  const yaTiene = await verificarMembresia(numeroPrincipal);

  await agregarMembresia(
    numeroPrincipal,
    idExtendido || numeroPrincipal,
    nombre,
    dias,
    adminInfo.nombre
  );

  const tiempo = await tiempoRestante(numeroPrincipal);

  // 📩 Notificar al usuario
  const jidUsuario = `${numeroPrincipal}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jidUsuario, {
      text: `🎉 *¡Tu membresía fue activada!*\n━━━━━━━━━━━━━━━━━━━━━━━\n🔓 Acceso *ilimitado* durante *${tiempo.dias} día(s)* y *${tiempo.horas} hora(s)*.\n👤 *Activada por:* ${adminInfo.nombre}\n📖 Comandos útiles:\n• /me → Ver tu membresía\n• /menu → Ver funciones del bot\n━━━━━━━━━━━━━━━━━━━━━━━\n📞 *Consultas:* 3813885182`
    });
  } catch (e) {
    console.warn(`⚠️ No se pudo enviar mensaje a ${numeroPrincipal}:`, e.message);
  }

  // 📩 Notificar al admin que lo ejecutó
  await sock.sendMessage(respuestaDestino, {
    text: `💳 *Datos para cobrar al cliente*\n━━━━━━━━━━━━━━━━━━━━━━━\n👤 Cliente: ${nombre}\n📱 Número: ${numeroPrincipal}\n🆔 ID extendido: ${idExtendido || '-'}\n⏳ Días: ${dias}\n💸 Monto sugerido: $15.000\n━━━━━━━━━━━━━━━━━━━━━━━\n👑 Vendedor: ${adminInfo.nombre}`
  });

  // 📩 Notificar a los dueños
  for (const dueño of dueños) {
    await sock.sendMessage(`${dueño}@s.whatsapp.net`, {
      text: `🔔 *Nueva membresía registrada*\n━━━━━━━━━━━━━━━━━━━━━━━\n👑 Admin: ${adminInfo.nombre}\n📞 Número: ${adminNormalizado}\n👤 Cliente: ${numeroPrincipal} - ${nombre}\n🆔 ID: ${idExtendido || '-'}\n⏳ Días: ${dias}`
    });
  }

  // 📊 Guardar venta
  if (!yaTiene) {
    const ventas = cargarVentas();
    ventas[adminNormalizado] = (ventas[adminNormalizado] || 0) + 1;
    guardarVentas(ventas);
  }

  return true;
}

// =============================
// 📌 Manejo de /id
// =============================
async function manejarId(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const id = normalizarNumero(numero);
  await sock.sendMessage(respuestaDestino, {
    text: `🆔 *Tu ID es:* ${id}\n━━━━━━━━━━━━━━━━━━━━━━━\n📌 JID completo: ${senderJid}\n💡 Usá este ID o tu JID extendido para vincular membresía.`,
    mentions: esGrupo ? [senderJid] : []
  });
  return true;
}

// =============================
// 📌 Manejo de /adm
// =============================
async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
  const adminNormalizado = normalizarNumero(numeroAdmin);
  if (!dueños.includes(adminNormalizado)) {
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\n❌ Solo el *dueño del bot* puede agregar administradores.'
    });
    return true;
  }

  const partes = texto.trim().split(/\s+/);
  if (partes.length < 3) {
    await sock.sendMessage(respuestaDestino, {
      text: `📖 *Uso del comando /adm:*\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ /adm <número> <id?> <nombre>\n\n📌 Ejemplo:\n/adm 3812345678 47215263391931 Juan`
    });
    return true;
  }

  const nuevoAdmin = normalizarNumero(partes[1]);
  let idExtendido = null;
  let nombre = 'Admin sin nombre';

  if (/^\d{11,15}$/.test(partes[2])) {
    idExtendido = normalizarNumero(partes[2]);
    nombre = partes.slice(3).join(' ').trim();
  } else {
    nombre = partes.slice(2).join(' ').trim();
  }

  if (!nombre) nombre = 'Admin sin nombre';

  if (adminList.includes(nuevoAdmin)) {
    const infoAnterior = adminDetalle[nuevoAdmin] || {};
    adminDetalle[nuevoAdmin] = {
      ...infoAnterior,
      nombre,
      id: idExtendido || infoAnterior.id || null
    };
  } else {
    adminList.push(nuevoAdmin);
    adminDetalle[nuevoAdmin] = { nombre, id: idExtendido || null };
  }
  guardarAdmins();

  await sock.sendMessage(respuestaDestino, {
    text: `✅ *Administrador agregado/actualizado*\n━━━━━━━━━━━━━━━━━━━━━━━\n📞 Número: ${nuevoAdmin}\n🆔 ID: ${idExtendido || '-'}\n👤 Nombre: ${nombre}`
  });

  return true;
}

// =============================
// 📌 Manejo de /me
// =============================
async function manejarMe(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const id = normalizarNumero(numero);
  const esAdmin = adminList.includes(id);
  const esDueño = dueños.includes(id);

  let info = adminDetalle[id];
  if (!info) {
    for (const adminNum in adminDetalle) {
      if (adminDetalle[adminNum].id === id) {
        info = adminDetalle[adminNum];
        break;
      }
    }
  }

  let texto = `📊 *Información de usuario*\n━━━━━━━━━━━━━━━━━━━━━━━\n🔑 JID: ${senderJid}\n📱 Normalizado: ${id}\n`;

  if (esDueño) {
    texto += '\n👑 *Sos dueño del bot.*\n✅ Acceso ilimitado.';
  } else if (esAdmin || info) {
    texto += `\n👑 *Sos administrador del bot*\n👤 Nombre: ${info?.nombre || 'N/A'}\n🆔 ID: ${info?.id || '-'}\n✅ Acceso completo.`;
  } else {
    const activo = await verificarMembresia(id);
    const tiempo = await tiempoRestante(id);
    if (activo) {
      texto += `\n📆 *Membresía activa*\n⏳ Restante: ${tiempo.dias} día(s), ${tiempo.horas} hora(s).`;
    } else {
      texto += `\n🔒 *No tenés membresía activa.*\n💡 Usá tu búsqueda gratuita o contactá a un admin.`;
    }
  }

  await sock.sendMessage(respuestaDestino, { text: texto, mentions: esGrupo ? [senderJid] : [] });
  return true;
}

// =============================
// 📌 Manejo de /admins
// =============================
async function manejarAdmins(sock, respuestaDestino) {
  const ventas = cargarVentas();

  const ranking = Object.entries(ventas)
    .map(([numero, cantidad]) => {
      const detalle = adminDetalle[numero] || {};
      return {
        nombre: detalle.nombre || 'Sin nombre',
        numero,
        id: detalle.id || '-',
        ventas: cantidad,
        monto: cantidad * 15000
      };
    })
    .sort((a, b) => b.ventas - a.ventas);

  if (ranking.length === 0) {
    await sock.sendMessage(respuestaDestino, {
      text: '📊 *No hay ventas registradas por ningún administrador.*'
    });
    return;
  }

  let texto = '📊 *Ranking de administradores*\n━━━━━━━━━━━━━━━━━━━━━━━\n';
  ranking.forEach((admin, i) => {
    texto += `*${i + 1}️⃣ ${admin.nombre}*\n📞 Número: ${admin.numero}\n🆔 ID: ${admin.id}\n🛒 Ventas: ${admin.ventas}\n💸 Total: $${admin.monto.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  });

  await sock.sendMessage(respuestaDestino, { text: texto.trim() });
}

module.exports = {
  manejarSub,
  manejarMe,
  manejarId,
  manejarAdm,
  manejarAdmins,
  adminList
};























