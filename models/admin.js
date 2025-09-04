const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  numero: { type: String, required: true, unique: true },
  nombre: { type: String, default: 'Admin' },
  permSub: { type: Boolean, default: true }, // Puede usar /sub
  ilimitado: { type: Boolean, default: true } // Tiene membresía ilimitada
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
