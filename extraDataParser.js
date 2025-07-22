const { NewMessage } = require('telegram/events');

async function esperarTextoExtraYAnalizar(client, bot, sock = null, numeroCliente = null, destino = null) {
    return new Promise((resolve) => {
        let resolved = false;
        const mensajes = [];

        const handler = async (event) => {
            if (resolved) return;

            const msg = event.message;
            const fromBot = msg.senderId && msg.senderId.equals(bot.id);
            if (!fromBot || msg.media) return;

            console.log('📩 Mensaje recibido del bot:', msg.message);
            mensajes.push(msg.message);
        };

        client.addEventHandler(handler, new NewMessage({}));

        setTimeout(async () => {
            resolved = true;
            client.removeEventHandler(handler);
            const texto = mensajes.map(m => m.trim()).join('\n');
            console.log('📄 Texto completo del bot:\n', texto);

            // ✅ Reenviar TODOS los mensajes recibidos, incluso si solo hay uno
            if (sock && destino && mensajes.length >= 1) {
                for (let i = 0; i < mensajes.length; i++) {
                    try {
                        await sock.sendMessage(destino, { text: mensajes[i] });
                    } catch (err) {
                        console.error('❌ Error al reenviar mensaje:', err);
                    }
                }
            }

            resolve(analizarTextoEstructurado(texto));
        }, 25000);
    });
}

function analizarTextoEstructurado(texto) {
    const resultado = {
        gmail: null,
        celulares: [],
        familiares: [],
        vehiculos: [],
        historialLaboral: [],
        domicilioTexto: null,
        linkMaps: null,
        dominio: null,
        dominios: [],
        nombreCompleto: null,
        cuit: null,
        dni: null,
        sexo: null,
        nacimiento: null,
        profesion: null,
        educacion: null
    };

    const mailMatch = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|ar)/i);
    if (mailMatch) resultado.gmail = mailMatch[0];

    const celulares = [...texto.matchAll(/(?:Celular|Tel[eé]fono|Número):?\s*(\d{8,15})/gi)];
    resultado.celulares = celulares.map(m => m[1]);

    const familiares = [...texto.matchAll(/nombre:\s+([A-ZÑÁÉÍÓÚ,\s]+)\s*documento:\s*(\d{7,8})/gi)];
    resultado.familiares = familiares.map(m => `${m[1].trim()} (${m[2]})`);

    const vehiculoMatches = [...texto.matchAll(/(\b[A-Z]{2}\d{3}[A-Z]{2}\b|\b[A-Z]{3}\d{3}\b).*?marca:\s*(.*?)\s+modelo:\s*(.*?)\s+ano:\s*(\d{4})/gi)];
    resultado.vehiculos = vehiculoMatches.map(m => ({
        dominio: m[1].trim(),
        marca: m[2].trim(),
        modelo: m[3].trim(),
        año: m[4].trim()
    }));

    const empresas = [...texto.matchAll(/Empresa:\s*(.+?)\s+◦.*?Período:\s*([0-9\/\-]+).*?Duración:\s*(\d+ (años?|meses?))/gis)];
    resultado.historialLaboral = empresas.map(m => `${m[1].trim()} - ${m[3]}`);

    const direccion = texto.match(/Dirección:\s*(.+)/i);
    if (direccion) resultado.domicilioTexto = direccion[1].trim();

    const link = texto.match(/https:\/\/www\.google\.com\/maps\/search\?[^\s]+/i);
    if (link) resultado.linkMaps = link[0];

    const dominioMatches = [...texto.matchAll(/\b[A-Z]{2}\d{3}[A-Z]{2}\b|\b[A-Z]{3}\d{3}\b/g)];
    const dominios = dominioMatches.map(m => m[0]);
    if (dominios.length > 0) {
        resultado.dominio = dominios[0];
        resultado.dominios = dominios;
    }

    const nombre = texto.match(/Nombre:\s*([A-ZÑÁÉÍÓÚ ]+)/i);
    const apellido = texto.match(/Apellido:\s*([A-ZÑÁÉÍÓÚ ]+)/i);
    if (nombre && apellido) resultado.nombreCompleto = `${apellido[1].trim()}, ${nombre[1].trim()}`;

    const dniMatch = texto.match(/DNI:\s*(\d{7,8})/i);
    if (dniMatch) resultado.dni = dniMatch[1];

    const cuitMatch = texto.match(/CU[IL]{2}:?\s*(\d{2,3}\d{8}\d{1})/i);
    if (cuitMatch) resultado.cuit = cuitMatch[1];

    // ✅ Nueva expresión para detectar sexo incluso con viñeta "•"
    const sexoMatch = texto.match(/(?:•\s*)?Sexo:\s*(F|M|Femenino|Masculino)/i);
    if (sexoMatch) resultado.sexo = sexoMatch[1];

    const nacimientoMatch = texto.match(/Nacimiento:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (nacimientoMatch) resultado.nacimiento = nacimientoMatch[1];

    const educacionMatch = texto.match(/Educaci[oó]n:\s*(.+)/i);
    if (educacionMatch) resultado.educacion = educacionMatch[1].trim();

    const profesionMatch = texto.match(/Profesi[oó]n:\s*(.+)/i);
    if (profesionMatch) resultado.profesion = profesionMatch[1].trim();

    return resultado;
}

module.exports = esperarTextoExtraYAnalizar;



