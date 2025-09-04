// comandos/membre.js
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const {
  agregarMembresia,
  actualizarIdGrupo,
  tiempoRestante,
  normalizarNumero,
  verificarMembresia,
} = require('../membresia');

/* ============================
 *  Rutas de archivos locales
 * ============================ */
const adminFile = path.join(__dirname, '../admines.json');
const adminDetalleFile = path.join(__dirname, '../admines_detalle.json');
const ventasPath = path.join(__dirname, '../ventas_admin.json');

/* ============================
 *  Config / Listas base
 * ============================ */
// 👑 Dueños del bot (pueden TODO)
const dueños = ['5493813885182']; // ← agregá más si corresponde
// 📞 Teléfono público del dueño para ventas (texto informativo al usuario)
const CONTACTO_DUEÑO = '3813885182';

// 👮 Lista de administradores (solo informativa; permisos finos en adminDetalle)
let adminList = [...dueños]; // por defecto, los dueños también son admins
let adminDetalle = {}; // { [numero]: { nombre, id, permSub, ... } }

/* ============================
 *  Carga persistencia local
 * ============================ */
(function bootLoad() {
  try {
    if (fs.existsSync(adminFile)) {
      adminList = JSON.parse(fs.readFileSync(adminFile));
      console.log('🗂️ [membre] admines.json cargado:', adminList);
    } else {
      console.log('ℹ️ [membre] admines.json no existe, se usará default:', adminList);
    }
  } catch (err) {
    console.error('⚠️ [membre] Error al leer admines.json:', err);
  }

  try {
    if (fs.existsSync(adminDetalleFile)) {
      adminDetalle = JSON.parse(fs.readFileSync(adminDetalleFile));
      console.log('🗂️ [membre] admines_detalle.json cargado (keys):', Object.keys(adminDetalle).length);
    } else {
      console.log('ℹ️ [membre] admines_detalle.json no existe, se arranca vacío.');
    }
  } catch (err) {
    console.error('⚠️ [membre] Error al leer admines_detalle.json:', err);
  }

  try {
    if (!fs.existsSync(ventasPath)) {
      fs.writeFileSync(ventasPath, '{}');
      console.log('🆕 [membre] ventas_admin.json creado.');
    }
  } catch (err) {
    console.error('⚠️ [membre] Error preparando ventas_admin.json:', err);
  }
})();

/* ============================
 *  Helpers de persistencia
 * ============================ */
function guardarAdmins() {
  try {
    fs.writeFileSync(adminFile, JSON.stringify(adminList, null, 2));
    fs.writeFileSync(adminDetalleFile, JSON.stringify(adminDetalle, null, 2));
    console.log('💾 [membre] Admins y adminDetalle guardados.');
  } catch (err) {
    console.error('❌ [membre] Error al guardar admines:', err);
  }
}

function cargarVentas() {
  try {
    const data = JSON.parse(fs.readFileSync(ventasPath));
    return data || {};
  } catch (e) {
    console.warn('⚠️ [membre] No pude leer ventas_admin.json, devuelvo {}:', e.message);
    return {};
  }
}

function guardarVentas(ventas) {
  try {
    fs.writeFileSync(ventasPath, JSON.stringify(ventas, null, 2));
    console.log('💾 [membre] Ventas guardadas.');
  } catch (e) {
    console.error('❌ [membre] Error guardando ventas:', e);
  }
}

/* ============================
 *  Helpers de permisos
 * ============================ */
function esDueño(numero) {
  const n = normalizarNumero(numero);
  return dueños.includes(n);
}

function esAdmin(numero) {
  const n = normalizarNumero(numero);
  return adminList.includes(n);
}

/**
 * Determina si puede usar /sub:
 *  - dueños SIEMPRE pueden
 *  - admins solo si tienen permSub === true en adminDetalle
 */
function puedeUsarSub(numero) {
  const n = normalizarNumero(numero);
  if (esDueño(n)) return true;
  if (!esAdmin(n)) return false;

  const det = adminDetalle[n];
  const habilitado = !!(det && det.permSub === true);
  if (!habilitado) {
    console.warn(`🚫 [membre] Admin ${n} intentó /sub sin permiso especial (permSub=false).`);
  }
  return habilitado;
}

/* ============================
 *  Parsing flexible /sub
 *  Soporta:
 *    /sub <numero> <lid?> <nombre...> <dias?>
 *  Ejemplos:
 *    /sub 3816611789 47215263391931 JuanPerez 30
 *    /sub 3816611789 Juan Perez 30
 *    /sub 3816611789 4721526... Juan  (30 por default)
 * ============================ */
