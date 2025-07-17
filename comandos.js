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
        const numeroNormalizado = normalizarNumero(rawSender);

        let idUsuario = numeroNormalizado;
        if (esGrupoWhatsApp) {
            idUsuario = rawSender;
        }

        const numeroSimple = normalizarNumero(rawSender);
        const respuestaDestino = from;
        const fakeSenderJid = esTelegram(sock) ? `${numeroSimple}` : `${numeroSimple}@s.whatsapp.net`;

        console.log('📤 ID usuario para membresía/admin:', idUsuario);
        console.log('📤 Número simple:', numeroSimple);
        console.log('👑 ¿Es admin?:', adminList.includes(numeroSimple));
        console.log('📦 Comando recibido:', comando);

        let tieneMembresia = verificarMembresia(idUsuario);
        const esAdmin = adminList.includes(numeroSimple);
        const esDueño = dueños.includes(numeroSimple);

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

        if (comando === '/ID') {
            console.log('🚀 Ejecutando /id');
            await manejarId(sock, idUsuario, respuestaDestino, fakeSenderJid, esGrupo);
            return;
        }

        if (comando.startsWith('/ADM ') || comando === '/ADM') {
            console.log('🚀 Ejecutando /adm');
            if (texto.trim() === '/ADM') {
                await sock.sendMessage(respuestaDestino, {
                    text: '⚠️ *Usá el comando correctamente:*\n\n📌 Ejemplo: /adm 5493815440516 Juan'
                });
                return;
            }
            await manejarAdm(sock, idUsuario, texto, respuestaDestino, adminList);
            return;
        }

        if (comando === '/ADMINS') {
            console.log('🚀 Ejecutando /admins');
            await manejarAdmins(sock, respuestaDestino);
            return;
        }

        if (comando.startsWith('/SUB ')) {
            console.log('🚀 Ejecutando /sub');
            await manejarSub(sock, idUsuario, texto, respuestaDestino, adminList);
            return;
        }

        if (comando === '/ME') {
            console.log('🚀 Ejecutando /me');
            await manejarMe(sock, idUsuario, respuestaDestino, fakeSenderJid, esGrupo, verificarMembresia, tiempoRestante, adminList);
            return;
        }

        if (!tieneMembresia && !esAdmin && !esDueño && esConsulta) {
            if (yaUsoBusquedaGratis(idUsuario)) {
                await sock.sendMessage(respuestaDestino, {
                    text: '🔒 *Ya usaste tu búsqueda gratuita.*\n\n📞 Contactá al *3813885182* para adquirir una membresía y continuar.'
                });
                return;
            }
            registrarBusquedaGratis(idUsuario);
        }

        if (esConsulta) {
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

            // Si no hay más consultas, procesamos la consulta de inmediato
            if (!agregado) {
                const estado = obtenerEstado();
                if (estado.tamaño <= 1) {
                    await sock.sendMessage(respuestaDestino, {
                        text: '⏳ *Procesando tu consulta...*'
                    });
                    return;
                }
                await sock.sendMessage(respuestaDestino, {
                    text: `📥 *Tu consulta ya está en la fila!*\n📌 Posición actual: *${estado.tamaño}*`
                });
                return;
            }

            await sock.sendMessage(respuestaDestino, {
                text: `⏳ *Consulta añadida a la fila!*\n📌 Posición: *${obtenerEstado().tamaño}*`
            });
            return;
        }

        if (comando === '/CEL') {
            console.log('🚀 Ejecutando /cel');
            await manejarCel(sock, msg, comando, idUsuario);
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
            await manejarRegistrar(sock, msg, idUsuario);
            return;
        }

        if (comando.startsWith('/DNRPA')) {
            console.log('🚀 Ejecutando /dnrpa');
            await manejarDnrpa(sock, comando, respuestaDestino, fakeSenderJid, esGrupo, idUsuario);
            return;
        }

        const manejado = await manejarComandosExtra(sock, msg, texto, idUsuario);
        console.log(`🟢 manejarComandosExtra retornó: ${manejado}`);
        if (manejado) return;

        if (enProceso.has(idUsuario)) return;

        if (esGrupo && !comando.startsWith('/') && !esDNI && !esPatente && !esCelular && !esCVU) {
            console.log('🛑 Ignorado: mensaje no válido para grupo');
            return;
        }

        if (!esGrupo) {
            await sock.sendMessage(from, {
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





















































