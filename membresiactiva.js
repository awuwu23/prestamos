const { normalizarNumero } = require('./membresia');
const MembresiaModel = require('./models').Membresia; // Asegurate de tener este modelo definido correctamente

function normalizarDestino(jid) {
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us')) {
        return jid;
    }
    if (/^\d+$/.test(jid)) {
        return `${jid}@s.whatsapp.net`;
    }
    return jid;
}

async function mostrarMembresiasActivas(sock, respuestaDestino) {
    try {
        const ahora = new Date();

        // Obtener membresías activas desde MongoDB
        const membresias = await MembresiaModel.find({ vence: { $gt: ahora } });

        if (!membresias.length) {
            await sock.sendMessage(normalizarDestino(respuestaDestino), {
                text: '📭 No hay membresías activas actualmente.'
            });
            return;
        }

        const lista = membresias.map(m => {
            const inicio = new Date(m.inicio);
            const vence = new Date(m.vence);
            const diasRestantes = Math.floor((vence - ahora) / (1000 * 60 * 60 * 24));
            const diasActiva = Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24));
            return {
                numero: m.numero,
                nombre: m.nombre || 'Sin nombre',
                diasRestantes,
                diasActiva
            };
        }).sort((a, b) => a.diasRestantes - b.diasRestantes);

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

module.exports = { mostrarMembresiasActivas };





