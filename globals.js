// =============================
// 📌 Variables globales
// =============================

// 🔒 Set global para manejar los usuarios que están esperando
// ingresar el sexo (M/F) después de una consulta.
// Esto evita que el bot procese otros mensajes de ese usuario
// mientras debe responder F o M.
const usuariosEsperandoSexo = new Set();

// Podés agregar más variables globales acá en el futuro
// por ejemplo: usuariosEnCooldown, consultasPendientes, etc.

module.exports = {
  usuariosEsperandoSexo
};
