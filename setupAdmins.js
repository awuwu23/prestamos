// setupAdmins.js
require('dotenv').config();
const conectarMongo = require('./mongo');
const { Admin } = require('./models/Admin');

const OWNER = (process.env.OWNER_NUMBER || '5493813885182').replace(/\D/g, '');

(async () => {
  try {
    await conectarMongo();
    console.log('✅ Conectado a MongoDB');

    await Admin.updateOne(
      { numero: OWNER },
      {
        $set: {
          numero: OWNER,
          nombre: 'Dueño',
          isOwner: true,
          esDueño: true, // compatibilidad
          permSub: true,
        },
      },
      { upsert: true }
    );

    console.log(`👑 Dueño asegurado en la base de datos: ${OWNER}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en setupAdmins:', err.message);
    process.exit(1);
  }
})();
