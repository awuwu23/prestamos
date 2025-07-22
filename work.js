const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const esperarPDFyAnalizar = require('./pdfParser');
const generarMensajeResultado = require('./mensajeResultado');
const { consultarDominio } = require('./dominio');
const { NewMessage } = require('telegram/events');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function validarIdentidad(dni, numeroCliente, sock, msg) {
    console.log('🚀 [validarIdentidad] Iniciando validación de identidad...');
    console.log('📍 DNI:', dni);
    console.log('📍 Número cliente:', numeroCliente);

    const destino = msg?.key?.remoteJid || (numeroCliente + '@s.whatsapp.net');
    console.log('📨 Destino de respuesta:', destino);

    const client = await iniciarClienteTelegram();
    console.log('📦 Resultado de iniciarClienteTelegram:', !!client);

    if (!client || typeof client.sendMessage !== 'function') {
        console.error('⛔ Cliente Telegram no válido.');
        return;
    }

    try {
        const bot = await client.getEntity(botUsername);
        if (!bot) throw new Error('❌ No se pudo obtener el bot.');
        console.log('🤖 Bot obtenido:', bot.username || '[Sin username]');

        // ✅ Activar handler antes de enviar el comando
        const textoExtraPromise = esperarTextoExtraYAnalizar(client, bot, sock, numeroCliente, destino);

        const comandoFederador = `/federador ${dni}`;
        console.log(`📤 Enviando comando: ${comandoFederador}`);
        await client.sendMessage(bot, { message: comandoFederador });

        await delay(10000);

        const textoExtra = await Promise.race([
            textoExtraPromise,
            new Promise(resolve => setTimeout(() => {
                console.warn('⏰ Timeout esperando respuesta de federador');
                resolve({});
            }, 30000))
        ]);

        console.log('📃 Texto extra analizado:', textoExtra);
        console.log('🧬 Sexo detectado:', textoExtra?.sexo);

        if (!textoExtra?.sexo) {
            console.warn('⚠️ Sexo no detectado. Cancelando flujo para evitar error en /dni');
            await sock.sendMessage(destino, {
                text: '⚠️ No se pudo obtener el sexo desde el informe federador. Reintentá más tarde.',
            });
            return;
        }

        const generoDetectado = textoExtra.sexo.toUpperCase().startsWith('M') ? 'M' : 'F';
        const comandoDni = `/dni ${dni} ${generoDetectado}`;
        console.log(`📤 Enviando comando: ${comandoDni}`);
        await client.sendMessage(bot, { message: comandoDni });

        // ✅ Reenviar todos los mensajes de /dni
        await reenviarMensajesDelBot(client, bot, sock, destino, 20000);

        let dominioResultado = null;
        if (textoExtra?.dominio) {
            const dominio = textoExtra.dominio;
            console.log(`⏳ Esperando 15s para consultar /dnrpa ${dominio}`);
            await delay(15000);
            dominioResultado = await consultarDominio(dominio, client, bot);
            console.log('✅ Resultado de /dnrpa:', dominioResultado);
        }

        const comandoWork = `/work ${dni}`;
        console.log(`📤 Enviando comando: ${comandoWork}`);
        await client.sendMessage(bot, { message: comandoWork });

        await delay(15000);

        const resultado = await esperarPDFyAnalizar(client, bot, numeroCliente, sock, destino);
        console.log('📊 Resultado PDF analizado:', resultado);

        if (!resultado || typeof resultado !== 'object') {
            console.error('❌ No se obtuvo un resultado válido del informe.');
            await sock.sendMessage(destino, {
                text: '⚠️ No se pudo obtener el resultado del análisis del informe.',
            });
            return;
        }

        const { mensajePrincipal, mensajeVacunas } = await generarMensajeResultado(dni, resultado, textoExtra, dominioResultado);
        console.log('📤 Enviando resultado al cliente por WhatsApp...');
        await sock.sendMessage(destino, { text: mensajePrincipal });
        if (mensajeVacunas) {
            await delay(1000);
            await sock.sendMessage(destino, { text: mensajeVacunas });
        }

        console.log('✅ Mensaje enviado correctamente.');
        console.log('🏁 [validarIdentidad] Finalizado correctamente.');
        return resultado;

    } catch (err) {
        console.error('❌ Error general en validarIdentidad:', err);
        await sock.sendMessage(destino, {
            text: '⚠️ Hubo un error durante la validación.',
        });
        return {
            deudas: 'Error',
            motivo: 'Error durante la validación',
            acreedores: []
        };
    }
}

// 🔽 Espera mensajes y analiza texto estructurado (para /federador)
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

// 🔽 Reenvía TODOS los mensajes del bot durante cierto tiempo
async function reenviarMensajesDelBot(client, bot, sock, destino, delayMs = 20000) {
    return new Promise((resolve) => {
        let resolved = false;
        const mensajes = [];

        const handler = async (event) => {
            if (resolved) return;

            const msg = event.message;
            const fromBot = msg.senderId && msg.senderId.equals(bot.id);
            if (!fromBot) return;

            const texto = msg.message?.trim();
            if (texto) {
                console.log('📥 [Reenvío Bot] Capturado:', texto);
                mensajes.push(texto);
            }
        };

        client.addEventHandler(handler, new NewMessage({}));

        setTimeout(async () => {
            resolved = true;
            client.removeEventHandler(handler);

            if (sock && destino && mensajes.length > 0) {
                for (const m of mensajes) {
                    try {
                        await sock.sendMessage(destino, { text: m });
                    } catch (err) {
                        console.error('❌ Error reenviando mensaje:', err);
                    }
                }
            }

            resolve();
        }, delayMs);
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

    const sexoMatch = texto.match(/(?:•\s*)?Sexo\s*[:\-]?\s*(M|F|Masculino|Femenino)/i);
    if (sexoMatch) {
        resultado.sexo = sexoMatch[1].charAt(0).toUpperCase();
        console.log('✅ Sexo detectado correctamente:', resultado.sexo);
    } else {
        console.warn('⚠️ No se detectó el campo Sexo en el texto.');
    }

    const nacimientoMatch = texto.match(/Nacimiento:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (nacimientoMatch) resultado.nacimiento = nacimientoMatch[1];

    const educacionMatch = texto.match(/Educaci[oó]n:\s*(.+)/i);
    if (educacionMatch) resultado.educacion = educacionMatch[1].trim();

    const profesionMatch = texto.match(/Profesi[oó]n:\s*(.+)/i);
    if (profesionMatch) resultado.profesion = profesionMatch[1].trim();

    return resultado;
}

module.exports = validarIdentidad;



































