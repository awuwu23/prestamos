const mongoose = require('mongoose');

// 📦 Esquema de membresías
const membresiaSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  inicio: { type: Number, required: true },      // timestamp en ms
  vence: { type: Number, required: true },       // timestamp en ms
  nombre: { type: String, default: 'Sin nombre' },
  idGrupo: { type: String, default: null },
  idExtendido: { type: String, default: null },
  ids: { type: [String], default: [] }
});

// 📦 Esquema para historial de uso gratuito
const historialGratisSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  usado: { type: Boolean, default: true },
  fecha: { type: Date, default: Date.now }
});

// ✅ Modelos
const Membresia = mongoose.model('Membresia', membresiaSchema);
const HistorialGratis = mongoose.model('HistorialGratis', historialGratisSchema);

module.exports = {
  Membresia,
  HistorialGratis
};

