const consultaQueue = [];
let consultaActiva = false;

function agregarConsulta(sock, consulta) {
    const yaExiste = consultaQueue.some(c => c.idUsuario === consulta.idUsuario);
    if (yaExiste) return false; // ❌ Ya tiene una consulta pendiente

    consultaQueue.push(consulta);

    // 🔢 Avisar posición en la cola si no es la primera
    const posicion = consultaQueue.length;
    if (consultaActiva) {
        sock.sendMessage(consulta.destino, {
            text: `⏳ *Tu consulta fue agregada a la cola.*\n📄 Actualmente eres el *#${posicion}* en la fila.\n🔄 Espera a que las consultas anteriores se procesen...`
        }).catch(() => {});
    }

    if (!consultaActiva) procesarSiguiente(sock); // 🚀 Procesar si no hay ninguna activa
    return true;
}

function obtenerEstado() {
    return {
        activa: consultaActiva,
        tamaño: consultaQueue.length
    };
}

function procesarSiguiente(sock) {
    if (consultaQueue.length === 0) {
        consultaActiva = false;
        return;
    }

    consultaActiva = true;
    const consulta = consultaQueue.shift();
    console.log(`🚀 Procesando consulta de ${consulta.idUsuario}`);

    consulta.fn()
        .then(async () => {
            // ✅ Confirmación al usuario tras finalizar consulta
            await sock.sendMessage(consulta.destino, {
                text: '✅ *Consulta finalizada.* Gracias por esperar.'
            }).catch(() => {});
        })
        .catch((err) => {
            console.error(`❌ Error procesando consulta de ${consulta.idUsuario}:`, err);
            sock.sendMessage(consulta.destino, {
                text: '⚠️ Ocurrió un error procesando tu consulta. Intentalo de nuevo más tarde.'
            }).catch(() => {});
        })
        .finally(() => {
            // ⏳ Espera 15s antes de la siguiente consulta
            setTimeout(() => {
                procesarSiguiente(sock);
            }, 15000);
        });
}

module.exports = {
    agregarConsulta,
    obtenerEstado,
    procesarSiguiente
};







