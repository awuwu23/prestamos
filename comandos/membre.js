const fs = require('fs');
const path = require('path');
const {
    agregarMembresia,
    actualizarIdGrupo,
    tiempoRestante,
    normalizarNumero,
    verificarMembresia
} = require('../membresia');

const adminFile = path.join(__dirname, '../admines.json');
const adminDetalleFile = path.join(__dirname, '../admines_detalle.json');
const ventasPath = path.join(__dirname, '../ventas_admin.json');

let adminList = ['5493813885182', '54927338121162993'];
const dueños = ['5493813885182', '54927338121162993'];
let adminDetalle = {};

// Cargar lista de admins y detalle desde archivos JSON
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

// Guardar admins y detalles en archivos JSON
function guardarAdmins() {
    try {
        fs.writeFileSync(adminFile, JSON.stringify(adminList, null, 2));
        fs.writeFileSync(adminDetalleFile, JSON.stringify(adminDetalle, null, 2));
    } catch (err) {
        console.error('❌ Error al guardar admines:', err);
    }
}

// Cargar ventas
function cargarVentas() {
    if (!fs.existsSync(ventasPath)) fs.writeFileSync(ventasPath, '{}');
    try {
        return JSON.parse(fs.readFileSync(ventasPath));
    } catch {
        return {};
    }
}

// Guardar ventas
function guardarVentas(ventas) {
    fs.writeFileSync(ventasPath, JSON.stringify(ventas, null, 2));
}

// Manejar comando /sub para asignar membresía
async function manejarSub(sock, numeroAdmin, texto, respuestaDestino, administradores) {
    const adminNormalizado = normalizarNumero(numeroAdmin);
    const esDueño = dueños.includes(adminNormalizado);

    if (!adminList.includes(adminNormalizado)) {
        await sock.sendMessage(respuestaDestino, {
            text: '⛔ *Acceso denegado*\n\n❌ No estás autorizado para usar este comando.'
        });
        return true;
    }

    const partes = texto.trim().split(' ');
    if (partes.length < 3) {
        await sock.sendMessage(respuestaDestino, {
            text: `📖 *Uso del comando /sub:*\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ /sub <número> <idExtendido?> <nombre>\n\n📌 *Ejemplo:*\n/sub 3812345678 549XXXXXXXX Juan`
        });
        return true;
    }

    const numeroPrincipal = normalizarNumero(partes[1]);
    const posibleId = partes[2].replace(/\D/g, '');
    const nombre = partes.slice(posibleId.length > 11 ? 3 : 2).join(' ');

    const yaTiene = verificarMembresia(numeroPrincipal);
    const idExtendido = posibleId.length > 11 ? posibleId : null;

    const adminInfo = adminDetalle[adminNormalizado] || { nombre: 'Admin desconocido', id: '-' };

    if (!yaTiene) {
        // Crear membresía nueva
        agregarMembresia(numeroPrincipal, idExtendido, nombre);
        const tiempo = tiempoRestante(numeroPrincipal);

        await sock.sendMessage(`${numeroPrincipal}@s.whatsapp.net`, {
            text:
`🎉 *¡Membresía activada exitosamente!*
━━━━━━━━━━━━━━━━━━━━━━━
🕒 *Vencimiento:* ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).
👤 *Vendedor:* ${adminInfo.nombre} (${adminNormalizado})
📖 *Usá /me para ver el estado de tu membresía.*
━━━━━━━━━━━━━━━━━━━━━━━`
        });

        await sock.sendMessage(respuestaDestino, {
            text:
`💳 *Datos para cobrar al cliente*
━━━━━━━━━━━━━━━━━━━━━━━
🧑‍💻 *Cliente:* ${nombre}
📱 *Número:* ${numeroPrincipal}

🏦 *Datos bancarios:*
- 🏦 *CBU:* 0000003100049327493120
- ✉️ *Alias:* leviatandox
- 👤 *Titular:* Carlos Ruben Collante
💸 *Monto sugerido:* $5.000
━━━━━━━━━━━━━━━━━━━━━━━
👑 *Vendedor:* ${adminInfo.nombre} (${adminNormalizado})`
        });

        for (const dueño of dueños) {
            await sock.sendMessage(`${dueño}@s.whatsapp.net`, {
                text:
`🔔 *Nueva membresía registrada*
━━━━━━━━━━━━━━━━━━━━━━━
👑 *Admin:* ${adminInfo.nombre}
📞 *Número:* ${adminNormalizado}
🆔 *ID:* ${adminInfo.id || '-'}
👤 *Cliente:* ${numeroPrincipal} - ${nombre}
━━━━━━━━━━━━━━━━━━━━━━━`
            });
        }

        const ventas = cargarVentas();
        ventas[adminNormalizado] = (ventas[adminNormalizado] || 0) + 1;
        guardarVentas(ventas);

    } else {
        // Renovar membresía y actualizar id extendido si es necesario
        agregarMembresia(numeroPrincipal, idExtendido, nombre);
        const tiempo = tiempoRestante(numeroPrincipal);

        await sock.sendMessage(respuestaDestino, {
            text: `🔄 *Membresía de ${numeroPrincipal} renovada y actualizada.*\n🕒 *Válida por:* ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).`
        });
    }

    return true;
}

