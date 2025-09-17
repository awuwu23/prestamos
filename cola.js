const consultaQueue = [];
let consultaActiva = false;
const DELAY_ENTRE_CONSULTAS = 15000; // 15 segundos entre consultas

// ✨ Función para generar encabezados y separadores
function formatoMensaje(titulo, contenido) {
    const separador = '────────────────────────────';
    return `*${titulo}*\n${separador}\n${contenido}\n${separador}`;
}

// 📌 Agregar una nueva consulta a la cola
function agregarConsulta(sock, consulta) {
    // ❌ Evitar repetición en la cola
    const yaExiste = consultaQueue.some(c => c.idUsuario === consulta.idUsuario);
    if (yaExiste) {
        sock.sendMessage(consulta.destino, {
            text: formatoMensaje('OSINT BOT 🔍', '⚠️ Ya tienes una consulta pendiente en la cola. Por favor espera tu turno.')
        }).catch(() => {});
        return false;
    }

    // 🌟 Ajustar destino si la respuesta es privada
    if (consulta.respuestaPrivada) {
        consulta.destino = `${consulta.idUsuario}@s.whatsapp.net`;
    }

    consultaQueue.push(consulta);

    // 🔢 Calcular posición y tiempo aproximado
    const posicion = consultaQueue.length;
    const tiempoEsperaSeg = (posicion - 1) * (DELAY_ENTRE_CONSULTAS / 1000);
    const minutos = Math.floor(tiempoEsperaSeg / 60);
    const segundos = Math.floor(tiempoEsperaSeg % 60);

    // ✅ Confirmación de ingreso
    const mensajeIngreso = `
✅ Tu consulta ha sido registrada correctamente.
📄 Posición en la cola: *#${posicion}*
⌛ Tiempo aproximado de espera: ${minutos}m ${segundos}s
🕒 Por favor, espera tu turno.`;

    sock.sendMessage(consulta.destino, {
        text: formatoMensaje('OSINT BOT 🔍', mensajeIngreso)
    }).catch(() => {});

    // 🚀 Procesar si no hay ninguna activa
    if (!consultaActiva) procesarSiguiente(sock);
    return true;
}

// 📌 Consultar estado actual de la cola
function obtenerEstado() {
    return {
        activa: consultaActiva,
        tamaño: consultaQueue.length
    };
}

// 📌 Procesar la siguiente consulta en la cola
async function procesarSiguiente(sock) {
    if (consultaQueue.length === 0) {
        consultaActiva = false;
        return;
    }

    consultaActiva = true;
    const consulta = consultaQueue.shift();
    console.log(`🚀 Procesando consulta de ${consulta.idUsuario}`);

    try {
        await consulta.fn();

        // ✅ Avisar finalización
        await sock.sendMessage(consulta.destino, {
            text: formatoMensaje('OSINT BOT 🔍', '✅ Consulta finalizada. Gracias por esperar.')
        }).catch(() => {});
    } catch (err) {
        console.error(`❌ Error procesando consulta de ${consulta.idUsuario}:`, err);
        const mensajeError = `
⚠️ Ocurrió un error procesando tu consulta.
⏳ Por favor, inténtalo de nuevo más tarde.`;
        await sock.sendMessage(consulta.destino, {
            text: formatoMensaje('OSINT BOT 🔍', mensajeError)
        }).catch(() => {});
    } finally {
        // 🔔 Avisar a los que quedaron en la cola que subieron de posición
        consultaQueue.forEach((c, index) => {
            const nuevoPos = index + 1;
            const tiempoEsperaSeg = index * (DELAY_ENTRE_CONSULTAS / 1000);
            const minutos = Math.floor(tiempoEsperaSeg / 60);
            const segundos = Math.floor(tiempoEsperaSeg % 60);

            const mensajeSubida = `
🔼 ¡Tu posición en la cola ha subido!
📄 Nueva posición: *#${nuevoPos}*
⌛ Tiempo aproximado de espera: ${minutos}m ${segundos}s`;

            sock.sendMessage(c.destino, {
                text: formatoMensaje('OSINT BOT 🔍', mensajeSubida)
            }).catch(() => {});
        });

        // ⏳ Espera antes de procesar la siguiente
        setTimeout(() => {
            procesarSiguiente(sock);
        }, DELAY_ENTRE_CONSULTAS);
    }
}

module.exports = {
    agregarConsulta,
    obtenerEstado,
    procesarSiguiente
};









