const fs = require('fs');
const path = require('path');
const {
    agregarMembresia,
    tiempoRestante,
    normalizarNumero,
    verificarMembresia,
    agregarIdSecundario
} = require('../membresia');

const adminFile = path.join(__dirname, '../admines.json');
const adminDetalleFile = path.join(__dirname, '../admines_detalle.json');
const ventasPath = path.join(__dirname, '../ventas_admin.json');

let adminList = ['5493813885182', '54927338121162993'];
const dueños = ['5493813885182', '54927338121162993'];
let adminDetalle = {};

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

function guardarAdmins() {
    try {
        fs.writeFileSync(adminFile, JSON.stringify(adminList, null, 2));
        fs.writeFileSync(adminDetalleFile, JSON.stringify(adminDetalle, null, 2));
    } catch (err) {
        console.error('❌ Error al guardar admines:', err);
    }
}

function cargarVentas() {
    if (!fs.existsSync(ventasPath)) fs.writeFileSync(ventasPath, '{}');
    try {
        return JSON.parse(fs.readFileSync(ventasPath));
    } catch {
        return {};
    }
}

function guardarVentas(ventas) {
    fs.writeFileSync(ventasPath, JSON.stringify(ventas, null, 2));
}

async function manejarSub(sock, numeroAdmin, texto, respuestaDestino, administradores) {
    const adminNormalizado = normalizarNumero(numeroAdmin);
    const esDueño = dueños.includes(adminNormalizado);

    if (!adminList.includes(adminNormalizado)) {
        await sock.sendMessage(respuestaDestino, {
            text: '⛔ No estás autorizado para usar este comando.'
        });
        return true;
    }

    const partes = texto.trim().split(' ');
    if (partes.length < 3) {
        await sock.sendMessage(respuestaDestino, {
            text: `ℹ️ *Uso del comando /sub:*\n\nPara registrar una membresía:\n/sub <número> <id?> <nombre>`
        });
        return true;
    }

    const numeroPrincipal = normalizarNumero(partes[1]);
    const posibleId = normalizarNumero(partes[2]);
    const nombre = partes.slice(posibleId.length > 11 ? 3 : 2).join(' ');
    const yaTiene = verificarMembresia(numeroPrincipal);
    const idGrupo = posibleId.length > 11 ? posibleId : null;

    if (!yaTiene) {
        agregarMembresia(numeroPrincipal, nombre);
        const tiempo = tiempoRestante(numeroPrincipal);

        const adminInfo = adminDetalle[adminNormalizado] || { nombre: 'Admin desconocido', id: '-' };

        // ✅ Mensaje al CLIENTE con confirmación
        await sock.sendMessage(`${numeroPrincipal}@s.whatsapp.net`, {
            text:
`🎉 *Tu membresía fue activada*

📆 Vence en ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).
👤 Vendedor: ${adminInfo.nombre} (${adminNormalizado})

🔍 Podés consultar tu membresía con el comando *"/me"*`
        });

        // ✅ Mensaje al ADMIN con los datos de cobro
        await sock.sendMessage(respuestaDestino, {
            text:
`💳 *Datos para cobrar al cliente*

🧑 Cliente: ${nombre}
📱 Número: ${numeroPrincipal}

🏦 Datos bancarios:
- CBU: 0000003100049327493120
- Alias: leviatandox
- Titular: Carlos Ruben Collante
- Monto sugerido: $5.000

👤 Vendedor: ${adminInfo.nombre} (${adminNormalizado})`
        });

        for (const dueño of dueños) {
            await sock.sendMessage(`${dueño}@s.whatsapp.net`, {
                text:
`🔔 *Nueva membresía vendida*

👤 Admin: ${adminInfo.nombre}
📞 Número: ${adminNormalizado}
🆔 ID: ${adminInfo.id || '-'}
👥 Cliente: ${numeroPrincipal} - ${nombre}`
            });
        }

        const ventas = cargarVentas();
        ventas[adminNormalizado] = (ventas[adminNormalizado] || 0) + 1;
        guardarVentas(ventas);

        if (idGrupo) agregarIdSecundario(numeroPrincipal, idGrupo);
    } else {
        if (idGrupo) {
            agregarIdSecundario(numeroPrincipal, idGrupo);
            await sock.sendMessage(respuestaDestino, {
                text: `🔄 El número *${numeroPrincipal}* ya tenía membresía. ID *${idGrupo}* vinculado para grupos.`
            });
        } else {
            await sock.sendMessage(respuestaDestino, {
                text: `ℹ️ El número *${numeroPrincipal}* ya tenía membresía activa.`
            });
        }
    }

    return true;
}

