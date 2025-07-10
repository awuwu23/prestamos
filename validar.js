const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const esperarPDFyAnalizar = require('./pdfParser');
const esperarTextoExtraYAnalizar = require('./extraDataParser');
const generarMensajeResultado = require('./mensajeResultado');
const { consultarDominio } = require('./dominio');

async function validarIdentidad(dni, numeroCliente, sock, msg) {
    console.log('🚀 [validarIdentidad] Iniciando validación de identidad...');
    console.log('📍 DNI:', dni);
    console.log('📍 Número cliente:', numeroCliente);

    const destino = msg?.key?.remoteJid || (numeroCliente + '@s.whatsapp.net');
    console.log('📨 Destino de respuesta:', destino);

    const client = await iniciarClienteTelegram();
    console.log('📦 Resultado de iniciarClienteTelegram:', client);

    if (!client || typeof client.sendMessage !== 'function') {
        console.error('⛔ Cliente Telegram no válido o método sendMessage inexistente.');
        return;
    }

    try {
        const bot = await client.getEntity(botUsername);
        console.log('🤖 Bot obtenido:', bot?.username || '[Sin username]');
        if (!bot) throw new Error('❌ No se pudo obtener el bot.');

        const inicioNosis = Date.now();
        const comandoNosis = `/nosis ${dni}`;
        console.log(`📤 Enviando comando: ${comandoNosis}`);
        await client.sendMessage(bot, { message: comandoNosis });

        const resultado = await esperarPDFyAnalizar(client, bot, numeroCliente, sock, destino);
        console.log('📊 Resultado PDF analizado:', resultado);

        if (!resultado || typeof resultado !== 'object') {
            console.error('❌ No se obtuvo un resultado válido del informe.');
            if (sock && destino) {
                await sock.sendMessage(destino, {
                    text: '⚠️ No se pudo obtener el resultado del análisis del informe.',
                });
            }
            return;
        }

        const tiempoTranscurrido = Date.now() - inicioNosis;
        const minimoEspera = 30000;
        if (tiempoTranscurrido < minimoEspera) {
            const esperaRestante = minimoEspera - tiempoTranscurrido;
            console.log(`⏱️ Esperando ${esperaRestante} ms antes de enviar /dni...`);
            await new Promise(resolve => setTimeout(resolve, esperaRestante));
        }

        const generoDetectado = resultado.sexo || 'F';
        const comandoDni = `/dni ${dni} ${generoDetectado}`;
        console.log(`📤 Enviando comando: ${comandoDni}`);
        await client.sendMessage(bot, { message: comandoDni });

        const textoExtra = await Promise.race([
            esperarTextoExtraYAnalizar(client, bot, sock, numeroCliente, destino),
            new Promise(resolve => setTimeout(() => {
                console.warn('⚠️ Tiempo de espera excedido para texto extra.');
                resolve({});
            }, 30000))
        ]);

        console.log('📃 Texto adicional analizado:', textoExtra);

        let dominioResultado = null;
        if (textoExtra?.dominio) {
            const dominio = textoExtra.dominio;
            console.log(`⏳ Esperando 15s para consultar dominio principal: ${dominio}`);
            await new Promise(resolve => setTimeout(resolve, 15000));
            dominioResultado = await consultarDominio(dominio, client, bot);
            console.log('✅ Resultado de /dnrpa:', dominioResultado);

            if (textoExtra.dominios?.length > 1) {
                const otros = textoExtra.dominios.slice(1);
                const vehiculoTexto = textoExtra.vehiculos?.map(v =>
                    `${v.dominio} Marca: ${v.marca}\nModelo: ${v.modelo}\nAño: ${v.año}`
                ).join('\n') || '';

                const detalleDominios = otros.map(dom => {
                    const regex = new RegExp(`${dom}.*?(Marca:.*?\\n)?(Modelo:.*?\\n)?(Año:.*?\\n)?`, 'i');
                    const match = vehiculoTexto.match(regex);

                    const marca = (match?.[1] || '').replace(/Marca:\s*/i, '').trim() || 'Marca N/D';
                    const modelo = (match?.[2] || '').replace(/Modelo:\s*/i, '').trim() || 'Modelo N/D';
                    const año = (match?.[3] || '').replace(/Año:\s*/i, '').trim() || 'Año N/D';

                    return `• ${dom}: ${marca} ${modelo} (${año})`;
                }).join('\n');

                await sock.sendMessage(destino, {
                    text: `📌 También se detectaron estas otras patentes:\n\n${detalleDominios}\n\n✳️ Si deseas más información detallada, mandá el comando /dnrpa PATENTE`
                });
            }
        }

        // ⬇️ NUEVO: Generar mensaje dividido
        const { mensajePrincipal, mensajeVacunas } = await generarMensajeResultado(dni, resultado, textoExtra, dominioResultado);
        console.log('📤 Enviando resultado al cliente por WhatsApp...');
        console.log('🧾 Destinatario:', destino);
        console.log('📝 Mensaje generado:', mensajePrincipal);

        if (!sock || !destino) {
            console.error('❌ sock o destino no definidos.');
            return;
        }

        try {
            await sock.sendMessage(destino, { text: mensajePrincipal });
            if (mensajeVacunas) {
                await new Promise(r => setTimeout(r, 1000));
                await sock.sendMessage(destino, { text: mensajeVacunas });
            }
            console.log('✅ Mensaje principal enviado correctamente.');
        } catch (err) {
            console.error('❌ Error al enviar mensaje por WhatsApp:', err);
        }

        console.log('🏁 [validarIdentidad] Finalizado correctamente.');
        return resultado;

    } catch (err) {
        console.error('❌ Error en validarIdentidad:', err);
        if (sock && destino) {
            await sock.sendMessage(destino, {
                text: '⚠️ Hubo un error al procesar la validación. Intentalo más tarde.',
            });
        }
        return {
            deudas: 'Error',
            motivo: 'Error durante la validación.',
            acreedores: []
        };
    }
}

module.exports = validarIdentidad;



























