const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { buscarLicenciaDesdeTelegram } = require('./federador');

function formatearHistorial(historial) {
    return historial.map((item, i) => ` ${i + 1}. ${item}`).join('\n');
}

async function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 🔎 Buscar PDF tras comando /nosis
async function consultarNosisDesdeTelegram(client, dni, sock, jid) {
    try {
        // Enviar /nosis al bot
        await client.sendMessage('expertoPDF_Bot', { message: `/nosis ${dni}` });

        console.log('⌛ Esperando PDF...');
        const pdfMessage = await client.waitForEvent('newMessage', (event) => {
            return event.message?.media && event.message.media.document?.mimeType === 'application/pdf';
        }, 60000); // 60s timeout

        const document = pdfMessage.message.media.document;
        const buffer = await client.downloadMedia(document);

        const fileName = `nosis_${dni}.pdf`;
        const filePath = path.join(__dirname, 'temp', fileName);
        fs.writeFileSync(filePath, buffer);

        // Analizar contenido del PDF
        const data = await pdfParse(buffer);
        const textoPdf = data.text.trim().slice(0, 2000); // Limitamos tamaño para no saturar mensaje

        // Enviar PDF al WhatsApp del usuario
        await sock.sendMessage(jid, {
            document: fs.readFileSync(filePath),
            fileName: fileName,
            mimetype: 'application/pdf'
        });

        console.log(`✅ PDF de Nosis enviado al usuario (${fileName})`);

        return `

📄 *Informe Nosis (resumen):*
${textoPdf || 'Sin texto extraído del PDF.'}
`;

    } catch (e) {
        console.error('❌ Error al obtener PDF de Nosis:', e.message);
        return '\n⚠️ No se pudo obtener el informe de Nosis.';
    }
}

async function generarMensajeResultado(dni, resultado, textoExtra = '', dominioData = null, client, sock, jid) {
    if (textoExtra && typeof textoExtra === 'object') {
        resultado.nombreCompleto = resultado.nombreCompleto || textoExtra.nombreCompleto;
        resultado.cuit = resultado.cuit || textoExtra.cuit;
        resultado.sexo = resultado.sexo || textoExtra.sexo;
        resultado.nacimiento = resultado.nacimiento || textoExtra.nacimiento;
        resultado.gmail = resultado.gmail || textoExtra.gmail;
        resultado.domicilioTexto = resultado.domicilioTexto || textoExtra.domicilioTexto;
        resultado.celulares = resultado.celulares || textoExtra.celulares;
        resultado.familiares = resultado.familiares || textoExtra.familiares;
        resultado.vehiculos = resultado.vehiculos || textoExtra.vehiculos;
        resultado.historialLaboral = resultado.historialLaboral || textoExtra.historialLaboral;
        resultado.educacion = resultado.educacion || textoExtra.educacion;
        resultado.profesion = resultado.profesion || textoExtra.profesion;
    }

    const {
        deudas, acreedores, relacionLaboral, nivelSocio,
        referencias, motivo, edad, domicilioTexto, gmail,
        nombreCompleto, cuit, sexo, nacimiento,
        profesion, educacion
    } = resultado;

    const celulares = Array.isArray(resultado.celulares) ? resultado.celulares : [];
    const familiares = Array.isArray(resultado.familiares) ? resultado.familiares : [];
    const vehiculos = Array.isArray(resultado.vehiculos) ? resultado.vehiculos : [];
    const historialLaboral = Array.isArray(resultado.historialLaboral) ? resultado.historialLaboral : [];

    let mensajePrincipal = `
📄 *Resumen financiero de datos para DNI ${dni}*


╭━━ 💰 *Situación Financiera*
• Deudas: ${deudas || 'No disponible'}
• Acreedores: ${acreedores.length ? acreedores.join(', ') : 'Ninguno'}
• Relación laboral: ${relacionLaboral}
• Nivel socioeconómico: ${nivelSocio}
• Referencias comerciales: ${referencias}

╭━━ 📡 *Datos de Contacto*
• Domicilio: ${domicilioTexto || 'No encontrado'}
• Correo: ${gmail || 'No encontrado'}
• Celulares: ${celulares.length ? celulares.join(', ') : 'No disponibles'}
• Familiares: ${familiares.length ? familiares.join(', ') : 'No disponibles'}

╭━━ 🚗 *Vehículos registrados*
${vehiculos.length
        ? vehiculos.map((v, i) =>
            ` ${i + 1}. ${v.dominio || 'N/D'} - ${v.marca || 'Marca N/D'} ${v.modelo || 'Modelo N/D'} (${v.año || 'Año N/D'})`
        ).join('\n')
        : ' No disponibles'}

╭━━ 🧾 *Historial laboral*
${historialLaboral.length ? formatearHistorial(historialLaboral) : ' No disponible'}

╭━━ 📝 *Comentario*
• ${motivo || 'N/D'}
`.trim();

    if (dominioData) {
        mensajePrincipal += `



🚙 *Datos del vehículo consultado (/dnrpa)*

╭━━ 📄 *Texto completo del vehículo (/dnrpa)*

${dominioData.textoPlano}
`.trim();
    }

    // ✅ Consultar licencia con federador.js
    let mensajeLicencia = '';
    try {
        const sexoSimplificado = (sexo || '').toLowerCase().startsWith('f') ? 'F' : 'M';
        mensajeLicencia = await buscarLicenciaDesdeTelegram(dni, sexoSimplificado);
    } catch (e) {
        console.error('❌ Error al consultar licencia:', e.message);
        mensajeLicencia = '\n\n⚠️ No se pudo consultar el estado de la licencia.';
    }

    // Esperamos 15 segundos antes de consultar Nosis
    await esperar(15000);

    // 🧠 Consultar y analizar PDF Nosis
    const mensajeNosis = await consultarNosisDesdeTelegram(client, dni, sock, jid);

    return {
        mensajePrincipal: mensajePrincipal + mensajeLicencia + mensajeNosis,
        mensajeVacunas: ''
    };
}

module.exports = generarMensajeResultado;


















