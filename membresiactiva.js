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

        // Crear lista de membresías activas
        const lista = Object.entries(membresias)
            .map(([numero, datos]) => {
                const inicio = new Date(datos.inicio);
                const vence = new Date(datos.vence); // ✅ CAMPO CORRECTO
                const diasRestantes = Math.floor((vence - ahora) / (1000 * 60 * 60 * 24));
                const diasActiva = Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24));
                return {
                    numero,
                    nombre: datos.nombre || 'Sin nombre',
                    diasRestantes,
                    diasActiva
                };
            })
            .filter(item => item.diasRestantes > 0)
            .sort((a, b) => a.diasRestantes - b.diasRestantes);

        if (lista.length === 0) {
            await sock.sendMessage(normalizarDestino(respuestaDestino), {
                text: '📭 No hay membresías activas actualmente.'
            });
            return;
        }

        let texto = '📋 *Membresías activas:*\n━━━━━━━━━━━━━━━━━━━━━━━\n';
        lista.forEach((item, index) => {
            texto += `*${index + 1}.* 📱 ${item.numero} - ${item.nombre}\n`;
            texto += `   🕑 Activa hace: ${item.diasActiva} día(s)\n`;
            texto += `   ⏳ Vence en: ${item.diasRestantes} día(s)\n\n`;
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
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
        return jid;
    }
    if (/^\d+$/.test(jid)) {
        return `${jid}@s.whatsapp.net`;
    }
    return jid;
}

module.exports = { mostrarMembresiasActivas };




