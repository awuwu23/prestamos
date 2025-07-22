const mongoose = require('mongoose');

// 📦 Estructura para membresías
const membresiaSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  inicio: Number,
  vence: Number,
  nombre: String,
  idGrupo: String,
  ids: [String]
});

// 📦 Estructura para historial de uso gratuito
const historialGratisSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  usado: { type: Boolean, default: true }
});

const Membresia = mongoose.model('Membresia', membresiaSchema);
const HistorialGratis = mongoose.model('HistorialGratis', historialGratisSchema);

module.exports = { Membresia, HistorialGratis };
