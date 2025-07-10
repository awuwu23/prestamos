const crypto = require('crypto');
const fs = require('fs');

const algoritmo = 'aes-256-cbc';
const clave = crypto.createHash('sha256').update('tu_clave_secreta_segura').digest(); // Cambiala por una clave fuerte
const iv = Buffer.alloc(16, 0); // Vector de inicialización (puede ser fijo para este uso)

function cifrarJSON(objeto, ruta) {
  const texto = JSON.stringify(objeto);
  const cipher = crypto.createCipheriv(algoritmo, clave, iv);
  const resultado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  fs.writeFileSync(ruta, resultado.toString('base64'));
}

function descifrarJSON(ruta) {
  const cifrado = fs.readFileSync(ruta, 'utf8');
  const buffer = Buffer.from(cifrado, 'base64');
  const decipher = crypto.createDecipheriv(algoritmo, clave, iv);
  const textoPlano = Buffer.concat([decipher.update(buffer), decipher.final()]);
  return JSON.parse(textoPlano.toString());
}

module.exports = { cifrarJSON, descifrarJSON };
