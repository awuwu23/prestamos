const fs = require('fs');
const path = require('path');

const membresiasPath = path.join(__dirname, 'membresias.json');
const historialPath = path.join(__dirname, 'historial_gratis.json');

// 🔄 Normaliza número al formato 549XXXXXXXXXX
function normalizarNumero(numero) {
  let n = numero.toString().replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  return '549' + n;
}

// 📥 Cargar membresías (async)
async function cargarMembresiasAsync() {
  try {
    if (!fs.existsSync(membresiasPath)) {
      fs.writeFileSync(membresiasPath, '{}');
      console.log('📂 Archivo membresías.json creado.');
      return {};
    }
    const data = await fs.promises.readFile(membresiasPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('❌ [Error] No se pudo leer membresías.json (archivo corrupto).');
    return {};
  }
}

// 📥 Cargar membresías (sync)
function cargarMembresias() {
  if (!fs.existsSync(membresiasPath)) {
    fs.writeFileSync(membresiasPath, '{}');
    console.log('📂 Archivo membresías.json creado.');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(membresiasPath));
  } catch (e) {
    console.error('❌ [Error] No se pudo leer membresías.json (archivo corrupto).');
    return {};
  }
}

// 💾 Guardar membresías
function guardarMembresias(membresias) {
  try {
    fs.writeFileSync(membresiasPath, JSON.stringify(membresias, null, 2));
    console.log('✅ Membresías guardadas correctamente.');
  } catch (err) {
    console.error('❌ [Error] No se pudo guardar membresías:', err);
  }
}

// ✅ Agregar o renovar membresía
function agregarMembresia(numero, idGrupo = null, nombre = '') {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();
  const ahora = Date.now();
  const unMes = 30 * 24 * 60 * 60 * 1000;

  if (!membresias[n]) {
    membresias[n] = {
      inicio: ahora,
      vence: ahora + unMes,
      nombre,
      idGrupo: idGrupo || null,
      ids: []
    };
    console.log(`🆕 Nueva membresía asignada a ${n} (${nombre}).`);
  } else {
    membresias[n].inicio = ahora;
    membresias[n].vence = ahora + unMes;
    membresias[n].nombre = nombre || membresias[n].nombre;

    if (idGrupo && !membresias[n].ids.includes(idGrupo) && membresias[n].idGrupo !== idGrupo) {
      membresias[n].ids.push(idGrupo);
      console.log(`➕ ID extendido agregado: ${idGrupo} para ${n}`);
    } else {
      console.log(`🔄 Membresía renovada para ${n} (${nombre}).`);
    }
  }

  guardarMembresias(membresias);

  const fechaVencimiento = new Date(ahora + unMes).toLocaleString();
  console.log(`📆 Válida hasta: ${fechaVencimiento}`);
}

// ✅ Actualizar idGrupo
function actualizarIdGrupo(numero, nuevoIdGrupo) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();

  if (!membresias[n]) {
    console.warn(`⚠️ [Advertencia] No existe membresía para ${n}.`);
    return;
  }

  if (membresias[n].idGrupo === nuevoIdGrupo || (membresias[n].ids && membresias[n].ids.includes(nuevoIdGrupo))) {
    console.log(`ℹ️ El ID extendido ${nuevoIdGrupo} ya está vinculado a ${n}.`);
    return;
  }

  if (!membresias[n].idGrupo) {
    membresias[n].idGrupo = nuevoIdGrupo;
    console.log(`✅ ID principal vinculado: ${nuevoIdGrupo} para ${n}.`);
  } else {
    if (!Array.isArray(membresias[n].ids)) membresias[n].ids = [];
    if (!membresias[n].ids.includes(nuevoIdGrupo)) {
      membresias[n].ids.push(nuevoIdGrupo);
      console.log(`➕ ID adicional vinculado: ${nuevoIdGrupo} para ${n}.`);
    }
  }

  guardarMembresias(membresias);
}

// ✅ Verifica membresía activa SOLO por número
async function verificarMembresia(numero) {
  const n = normalizarNumero(numero);
  const membresias = await cargarMembresiasAsync();
  const ahora = Date.now();

  const datos = membresias[n];
  return datos && datos.vence > ahora;
}

// 🕓 Tiempo restante
function tiempoRestante(numero) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();
  const ahora = Date.now();

  const data = membresias[n];
  if (data && ahora < data.vence) return calcularTiempo(data.vence - ahora);

  return null;
}

function calcularTiempo(ms) {
  if (ms <= 0) return null;
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { dias, horas };
}

// ✅ Control búsqueda gratuita
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

function yaUsoBusquedaGratis(numero) {
  const n = normalizarNumero(numero);
  const historial = cargarHistorial();
  return historial[n] === true;
}

function registrarBusquedaGratis(numero) {
  const n = normalizarNumero(numero);
  const historial = cargarHistorial();
  historial[n] = true;
  guardarHistorial(historial);
  console.log(`🆓 Uso gratuito registrado para ${n}.`);
}

// 📦 Exportar
module.exports = {
  agregarMembresia,
  actualizarIdGrupo,
  verificarMembresia,
  tiempoRestante,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis,
  normalizarNumero,
  cargarMembresias
};











