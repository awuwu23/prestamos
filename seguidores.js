const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://smmsat.com/api/v2';
const API_KEY = 'c13032a392f3c76dbddc07d89d8e62b6';

// 📁 Archivo para tokens
const tokensFile = path.join(__dirname, '../tokens.json');
let tokens = {};
if (fs.existsSync(tokensFile)) {
    tokens = JSON.parse(fs.readFileSync(tokensFile));
}

function guardarTokens() {
    fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
}

function obtenerTokens(numero) {
    const num = numero.replace(/\D/g, '');
    return tokens[num] || 0;
}

function descontarTokens(numero, cantidad) {
    const num = numero.replace(/\D/g, '');
    tokens[num] = Math.max((tokens[num] || 0) - cantidad, 0);
    guardarTokens();
}

function normalizarNumero(numero) {
    return numero.replace(/\D/g, '').replace(/^0/, '54');
}

// 🕓 Pedidos pendientes por usuario
let pedidosPendientes = {};

async function procesarSeguidores(sock, msg, texto, numeroRemitente) {
    const from = msg.key.remoteJid;
    const remitenteNormalizado = normalizarNumero(numeroRemitente);

    // ✅ Si hay un pedido pendiente
    const pedido = pedidosPendientes[remitenteNormalizado];

    // 1️⃣ Paso: Detectar URL
    if (!pedido && texto.startsWith('http') && (
        texto.includes('instagram.com') ||
        texto.includes('tiktok.com') ||
        texto.includes('youtube.com')
    )) {
        console.log('🔗 Link detectado:', texto);

        // Detectar plataforma automáticamente
        let plataforma = '';
        if (texto.includes('instagram.com')) plataforma = 'instagram';
        else if (texto.includes('tiktok.com')) plataforma = 'tiktok';
        else if (texto.includes('youtube.com')) plataforma = 'youtube';

        pedidosPendientes[remitenteNormalizado] = { url: texto, plataforma, paso: 'esperandoCantidad' };

        // Preguntar cantidad
        await sock.sendMessage(from, {
            text: `👥 *¿Cuántos seguidores quieres para ${plataforma.toUpperCase()}?*\n💡 Escribe solo el número (ejemplo: 100, 500, 1000).`
        });
        return true;
    }

    // 2️⃣ Paso: Esperar cantidad
    if (pedido && pedido.paso === 'esperandoCantidad') {
        const cantidad = parseInt(texto);
        if (isNaN(cantidad) || cantidad <= 0) {
            await sock.sendMessage(from, {
                text: '⚠️ Ingresa una cantidad válida de seguidores (ejemplo: 100, 500, 1000).'
            });
            return true;
        }

        const tokensNecesarios = Math.ceil((cantidad / 100) * 10);
        const saldo = obtenerTokens(remitenteNormalizado);

        if (saldo < tokensNecesarios) {
            await sock.sendMessage(from, {
                text: `🚫 No tienes suficientes tokens.\n\n💰 Tokens disponibles: *${saldo}*\n📦 Necesarios: *${tokensNecesarios}*\n\n📌 Usa /tokens o pide a un administrador que cargue tokens.`
            });
            delete pedidosPendientes[remitenteNormalizado];
            return true;
        }

        pedido.cantidad = cantidad;
        pedido.tokens = tokensNecesarios;
        pedido.paso = 'esperandoConfirmacion';

        // 📸 Enviar imagen + texto juntos
        const instructivoPath = path.join(__dirname, '../seguidores.jpg');
        try {
            const imagenBuffer = fs.readFileSync(instructivoPath);
            await sock.sendMessage(from, {
                image: imagenBuffer,
                caption: `📄 *Instrucciones para cargar seguidores*\n\n✅ Antes de confirmar, asegúrate de:\n\n- 📱 Tener la cuenta en *público*.\n- ✅ Seguir los pasos indicados en esta imagen.\n\n✏️ Cuando estés listo, escribe *"SI"* para confirmar o *"NO"* para cancelar.`
            });
            console.log('✅ Imagen de instrucciones enviada junto al mensaje de confirmación.');
        } catch (err) {
            console.error('❌ Error al enviar la imagen de instrucciones:', err);
            await sock.sendMessage(from, {
                text: '⚠️ No se pudo enviar la imagen de instrucciones. Asegúrate de tener la cuenta en público y escribe *"SI"* para confirmar o *"NO"* para cancelar.'
            });
        }
        return true;
    }

    // 3️⃣ Paso: Confirmación del usuario
    if (pedido && pedido.paso === 'esperandoConfirmacion') {
        const respuesta = texto.trim().toUpperCase();

        if (respuesta === 'NO') {
            delete pedidosPendientes[remitenteNormalizado];
            await sock.sendMessage(from, { text: '❌ Pedido cancelado.' });
            return true;
        }

        if (respuesta === 'SI') {
            try {
                // ✅ Descontar tokens antes de la API
                descontarTokens(remitenteNormalizado, pedido.tokens);

                // ✅ Obtener servicios disponibles
                const serviciosResponse = await axios.post(API_URL, {
                    key: API_KEY,
                    action: 'services'
                });

                console.log('📦 Servicios disponibles:', serviciosResponse.data);

                const servicio = serviciosResponse.data.find(s =>
                    s.name.toLowerCase().includes('followers') &&
                    s.name.toLowerCase().includes(pedido.plataforma)
                );

                if (!servicio) {
                    await sock.sendMessage(from, {
                        text: `🚫 No hay servicio disponible para *${pedido.plataforma}* en este momento.`
                    });
                    // Reembolsar tokens si no hay servicio
                    descontarTokens(remitenteNormalizado, -pedido.tokens);
                    delete pedidosPendientes[remitenteNormalizado];
                    return true;
                }

                // ✅ Realizar el pedido
                const respuestaAPI = await axios.post(API_URL, {
                    key: API_KEY,
                    action: 'add',
                    service: servicio.service || servicio.id,
                    link: pedido.url,
                    quantity: pedido.cantidad
                });

                console.log('✅ Respuesta API pedido:', respuestaAPI.data);

                const idOrden = respuestaAPI.data.order;

                await sock.sendMessage(from, {
                    text: `🎉 *Pedido realizado con éxito*\n\n🆔 ID: *${idOrden}*\n📱 Plataforma: *${pedido.plataforma.toUpperCase()}*\n👥 Seguidores: *${pedido.cantidad}*\n💳 Tokens usados: *${pedido.tokens}*\n📦 Estado: *Pendiente...*`
                });
            } catch (error) {
                console.error('❌ Error al procesar seguidores:', error);
                await sock.sendMessage(from, {
                    text: '❌ Ocurrió un error al realizar el pedido. Intenta más tarde.'
                });
                // Reembolsar tokens si falla
                descontarTokens(remitenteNormalizado, -pedido.tokens);
            }

            delete pedidosPendientes[remitenteNormalizado];
            return true;
        }
    }

    return false;
}

module.exports = { procesarSeguidores };









