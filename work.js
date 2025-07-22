const { iniciarClienteTelegram, botUsername } = require('./telegramClientNuevo');
const esperarPDFyAnalizar = require('./pdfParser');
const esperarTextoExtraYAnalizar = require('./extraDataParser');
const generarMensajeResultado = require('./mensajeResultado');
const { consultarDominio } = require('./dominio');

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

        // 1️⃣ Enviar /federador
        const comandoFederador = `/federador ${dni}`;
        console.log(`📤 Enviando comando: ${comandoFederador}`);
        await client.sendMessage(bot, { message: comandoFederador });

        // Esperar 15s
        await delay(15000);

        // 2️⃣ Analizar respuesta
        const textoExtra = await Promise.race([
            esperarTextoExtraYAnalizar(client, bot, sock, numeroCliente, destino),
            new Promise(resolve => setTimeout(() => {
                console.warn('⏰ Timeout esperando respuesta de federador');
                resolve({});
            }, 30000))
        ]);
        console.log('📃 Texto extra analizado:', textoExtra);
        console.log('🧬 Sexo detectado:', textoExtra?.sexo);

        // Verificar si se extrajo correctamente el sexo
        if (!textoExtra?.sexo) {
            console.warn('⚠️ Sexo no detectado. Cancelando flujo para evitar error en /dni');
            await sock.sendMessage(destino, {
                text: '⚠️ No se pudo obtener el sexo desde el informe federador. Reintentá más tarde.',
            });
            return;
        }

        // 3️⃣ Enviar /dni
        const generoDetectado = textoExtra.sexo.toUpperCase().startsWith('M') ? 'M' : 'F';
        const comandoDni = `/dni ${dni} ${generoDetectado}`;
        console.log(`📤 Enviando comando: ${comandoDni}`);
        await client.sendMessage(bot, { message: comandoDni });

        // Esperar 15s
        await delay(15000);

        // 4️⃣ Consultar dominio si hay
        let dominioResultado = null;
        if (textoExtra?.dominio) {
            const dominio = textoExtra.dominio;
            console.log(`⏳ Esperando 15s para consultar /dnrpa ${dominio}`);
            await delay(15000);
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

        // 5️⃣ Enviar /work
        const comandoWork = `/work ${dni}`;
        console.log(`📤 Enviando comando: ${comandoWork}`);
        await client.sendMessage(bot, { message: comandoWork });

        // Esperar 15s antes de esperar el PDF
        await delay(15000);

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

        // 6️⃣ Generar mensaje completo
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
                await delay(1000);
                await sock.sendMessage(destino, { text: mensajeVacunas });
            }
            console.log('✅ Mensaje enviado correctamente.');
        } catch (err) {
            console.error('❌ Error al enviar mensaje por WhatsApp:', err);
        }

        console.log('🏁 [validarIdentidad] Finalizado correctamente.');
        return resultado;

    } catch (err) {
        console.error('❌ Error general en validarIdentidad:', err);
        if (sock && destino) {
            await sock.sendMessage(destino, {
                text: '⚠️ Hubo un error durante la validación.',
            });
        }
        return {
            deudas: 'Error',
            motivo: 'Error durante la validación',
            acreedores: []
        };
    }
}

module.exports = validarIdentidad;






























