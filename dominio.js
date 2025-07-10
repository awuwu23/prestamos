const path = require('path');
const quienSoy = __filename;
console.log('🧩 Archivo ejecutado:', quienSoy);

const telegramClientPath = path.resolve(__dirname, './telegramClientNuevo');
console.log('🔍 Cargando módulo:', telegramClientPath);

const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');

async function consultarDominio(dominio, clientArg = null, botArg = null) {
    console.log('\n🔧 Función consultarDominio INICIADA');
    console.log('📥 Dominio recibido:', dominio);

    const client = clientArg || await iniciarClienteTelegram();

    console.log('📦 Resultado de iniciarClienteTelegram:', client);
    console.log('📘 Tipo de client:', typeof client);
    console.log('📘 Constructor de client:', client?.constructor?.name || '[nulo]');
    console.log('📘 Métodos disponibles en client:', Object.keys(client || {}));
    console.log('📘 ¿Existe client.sendMessage?:', typeof client?.sendMessage);

    if (!client || typeof client !== 'object') {
        console.error('⛔ client es nulo, inválido o no es un objeto');
        return null;
    }

    try {
        const bot = botArg || await client.getEntity(botUsername);

        console.log('🤖 Bot obtenido:', bot?.username || '[sin username]');
        console.log('🤖 Bot ID:', bot?.id);
        console.log('🤖 Tipo de bot:', typeof bot);
        console.log('🤖 Constructor del bot:', bot?.constructor?.name);

        if (!bot) throw new Error('❌ No se pudo obtener el bot de Telegram');

        const comando = `/dnrpa ${dominio}`;
        console.log(`📤 Enviando comando ${comando} al bot...`);

        if (typeof client.sendMessage !== 'function') {
            console.error('⛔ client.sendMessage no está disponible');
            return null;
        }

        await client.sendMessage(bot.id, { message: comando });

        const resultado = await esperarRespuestaDominio(client, bot);
        console.log('📥 Texto recibido de /dnrpa:\n', resultado?.textoPlano || '[Vacío]');
        return resultado;
    } catch (err) {
        console.error('❌ Error en consultarDominio:', err);
        return null;
    }
}

async function analizarDominio(dominio, destino, sock) {
    console.log('\n🔍 Función analizarDominio INICIADA');
    console.log('📥 Dominio recibido:', dominio);

    const client = await iniciarClienteTelegram();
    if (!client) {
        await sock.sendMessage(destino, {
            text: '❌ No se pudo iniciar conexión con Telegram.',
        });
        return;
    }

    try {
        const bot = await client.getEntity(botUsername);
        const resultado = await consultarDominio(dominio, client, bot);

        if (!resultado) {
            await sock.sendMessage(destino, {
                text: '⚠️ No se obtuvo información del dominio. Verificá que esté bien escrito.',
            });
            return;
        }

        if (resultado.imagen) {
            await sock.sendMessage(destino, {
                image: resultado.imagen,
                caption: `📷 Imagen final del informe DNRPA para *${dominio}*.`
            });
        }

        if (resultado.textoPlano && resultado.textoPlano.length > 10) {
            const decorado = decorarTextoDominio(resultado.textoPlano);
            await sock.sendMessage(destino, {
                text: `📄 *Datos del dominio ${dominio}:*\n\n${decorado}`,
            });
        }
    } catch (err) {
        console.error('❌ Error en analizarDominio:', err);
        await sock.sendMessage(destino, {
            text: '❌ Ocurrió un error al procesar la patente.',
        });
    }
}

