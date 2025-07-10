// comandos/registrar.js
const fs = require('fs');
const path = require('path');
const { manejarRegistro } = require('../registro');

const clientesPath = path.join(__dirname, '..', 'clientes.json');

async function manejarRegistrar(sock, msg, numero) {
    let dniAprobado = null;
    if (fs.existsSync(clientesPath)) {
        const clientes = JSON.parse(fs.readFileSync(clientesPath));
        const existente = clientes.find(c => c.whatsapp === numero && c.aprobado);
        if (existente) dniAprobado = existente.dni;
    }
    await manejarRegistro(sock, msg, dniAprobado);
    return true;
}

module.exports = manejarRegistrar;
