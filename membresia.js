const fs = require('fs');
const path = require('path');
const { Membresia, HistorialGratis } = require('./models');

const membresiasPath = path.join(__dirname, 'membresias.json');
const historialPath = path.join(__dirname, 'historial_gratis.json');

function normalizarNumero(numero) {
  let n = numero.toString().replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  return '549' + n;
}

// 📥 Cargar membresías desde Mongo
async function cargarMembresias() {
  const lista = await Membresia.find({});
  const resultado = {};
  for (const m of lista) {
    resultado[m.numero] = {
      inicio: m.inicio,
      vence: m.vence,
      nombre: m.nombre,
      idGrupo: m.idGrupo,
      ids: m.ids || []
    };
  }
  return resultado;
}

// 💾 Guardado innecesario (se maneja con Mongo)
function guardarMembresias(_) {
  console.log('📦 [MongoDB] Las membresías se guardan automáticamente.');
}

// ✅ Agregar o renovar membresía
async function agregarMembresia(numero, idGrupo = null, nombre = '') {
  const n = normalizarNumero(numero);
  const ahora = Date.now();
  const unMes = 30 * 24 * 60 * 60 * 1000;

  let membresia = await Membresia.findOne({ numero: n });

  if (!membresia) {
    membresia = new Membresia({
      numero: n,
      inicio: ahora,
      vence: ahora + unMes,
      nombre,
      idGrupo: idGrupo || null,
      ids: []
    });
    console.log(`🆕 Nueva membresía asignada a ${n} (${nombre}).`);
  } else {
    membresia.inicio = ahora;
    membresia.vence = ahora + unMes;
    membresia.nombre = nombre || membresia.nombre;

    if (idGrupo && !membresia.ids.includes(idGrupo) && membresia.idGrupo !== idGrupo) {
      membresia.ids.push(idGrupo);
      console.log(`➕ ID extendido agregado: ${idGrupo} para ${n}`);
    } else {
      console.log(`🔄 Membresía renovada para ${n} (${nombre}).`);
    }
  }

  await membresia.save();

  const fechaVencimiento = new Date(ahora + unMes).toLocaleString();
  console.log(`📆 Válida hasta: ${fechaVencimiento}`);
}

// ✅ Asignar ID de grupo
async function actualizarIdGrupo(numero, nuevoIdGrupo) {
  const n = normalizarNumero(numero);
  const m = await Membresia.findOne({ numero: n });

  if (!m) {
    console.warn(`⚠️ [Advertencia] No existe membresía para ${n}.`);
    return;
  }

  if (m.idGrupo === nuevoIdGrupo || (m.ids && m.ids.includes(nuevoIdGrupo))) {
    console.log(`ℹ️ El ID extendido ${nuevoIdGrupo} ya está vinculado a ${n}.`);
    return;
  }

  if (!m.idGrupo) {
    m.idGrupo = nuevoIdGrupo;
    console.log(`✅ ID principal vinculado: ${nuevoIdGrupo} para ${n}.`);
  } else {
    if (!Array.isArray(m.ids)) m.ids = [];
    if (!m.ids.includes(nuevoIdGrupo)) {
      m.ids.push(nuevoIdGrupo);
      console.log(`➕ ID adicional vinculado: ${nuevoIdGrupo} para ${n}.`);
    }
  }

  await m.save();
}

// ✅ Verificar membresía activa
async function verificarMembresia(numero) {
  const n = normalizarNumero(numero);
  const ahora = Date.now();

  const m = await Membresia.findOne({
    $or: [
      { numero: n },
      { idGrupo: n },
      { ids: n }
    ],
    vence: { $gt: ahora }
  });

  return !!m;
}

// 🕓 Tiempo restante
async function tiempoRestante(numero) {
  const n = normalizarNumero(numero);
  const ahora = Date.now();

  const m = await Membresia.findOne({
    $or: [
      { numero: n },
      { idGrupo: n },
      { ids: n }
    ],
    vence: { $gt: ahora }
  });

  if (!m) return null;
  return calcularTiempo(m.vence - ahora);
}

function calcularTiempo(ms) {
  if (ms <= 0) return null;
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { dias, horas };
}

// ✅ Búsqueda gratuita - versión Mongo
async function yaUsoBusquedaGratis(numero) {
  const n = normalizarNumero(numero);
  const uso = await HistorialGratis.findOne({ numero: n });
  return !!uso;
}

async function registrarBusquedaGratis(numero) {
  const n = normalizarNumero(numero);
  await HistorialGratis.updateOne(
    { numero: n },
    { $set: { usado: true } },
    { upsert: true }
  );
  console.log(`🆓 Uso gratuito registrado para ${n}.`);
}

// ✅ Limpieza automática de membresías vencidas
async function limpiarMembresiasVencidas(sock = null) {
  const ahora = Date.now();
  const vencidas = await Membresia.find({ vence: { $lte: ahora } });

  for (const m of vencidas) {
    if (sock) {
      try {
        await sock.sendMessage(`${m.numero}@s.whatsapp.net`, {
          text: `🔒 *Tu membresía ha expirado.*\n\nSi querés seguir usando el sistema, contactá con un administrador para renovarla.\n\n📞 *Admin:* 3813885182`
        });
      } catch (e) {
        console.warn(`⚠️ No se pudo notificar a ${m.numero}:`, e.message);
      }
    }
    await Membresia.deleteOne({ numero: m.numero });
    console.log(`🧹 Eliminada membresía vencida de ${m.numero}`);
  }
}

module.exports = {
  agregarMembresia,
  actualizarIdGrupo,
  verificarMembresia,
  tiempoRestante,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis,
  normalizarNumero,
  cargarMembresias,
  guardarMembresias,
  limpiarMembresiasVencidas
};
