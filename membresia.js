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

// 📥 Cargar archivo de membresías (ahora desde Mongo)
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

// 💾 Guardar archivo de membresías (ahora automático con Mongo)
function guardarMembresias(_) {
  console.log('📦 [MongoDB] Las membresías se guardan automáticamente.');
}

// ✅ Agregar membresía con número, idGrupo y nombre
async function agregarMembresia(numero, idGrupo = null, nombre = '') {
  const n = normalizarNumero(numero);
  const ahora = Date.now();
  const unMes = 30 * 24 * 60 * 60 * 1000;

  let membresias = await Membresia.findOne({ numero: n });

  if (!membresias) {
    membresias = new Membresia({
      numero: n,
      inicio: ahora,
      vence: ahora + unMes,
      nombre,
      idGrupo: idGrupo || null,
      ids: []
    });
    console.log(`🆕 Nueva membresía asignada a ${n} (${nombre}).`);
  } else {
    membresias.inicio = ahora;
    membresias.vence = ahora + unMes;
    membresias.nombre = nombre || membresias.nombre;

    if (idGrupo && !membresias.ids.includes(idGrupo) && membresias.idGrupo !== idGrupo) {
      membresias.ids.push(idGrupo);
      console.log(`➕ ID extendido agregado: ${idGrupo} para ${n}`);
    } else {
      console.log(`🔄 Membresía renovada para ${n} (${nombre}).`);
    }
  }

  await membresias.save();

  const fechaVencimiento = new Date(ahora + unMes).toLocaleString();
  console.log(`📆 Válida hasta: ${fechaVencimiento}`);
}

// ✅ Actualizar o asignar un idGrupo a membresía existente
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

// ✅ Verifica si número, idGrupo o alguno de los ids tiene membresía activa
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

// 🕓 Devuelve tiempo restante de membresía
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

// ✅ Control de búsqueda gratuita (mantiene carga desde JSON para retrocompatibilidad)
function cargarHistorial() {
  if (!fs.existsSync(historialPath)) {
    fs.writeFileSync(historialPath, '{}');
    console.log('📂 Archivo historial_gratis.json creado.');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(historialPath));
  } catch (e) {
    console.error('❌ [Error] No se pudo leer historial_gratis.json (archivo corrupto).');
    return {};
  }
}

function guardarHistorial(historial) {
  try {
    fs.writeFileSync(historialPath, JSON.stringify(historial, null, 2));
    console.log('✅ Historial guardado correctamente.');
  } catch (err) {
    console.error('❌ [Error] No se pudo guardar historial:', err);
  }
}

// ✅ Versión Mongo
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

// ✅ LIMPIEZA AUTOMÁTICA de membresías vencidas + notificación
async function limpiarMembresiasVencidas(sock = null) {
  const ahora = Date.now();
  const vencidas = await Membresia.find({ vence: { $lte: ahora } });

  for (const m of vencidas) {
    if (sock) {
      try {
        await sock.sendMessage(`${m.numero}@s.whatsapp.net`, {
          text: `🔒 *Tu membresía ha expirado.*\n\nSi querés seguir usando el sistema, contactá con un administrador para renovarla.`
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