async function esperarRespuestaDominio(client, bot) {
    return new Promise((resolve) => {
        const mensajes = [];
        let textoListo = false;
        let imagenLista = false;
        let mediaBuffer = null;

        const terminar = () => {
            client.removeEventHandler(handler);
            const textoFinal = filtrarMensajesDominio(mensajes);
            resolve({ textoPlano: textoFinal, imagen: mediaBuffer });
        };

        const timeout = setTimeout(() => {
            console.log('⏱️ Tiempo agotado esperando /dnrpa');
            terminar();
        }, 20000);

        const handler = async (event) => {
            const msg = event.message;
            const fromBot = msg.senderId && msg.senderId.equals(bot.id);
            if (!fromBot) return;

            if (msg.message && typeof msg.message === 'string') {
                console.log('📨 Mensaje capturado del bot:', msg.message);
                mensajes.push(msg.message);

                if (!textoListo && /Patente:|Dominio:|Marca:|Modelo:|Chasis:/i.test(msg.message)) {
                    textoListo = true;
                    if (imagenLista) {
                        clearTimeout(timeout);
                        terminar();
                    }
                }
            }

            if (msg.media && !imagenLista) {
                try {
                    const buffer = await msg.downloadMedia();
                    if (buffer) {
                        mediaBuffer = buffer;
                        imagenLista = true;
                        console.log('🖼️ Imagen descargada correctamente.');
                        if (textoListo) {
                            clearTimeout(timeout);
                            terminar();
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Error descargando media:', e);
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({}));
    });
}

function filtrarMensajesDominio(mensajes) {
    const textoCrudo = mensajes.join('\n\n');
    if (textoCrudo.includes('Debes esperar') && textoCrudo.includes('inténtalo de nuevo')) {
        console.warn('⛔ Anti-spam detectado. Se aborta procesamiento.');
        return '';
    }

    const utiles = mensajes.filter(msg =>
        !msg.includes('consume 2 tokens') &&
        !msg.includes('Por favor, espera') &&
        !msg.includes('Buscando DNRPA') &&
        msg.length > 10
    );
    return utiles.join('\n\n').trim();
}

function decorarTextoDominio(texto) {
    let decorado = texto
        .replace(/\[>>>]/g, '🔹')
        .replace(/Patente:/g, '🚗 *Patente:*')
        .replace(/Dominio Anterior:/g, '↩️ *Dominio Anterior:*')
        .replace(/Placa:/g, '📛 *Placa:*')
        .replace(/Procedencia:/g, '🌍 *Procedencia:*')
        .replace(/Fecha Inscripci[oó]n?:/gi, '📅 *Fecha Inscripción:*')
        .replace(/Fabrica:/g, '🏭 *Fábrica:*')
        .replace(/Marca:/g, '🏷️ *Marca:*')
        .replace(/Modelo:/g, '📦 *Modelo:*')
        .replace(/Tipo:/g, '⚙️ *Tipo:*')
        .replace(/Marca Chasis:/g, '🧱 *Marca Chasis:*')
        .replace(/Chasis:/g, '🔩 *Chasis:*')
        .replace(/Marca Motor:/g, '🛠️ *Marca Motor:*')
        .replace(/NRO Motor:/g, '🔧 *N° Motor:*')
        .replace(/Nombre:/g, '🧑 *Nombre:*')
        .replace(/CUIT:/g, '💼 *CUIT:*')
        .replace(/D\.N\.I:/g, '🪪 *DNI:*')
        .replace(/Calle:/g, '🏠 *Calle:*')
        .replace(/Numero:/g, '🔢 *Número:*')
        .replace(/Localidad:/g, '🌆 *Localidad:*')
        .replace(/Provincia:/g, '🗺️ *Provincia:*')
        .replace(/Estado:/g, '📌 *Estado:*')
        .replace(/Denuncia:/g, '🚨 *Denuncia:*')
        .replace(/Fecha Denuncia:/g, '📅 *Fecha Denuncia:*')
        .replace(/Delito:/g, '⚖️ *Delito:*')
        .replace(/Fecha Emision:/g, '🗓️ *Fecha Emisión:*')
        .replace(/NRO CEDULA:/g, '📄 *N° Cédula:*');

    if (/INHIBIDO/i.test(texto)) decorado += '\n\n🚫 *¡ATENCIÓN!* El vehículo se encuentra inhibido.';
    if (/PRENDA/i.test(texto)) decorado += '\n\n⚠️ *¡ALERTA!* El vehículo tiene una prenda registrada.';
    if (/PROHIBICION DE CIRCULAR/i.test(texto)) decorado += '\n\n🛑 *¡URGENTE!* El vehículo tiene prohibición de circular.';

    return decorado;
}

function analizarDominioTexto(texto) {
    if (!texto || texto.length < 10) return null;
    const resultado = { textoPlano: texto.trim() };
    return resultado;
}

module.exports = {
    consultarDominio,
    analizarDominio
};







