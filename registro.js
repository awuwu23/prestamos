// registro.js
const { iniciarRegistro, obtenerPaso, guardarCliente, validarCBU, yaRegistrado } = require('./validacion');

const preguntas = [
    { campo: 'nombre', texto: '1️⃣ Ingrese su *nombre completo*:' },
    { campo: 'telefono', texto: '2️⃣ Ingrese su *número de teléfono* (sin 0 ni 15):' },
    { campo: 'email', texto: '3️⃣ Ingrese su *email*:' },
    { campo: 'direccion', texto: '4️⃣ Ingrese su *dirección* (calle, número, ciudad):' },
    { campo: 'ingresos', texto: '5️⃣ ¿Cuánto gana al mes (aproximadamente)?' },
    { campo: 'trabajo', texto: '6️⃣ ¿En qué trabaja actualmente?' },
    { campo: 'dirTrabajo', texto: '7️⃣ Ingrese la *dirección de su trabajo*:' },
    { campo: 'dirReal', texto: '8️⃣ Ingrese la *dirección donde vive actualmente*:' },
    { campo: 'dirAuditoria', texto: '9️⃣ Ingrese la *dirección donde podemos auditarlo*:' },
    { campo: 'cbu', texto: '🔟 Ingrese su *CBU o alias* bancario:' },
];

async function manejarRegistro(sock, msg, dniAprobado) {
    const numero = msg.key.remoteJid.replace('@s.whatsapp.net', '');
    if (!dniAprobado) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Su DNI no está aprobado para crédito. Si posee una garantía real, por favor comuníquese con un asesor.'
        });
        return;
    }

    if (yaRegistrado(dniAprobado, numero)) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Usted ya está registrado como cliente. No es posible registrar el mismo DNI o número más de una vez.'
        });
        return;
    }

    const paso = obtenerPaso(numero) || iniciarRegistro(numero);

    const mensaje = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const texto = mensaje.trim();

    if (paso.paso > 0 && paso.paso <= preguntas.length) {
        const actual = preguntas[paso.paso - 1];
        paso.datos[actual.campo] = texto;
    }

    if (paso.paso === preguntas.length) {
        if (!validarCBU(paso.datos.cbu)) {
            await sock.sendMessage(msg.key.remoteJid, { text: '❌ El CBU o alias no es válido. Intente de nuevo.' });
            paso.paso--;
            return;
        }

        paso.datos.numero = numero;
        paso.datos.aprobado = true;
        guardarCliente(dniAprobado, paso.datos, sock);

        await sock.sendMessage(msg.key.remoteJid, {
            text: '✅ Registro completado. Su solicitud será revisada y será contactado próximamente.'
        });

        return;
    }

    const siguiente = preguntas[paso.paso];
    await sock.sendMessage(msg.key.remoteJid, { text: siguiente.texto });
    paso.paso++;
}

module.exports = {
    manejarRegistro
};