function parsearSub(raw) {
  const partes = raw.trim().split(/\s+/);
  // partes[0] = /sub
  if (partes.length < 3) {
    return null;
  }

  const numeroPrincipal = normalizarNumero(partes[1]);
  let idExtendido = null;
  let dias = 30;
  let nombre = '';

  if (partes.length === 3) {
    // /sub numero nombre
    nombre = partes[2];
  } else if (partes.length >= 4) {
    const posibleIdONombre = partes[2];

    // Heurística: si parece ID/LID/numero largo, lo tomamos como idExtendido
    if (/^\d{11,20}$/.test(posibleIdONombre)) {
      idExtendido = normalizarNumero(posibleIdONombre);
      // el penúltimo podría ser nombre y el último días
      const ultimo = partes[partes.length - 1];
      const posibleDias = parseInt(ultimo, 10);
      if (!isNaN(posibleDias)) {
        dias = Math.max(1, Math.min(60, posibleDias));
        nombre = partes.slice(3, partes.length - 1).join(' ').trim();
      } else {
        nombre = partes.slice(3).join(' ').trim();
      }
    } else {
      // no hay id extendido, es nombre directo
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
 *  /sub
 * ============================ */
async function manejarSub(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);
  console.log(`📥 [/sub] Pedido por: ${adminN} | Texto: "${texto}"`);

  if (!puedeUsarSub(adminN)) {
    const detalle = adminDetalle[adminN];
    const esAdminFlag = esAdmin(adminN);
    console.warn(`⛔ [/sub] Denegado a ${adminN}. esDueño=${esDueño(adminN)} esAdmin=${esAdminFlag} permSub=${detalle?.permSub}`);
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo *dueños* o *admins habilitados* (permSub) pueden usar este comando.',
    });
    return true;
  }

  const parsed = parsearSub(texto);
  if (!parsed) {
    console.log('ℹ️ [/sub] Uso incorrecto.');
    await sock.sendMessage(respuestaDestino, {
      text:
        '📖 *Uso del comando /sub:*\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ /sub <número> <id?> <nombre> <días?>\n\n' +
        '📌 Ejemplos:\n' +
        '/sub 3816611789 47215263391931 JuanPerez 30\n' +
        '/sub 3816611789 Juan Perez 30\n' +
        '/sub 3816611789 47215263391931 Juan\n',
    });
    return true;
  }

  const { numeroPrincipal, idExtendido, nombre, dias } = parsed;
  const adminInfo = adminDetalle[adminN] || { nombre: 'Admin', id: '-', permSub: true };

  console.log(
    `✅ [/sub] Alta/renovación → cliente=${numeroPrincipal} | idExt=${idExtendido} | nombre="${nombre}" | dias=${dias} | por=${adminN} (${adminInfo.nombre})`
  );

  const yaTiene = await verificarMembresia(numeroPrincipal);
  await agregarMembresia(numeroPrincipal, idExtendido, nombre, dias, adminInfo.nombre);
  const tiempo = await tiempoRestante(numeroPrincipal);

  // Notificar al usuario final
  const jidUsuario = `${numeroPrincipal}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jidUsuario, {
      text:
        `🎉 *¡Tu membresía fue activada!*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Nombre:* ${nombre}\n` +
        `📱 *Número:* ${numeroPrincipal}\n` +
        `🆔 *ID vinculado:* ${idExtendido}\n` +
        `⏳ *Duración:* ${dias} día(s) (restan ${tiempo?.dias ?? dias}d ${tiempo?.horas ?? 0}h)\n` +
        `👑 *Activada por:* ${adminInfo.nombre}\n\n` +
        `📖 Comandos útiles:\n` +
        `• /me → ver tu estado\n` +
        `• /id → ver tu ID / JID\n` +
        `• /menu → funciones del bot\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *Soporte / Renovaciones:* ${CONTACTO_DUEÑO}`,
    });
    console.log(`📩 [/sub] Mensaje de alta enviado a usuario ${numeroPrincipal}`);
  } catch (e) {
    console.warn(`⚠️ [/sub] No se pudo notificar al usuario ${numeroPrincipal}:`, e.message);
  }

  // Resumen al admin que ejecutó
  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Membresía registrada*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Cliente: ${nombre}\n` +
      `📱 Número: ${numeroPrincipal}\n` +
      `🆔 ID/LID: ${idExtendido}\n` +
      `⏳ Días: ${dias}\n\n` +
      `💳 *Datos de cobro (sugerido):*\n` +
      `CBU: 0000003100049327493120\n` +
      `Alias: leviatandox\n` +
      `Titular: Carlos Ruben Collante\n` +
      `Monto: $15.000\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👑 Vendedor: ${adminInfo.nombre} (${adminN})`,
  });

  // Notificar a todos los dueños
  for (const dueño of dueños) {
    try {
      await sock.sendMessage(`${dueño}@s.whatsapp.net`, {
        text:
          `🔔 *Nueva membresía registrada*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👑 Admin: ${adminInfo.nombre} (${adminN})\n` +
          `👤 Cliente: ${nombre}\n` +
          `📱 Número: ${numeroPrincipal}\n` +
          `🆔 ID/LID: ${idExtendido}\n` +
          `⏳ Días: ${dias}`,
      });
    } catch (e) {
      console.warn(`⚠️ [/sub] No se pudo notificar al dueño ${dueño}:`, e.message);
    }
  }

  // Contabilizar venta solo si no la tenía
  if (!yaTiene) {
    const ventas = cargarVentas();
    ventas[adminN] = (ventas[adminN] || 0) + 1;
    guardarVentas(ventas);
    console.log(`📈 [/sub] Venta registrada para ${adminN}. Total: ${ventas[adminN]}`);
  } else {
    console.log('ℹ️ [/sub] El cliente ya tenía membresía activa; no suma venta.');
  }

  return true;
}

