const fs = require('fs');
const path = require('path');

const membresiasPath = path.join(__dirname, 'membresias.json');
const historialPath = path.join(__dirname, 'historial_gratis.json');

// Normaliza número al formato 549XXXXXXXXXX
function normalizarNumero(numero) {
  let n = numero.replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  return '549' + n;
}

// Carga o crea archivo de membresías
function cargarMembresias() {
  if (!fs.existsSync(membresiasPath)) {
    fs.writeFileSync(membresiasPath, '{}');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(membresiasPath));
  } catch (e) {
    console.error('⚠️ Error leyendo membresías. Archivo corrupto.');
    return {};
  }
}

// Guarda archivo de membresías
function guardarMembresias(membresias) {
  try {
    fs.writeFileSync(membresiasPath, JSON.stringify(membresias, null, 2));
  } catch (err) {
    console.error('❌ Error al guardar membresías:', err);
  }
}

// Historial de búsquedas gratuitas
function cargarHistorial() {
  if (!fs.existsSync(historialPath)) {
    fs.writeFileSync(historialPath, '{}');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(historialPath));
  } catch (e) {
    console.error('⚠️ Error leyendo historial. Archivo corrupto.');
    return {};
  }
}

function guardarHistorial(historial) {
  try {
    fs.writeFileSync(historialPath, JSON.stringify(historial, null, 2));
  } catch (err) {
    console.error('❌ Error al guardar historial:', err);
  }
}

// ✅ Agregar membresía (con nombre)
function agregarMembresia(numero, nombre = '') {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();
  const ahora = Date.now();
  const unMes = 30 * 24 * 60 * 60 * 1000;

  membresias[n] = {
    inicio: ahora,
    vence: ahora + unMes,
    nombre,
    ids: []
  };

  guardarMembresias(membresias);
  console.log(`✅ Membresía asignada a ${n} (${nombre}) hasta ${new Date(ahora + unMes).toLocaleString()}`);
}

// ✅ Agrega un ID adicional para ese número (grupo)
function agregarIdSecundario(numero, nuevoId) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();

  if (!membresias[n]) {
    console.warn(`⚠️ No existe membresía para ${n}`);
    return;
  }

  if (!membresias[n].ids) membresias[n].ids = [];

  if (!membresias[n].ids.includes(nuevoId)) {
    membresias[n].ids.push(nuevoId);
    guardarMembresias(membresias);
    console.log(`➕ ID ${nuevoId} agregado a ${n}`);
  } else {
    console.log(`ℹ️ ID ${nuevoId} ya estaba vinculado a ${n}`);
  }
}

// Verifica si número o ID secundario tiene membresía activa
function verificarMembresia(numero) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();

  // Buscar por número principal
  const data = membresias[n];
  if (data && Date.now() < data.vence) return true;

  // Buscar por ID secundario
  for (const clave in membresias) {
    const datos = membresias[clave];
    if (datos.ids && datos.ids.includes(n) && Date.now() < datos.vence) return true;
  }

  return false;
}

// Devuelve tiempo restante de membresía
function tiempoRestante(numero) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();

  let data = membresias[n];

  if (!data) {
    // Buscar por ID secundario
    for (const clave in membresias) {
      const datos = membresias[clave];
      if (datos.ids && datos.ids.includes(n)) {
        data = datos;
        break;
      }
    }
  }

  if (!data) return null;

  const faltanMs = data.vence - Date.now();
  if (faltanMs <= 0) return null;

  const dias = Math.floor(faltanMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((faltanMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { dias, horas };
}

// Control de búsqueda gratuita
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
  console.log(`🆓 Uso gratuito registrado para ${n}`);
}

module.exports = {
  agregarMembresia,
  agregarIdSecundario,
  verificarMembresia,
  tiempoRestante,
  yaUsoBusquedaGratis,
  registrarBusquedaGratis,
  normalizarNumero
};


