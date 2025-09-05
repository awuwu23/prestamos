// src/models/Admin.js
const mongoose = require('mongoose');

// 📌 Definición del esquema de Admins
const AdminSchema = new mongoose.Schema(
  {
    numero: { type: String, required: true, unique: true }, // número normalizado
    nombre: { type: String, default: 'Admin sin nombre' },
    id: { type: String, default: null }, // ID extendido o JID
    permSub: { type: Boolean, default: false }, // si puede usar /sub
    ventas: { type: Number, default: 0 }, // contador de ventas
    isOwner: { type: Boolean, default: false }, // dueño del bot
  },
  { timestamps: true }
);

// 📌 Crear modelo
const Admin = mongoose.model('Admin', AdminSchema);

/* ============================
 * Helpers
 * ============================ */

/**
 * ✅ Verifica si el número es dueño del bot
 * @param {string} numero
 * @returns {Promise<boolean>}
 */
async function esDueño(numero) {
  try {
    const n = numero.replace(/\D/g, ''); // normalizar rápido
    const admin = await Admin.findOne({ numero: n });
    return !!(admin && admin.isOwner);
  } catch (error) {
    console.error('❌ Error verificando dueño:', error);
    return false;
  }
}

/**
 * ✅ Verifica si el número es admin (dueño o admin normal)
 * @param {string} numero
 * @returns {Promise<boolean>}
 */
async function esAdmin(numero) {
  try {
    const n = numero.replace(/\D/g, '');
    const admin = await Admin.findOne({ numero: n });
    return !!admin;
  } catch (error) {
    console.error('❌ Error verificando admin:', error);
    return false;
  }
}

/**
 * ✅ Verifica si puede usar /sub
 * (dueño o admin con permSub=true)
 * @param {string} numero
 * @returns {Promise<boolean>}
 */
async function puedeUsarSub(numero) {
  try {
    const n = numero.replace(/\D/g, '');
    const admin = await Admin.findOne({ numero: n });
    return admin?.isOwner || admin?.permSub || false;
  } catch (error) {
    console.error('❌ Error verificando permiso de /sub:', error);
    return false;
  }
}

/**
 * ✅ Agregar nuevo admin a la DB
 * @param {Object} data - { numero, nombre, isOwner, permSub }
 * @returns {Promise<Admin>}
 */
async function agregarAdmin(data) {
  try {
    const nuevo = new Admin(data);
    return await nuevo.save();
  } catch (error) {
    console.error('❌ Error agregando admin:', error);
    throw error;
  }
}

/* ============================
 * Exports
 * ============================ */
module.exports = {
  Admin,
  esDueño,
  esAdmin,
  puedeUsarSub,
  agregarAdmin,
};
