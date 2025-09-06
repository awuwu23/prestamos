// =============================
// 📌 Importaciones
// =============================
const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const esperarPDFyAnalizar = require('./pdfParser');
const generarMensajeResultado = require('./mensajeResultado');
const { consultarDominio } = require('./dominio');
const { NewMessage } = require('telegram/events');

// 📌 Importamos el Set compartido desde globals.js
const { usuariosEsperandoSexo } = require('./globals');

const delay = ms => new Promise(res => setTimeout(res, ms));

// =============================
// 📌 Función principal
// =============================
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

        // ✅ Handler antes de enviar el comando /federador
        const textoExtraPromise = esperarTextoExtraYAnalizar(client, bot, sock, numeroCliente, destino);

        const comandoFederador = `/federador ${dni}`;
        console.log(`📤 Enviando comando: ${comandoFederador}`);
        await client.sendMessage(bot, { message: comandoFederador });

        await delay(10000);

        const textoExtra = await textoExtraPromise;
        console.log('📃 Texto extra analizado:', textoExtra);
        console.log('🧬 Sexo detectado:', textoExtra?.sexo);

        // ⚠️ Si no hay sexo → pedirlo al usuario
        let generoDetectado = null;
        if (!textoExtra?.sexo) {
            console.warn('⚠️ Sexo no detectado. Pidiendo al usuario...');

            await sock.sendMessage(destino, {
                text: '⚠️ No pude identificar el sexo en el informe.\n\nPor favor escribí una de las siguientes opciones y enviámela:\n\n👉 *F* = Femenino\n👉 *M* = Masculino\n\n(Escribilo tal cual, solo una letra)'
            });

            usuariosEsperandoSexo.add(destino);

            try {
                generoDetectado = await esperarSexoUsuario(sock, destino);
                console.log('✅ Sexo ingresado manualmente:', generoDetectado);
            } finally {
                usuariosEsperandoSexo.delete(destino);
            }
        } else {
            generoDetectado = textoExtra.sexo.toUpperCase().startsWith('M') ? 'M' : 'F';
        }

        const comandoDni = `/dni ${dni} ${generoDetectado}`;
        console.log(`📤 Enviando comando: ${comandoDni}`);
        await client.sendMessage(bot, { message: comandoDni });

        // ✅ Reenviar todos los mensajes de /dni (35s)
        await reenviarMensajesDelBot(client, bot, sock, destino, 35000);

        let dominioResultado = null;
        if (textoExtra?.dominio) {
            const dominio = textoExtra.dominio;
            console.log(`⏳ Esperando 15s para consultar /dnrpa ${dominio}`);
            await delay(15000);
            dominioResultado = await consultarDominio(dominio, client, bot);
            console.log('✅ Resultado de /dnrpa:', dominioResultado);
        }

        // ✅ Flujo /work
        const pdfWorkPromise = esperarPDFyAnalizar(client, bot, numeroCliente, sock, destino);
        const comandoWork = `/work ${dni}`;
        console.log(`📤 Enviando comando: ${comandoWork}`);
        await client.sendMessage(bot, { message: comandoWork });

        const resultadoWork = await pdfWorkPromise;
        console.log('📊 Resultado PDF Work analizado:', resultadoWork);

        if (!resultadoWork || typeof resultadoWork !== 'object') {
            console.error('❌ No se obtuvo un resultado válido del informe Work.');
            await sock.sendMessage(destino, {
                text: '⚠️ No se pudo obtener el resultado del análisis del informe Work.',
            });
            return;
        }

        // 📤 Enviar PDF Work con caption
        if (resultadoWork?.pdfBuffer) {
            try {
                await sock.sendMessage(destino, {
                    document: resultadoWork.pdfBuffer,
                    fileName: resultadoWork.pdfFileName || `${dni}_work.pdf`,
                    mimetype: 'application/pdf',
                    caption: '📎 Informe Work'
                });
                console.log('📤 PDF Work enviado al cliente por WhatsApp.');
            } catch (err) {
                console.error('❌ Error al enviar PDF Work:', err);
            }
        }

        const { mensajePrincipal, mensajeVacunas } =
            await generarMensajeResultado(dni, resultadoWork, textoExtra, dominioResultado);
        if (mensajePrincipal) {
            await sock.sendMessage(destino, { text: mensajePrincipal });
        }
        if (mensajeVacunas) {
            await delay(1000);
            await sock.sendMessage(destino, { text: mensajeVacunas });
        }

        // 🔽 NUEVO FLUJO: /nosis
        console.log('🚀 Iniciando flujo para /nosis...');
        console.log('⏳ Esperando 20s para evitar anti-spam antes de /nosis...');
        await delay(20000);

        const pdfNosisPromise = esperarPDFyAnalizar(client, bot, numeroCliente, sock, destino);
        const nosisMensajesPromise = reenviarMensajesDelBot(client, bot, sock, destino, 25000);

        const comandoNosis = `/nosis ${dni}`;
        console.log(`📤 Enviando comando: ${comandoNosis}`);
        await client.sendMessage(bot, { message: comandoNosis });

        const resultadoNosis = await pdfNosisPromise;
        console.log('📊 Resultado PDF Nosis analizado:', resultadoNosis);

        await nosisMensajesPromise;

        if (!resultadoNosis || typeof resultadoNosis !== 'object') {
            console.error('❌ No se obtuvo un resultado válido del informe Nosis.');
            await sock.sendMessage(destino, {
                text: '⚠️ No se pudo obtener el resultado del informe Nosis.',
            });
        } else {
            // 📤 Enviar PDF Nosis con caption
            if (resultadoNosis?.pdfBuffer) {
                try {
                    await sock.sendMessage(destino, {
                        document: resultadoNosis.pdfBuffer,
                        fileName: resultadoNosis.pdfFileName || `${dni}_nosis.pdf`,
                        mimetype: 'application/pdf',
                        caption: '📎 Informe Nosis'
                    });
                    console.log('📤 PDF Nosis enviado al cliente por WhatsApp.');
                } catch (err) {
                    console.error('❌ Error al enviar PDF Nosis:', err);
                }
            }

            const { mensajePrincipal: mensajeNosis, mensajeVacunas: mensajeVacunasNosis } =
                await generarMensajeResultado(dni, resultadoNosis, textoExtra, dominioResultado);

            if (mensajeNosis) {
                await sock.sendMessage(destino, { text: mensajeNosis });
            }
            if (mensajeVacunasNosis) {
                await delay(1000);
                await sock.sendMessage(destino, { text: mensajeVacunasNosis });
            }
        }

        console.log('✅ Flujo completo finalizado.');
        return resultadoNosis;

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

