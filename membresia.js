const fs = require('fs');
const path = require('path');

const membresiasPath = path.join(__dirname, 'membresias.json');
const historialPath = path.join(__dirname, 'historial_gratis.json');

function normalizarNumero(numero) {
  let n = numero.toString().replace(/\D/g, '');
  if (n.startsWith('549')) return n;
  if (n.startsWith('54')) return '549' + n.slice(2);
  return '549' + n;
}

// 📥 Cargar archivo de membresías
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

// 💾 Guardar archivo de membresías
function guardarMembresias(membresias) {
  try {
    fs.writeFileSync(membresiasPath, JSON.stringify(membresias, null, 2));
    console.log('✅ Membresías guardadas correctamente.');
  } catch (err) {
    console.error('❌ [Error] No se pudo guardar membresías:', err);
  }
}

// ✅ Agregar membresía con número, idGrupo y nombre
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

// ✅ Actualizar o asignar un idGrupo a membresía existente
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

// ✅ Verifica si número, idGrupo o alguno de los ids tiene membresía activa
function verificarMembresia(numero) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();
  const ahora = Date.now();

  const principal = membresias[n];
  if (principal && ahora < principal.vence) return true;

  for (const clave in membresias) {
    const datos = membresias[clave];
    if (!datos) continue;
    if (ahora >= datos.vence) continue;

    if (datos.idGrupo) {
      if (
        datos.idGrupo === n ||
        n.startsWith(datos.idGrupo) ||
        datos.idGrupo.startsWith(n)
      ) return true;
    }

    if (datos.ids && Array.isArray(datos.ids)) {
      for (const id of datos.ids) {
        if (
          id === n ||
          n.startsWith(id) ||
          id.startsWith(n)
        ) return true;
      }
    }
  }

  return false;
}

// 🕓 Devuelve tiempo restante de membresía
function tiempoRestante(numero) {
  const n = normalizarNumero(numero);
  const membresias = cargarMembresias();
  const ahora = Date.now();

  let data = membresias[n];
  if (data && ahora < data.vence) return calcularTiempo(data.vence - ahora);

  for (const clave in membresias) {
    const datos = membresias[clave];
    if (!datos) continue;
    if (ahora >= datos.vence) continue;

    if (datos.idGrupo) {
      if (
        datos.idGrupo === n ||
        n.startsWith(datos.idGrupo) ||
        datos.idGrupo.startsWith(n)
      ) return calcularTiempo(datos.vence - ahora);
    }

    if (datos.ids && Array.isArray(datos.ids)) {
      for (const id of datos.ids) {
        if (
          id === n ||
          n.startsWith(id) ||
          id.startsWith(n)
        ) return calcularTiempo(datos.vence - ahora);
      }
    }
  }

  return null;
}

function calcularTiempo(ms) {
  if (ms <= 0) return null;
  const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
  const horas = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { dias, horas };
}

// ✅ Control de búsqueda gratuita
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

// ✅ LIMPIEZA AUTOMÁTICA de membresías vencidas + notificación
async function limpiarMembresiasVencidas(sock = null) {
  const membresias = cargarMembresias();
  const ahora = Date.now();
  let cambios = false;

  for (const numero in membresias) {
    const datos = membresias[numero];
    if (!datos || datos.vence <= ahora) {
      if (sock) {
        try {
          await sock.sendMessage(`${numero}@s.whatsapp.net`, {
            text: `🔒 *Tu membresía ha expirado.*\n\nSi querés seguir usando el sistema, contactá con un administrador para renovarla.`
          });
        } catch (e) {
          console.warn(`⚠️ No se pudo notificar a ${numero}:`, e.message);
        }
      }

      delete membresias[numero];
      cambios = true;
      console.log(`🧹 Eliminada membresía vencida de ${numero}`);
    }
  }

  if (cambios) guardarMembresias(membresias);
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
  limpiarMembresiasVencidas
};













