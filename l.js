// leer.js
const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const fs = require("fs");

const apiId = 25130211;
const apiHash = "37dd15c3620434489c143d0f4fd89e4c";
const sessionFile = "telegram.session";

if (!fs.existsSync(sessionFile)) {
  console.log("❌ No se encontró archivo de sesión. Saliendo...");
  process.exit(0);
}

const sessionString = fs.readFileSync(sessionFile, "utf8");
const client = new TelegramClient(
  new StringSession(sessionString),
  apiId,
  apiHash,
  { connectionRetries: 5 }
);

(async () => {
  console.log("Conectando con sesión existente...");
  await client.start({
    phoneNumber: async () => { throw new Error("⚠️ No hay soporte para login por SMS"); },
    phoneCode: async () => { throw new Error("⚠️ No hay soporte para login por código"); },
    password: async () => "",
    onError: (err) => console.error(err),
  });

  console.log("✅ Sesión iniciada con éxito.\n");

  // Mensajes normales
  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg || !msg.message) return;

    const chat = await msg.getChat();
    const sender =
      chat.username || chat.title || chat.firstName || chat.id;

    console.log(`📩 Nuevo mensaje de [${sender}] (${chat.id}): ${msg.message}`);
  }, new NewMessage({}));

  // Notificaciones del sistema (códigos de login, etc.)
  client.addEventHandler((update) => {
    if (update instanceof Api.UpdateServiceNotification) {
      console.log("⚠️ Notificación del sistema:", update.message);
    }
  });
})();
