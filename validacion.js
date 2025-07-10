// validacion.js
const fs = require('fs');
const path = require('path');
const clientesPath = path.join(__dirname, 'clientes.json');

let registros = {};
const ADMIN_WA = '5493813885182@s.whatsapp.net';

function iniciarRegistro(numero) {
    registros[numero] = {
        paso: 0,
        datos: {},
        selfieFrase: generarFraseAzar(),
        aprobado: false,
    };
    return registros[numero];
}

function generarFraseAzar() {
    const frases = [
        'Soy cliente de Confianza Créditos',
        'Solicito un préstamo responsablemente',
        'Autorizo el análisis de mi perfil crediticio',
        'Mi nombre es real y acepto los términos',
    ];
    return frases[Math.floor(Math.random() * frases.length)];
}

function obtenerPaso(numero) {
    return registros[numero];
}

function validarCBU(cbu) {
    return /^[0-9]{22}$/.test(cbu) || /^[a-zA-Z0-9._-]{6,20}$/.test(cbu); // CBU o alias
}

function yaRegistrado(dni, numero) {
    if (!fs.existsSync(clientesPath)) return false;
    const existentes = JSON.parse(fs.readFileSync(clientesPath));
    return existentes.some(c => c.dni === dni || c.whatsapp === numero);
}

function guardarCliente(dni, datos, sock) {
    let existentes = [];
    if (fs.existsSync(clientesPath)) {
        existentes = JSON.parse(fs.readFileSync(clientesPath));
    }

    const registro = {
        ...datos,
        dni,
        whatsapp: datos.numero,
        fecha: new Date().toISOString(),
    };

    existentes.push(registro);
    fs.writeFileSync(clientesPath, JSON.stringify(existentes, null, 2));

    // Enviar resumen del registro al número administrador
    if (sock) {
        const resumen = generarResumenRegistro(registro);
        sock.sendMessage(ADMIN_WA, {
            text: resumen + `\n\n¿Aprobás el crédito para este cliente?\nResponde con: ✅ si   ❌ no`
        });
    }
}

function generarResumenRegistro(data) {
    return `📋 *Nuevo cliente registrado*

` +
        `• 👤 Nombre: ${data.nombre || '---'}
` +
        `• 🆔 DNI: ${data.dni || '---'}
` +
        `• 📞 Teléfono: ${data.telefono || '---'}
` +
        `• ✉️ Email: ${data.email || '---'}
` +
        `• 🏠 Dirección: ${data.direccion || '---'}
` +
        `• 💼 Trabajo: ${data.trabajo || '---'}
` +
        `• 💵 Ingresos: ${data.ingresos || '---'}
` +
        `• 📍 Domicilio laboral: ${data.dirTrabajo || '---'}
` +
        `• 📍 Domicilio real: ${data.dirReal || '---'}
` +
        `• 🏦 CBU/Alias: ${data.cbu || '---'}
` +
        `• ✅ Aprobado: ${data.aprobado ? 'Sí' : 'No'}
` +
        `🕓 Fecha: ${new Date().toLocaleString('es-AR')}`;
}

module.exports = {
    iniciarRegistro,
    obtenerPaso,
    guardarCliente,
    generarFraseAzar,
    validarCBU,
    generarResumenRegistro,
    yaRegistrado,
    ADMIN_WA
};

