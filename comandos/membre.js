/* eslint-disable no-console */
const { Admin } = require('../models/Admin');
const { Membresia } = require('../models');
const { normalizarNumero, agregarMembresia, tiempoRestante, verificarMembresia } = require('../membresia');

/* ============================
 * Configuración base
 * ============================ */
const DUEÑOS = [
  (process.env.OWNER_NUMBER || '5493813885182').replace(/\D/g, '')
];
const CONTACTO_DUEÑO = process.env.OWNER_CONTACT || '3813885182';

/* ============================
 * Boot inicial: asegurar dueños
 * ============================ */
(async () => {
  try {
    for (const numero of DUEÑOS) {
      await Admin.updateOne(
        { numero },
        {
          $set: {
            numero,
            nombre: 'Dueño',
            isOwner: true,
            esDueño: true,
            permSub: true,  // Se asegura que los dueños tengan acceso ilimitado
          },
        },
        { upsert: true }
      );
      console.log(`👑 [membre] Dueño asegurado en Mongo: ${numero}`);
    }
  } catch (e) {
    console.error('❌ [membre] Error inicializando dueños en Mongo:', e);
  }
})();

/* ============================
 * Helpers comunes
 * ============================ */
function pareceTelefono(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15;
}

function pareceIdExtendido(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length >= 11 && d.length <= 20;
}

function normalizarTelefono(raw) {
  return normalizarNumero(String(raw || '').replace(/\D/g, ''));
}

function normalizarId(raw) {
  return String(raw || '').replace(/\D/g, '');
}

/* ============================
 * Helpers de permisos
 * ============================ */
async function esDueño(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  console.log(`🔍 Verificando si ${n} es dueño`);
  return !!(admin && (admin.isOwner || admin.esDueño));
}

async function esAdmin(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  console.log(`🔍 Verificando si ${n} es admin`);
  return !!admin;
}

async function puedeUsarSub(numero) {
  const n = normalizarNumero(numero);
  const admin = await Admin.findOne({ numero: n });
  console.log(`🔍 Verificando si ${n} puede usar el comando /sub`);
  return !!(admin && ((admin.isOwner || admin.esDueño) || admin.permSub));
}

/* ============================
 * Parsing flexible /sub
 * ============================ */
function parsearSub(raw) {
  const partes = raw.trim().split(/\s+/);
  if (partes.length < 2) return null;
  const tokens = partes.slice(1);

  let dias = 30;
  const ultimo = tokens[tokens.length - 1];
  if (/^\d+$/.test(ultimo)) {
    const posibleDias = parseInt(ultimo, 10);
    if (posibleDias >= 1 && posibleDias <= 60) {
      dias = posibleDias;
      tokens.pop();
    }
  }

  const numericTokens = [];
  const otherTokens = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) numericTokens.push(t);
    else otherTokens.push(t);
  }

  let numeroPrincipal = null;
  let idExtendido = null;

  if (numericTokens.length >= 2) {
    const a = numericTokens[0];
    const b = numericTokens[1];
    const aIsPhone = pareceTelefono(a);
    const bIsPhone = pareceTelefono(b);

    if (aIsPhone && !bIsPhone) {
      numeroPrincipal = normalizarTelefono(a);
      idExtendido = normalizarId(b);
    } else if (!aIsPhone && bIsPhone) {
      idExtendido = normalizarId(a);
      numeroPrincipal = normalizarTelefono(b);
    } else {
      if (a.length >= b.length) {
        idExtendido = normalizarId(a);
        numeroPrincipal = normalizarTelefono(b);
      } else {
        idExtendido = normalizarId(b);
        numeroPrincipal = normalizarTelefono(a);
      }
    }
  } else if (numericTokens.length === 1) {
    const t = numericTokens[0];
    if (pareceTelefono(t)) numeroPrincipal = normalizarTelefono(t);
    else idExtendido = normalizarId(t);
  }

  const nombre = (otherTokens.join(' ').trim()) || 'Usuario';
  if (!numeroPrincipal && !idExtendido) return null;

  if (!numeroPrincipal && idExtendido) {
    numeroPrincipal = normalizarTelefono(idExtendido);
  }
  if (!idExtendido) idExtendido = numeroPrincipal;

  return { numeroPrincipal, idExtendido, nombre, dias };
}

/* ============================
 * Parsing flexible /adm
 * ============================ */
