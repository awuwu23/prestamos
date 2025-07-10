// telegramClientNuevo.js - con trazas para depurar origen del valor de client

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');

console.log('📦 [telegramClientNuevo.js] Módulo cargado');

const apiId = 25130211;
const apiHash = '37dd15c3620434489c143d0f4fd89e4c';
const botUsername = '@ExpertoPDF_Bot';
const sessionFile = 'telegram.session';

let telegramInstance = null;

async function iniciarClienteTelegram() {
    console.log('\n⚙️ [iniciarClienteTelegram] Función invocada');

    console.log('🔍 Estado inicial de telegramInstance:', telegramInstance);
    console.log('🔍 Tipo de telegramInstance:', typeof telegramInstance);
    if (typeof telegramInstance !== 'object') {
        console.warn('⚠️ [iniciarClienteTelegram] Valor inesperado detectado. Se mostrará trace.');
        console.trace('🔎 Stack trace del valor corrupto de telegramInstance');
    }

    if (telegramInstance && telegramInstance.connected) {
        console.log('✅ Cliente ya conectado. Reutilizando...');
        return telegramInstance;
    }

    // Intentar reconectar si existe pero está desconectado
    if (telegramInstance && !telegramInstance.connected) {
        try {
            console.log('♻️ Cliente existente desconectado. Intentando reconectar...');
            await telegramInstance.connect();
            if (telegramInstance.connected) {
                console.log('✅ Reconexión exitosa.');
                return telegramInstance;
            }
        } catch (err) {
            console.warn('⚠️ Falló reconexión. Reiniciando cliente desde cero.');
            telegramInstance = null;
        }
    }

    const sessionStr = fs.existsSync(sessionFile) ? fs.readFileSync(sessionFile, 'utf8') : '';
    const stringSession = new StringSession(sessionStr);

    telegramInstance = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    try {
        if (!sessionStr) {
            console.log('🔐 Iniciando sesión interactiva por primera vez...');
            await telegramInstance.start({
                phoneNumber: async () => await input.text('📱 Número de teléfono: '),
                password: async () => await input.text('🔐 Contraseña 2FA (si tenés): '),
                phoneCode: async () => await input.text('🔑 Código recibido por Telegram: '),
                onError: (err) => console.error('❌ Error al iniciar sesión:', err),
            });

            const savedSession = telegramInstance.session.save();
            fs.writeFileSync(sessionFile, savedSession);
            console.log('✅ Sesión guardada correctamente.');
        } else {
            console.log('📦 Conectando con sesión existente...');
            await telegramInstance.connect();
        }

        console.log('✅ Cliente Telegram conectado.');
        console.log('📘 Tipo:', typeof telegramInstance);
        console.log('📘 Constructor:', telegramInstance.constructor?.name);
        console.log('📘 Métodos disponibles:', Object.keys(telegramInstance));

        if (typeof telegramInstance.sendMessage !== 'function') {
            console.warn('⚠️ client.sendMessage no está disponible. Puede haber corrupción externa.');
            console.trace('📌 Stack trace client.sendMessage undefined');
        }

        return telegramInstance;
    } catch (err) {
        console.error('❌ Error al conectar con Telegram:', err);
        telegramInstance = null;
        return null;
    }
}

module.exports = {
    iniciarClienteTelegram,
    botUsername
};



