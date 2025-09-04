// models/Admin.js
const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true }, // número normalizado
  nombre: { type: String, default: 'Admin sin nombre' },
  id: { type: String, default: null }, // ID extendido o JID
  permSub: { type: Boolean, default: false }, // si puede usar /sub
  ventas: { type: Number, default: 0 }, // contador de ventas
  isOwner: { type: Boolean, default: false }, // dueño del bot
}, { timestamps: true });

module.exports = mongoose.model('Admin', AdminSchema);
