const mongoose = require('mongoose');

// ✅ Mantengo ambos campos (isOwner y esDueño) para compatibilidad
const AdminSchema = new mongoose.Schema(
  {
    numero: { type: String, required: true, unique: true },
    nombre: { type: String, default: 'Admin sin nombre' },
    id: { type: String, default: null },
    permSub: { type: Boolean, default: false },
    ventas: { type: Number, default: 0 },
    isOwner: { type: Boolean, default: false }, // nombre “nuevo”
    esDueño: { type: Boolean, default: false }, // compatibilidad con código viejo
  },
  { timestamps: true }
);

const Admin = mongoose.model('Admin', AdminSchema);

// --- Helpers ---

// Normaliza el número de teléfono
function normalizarNumero(n) {
  if (!n) return '';
  const normalizado = n.toString().replace(/\D/g, '').replace(/^54(9?)/, '549');
  console.log(`Normalizando número ${n} → ${normalizado}`);
  return normalizado;
}

// Verifica si el número corresponde a un "dueño" (usando isOwner o esDueño)
async function esDueño(numero) {
  try {
    const n = normalizarNumero(numero);
    const admin = await Admin.findOne({ numero: n });
    console.log(`🔍 Verificando si ${n} es dueño`);
    // ✅ Vale con cualquiera de los dos flags
    return !!(admin && (admin.isOwner || admin.esDueño));
  } catch (e) {
    console.error('❌ Error verificando dueño:', e);
    return false;
  }
}

// Verifica si el número corresponde a un "admin"
async function esAdmin(numero) {
  try {
    const n = normalizarNumero(numero);
    const admin = await Admin.findOne({ numero: n });
    console.log(`🔍 Verificando si ${n} es admin`);
    return !!admin;
  } catch (e) {
    console.error('❌ Error verificando admin:', e);
    return false;
  }
}

// Verifica si el número tiene permisos para usar el comando /sub
async function puedeUsarSub(numero) {
  try {
    const n = normalizarNumero(numero);
    const admin = await Admin.findOne({ numero: n });
    console.log(`🔍 Verificando si ${n} puede usar el comando /sub`);
    // ✅ dueño (con cualquiera de los dos flags) o permSub
    return !!(admin && ((admin.isOwner || admin.esDueño) || admin.permSub));
  } catch (e) {
    console.error('❌ Error verificando permiso /sub:', e);
    return false;
  }
}

// Agregar o actualizar administrador
async function agregarAdmin(data) {
  try {
    const payload = { ...data };
    console.log(`📝 Preparando datos para agregar/actualizar admin: ${JSON.stringify(payload)}`);
    // si viene esDueño=true, pongo isOwner=true también
    if (payload.esDueño) payload.isOwner = true;
    if (payload.isOwner) payload.esDueño = true;

    // Normaliza el número del admin
    payload.numero = normalizarNumero(payload.numero);

    // Actualiza o crea el admin
    const doc = await Admin.findOneAndUpdate(
      { numero: payload.numero },
      { $set: payload },
      { upsert: true, new: true }
    );

    console.log(`✔ Admin ${payload.numero} agregado/actualizado: ${doc.nombre}`);
    return doc;
  } catch (e) {
    console.error('❌ Error agregando admin:', e);
    throw e;
  }
}

// Lógica adicional para actualizar el estado de membresía al ser promovido a admin
async function actualizarMembresiaSiEsAdmin(numero) {
  try {
    const admin = await Admin.findOne({ numero: normalizarNumero(numero) });

    // Si el usuario se vuelve admin, actualizamos su membresía
    if (admin && (admin.isOwner || admin.esDueño)) {
      console.log(`⚡ Actualizando membresía para ${numero} al ser promovido a admin.`);
      // Aquí puedes agregar la lógica para actualizar su membresía
      // Ejemplo: agregar o renovar la membresía, o darle acceso ilimitado si se requiere
    }
  } catch (e) {
    console.error('❌ Error al actualizar membresía del admin:', e);
  }
}

module.exports = {
  Admin,
  esDueño,
  esAdmin,
  puedeUsarSub,
  agregarAdmin,
  actualizarMembresiaSiEsAdmin, // Exportamos la función adicional
};