// =============================
// 📌 Espera mensajes y analiza texto
// =============================
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
        }, 30000);
    });
}

// =============================
// 📌 Reenvía TODOS los mensajes del bot
// =============================
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

            console.log(`📦 [Reenvío Bot] Capturados ${mensajes.length} mensajes en ${delayMs / 1000}s`);

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

// =============================
// 📌 Analizador de texto
// =============================
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

    const sexoMatch = texto.match(/Sexo\s*[:\-]?\s*(M|F|Masculino|Femenino)/i);
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

// =============================
// 📌 Esperar sexo ingresado manualmente
// =============================
function esperarSexoUsuario(sock, destino, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        let terminado = false;

        const handler = async (m) => {
            try {
                if (terminado) return;
                if (m.type !== 'notify') return;
                if (!m.messages || m.messages.length === 0) return;

                const msg = m.messages[0];
                if (!msg?.key?.remoteJid) return;

                const from = msg.key.remoteJid;
                if (from !== destino) return;

                const texto =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    '';
                const clean = texto.trim().toUpperCase();

                if (clean === 'F' || clean === 'M') {
                    terminado = true;
                    sock.ev.off('messages.upsert', handler);

                    await sock.sendMessage(destino, {
                        text: `✅ Perfecto, registré el sexo como *${clean === 'F' ? 'Femenino' : 'Masculino'}*. Continuamos con la validación...`
                    });

                    resolve(clean);
                } else {
                    await sock.sendMessage(destino, {
                        text: '⚠️ Respuesta no válida.\n👉 Escribí solo *F* (Femenino) o *M* (Masculino).'
                    });
                }
            } catch (err) {
                console.error('❌ Error en esperarSexoUsuario:', err);
            }
        };

        sock.ev.on('messages.upsert', handler);

        setTimeout(() => {
            if (!terminado) {
                terminado = true;
                sock.ev.off('messages.upsert', handler);
                reject(new Error('Timeout esperando sexo del usuario.'));
            }
        }, timeoutMs);
    });
}

module.exports = validarIdentidad;






































