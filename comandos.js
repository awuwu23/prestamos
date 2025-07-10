const fs = require('fs');
const path = require('path');

const { limpiarNumero } = require('./cel');
const { manejarComandosExtra } = require('./comandos2');
const {
    verificarMembresia,
    yaUsoBusquedaGratis,
    registrarBusquedaGratis,
    tiempoRestante
} = require('./membresia');

const {
    manejarSub,
    manejarMe,
    manejarId,
    manejarAdm,
    manejarAdmins,
    adminList
} = require('./comandos/membre');

const { manejarCel, manejarMenu, manejarCredito } = require('./comandos/utiles');
const manejarRegistrar = require('./comandos/registrar');
const manejarDnrpa = require('./comandos/dnrpa');
const manejarValidacionDni = require('./comandos/validacionDni');
const manejarConsultaLibre = require('./comandos/consultaLibre');

const enProceso = new Set();

const dueños = ['5493813885182', '54927338121162993', '6500959070'];

function esTelegram(sock) {
    return typeof sock.sendMessage === 'function' && !sock.ev;
}

function normalizarNumero(numero) {
    const limpio = numero.toString().replace(/\D/g, '');
    if (/^\d{9,16}$/.test(limpio)) return limpio;
    if (limpio.startsWith('549')) return limpio;
    if (limpio.startsWith('54')) return '549' + limpio.slice(2);
    return '549' + limpio;
}

async function manejarMensaje(sock, msg) {
    try {
        const mensaje = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const texto = mensaje.trim();
        const comando = texto.toUpperCase();
        const from = msg.key.remoteJid;

        const esGrupoTelegram = esTelegram(sock) && from && from.startsWith('-100');
        const esGrupoWhatsApp = from?.endsWith?.('@g.us') || false;
        const esGrupo = esGrupoTelegram || esGrupoWhatsApp;

        console.log('\n📥 Nuevo mensaje recibido');
        console.log('📍 Es grupo:', esGrupo);
        console.log('📨 Remitente (msg.key.participant):', msg.key.participant);
        console.log('📨 Remitente (msg.key.remoteJid):', msg.key.remoteJid);

        let senderJid = esGrupo ? msg.key.participant : msg.key.remoteJid;
        if (!senderJid) {
            console.warn('❌ No se pudo determinar el remitente.');
            return;
        }

        const raw = senderJid.includes('@') ? senderJid.split('@')[0] : senderJid;
        const numero = esTelegram(sock) ? raw : normalizarNumero(raw);
        const numeroNormalizado = normalizarNumero(raw);
        const respuestaDestino = from;
        const fakeSenderJid = esTelegram(sock) ? `${numero}` : `${numero}@s.whatsapp.net`;

        console.log('📤 Número procesado:', numero);
        console.log('👑 ¿Es admin?:', adminList.includes(numeroNormalizado));
        console.log('📦 Comando recibido:', comando);

        const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
        const esDNI = /^\d{7,8}$/.test(comando);
        const esPatente = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) || /^[A-Z]{3}\d{3}$/.test(textoPlano);
        const esCelular = /^\d{9,12}$/.test(comando.replace(/\D/g, ''));
        const esCVU = /^\d{22}$/.test(comando.replace(/\D/g, ''));
        const esConsulta = esDNI || esPatente || esCelular || esCVU;

        const tieneMembresia = verificarMembresia(numeroNormalizado);
        const esAdmin = adminList.includes(numeroNormalizado);
        const esDueño = dueños.includes(numero) || dueños.includes(numeroNormalizado);

        if (esGrupoTelegram && !esDueño && !esAdmin && !tieneMembresia) {
            console.log(`🔒 Usuario en grupo de Telegram sin permisos: ${numero}`);
            return;
        }

        if (comando === '/ID') {
            console.log('🚀 Ejecutando /id');
            await manejarId(sock, numero, respuestaDestino, fakeSenderJid, esGrupo);
            return;
        }

        if (comando.startsWith('/ADM ') || comando === '/ADM') {
            console.log('🚀 Ejecutando /adm');
            if (texto.trim() === '/ADM') {
                await sock.sendMessage(respuestaDestino, {
                    text: '⚠️ Usá el comando correctamente:\n👉 *Ejemplo:* `/adm 5493815440516 Juan`'
                });
                return;
            }
            await manejarAdm(sock, numero, texto, respuestaDestino, adminList);
            return;
        }

        if (comando === '/ADMINS') {
            console.log('🚀 Ejecutando /admins');
            await manejarAdmins(sock, respuestaDestino);
            return;
        }

        if (comando.startsWith('/SUB ')) {
            console.log('🚀 Ejecutando /sub');
            await manejarSub(sock, numero, texto, respuestaDestino, adminList);
            return;
        }

        if (comando === '/ME') {
            console.log('🚀 Ejecutando /me');
            await manejarMe(sock, numero, respuestaDestino, fakeSenderJid, esGrupo, verificarMembresia, tiempoRestante, adminList);
            return;
        }

        if (!tieneMembresia && !esAdmin && !esDueño && esConsulta) {
            if (yaUsoBusquedaGratis(numeroNormalizado)) {
                await sock.sendMessage(respuestaDestino, {
                    text: '🔒 Ya usaste tu búsqueda gratuita. Contactá al *3813885182* para obtener membresía.'
                });
                return;
            }
            registrarBusquedaGratis(numeroNormalizado);
        }

        if (comando === '/CEL') {
            console.log('🚀 Ejecutando /cel');
            await manejarCel(sock, msg, comando, numero);
            return;
        }

        if (comando === '/MENU') {
            console.log('🚀 Ejecutando /menu');
            await manejarMenu(sock, respuestaDestino, fakeSenderJid, esGrupo);
            return;
        }

        if (comando.startsWith('/CREDITO ')) {
            console.log('🚀 Ejecutando /credito');
            await manejarCredito(sock, comando, respuestaDestino, fakeSenderJid, esGrupo);
            return;
        }

        if (comando === '/REGISTRAR') {
            console.log('🚀 Ejecutando /registrar');
            await manejarRegistrar(sock, msg, numero);
            return;
        }

        if (comando.startsWith('/DNRPA')) {
            console.log('🚀 Ejecutando /dnrpa');
            await manejarDnrpa(sock, comando, respuestaDestino, fakeSenderJid, esGrupo, numero);
            return;
        }

        if (await manejarComandosExtra(sock, msg, comando, numeroNormalizado)) return;
        if (enProceso.has(numero)) return;

        if (esGrupo && !comando.startsWith('/') && !esDNI && !esPatente && !esCelular && !esCVU) {
            console.log('🛑 Ignorado: mensaje no válido para grupo');
            return;
        }

        if (esDNI) {
            console.log('🚀 Ejecutando validación de DNI');
            await manejarValidacionDni(sock, msg, comando, numero, fakeSenderJid, esGrupo, enProceso, respuestaDestino);
            return;
        }

        const handled = await manejarConsultaLibre(sock, comando, numero, esGrupo, fakeSenderJid, respuestaDestino, enProceso);
        if (handled) {
            console.log('✅ Consulta libre manejada');
            return;
        }

        if (!esGrupo) {
            await sock.sendMessage(from, {
                text: '❓ Comando no reconocido. Escribí /menu para ver opciones disponibles.',
            });
        }

    } catch (err) {
        console.error('❌ Error al manejar mensaje:', err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Ocurrió un error procesando tu mensaje. Intentalo de nuevo.',
        });
    }
}

module.exports = manejarMensaje;
















