/* eslint-disable no-console */
const {
  agregarMembresia,
  tiempoRestante,
  normalizarNumero,
  verificarMembresia,
} = require('../membresia');
const Admin = require('../models/Admin');

/* ============================
 * Config base
 * ============================ */
// 👑 Dueños hardcodeados (se insertan en Mongo si no existen)
const DUEÑOS = ['5493813885182'];
// 📞 Teléfono público del dueño
const CONTACTO_DUEÑO = '3813885182';

/* ============================
 * Boot inicial: asegurar dueños
 * ============================ */
(async () => {
  try {
    for (const numero of DUEÑOS) {
      const existe = await Admin.findOne({ numero });
      if (!existe) {
        await Admin.create({ numero, nombre: 'Dueño', esDueño: true, permSub: true });
        console.log(`👑 [membre] Dueño insertado en Mongo: ${numero}`);
      }
    }
  } catch (e) {
    console.error('❌ [membre] Error inicializando dueños en Mongo:', e);
  }
})();

/* ============================
 * Helpers de permisos
 * ============================ */
async function esDueño(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  return admin?.esDueño || false;
}

async function esAdmin(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  return !!admin;
}

async function puedeUsarSub(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  return admin?.esDueño || admin?.permSub || false;
}

/* ============================
 * Parsing flexible /sub
 * ============================ */
function parsearSub(raw) {
  const partes = raw.trim().split(/\s+/);
  if (partes.length < 3) return null;

  const numeroPrincipal = normalizarNumero(partes[1]);
  let idExtendido = null;
  let dias = 30;
  let nombre = '';

  if (partes.length === 3) {
    nombre = partes[2];
  } else if (partes.length >= 4) {
    const posibleIdONombre = partes[2];
    if (/^\d{11,20}$/.test(posibleIdONombre)) {
      idExtendido = normalizarNumero(posibleIdONombre);
      const ultimo = partes[partes.length - 1];
      const posibleDias = parseInt(ultimo, 10);
      if (!isNaN(posibleDias)) {
        dias = Math.max(1, Math.min(60, posibleDias));
        nombre = partes.slice(3, partes.length - 1).join(' ').trim();
      } else {
        nombre = partes.slice(3).join(' ').trim();
      }
    } else {
      const ultimo = partes[partes.length - 1];
      const posibleDias = parseInt(ultimo, 10);
      if (!isNaN(posibleDias)) {
        dias = Math.max(1, Math.min(60, posibleDias));
        nombre = partes.slice(2, partes.length - 1).join(' ').trim();
      } else {
        nombre = partes.slice(2).join(' ').trim();
      }
    }
  }

  if (!nombre) nombre = 'Usuario';
  if (!idExtendido) idExtendido = numeroPrincipal;
  return { numeroPrincipal, idExtendido, nombre, dias };
}

/* ============================
 * /sub
 * ============================ */
async function manejarSub(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);
  const admin = await Admin.findOne({ numero: adminN });

  if (!(await puedeUsarSub(adminN))) {
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo *dueños* o *admins habilitados* (permSub) pueden usar este comando.',
    });
    return true;
  }

  const parsed = parsearSub(texto);
  if (!parsed) {
    await sock.sendMessage(respuestaDestino, {
      text:
        '📖 *Uso del comando /sub:*\n━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ /sub <número> <id?> <nombre> <días?>\n\n' +
        '📌 Ejemplos:\n' +
        '/sub 3816611789 47215263391931 JuanPerez 30\n' +
        '/sub 3816611789 Juan Perez 30\n' +
        '/sub 3816611789 47215263391931 Juan',
    });
    return true;
  }

  const { numeroPrincipal, idExtendido, nombre, dias } = parsed;
  const yaTiene = await verificarMembresia(numeroPrincipal);

  await agregarMembresia(numeroPrincipal, idExtendido, nombre, dias, admin?.nombre || 'Admin');
  const tiempo = await tiempoRestante(numeroPrincipal);

  // Notificar usuario
  const jidUsuario = `${numeroPrincipal}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jidUsuario, {
      text:
        `🎉 *¡Tu membresía fue activada!*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Nombre: ${nombre}\n📱 Número: ${numeroPrincipal}\n🆔 ID: ${idExtendido}\n` +
        `⏳ Duración: ${dias} día(s) (restan ${tiempo?.dias ?? dias}d ${tiempo?.horas ?? 0}h)\n` +
        `👑 Activada por: ${admin?.nombre || 'Admin'}\n\n` +
        `📞 *Soporte / Renovaciones:* ${CONTACTO_DUEÑO}`,
    });
  } catch (e) {
    console.warn(`⚠️ [/sub] No se pudo notificar al usuario ${numeroPrincipal}:`, e.message);
  }

  // Resumen al admin
  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Membresía registrada*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Cliente: ${nombre}\n📱 Número: ${numeroPrincipal}\n🆔 ID/LID: ${idExtendido}\n⏳ Días: ${dias}\n` +
      `👑 Vendedor: ${admin?.nombre || 'Admin'} (${adminN})`,
  });

  // Contabilizar venta
  if (!yaTiene) {
    await Admin.updateOne({ numero: adminN }, { $inc: { ventas: 1 } });
  }
  return true;
}

