// federador.js

const { botUsername, iniciarClienteTelegram } = require('./telegramClientNuevo');
const { NewMessage } = require('telegram/events');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Espera 15 segundos y busca licencia desde Telegram
async function buscarLicenciaDesdeTelegram(dni, sexo) {
    await new Promise(resolve => setTimeout(resolve, 15000));
    const client = await iniciarClienteTelegram();
    if (!client || !client.connected) {
        console.error('❌ Cliente Telegram no conectado');
        return '\n\n🪪 No se pudo consultar la licencia.';
    }

    const comando = `/licencia ${dni} ${sexo}`;
    console.log('🤖 Enviando comando al bot:', comando);

    try {
        await client.sendMessage(botUsername, { message: comando });
    } catch (err) {
        console.error('❌ Error al enviar comando:', err.message);
        return '\n\n🪪 Error al consultar licencia.';
    }

    return new Promise((resolve) => {
        let timeout;

        const handler = async (event) => {
            const mensaje = event.message?.message || '';
            if (
                mensaje.includes('🪪 Licencia de Conducir') ||
                mensaje.includes('❌ No se encontró información de licencia')
            ) {
                clearTimeout(timeout);
                client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

                if (mensaje.includes('🪪 Licencia de Conducir')) {
                    const inicio = mensaje.indexOf('🪪 Licencia de Conducir');
                    const licenciaTexto = mensaje.substring(inicio).trim();
                    resolve(`\n\n${licenciaTexto}`);
                } else {
                    resolve('\n\n❌ No se encontró información de licencia.');
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

        timeout = setTimeout(() => {
            client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));
            resolve('\n\n🪪 No se recibió respuesta del bot de licencias.');
        }, 15000);
    });
}

// 🧾 Consulta /nosis y descarga PDF, analiza y lo envía al WhatsApp
async function buscarNosisDesdeTelegram(dni, sock, jid) {
    const client = await iniciarClienteTelegram();
    if (!client || !client.connected) {
        console.error('❌ Cliente Telegram no conectado');
        return '\n\n📄 No se pudo consultar Nosis.';
    }

    const comando = `/nosis ${dni}`;
    console.log('🤖 Enviando comando al bot:', comando);

    try {
        await client.sendMessage(botUsername, { message: comando });
    } catch (err) {
        console.error('❌ Error al enviar /nosis:', err.message);
        return '\n\n📄 Error al enviar comando /nosis.';
    }

    return new Promise((resolve) => {
        let timeout;

        const handler = async (event) => {
            const msg = event.message;
            if (msg.media && msg.media.document && msg.media.document.mimeType === 'application/pdf') {
                clearTimeout(timeout);
                client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

                const fileName = msg.media.document.attributes?.find(attr => attr.fileName)?.fileName || `${dni}_nosis.pdf`;
                const filePath = path.join(__dirname, 'temp', fileName);

                // Descargar el PDF
                try {
                    const buffer = await client.downloadMedia(msg.media);
                    fs.writeFileSync(filePath, buffer);

                    // Analizar PDF
                    const data = await pdfParse(buffer);
                    const texto = data.text.trim().slice(0, 2000); // Limitamos el texto

                    // Enviar PDF por WhatsApp
                    await sock.sendMessage(jid, {
                        document: fs.readFileSync(filePath),
                        fileName: fileName,
                        mimetype: 'application/pdf'
                    });

                    console.log('✅ PDF enviado correctamente por WhatsApp');

                    resolve(`

📄 *Informe Nosis (resumen)*:
${texto || 'Sin contenido'}
`);
                } catch (e) {
                    console.error('❌ Error descargando o procesando el PDF:', e.message);
                    resolve('\n\n📄 Error al descargar o analizar el PDF de Nosis.');
                }
            }
        };

        client.addEventHandler(handler, new NewMessage({ fromUsers: botUsername }));

        timeout = setTimeout(() => {
            client.removeEventHandler(handler, new NewMessage({ fromUsers: botUsername }));
            resolve('\n\n📄 No se recibió el informe de Nosis.');
        }, 30000); // Espera 30 segundos máximo
    });
}

module.exports = {
    buscarLicenciaDesdeTelegram,
    buscarNosisDesdeTelegram
};





