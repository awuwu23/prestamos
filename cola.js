const consultaQueue = [];
let consultaActiva = false;

/**
 * Agrega una nueva consulta a la cola.
 * Si ya existe una consulta pendiente del mismo usuario, la ignora.
 * Si no hay consulta activa, inicia el procesamiento.
 */
function agregarConsulta(sock, consulta) {
    const yaExiste = consultaQueue.some(c => c.idUsuario === consulta.idUsuario);
    if (yaExiste) return false; // ❌ Ya tiene una consulta pendiente

    consultaQueue.push(consulta);

    const posicion = consultaQueue.length;

    if (consultaActiva) {
        // Si ya hay una consulta activa, notifica posición en la cola
        sock.sendMessage(consulta.destino, {
            text: `⏳ *Tu consulta fue agregada a la cola.*\n📄 Actualmente eres el *#${posicion}* en la fila.\n🔄 Espera a que las consultas anteriores se procesen...`
        }).catch(() => {});
    }

    if (!consultaActiva) {
        // Si no hay ninguna activa, comienza el procesamiento
        procesarSiguienteConsulta();
    }

    return true;
}

/**
 * Devuelve el estado actual de la cola.
 */
function obtenerEstado() {
    return {
        activa: consultaActiva,
        tamaño: consultaQueue.length
    };
}

/**
 * Procesa la siguiente consulta de la cola si hay disponibles.
 */
function procesarSiguienteConsulta() {
    if (consultaQueue.length === 0) {
        consultaActiva = false;
        return;
    }

    consultaActiva = true;
    const consulta = consultaQueue.shift();

    console.log(`🚀 Procesando consulta de ${consulta.idUsuario}`);

    consulta.fn()
        .catch((err) => {
            console.error(`❌ Error procesando consulta de ${consulta.idUsuario}:`, err);
        })
        .finally(() => {
            // Esperar 15 segundos antes de continuar con la siguiente consulta
            setTimeout(() => {
                procesarSiguienteConsulta();
            }, 15000);
        });
}

module.exports = {
    agregarConsulta,
    obtenerEstado,
    procesarSiguienteConsulta
};





