const fs = require('fs');
const path = require('path');
const { Membresia, HistorialGratis } = require('./models');

const membresiasPath = path.join(__dirname, 'membresias.json');
const historialPath = path.join(__dirname, 'historial_gratis.json');

// 🔢 Normaliza números a formato 549XXXXXXXXXX
function normalizarNumero(numero) {
  if (!numero) return null;
  let n = numero.toString().replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  return '549' + n;
}

// 🧹 Limpia JIDs de WhatsApp (soporta @s.whatsapp.net, @lid y @g.us)
function limpiarId(numeroOId) {
  if (!numeroOId) return null;
  return numeroOId
    .toString()
    .replace('@lid', '')
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .trim();
}

// 📥 Cargar todas las membresías desde Mongo
async function cargarMembresias() {
  const lista = await Membresia.find({});
  const resultado = {};
  for (const m of lista) {
    resultado[m.numero] = {
      inicio: m.inicio,
      vence: m.vence,
      nombre: m.nombre,
      idGrupo: m.idGrupo,
      vendedor: m.vendedor || null,
      ids: m.ids || []
    };
  }
  return resultado;
}

// 💾 Guardado innecesario (MongoDB persiste solo)
function guardarMembresias(_) {
  console.log('📦 [MongoDB] Las membresías se guardan automáticamente.');
}

// ✅ Crear o renovar membresía
async function agregarMembresia(numero, idGrupo = null, nombre = '', diasDuracion = 30, vendedor = null) {
  const n = normalizarNumero(numero);
  const idNorm = idGrupo ? normalizarNumero(idGrupo) : null;

  const ahora = Date.now();
  const duracion = Math.min(diasDuracion, 60) * 24 * 60 * 60 * 1000;

  let membresia = await Membresia.findOne({ numero: n });

  if (!membresia) {
    membresia = new Membresia({
      numero: n,
      inicio: ahora,
      vence: ahora + duracion,
      nombre,
      idGrupo: idNorm || null,
      ids: idNorm ? [idNorm] : [],
      vendedor: vendedor || null
    });
    console.log(`🆕 Nueva membresía asignada a ${n} (${nombre}).`);
  } else {
    membresia.inicio = ahora;
    membresia.vence = ahora + duracion;
    if (nombre) membresia.nombre = nombre;
    if (vendedor) membresia.vendedor = vendedor;

    if (idNorm && ![membresia.idGrupo, ...(membresia.ids || [])].includes(idNorm)) {
      if (!membresia.idGrupo) {
        membresia.idGrupo = idNorm;
        console.log(`✅ ID principal vinculado: ${idNorm} para ${n}.`);
      } else {
        if (!Array.isArray(membresia.ids)) membresia.ids = [];
        membresia.ids.push(idNorm);
        console.log(`➕ ID extendido agregado: ${idNorm} para ${n}`);
      }
    } else {
      console.log(`🔄 Membresía renovada para ${n} (${nombre}).`);
    }
  }

  await membresia.save();

  const fechaVencimiento = new Date(membresia.vence).toLocaleString();
  console.log(`📆 Válida hasta: ${fechaVencimiento}`);
}

// ✅ Vincular un nuevo ID de grupo a una membresía
async function actualizarIdGrupo(numero, nuevoIdGrupo) {
  const n = normalizarNumero(numero);
  const idNorm = normalizarNumero(nuevoIdGrupo);
  const m = await Membresia.findOne({ numero: n });

  if (!m) {
    console.warn(`⚠️ [Advertencia] No existe membresía para ${n}.`);
    return;
  }

  if ([m.idGrupo, ...(m.ids || [])].includes(idNorm)) {
    console.log(`ℹ️ El ID extendido ${idNorm} ya está vinculado a ${n}.`);
    return;
  }

  if (!m.idGrupo) {
    m.idGrupo = idNorm;
    console.log(`✅ ID principal vinculado: ${idNorm} para ${n}.`);
  } else {
    if (!Array.isArray(m.ids)) m.ids = [];
    m.ids.push(idNorm);
    console.log(`➕ ID adicional vinculado: ${idNorm} para ${n}.`);
  }

  await m.save();
}

// ✅ Verificar membresía activa (por número normalizado o ID extendido)
async function verificarMembresia(numeroOId) {
  if (!numeroOId) return false;
  const limpio = limpiarId(numeroOId);
  const n = normalizarNumero(limpio);
  const ahora = Date.now();

  const m = await Membresia.findOne({
    $or: [
      { numero: n },
      { idGrupo: n },
      { ids: n }
    ],
    vence: { $gt: ahora }
  });

  if (!m) {
    console.warn(`⛔ Usuario ${numeroOId} → limpio: ${limpio} → normalizado: ${n} aparece SIN membresía activa.`);
  } else {
    console.log(`✅ Usuario ${n} tiene membresía activa (vence: ${new Date(m.vence).toLocaleString()}).`);
  }

  return !!m;
}

// 🕓 Tiempo restante de membresía
async function tiempoRestante(numeroOId) {
  if (!numeroOId) return null;
  const limpio = limpiarId(numeroOId);
  const n = normalizarNumero(limpio);
  const ahora = Date.now();

  const m = await Membresia.findOne({
    $or: [
      { numero: n },
      { idGrupo: n },
      { ids: n }
    ],
    vence: { $gt: ahora }
  });

  if (!m) {
    console.warn(`⏳ No se encontró tiempo restante para ${numeroOId} (limpio: ${limpio}, normalizado: ${n}).`);
    return null;
  }

  const tiempo = calcularTiempo(m.vence - ahora);
  console.log(`⏳ Tiempo restante para ${n}: ${tiempo.dias} días y ${tiempo.horas} horas.`);
  return tiempo;
}

// ⏳ Calcula días y horas desde ms
function calcularTiempo(ms) {
  if (ms <= 0) return null;
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { dias, horas };
}

// ✅ Control de búsqueda gratuita
async function yaUsoBusquedaGratis(numero) {
  const n = normalizarNumero(numero);
  const uso = await HistorialGratis.findOne({ numero: n });
  console.log(`🔎 Verificando si ${n} ya usó la búsqueda gratuita → ${uso ? 'Sí' : 'No'}`);
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

// ✅ Limpieza de membresías vencidas
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