// Manejar comando /id
async function manejarId(sock, numero, respuestaDestino, senderJid, esGrupo) {
    const id = normalizarNumero(numero);
    await sock.sendMessage(respuestaDestino, {
        text: `🆔 *Tu ID es:* ${id}\n━━━━━━━━━━━━━━━━━━━━━━━\n💡 *Usá este ID para vincular membresía en grupos.*`,
        mentions: esGrupo ? [senderJid] : [],
    });
    return true;
}

// Manejar comando /adm
async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
    const adminNormalizado = normalizarNumero(numeroAdmin);
    if (!dueños.includes(adminNormalizado)) {
        await sock.sendMessage(respuestaDestino, {
            text: '⛔ *Acceso denegado*\n\n❌ Solo el *dueño del bot* puede agregar administradores.'
        });
        return true;
    }

    const partes = texto.trim().split(' ');
    if (partes.length < 3) {
        await sock.sendMessage(respuestaDestino, {
            text: `📖 *Uso del comando /adm:*\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ /adm <número> <id?> <nombre>\n\n📌 *Ejemplo:*\n/adm 3812345678 549XXXXXXXX Juan`
        });
        return true;
    }

    const nuevoAdmin = normalizarNumero(partes[1]);
    let idExtendido = null;
    let nombre = 'Admin sin nombre';

    if (partes[2].startsWith('54')) {
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
            nombre: nombre || infoAnterior.nombre || 'Admin sin nombre',
            id: idExtendido || infoAnterior.id || null
        };
        guardarAdmins();

        await sock.sendMessage(respuestaDestino, {
            text: `✅ *Administrador actualizado*\n\n📞 *Número:* ${nuevoAdmin}\n👤 *Nombre:* ${nombre}`
        });
        return true;
    }

    adminList.push(nuevoAdmin);
    adminDetalle[nuevoAdmin] = {
        nombre: nombre,
        id: idExtendido || null
    };
    guardarAdmins();

    await sock.sendMessage(respuestaDestino, {
        text: `✅ *${nombre} fue agregado como nuevo administrador (${nuevoAdmin}).*`
    });

    try {
        await sock.sendMessage(`${nuevoAdmin}@s.whatsapp.net`, {
            text: `👑 *Fuiste promovido como administrador del bot*\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ Ahora podés usar comandos especiales:\n- /sub <número> <id?> <nombre>\n- /me\n\n💸 *Ganancia por membresía vendida:* $5.000`
        });
    } catch (err) {
        console.warn('⚠️ No se pudo notificar al nuevo admin:', err.message);
    }

    return true;
}

// Manejar comando /me
async function manejarMe(sock, numero, respuestaDestino, senderJid, esGrupo) {
    const id = normalizarNumero(numero);
    const esAdmin = adminList.includes(id);
    const esDueño = dueños.includes(id);

    let info = adminDetalle[id];

    if (!info) {
        for (const adminNum in adminDetalle) {
            const detalle = adminDetalle[adminNum];
            if (detalle.id === id) {
                info = detalle;
                break;
            }
        }
    }

    if (esAdmin || info) {
        await sock.sendMessage(respuestaDestino, {
            text: esDueño
                ? '👑 *Sos dueño del bot.*\n\n✅ Acceso total e ilimitado.'
                : `👑 *Sos administrador del bot*\n━━━━━━━━━━━━━━━━━━━━━━━\n👤 *Nombre:* ${info?.nombre || 'N/A'}\n🆔 *ID:* ${info?.id || '-'}\n✅ Acceso completo sin restricciones.`,
            mentions: esGrupo ? [senderJid] : [],
        });
        return true;
    }

    const activo = verificarMembresia(id);
    const tiempo = tiempoRestante(id);

    if (activo) {
        await sock.sendMessage(respuestaDestino, {
            text: `📆 *Membresía activa*\n━━━━━━━━━━━━━━━━━━━━━━━\n⏳ *Vence en:* ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).\n💡 *Usá /menu para ver opciones.*`,
            mentions: esGrupo ? [senderJid] : [],
        });
    } else {
        await sock.sendMessage(respuestaDestino, {
            text: '🔒 *No tenés membresía activa.*\n\n💡 Podés usar una búsqueda gratuita o contactar a un admin.',
            mentions: esGrupo ? [senderJid] : [],
        });
    }

    return true;
}

// Manejar comando /admins
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
                monto: cantidad * 5000
            };
        })
        .sort((a, b) => b.ventas - a.ventas);

    if (ranking.length === 0) {
        await sock.sendMessage(respuestaDestino, {
            text: '📊 *No hay ventas registradas por ningún administrador.*'
        });
        return;
    }

    let texto = '📊 *Ranking de administradores por ventas:*\n━━━━━━━━━━━━━━━━━━━━━━━\n';
    ranking.forEach((admin, i) => {
        texto += `*${i + 1}️⃣ ${admin.nombre}*\n📞 *Número:* ${admin.numero}\n🆔 *ID:* ${admin.id}\n🛒 *Ventas:* ${admin.ventas}\n💸 *Total vendido:* $${admin.monto.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━\n`;
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



















