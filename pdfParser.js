const { NewMessage } = require('telegram/events');
const pdf = require('pdf-parse');

async function esperarPDFyAnalizar(client, bot, numeroCliente, sock, destino) {
    return new Promise((resolve) => {
        console.log('🕒 Esperando PDF...');
        let resolved = false;
        const textos = [];

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                client.removeEventHandler(handler);
                console.log('⏱️ Tiempo agotado. No se recibió PDF.');
                resolve({
                    deudas: 'No recibido',
                    motivo: 'No se recibió el informe en el tiempo esperado',
                    acreedores: []
                });
            }
        }, 60000);

        const handler = async (event) => {
            if (resolved) return;

            try {
                const msg = event.message;
                const fromBot = msg.senderId && msg.senderId.equals(bot.id);
                if (!fromBot) return;

                if (msg.message && !msg.media) {
                    console.log('📩 Texto recibido:', msg.message);
                    textos.push(msg.message);
                    return;
                }

                if (msg.media?.document) {
                    const fileName = msg.media.document.attributes.find(attr => attr.fileName)?.fileName || '';
                    console.log(`📁 Documento detectado: ${fileName}`);
                    if (!fileName.endsWith('.pdf')) return;

                    let buffer, data;
                    try {
                        console.log('📥 Descargando PDF...');
                        buffer = await client.downloadMedia(msg.media);
                        console.log('✅ PDF descargado correctamente.');
                        data = await pdf(buffer);
                        console.log('✅ PDF parseado correctamente.');
                    } catch (e) {
                        console.error('❌ Error procesando el PDF:', e);
                        return;
                    }

                    const texto = data.text;
                    const rechazado = /Resultado\s*:\s*Rechazado/i.test(texto);
                    const tieneDeudas = /DEUDA|MOROSO|VERAZ/i.test(texto);

                    const acreedores = texto.split('\n').filter(l =>
                        /BANCO|TARJETA|CREDITO|COOPERATIVA|FINANCIERA|EMPRESA/i.test(l)
                    ).map(l => l.trim());

                    const relacionLaboral = (texto.match(/Relaci[oó]n laboral.*?:\s*(.*)/i) || [])[1] || 'No especificada';
                    const nivelSocio = (texto.match(/Nivel Socioecon[oó]mico.*?:\s*(.*)/i) || [])[1] || 'No indicado';
                    const referencias = (texto.match(/Referencias comerciales.*?:\s*(.*)/i) || [])[1] || 'Sin referencias';

                    let edad = null;
                    const nacimientoMatch = texto.match(/Fecha de nacimiento\s*:? (\d{2}\/\d{2}\/\d{4})/i);
                    if (nacimientoMatch) {
                        const [day, month, year] = nacimientoMatch[1].split('/');
                        const nacimiento = new Date(`${year}-${month}-${day}`);
                        const hoy = new Date();
                        edad = hoy.getFullYear() - nacimiento.getFullYear();
                        if (
                            hoy.getMonth() < nacimiento.getMonth() ||
                            (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())
                        ) edad--;
                    }

                    const sexoMatch = texto.match(/Sexo\s*[:\-]?\s*(F|M|Femenino|Masculino)/i);
                    const sexo = sexoMatch ? (sexoMatch[1].toUpperCase().startsWith('F') ? 'F' : 'M') : 'F';

                    const validaciones = [
                        /Correo validado: SI/i.test(texto),
                        /Celular validado: SI/i.test(texto),
                        /CBU validado: SI/i.test(texto),
                        /Cuestionario respondido: SI/i.test(texto)
                    ];
                    const validacionesCompletas = validaciones.filter(Boolean).length;

                    clearTimeout(timeout);
                    resolved = true;
                    client.removeEventHandler(handler);

                    // ✅ Enviar el PDF al grupo o privado
                    if (sock && destino) {
                        await sock.sendMessage(destino, {
                            document: buffer,
                            mimetype: 'application/pdf',
                            fileName: fileName || 'informe_nosis.pdf'
                        });
                    }

                    // ✅ Reenviar los textos (si hay varios intermedios)
                    if (sock && destino && textos.length > 2) {
                        for (let i = 1; i < textos.length - 1; i++) {
                            await sock.sendMessage(destino, { text: textos[i] });
                        }
                    }

                    resolve({
                        deudas: rechazado || tieneDeudas ? 'Sí' : 'No',
                        acreedores,
                        rechazado,
                        relacionLaboral,
                        nivelSocio,
                        referencias,
                        edad,
                        sexo,
                        validacionesCompletas,
                        pdfBuffer: buffer,
                        pdfFileName: fileName || 'informe_nosis.pdf'
                    });
                }
            } catch (err) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    client.removeEventHandler(handler);
                    console.error('❌ Error inesperado:', err);
                    resolve({
                        deudas: 'Error',
                        motivo: 'Error al procesar el informe PDF',
                        acreedores: []
                    });
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({}));
    });
}

module.exports = esperarPDFyAnalizar;