function parsearAdm(raw) {
  const partes = raw.trim().split(/\s+/);
  if (partes.length < 2) return null;

  const tokens = partes.slice(1);
  let permSub;
  const last = tokens[tokens.length - 1];
  if (last && /^sub:(on|off)$/i.test(last)) {
    permSub = last.toLowerCase() === 'sub:on';
    tokens.pop();
  }

  const numericTokens = [];
  const otherTokens = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) numericTokens.push(t);
    else otherTokens.push(t);
  }

  let numero = null;
  let idExtendido = null;

  if (numericTokens.length >= 2) {
    const a = numericTokens[0];
    const b = numericTokens[1];
    const aIsPhone = pareceTelefono(a);
    const bIsPhone = pareceTelefono(b);

    if (aIsPhone && !bIsPhone) {
      numero = normalizarTelefono(a);
      idExtendido = normalizarId(b);
    } else if (!aIsPhone && bIsPhone) {
      idExtendido = normalizarId(a);
      numero = normalizarTelefono(b);
    } else {
      if (a.length >= b.length) {
        idExtendido = normalizarId(a);
        numero = normalizarTelefono(b);
      } else {
        idExtendido = normalizarId(b);
        numero = normalizarTelefono(a);
      }
    }
  } else if (numericTokens.length === 1) {
    const t = numericTokens[0];
    if (pareceTelefono(t)) numero = normalizarTelefono(t);
    else idExtendido = normalizarId(t);
  }

  const nombre = (otherTokens.join(' ').trim()) || 'Admin sin nombre';
  if (!numero && !idExtendido) return null;

  return { numero, idExtendido, nombre, permSub };
}

/* ============================
 * /sub
 * ============================ */
async function manejarSub(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);
  const admin = await Admin.findOne({ numero: adminN });

  console.log(`⚡ Verificando permisos de sub para ${adminN}`);
  if (!(await puedeUsarSub(adminN))) {
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo *dueños* o *admins habilitados* (permSub) pueden usar este comando.',
    });
    return true;
  }

  console.log(`✔ Permiso de sub otorgado para ${adminN}`);
  const parsed = parsearSub(texto);
  if (!parsed) {
    await sock.sendMessage(respuestaDestino, {
      text:
        '📖 *Uso del comando /sub:*\n' +
        '• /sub <id> <numero> <nombre...> <días?>\n' +
        '• /sub <numero> <nombre...> <días?>\n' +
        '• /sub <id> <nombre...> <días?>\n',
    });
    return true;
  }

  const { numeroPrincipal, idExtendido, nombre, dias } = parsed;
  console.log(`⚡ Activando membresía para ${numeroPrincipal} (${nombre})`);
  const yaTiene = await verificarMembresia(numeroPrincipal);

  await agregarMembresia(
    numeroPrincipal,
    idExtendido,
    nombre,
    dias,
    admin?.nombre || 'Admin'
  );
  const tiempo = await tiempoRestante(numeroPrincipal);

  const jidUsuario = `${numeroPrincipal}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jidUsuario, {
      text:
        `🎉 *¡Tu membresía fue activada!*\n` +
        `👤 ${nombre}\n📱 ${numeroPrincipal}\n🆔 ${idExtendido}\n` +
        `⏳ ${dias} día(s) (restan ${tiempo?.dias ?? dias}d ${tiempo?.horas ?? 0}h)\n` +
        `👑 Activada por: ${admin?.nombre || 'Admin'}\n\n` +
        `📞 Soporte: ${CONTACTO_DUEÑO}`,
    });
  } catch {}

  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Membresía registrada*\n` +
      `👤 ${nombre}\n📱 ${numeroPrincipal}\n🆔 ${idExtendido}\n⏳ ${dias}\n` +
      `👑 Vendedor: ${admin?.nombre || 'Admin'} (${adminN})`,
  });

  for (const d of DUEÑOS) {
    await sock.sendMessage(`${d}@s.whatsapp.net`, {
      text:
        `💸 *Nueva venta registrada!*\n` +
        `👤 ${nombre}\n📱 ${numeroPrincipal}\n🆔 ${idExtendido}\n` +
        `⏳ ${dias} días\n👑 Vendedor: ${admin?.nombre || 'Admin'} (${adminN})`,
    });
  }

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
  console.log(`⚡ Procesando ID para ${idNorm}`);
  await sock.sendMessage(respuestaDestino, {
    text:
      `🆔 ID normalizado: ${idNorm}\n🔗 LID/JID: ${senderJid || '-'}`,
    mentions: esGrupo && senderJid ? [senderJid] : [],
  });
  return true;
}