/* ============================
 *  /id
 * ============================ */
async function manejarId(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const idNorm = normalizarNumero(numero);
  const lidOjid = String(senderJid || '').replace('@s.whatsapp.net', '').replace('@lid', '').trim();

  console.log(`📥 [/id] Pedido por ${idNorm} | senderJid=${senderJid}`);

  await sock.sendMessage(respuestaDestino, {
    text:
      `🆔 *Tu ID normalizado:* ${idNorm}\n` +
      `🔗 *Tu LID/JID:* ${senderJid || '-'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 Con cualquiera de estos IDs podemos vincular tu membresía en /sub.`,
    mentions: esGrupo && senderJid ? [senderJid] : [],
  });
  return true;
}

/* ============================
 *  /adm
 *  Solo dueños pueden crear/editar admins
 *  Si querés habilitar /sub a un admin: /adm <num> <id?> <nombre> sub:on
 *  sub:on → permSub=true | sub:off → permSub=false
 * ============================ */
async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
  const adminN = normalizarNumero(numeroAdmin);
  console.log(`📥 [/adm] Pedido de ${adminN} | "${texto}"`);

  if (!esDueño(adminN)) {
    console.warn(`⛔ [/adm] Denegado a ${adminN} (no es dueño).`);
    await sock.sendMessage(respuestaDestino, {
      text: '⛔ *Acceso denegado*\n\nSolo el *dueño del bot* puede administrar administradores.',
    });
    return true;
  }

  const partes = texto.trim().split(/\s+/);
  if (partes.length < 3) {
    await sock.sendMessage(respuestaDestino, {
      text:
        '📖 *Uso del comando /adm:*\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '✅ /adm <número> <id?> <nombre...> [sub:on|sub:off]\n\n' +
        '📌 Ejemplos:\n' +
        '/adm 3812345678 47215263391931 Juan Perez sub:on\n' +
        '/adm 3812345678 Juan Perez sub:off',
    });
    return true;
  }

  const nuevoAdmin = normalizarNumero(partes[1]);

  // Detectar si hay ID extendido
  let idExtendido = null;
  let idxNombreStart = 2;
  if (/^\d{11,20}$/.test(partes[2])) {
    idExtendido = normalizarNumero(partes[2]);
    idxNombreStart = 3;
  }

  // Detectar flag sub:on/off al final
  let permSub = undefined; // undefined = no cambia
  const ultima = partes[partes.length - 1].toLowerCase();
  if (ultima === 'sub:on' || ultima === 'sub:off') {
    permSub = ultima === 'sub:on';
  }

  // Nombre:
  const nombreTokens = partes.slice(idxNombreStart, permSub !== undefined ? partes.length - 1 : partes.length);
  let nombre = nombreTokens.join(' ').trim() || 'Admin sin nombre';

  const existe = adminList.includes(nuevoAdmin);
  const anterior = adminDetalle[nuevoAdmin] || {};

  adminDetalle[nuevoAdmin] = {
    ...anterior,
    nombre: nombre || anterior.nombre || 'Admin sin nombre',
    id: idExtendido || anterior.id || null,
    ...(permSub !== undefined ? { permSub } : {}),
  };

  if (!existe) adminList.push(nuevoAdmin);
  guardarAdmins();

  console.log(
    `✅ [/adm] Admin ${existe ? 'actualizado' : 'creado'}: ${nuevoAdmin} | nombre="${adminDetalle[nuevoAdmin].nombre}" | id=${adminDetalle[nuevoAdmin].id} | permSub=${adminDetalle[nuevoAdmin].permSub}`
  );

  await sock.sendMessage(respuestaDestino, {
    text:
      `✅ *Administrador ${existe ? 'actualizado' : 'agregado'}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📞 Número: ${nuevoAdmin}\n` +
      `🆔 ID: ${adminDetalle[nuevoAdmin].id || '-'}\n` +
      `👤 Nombre: ${adminDetalle[nuevoAdmin].nombre}\n` +
      `🔐 Puede usar /sub: ${adminDetalle[nuevoAdmin].permSub ? 'Sí' : 'No'}`,
  });

  // Avisar al admin afectado (si es alta/edición y existe)
  try {
    await sock.sendMessage(`${nuevoAdmin}@s.whatsapp.net`, {
      text:
        `👑 *Sos administrador del bot*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 Nombre: ${adminDetalle[nuevoAdmin].nombre}\n` +
        `🆔 ID: ${adminDetalle[nuevoAdmin].id || '-'}\n` +
        `🔐 /sub habilitado: ${adminDetalle[nuevoAdmin].permSub ? 'Sí' : 'No'}`,
    });
  } catch (e) {
    console.warn(`⚠️ [/adm] No se pudo notificar al admin ${nuevoAdmin}:`, e.message);
  }

  return true;
}

