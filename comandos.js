const fs = require('fs');
const path = require('path');

const { limpiarNumero } = require('./cel');
const { manejarComandosExtra } = require('./comandos2');
const {
    verificarMembresia,
    yaUsoBusquedaGratis,
    registrarBusquedaGratis,
    tiempoRestante,
    actualizarIdGrupo,
    normalizarNumero
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

// ✅ Cola centralizada
const { agregarConsulta, obtenerEstado } = require('./cola');

const enProceso = new Set();
const dueños = ['5493813885182', '54927338121162993', '6500959070'];

function esTelegram(sock) {
    return typeof sock.sendMessage === 'function' && !sock.ev;
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

        const rawSender = senderJid.includes('@') ? senderJid.split('@')[0] : senderJid;
        const numeroSimple = normalizarNumero(rawSender);
        const fakeSenderJid = esTelegram(sock) ? `${numeroSimple}` : `${numeroSimple}@s.whatsapp.net`;
        const respuestaDestino = from;

        const esAdmin = adminList.includes(numeroSimple);
        const esDueño = dueños.includes(numeroSimple);
        const idUsuario = numeroSimple;

        console.log('📤 ID usuario para membresía/admin:', idUsuario);
        console.log('📤 Número simple:', numeroSimple);
        console.log('👑 ¿Es admin?:', esAdmin);
        console.log('📦 Comando recibido:', comando);

        let tieneMembresia = verificarMembresia(idUsuario);

        if (tieneMembresia) {
            const membresias = require('./membresia').cargarMembresias();
            const membresiaActual = membresias[numeroSimple];
            if (membresiaActual && (!membresiaActual.idGrupo || membresiaActual.idGrupo !== idUsuario)) {
                console.log(`🔄 Actualizando idGrupo para ${numeroSimple} con ${idUsuario}`);
                actualizarIdGrupo(numeroSimple, idUsuario);
            }
        }

        if (esGrupoTelegram && !esDueño && !esAdmin && !tieneMembresia) {
            console.log(`🔒 Usuario en grupo de Telegram sin permisos: ${numeroSimple}`);
            return;
        }

        const textoPlano = comando.replace(/[^A-Z0-9]/gi, '');
        const esDNI = /^\d{7,8}$/.test(comando);
        const esPatente = /^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/.test(textoPlano) || /^[A-Z]{3}\d{3}$/.test(textoPlano);
        const esCelular = /^\d{9,12}$/.test(comando.replace(/\D/g, ''));
        const esCVU = /^\d{22}$/.test(comando.replace(/\D/g, ''));
        const esConsulta = esDNI || esPatente || esCelular || esCVU;

        // === Comandos ===

        if (comando === '/ID') {
            console.log('🚀 Ejecutando /id');
            return await manejarId(sock, idUsuario, respuestaDestino, fakeSenderJid, esGrupo);
        }

        if (comando === '/ADMINS') {
            console.log('🚀 Ejecutando /admins');
            return await manejarAdmins(sock, respuestaDestino);
        }

        if (comando === '/ME') {
            console.log('🚀 Ejecutando /me');
            return await manejarMe(sock, idUsuario, respuestaDestino, fakeSenderJid, esGrupo, verificarMembresia, tiempoRestante, adminList);
        }

        if (comando.startsWith('/ADM ') || comando === '/ADM') {
            console.log('🚀 Ejecutando /adm');
            if (texto.trim() === '/ADM') {
                return await sock.sendMessage(respuestaDestino, {
                    text: '⚠️ *Usá el comando correctamente:*\n\n📌 Ejemplo: /adm 5493815440516 Juan'
                });
            }
            return await manejarAdm(sock, idUsuario, texto, respuestaDestino, adminList);
        }

        if (comando.startsWith('/SUB ')) {
            console.log('🚀 Ejecutando /sub');
            return await manejarSub(sock, idUsuario, texto, respuestaDestino, adminList);
        }

        if (comando === '/CEL') {
            console.log('🚀 Ejecutando /cel');
            return await manejarCel(sock, msg, comando, idUsuario);
        }

        if (comando === '/MENU') {
            console.log('🚀 Ejecutando /menu');
            return await manejarMenu(sock, respuestaDestino, fakeSenderJid, esGrupo);
        }

        if (comando === '/REGISTRAR') {
            console.log('🚀 Ejecutando /registrar');
            return await manejarRegistrar(sock, msg, idUsuario);
        }

        if (comando.startsWith('/DNRPA')) {
            console.log('🚀 Ejecutando /dnrpa');
            return await manejarDnrpa(sock, comando, respuestaDestino, fakeSenderJid, esGrupo, idUsuario);
        }

        if (comando.startsWith('/CREDITO ')) {
            console.log('🚀 Ejecutando /credito');
            return await manejarCredito(sock, comando, respuestaDestino, fakeSenderJid, esGrupo);
        }

        // === Consultas ===
        if (esConsulta) {
            if (!esAdmin && !esDueño && !tieneMembresia) {
                if (yaUsoBusquedaGratis(idUsuario)) {
                    return await sock.sendMessage(respuestaDestino, {
                        text: '🔒 *Ya usaste tu búsqueda gratuita.*\n\n📞 Contactá al *3813885182* para adquirir una membresía y continuar.'
                    });
                }
                registrarBusquedaGratis(idUsuario);
            }

            const agregado = agregarConsulta(sock, {
                idUsuario,
                destino: respuestaDestino,
                fn: async () => {
                    if (esDNI) {
                        console.log('🚀 Ejecutando validación de DNI');
                        await manejarValidacionDni(sock, msg, comando, idUsuario, fakeSenderJid, esGrupo, enProceso, respuestaDestino);
                    } else {
                        console.log('🚀 Ejecutando consulta libre');
                        await manejarConsultaLibre(sock, comando, idUsuario, esGrupo, fakeSenderJid, respuestaDestino, enProceso);
                    }
                }
            });

            if (!agregado) {
                const estado = obtenerEstado();
                if (estado.tamaño <= 1) {
                    return await sock.sendMessage(respuestaDestino, {
                        text: '⏳ *Procesando tu consulta...*'
                    });
                }
                return await sock.sendMessage(respuestaDestino, {
                    text: `📥 *Tu consulta ya está en la fila!*\n📌 Posición actual: *${estado.tamaño}*`
                });
            }

            return await sock.sendMessage(respuestaDestino, {
                text: `⏳ *Consulta añadida a la fila!*\n📌 Posición: *${obtenerEstado().tamaño}*`
            });
        }

        // === Comandos extra ===
        const manejado = await manejarComandosExtra(sock, msg, texto, idUsuario);
        console.log(`🟢 manejarComandosExtra retornó: ${manejado}`);
        if (manejado) return;

        // === Mensajes no reconocidos ===
        if (enProceso.has(idUsuario)) return;

        if (esGrupo && !comando.startsWith('/') && !esDNI && !esPatente && !esCelular && !esCVU) {
            console.log('🛑 Ignorado: mensaje no válido para grupo');
            return;
        }

        if (!esGrupo) {
            return await sock.sendMessage(from, {
                text: '❓ *Comando no reconocido.*\n\n📖 Escribí */menu* para ver las opciones disponibles.'
            });
        }

    } catch (err) {
        console.error('❌ Error al manejar mensaje:', err);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ *Ocurrió un error procesando tu mensaje.*\n\n❌ Por favor intentá nuevamente.'
        });
    }
}

module.exports = manejarMensaje;





















