/* ============================
 * /adm
 * ============================ */
async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);
  console.log(`⚡ Procesando /adm para ${adminN}`);

  if (!(await esDueño(adminN))) {
    console.log(`❌ Acceso denegado, solo el dueño puede administrar.`);
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo el *dueño del bot* puede administrar administradores.',
    });
    return true;
  }

  const parsed = parsearAdm(texto);
  if (!parsed) {
    console.log(`❌ Error en el comando /adm.`);
    await sock.sendMessage(respuestaDestino, {
      text: '📖 Uso: /adm <id> <numero> <nombre...> sub:on|sub:off',
    });
    return true;
  }

  const { numero, idExtendido, nombre, permSub } = parsed;

  const filtro = numero ? { numero } : { id: idExtendido };
  const existente = await Admin.findOne(filtro);

  const setFields = { nombre };
  if (typeof permSub === 'boolean') setFields.permSub = permSub;
  if (idExtendido) setFields.id = idExtendido;
  if (numero) setFields.numero = numero;

  if (existente) {
    await Admin.updateOne({ _id: existente._id }, { $set: setFields });
  } else {
    await Admin.updateOne(filtro, { $set: setFields }, { upsert: true });
  }

  const adminFinal = await Admin.findOne(filtro);

  console.log(`✔ Admin actualizado/agregado: ${adminFinal?.nombre}`);
  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Administrador agregado/actualizado*\n` +
      `👤 ${adminFinal?.nombre || nombre}\n` +
      `📞 ${adminFinal?.numero || numero || '-'}\n` +
      `🆔 ${adminFinal?.id || idExtendido || '-'}\n` +
      `🔐 /sub: ${(typeof permSub === 'boolean' ? permSub : adminFinal?.permSub) ? 'Sí' : 'No'}`,
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
    `📊 *Tu información*\n` +
    `🆔 ${idNorm}\n🔗 ${senderJid || '-'}`;

  if (admin && (admin.isOwner || admin.esDueño)) {
    texto += `\n\n👑 Sos DUEÑO del bot.`;
  } else if (admin) {
    texto +=
      `\n\n👑 Sos ADMIN\n` +
      `👤 ${admin.nombre}\n📞 ${admin.numero}\n🆔 ${admin.id || '-'}\n` +
      `🔐 /sub: ${admin.permSub ? 'Sí' : 'No'}`;
  } else {
    const activo = await verificarMembresia(idNorm);
    if (activo) {
      const t = await tiempoRestante(idNorm);
      texto += `\n\n📆 Membresía activa\n⏳ ${t?.dias ?? '-'}d ${t?.horas ?? '-'}h`;
    } else {
      texto +=
        `\n\n🔒 Sin membresía activa.\n🆓 Tenés 1 búsqueda gratis.\n` +
        `📞 Para activar: *${CONTACTO_DUEÑO}*`;
    }
  }

  console.log(`⚡ Respondiendo información de usuario ${idNorm}`);
  await sock.sendMessage(respuestaDestino, {
    text: texto,
    mentions: esGrupo && senderJid ? [senderJid] : [],
  });
  return true;
}

/* ============================
 * /admins
 * ============================ */
async function manejarAdmins(sock, respuestaDestino) {
  const admins = await Admin.find().sort({ ventas: -1, createdAt: 1 });

  if (!admins.length) {
    console.log('❌ No hay administradores registrados.');
    await sock.sendMessage(respuestaDestino, {
      text: '📊 No hay administradores registrados.',
    });
    return;
  }

  let texto = '📊 *Lista de administradores*\n';
  admins.forEach((a, i) => {
    texto +=
      `\n*${i + 1}️⃣ ${a.nombre}*\n` +
      `📞 ${a.numero}\n🆔 ${a.id || '-'}\n` +
      `🔐 /sub: ${a.permSub ? 'on' : 'off'}\n` +
      `👑 Dueño: ${(a.isOwner || a.esDueño) ? 'Sí' : 'No'}\n` +
      `🛒 Ventas: ${a.ventas || 0}\n`;
  });

  console.log(`⚡ Listando administradores: ${admins.length} encontrados.`);
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
  esDueño,
  esAdmin,
  puedeUsarSub,
};


























