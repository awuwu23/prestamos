const fs = require('fs');
const path = require('path');
const { normalizarNumero } = require('./membresia');

function cargarMembresias() {
    const file = path.join(__dirname, 'membresias.json');
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file));
}

async function mostrarMembresiasActivas(sock, respuestaDestino) {
    try {
        const membresias = cargarMembresias();
        const ahora = Date.now();

        // Creamos lista ordenada de miembros
        const lista = Object.entries(membresias)
            .map(([numero, datos]) => {
                const inicio = new Date(datos.inicio);
                const vencimiento = new Date(datos.vencimiento);
                const diasRestantes = Math.ceil((vencimiento - ahora) / (1000 * 60 * 60 * 24));
                const diasActiva = Math.ceil((ahora - inicio) / (1000 * 60 * 60 * 24));
                return {
                    numero,
                    diasRestantes,
                    diasActiva
                };
            })
            .sort((a, b) => a.diasRestantes - b.diasRestantes);

        if (lista.length === 0) {
            await sock.sendMessage(normalizarDestino(respuestaDestino), {
                text: '📭 No hay membresías activas actualmente.'
            });
            return;
        }

        let texto = '📋 *Membresías activas:*\n\n';
        lista.forEach((item, index) => {
            texto += `*${index + 1}.* 📱 ${item.numero}\n`;
            texto += `   🕑 Activa hace: ${item.diasActiva} días\n`;
            texto += `   ⏳ Vence en: ${item.diasRestantes} días\n\n`;
        });

        await sock.sendMessage(normalizarDestino(respuestaDestino), {
            text: texto.trim()
        });
    } catch (err) {
        console.error('❌ Error en mostrarMembresiasActivas:', err);
        await sock.sendMessage(normalizarDestino(respuestaDestino), {
            text: '⚠️ Ocurrió un error al obtener la lista de membresías.'
        });
    }
}

function normalizarDestino(jid) {
    // Si ya es JID válido, devolverlo tal cual
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
        return jid;
    }
    // Si es número, agregar sufijo
    if (/^\d+$/.test(jid)) {
        return `${jid}@s.whatsapp.net`;
    }
    return jid; // fallback
}

module.exports = { mostrarMembresiasActivas };