async function manejarId(sock, numero, respuestaDestino, senderJid, esGrupo) {
    const id = normalizarNumero(numero);
    await sock.sendMessage(respuestaDestino, {
        text: `🆔 *Tu ID es:* ${id}\n\nUsá este ID si necesitás vincular tu membresía para usar el bot en grupos.`,
        mentions: esGrupo ? [senderJid] : [],
    });
    return true;
}

async function manejarAdm(sock, numeroAdmin, texto, respuestaDestino) {
    const adminNormalizado = normalizarNumero(numeroAdmin);
    if (!dueños.includes(adminNormalizado)) {
        await sock.sendMessage(respuestaDestino, {
            text: '⛔ Solo el dueño del bot puede agregar nuevos administradores.'
        });
        return true;
    }

    const partes = texto.trim().split(' ');
    if (partes.length < 3) {
        await sock.sendMessage(respuestaDestino, {
            text: '⚠️ Uso incorrecto. Formato:\n/adm <número> <id?> <nombre>\n\nEjemplo:\n/adm 3811234567 549XXXXXXXXXXX Juan'
        });
        return true;
    }

    const nuevoAdmin = normalizarNumero(partes[1]);

    let idGrupo = null;
    let nombre = 'Admin sin nombre';

    if (partes[2].startsWith('54')) {
        idGrupo = normalizarNumero(partes[2]);
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
            id: idGrupo || infoAnterior.id || null
        };
        guardarAdmins();

        await sock.sendMessage(respuestaDestino, {
            text: `✅ El administrador *${nuevoAdmin}* ya existía, pero su información fue actualizada.`
        });
        return true;
    }

    adminList.push(nuevoAdmin);
    adminDetalle[nuevoAdmin] = {
        nombre: nombre,
        id: idGrupo || null
    };
    guardarAdmins();

    await sock.sendMessage(respuestaDestino, {
        text: `✅ *${nombre}* fue agregado como nuevo administrador (${nuevoAdmin}).`
    });

    try {
        await sock.sendMessage(`${nuevoAdmin}@s.whatsapp.net`, {
            text: `👑 *Fuiste promovido a administrador del bot*\n\nAhora podés usar los comandos:\n- /sub <número> <id?> <nombre>\n- /me\n\n💡 Por cada membresía que registres, recibís $5.000 de ganancia.`
        });
    } catch (err) {
        console.warn('⚠️ No se pudo notificar al nuevo admin:', err.message);
    }

    return true;
}

async function manejarMe(sock, numero, respuestaDestino, senderJid, esGrupo, verificarMembresia, tiempoRestante, administradores) {
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
                ? '👑 Sos *dueño* del bot. Tenés acceso total e ilimitado.'
                : `👑 Sos *administrador* del bot.*\n\n📛 *Nombre:* ${info?.nombre || 'N/A'}\n🆔 *ID:* ${info?.id || '-'}\n\n✅ Tenés acceso completo sin restricciones.`,
            mentions: esGrupo ? [senderJid] : [],
        });
        return true;
    }

    const activo = verificarMembresia(id);
    const tiempo = tiempoRestante(id);

    if (activo) {
        await sock.sendMessage(respuestaDestino, {
            text: `🕓 *Tu membresía está activa.*\n📆 Vence en ${tiempo.dias} día(s) y ${tiempo.horas} hora(s).`,
            mentions: esGrupo ? [senderJid] : [],
        });
    } else {
        await sock.sendMessage(respuestaDestino, {
            text: '🔒 *No tenés membresía activa.* Solo podés hacer una búsqueda gratuita.',
            mentions: esGrupo ? [senderJid] : [],
        });
    }

    return true;
}

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
            text: '📊 Aún no hay ventas registradas por ningún administrador.'
        });
        return;
    }

    let texto = '📊 *Ranking de administradores por ventas:*\n\n';
    ranking.forEach((admin, i) => {
        texto += `*${i + 1}️⃣ ${admin.nombre}*\n📞 ${admin.numero}\n🆔 ${admin.id}\n🛒 Ventas: ${admin.ventas}\n💸 Total: $${admin.monto.toLocaleString()}\n\n`;
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