/* ============================
 * /id
 * ============================ */
async function manejarId(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const idNorm = normalizarNumero(numero);
  await sock.sendMessage(respuestaDestino, {
    text:
      `🆔 *Tu ID normalizado:* ${idNorm}\n🔗 *Tu LID/JID:* ${senderJid || '-'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n💡 Con cualquiera de estos IDs podemos vincular tu membresía en /sub.`,
    mentions: esGrupo && senderJid ? [senderJid] : [],
  });
  return true;
}

/* ============================
 * /adm
 * ============================ */
async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);

  if (!(await esDueño(adminN))) {
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo el *dueño del bot* puede administrar administradores.',
    });
    return true;
  }

  const partes = texto.trim().split(/\s+/);
  if (partes.length < 3) {
    await sock.sendMessage(respuestaDestino, {
      text:
        '📖 *Uso del comando /adm:*\n━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ /adm <número> <id?> <nombre...> [sub:on|sub:off]',
    });
    return true;
  }

  const nuevoAdmin = normalizarNumero(partes[1]);
  let idExtendido = null;
  let idxNombreStart = 2;

  if (/^\d{11,20}$/.test(partes[2])) {
    idExtendido = normalizarNumero(partes[2]);
    idxNombreStart = 3;
  }

  let permSub;
  const ultima = partes[partes.length - 1].toLowerCase();
  if (ultima === 'sub:on' || ultima === 'sub:off') {
    permSub = ultima === 'sub:on';
  }

  const nombreTokens = partes.slice(idxNombreStart, permSub !== undefined ? partes.length - 1 : partes.length);
  const nombre = nombreTokens.join(' ').trim() || 'Admin sin nombre';

  await Admin.updateOne(
    { numero: nuevoAdmin },
    { $set: { nombre, id: idExtendido, ...(permSub !== undefined ? { permSub } : {}) } },
    { upsert: true }
  );

  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Administrador agregado/actualizado*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📞 Número: ${nuevoAdmin}\n🆔 ID: ${idExtendido || '-'}\n👤 Nombre: ${nombre}\n` +
      `🔐 Puede usar /sub: ${permSub ? 'Sí' : 'No'}`,
  });
  return true;
}

/* ============================
 * /me
 * ============================ */
async function manejarMe(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const idNorm = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: idNorm });

  let texto =
    `📊 *Tu información*\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ID normalizado: ${idNorm}\n🔗 LID/JID: ${senderJid || '-'}`;

  if (admin?.esDueño) {
    texto += `\n\n👑 *Sos DUEÑO del bot.*\n✅ Acceso total.`;
  } else if (admin) {
    texto +=
      `\n\n👑 *Sos ADMINISTRADOR*\n👤 Nombre: ${admin.nombre}\n🆔 ID: ${admin.id || '-'}\n` +
      `🔐 /sub habilitado: ${admin.permSub ? 'Sí' : 'No'}`;
  } else {
    const activo = await verificarMembresia(idNorm);
    if (activo) {
      const t = await tiempoRestante(idNorm);
      texto += `\n\n📆 *Membresía activa*\n⏳ Restante: ${t?.dias ?? '-'} día(s), ${t?.horas ?? '-'} hora(s).`;
    } else {
      texto +=
        `\n\n🔒 *No tenés membresía activa.*\n🆓 Tenés 1 búsqueda gratis.\n` +
        `📞 Para activar tu membresía hablá con el dueño: *${CONTACTO_DUEÑO}*`;
    }
  }

  await sock.sendMessage(respuestaDestino, { text: texto, mentions: esGrupo && senderJid ? [senderJid] : [] });
  return true;
}

/* ============================
 * /admins (ranking ventas)
 * ============================ */
async function manejarAdmins(sock, respuestaDestino) {
  const admins = await Admin.find({ ventas: { $gt: 0 } }).sort({ ventas: -1 });
  if (!admins.length) {
    await sock.sendMessage(respuestaDestino, { text: '📊 *No hay ventas registradas por ningún administrador.*' });
    return;
  }

  let texto = '📊 *Ranking de administradores por ventas*\n━━━━━━━━━━━━━━━━━━━━━━━\n';
  admins.forEach((a, i) => {
    texto +=
      `*${i + 1}️⃣ ${a.nombre}*\n📞 Número: ${a.numero}\n🆔 ID: ${a.id || '-'}\n` +
      `🛒 Ventas: ${a.ventas}\n💸 Total: $${(a.ventas * 15000).toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
  });

  await sock.sendMessage(respuestaDestino, { text: texto.trim() });
}

/* ============================
 * Exports
 * ============================ */
module.exports = {
  manejarSub,
  manejarMe,
  manejarId,
  manejarAdm,
  manejarAdmins,
};
