/* ============================
 *  /me
 * ============================ */
async function manejarMe(sock, numero, respuestaDestino, senderJid, esGrupo) {
  const idNorm = normalizarNumero(numero);
  const infoAdmin = adminDetalle[idNorm];
  const soyDueño = esDueño(idNorm);
  const soyAdmin = esAdmin(idNorm);

  // Intento de obtener info por ID extendido guardado
  let infoPorId = null;
  if (!infoAdmin) {
    for (const key in adminDetalle) {
      if ((adminDetalle[key]?.id || '') === idNorm) {
        infoPorId = adminDetalle[key];
        break;
      }
    }
  }

  console.log(`📥 [/me] Pedido por ${idNorm} | esDueño=${soyDueño} esAdmin=${soyAdmin} senderJid=${senderJid}`);

  let texto =
    `📊 *Tu información*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ID normalizado: ${idNorm}\n` +
    `🔗 LID/JID: ${senderJid || '-'}\n`;

  if (soyDueño) {
    texto += `\n👑 *Sos DUEÑO del bot.*\n✅ Acceso total.`;
  } else if (soyAdmin || infoPorId) {
    const i = infoAdmin || infoPorId || {};
    texto +=
      `\n👑 *Sos ADMINISTRADOR*\n` +
      `👤 Nombre: ${i.nombre || 'N/A'}\n` +
      `🆔 ID admin: ${i.id || '-'}\n` +
      `🔐 /sub habilitado: ${i.permSub ? 'Sí' : 'No'}`;
  } else {
    const activo = await verificarMembresia(idNorm);
    if (activo) {
      const t = await tiempoRestante(idNorm);
      texto +=
        `\n📆 *Membresía activa*\n` +
        `⏳ Restante: ${t?.dias ?? '-'} día(s), ${t?.horas ?? '-'} hora(s).`;
    } else {
      texto +=
        `\n🔒 *No tenés membresía activa.*\n` +
        `🆓 Tenés 1 búsqueda gratis.\n` +
        `📞 Si querés activar una membresía, hablá con el dueño: *${CONTACTO_DUEÑO}*`;
    }
  }

  await sock.sendMessage(respuestaDestino, { text: texto, mentions: esGrupo && senderJid ? [senderJid] : [] });
  return true;
}

/* ============================
 *  /admins (ranking de ventas)
 * ============================ */
async function manejarAdmins(sock, respuestaDestino) {
  console.log('📥 [/admins] Pedido de ranking de ventas');

  const ventas = cargarVentas();
  const ranking = Object.entries(ventas)
    .map(([numero, cantidad]) => {
      const detalle = adminDetalle[numero] || {};
      return {
        nombre: detalle.nombre || 'Sin nombre',
        numero,
        id: detalle.id || '-',
        ventas: cantidad,
        monto: cantidad * 15000,
      };
    })
    .sort((a, b) => b.ventas - a.ventas);

  if (ranking.length === 0) {
    await sock.sendMessage(respuestaDestino, {
      text: '📊 *No hay ventas registradas por ningún administrador.*',
    });
    return;
  }

  let texto = '📊 *Ranking de administradores por ventas*\n━━━━━━━━━━━━━━━━━━━━━━━\n';
  ranking.forEach((a, i) => {
    texto +=
      `*${i + 1}️⃣ ${a.nombre}*\n` +
      `📞 Número: ${a.numero}\n` +
      `🆔 ID: ${a.id}\n` +
      `🛒 Ventas: ${a.ventas}\n` +
      `💸 Total: $${a.monto.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  });

  await sock.sendMessage(respuestaDestino, { text: texto.trim() });
}

/* ============================
 *  Exports
 * ============================ */
module.exports = {
  manejarSub,
  manejarMe,
  manejarId,
  manejarAdm,
  manejarAdmins,
  adminList, // usado por otros módulos si lo necesitan
};
























