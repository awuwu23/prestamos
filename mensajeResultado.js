// mensajeResultado.js

async function generarMensajeResultado(dni, resultado, textoExtra = '', dominioData = null) {
    const mensajePrincipal = `
━━━━━━━━━━━━━━━━━━━━━━━
✅ *Consulta finalizada correctamente*
━━━━━━━━━━━━━━━━━━━━━━━

⚡ Gracias por usar nuestro bot.  
Con una *membresía activa* tendrás acceso completo y sin límites a todas las funciones.

💎 *Membresía Premium* — *$15.000 ARS / mes*

╭━━━ ✨ Beneficios exclusivos
┃ 🚀 Consultas *ilimitadas* y sin restricciones.  
┃ 📊 Resultados completos en *segundos*.  
┃ 🕒 Atención automática *24/7*.  
┃ 🔒 Acceso exclusivo solo para miembros.  
┃ 👑 Rol *VIP en el grupo* con beneficios extra.  
┃ 🤝 Soporte directo con un administrador.  
┃ 📂 Historial de consultas organizado.  
┃ 🛡️ Privacidad y seguridad garantizada.  
╰━━━━━━━━━━━━━━━

👥 *¿Para quién es ideal este bot?*
• ⚖️ *Abogados* → Acceso rápido a datos para agilizar trámites y demandas.  
• 📑 *Gestores* → Información inmediata para tus clientes.  
• 💵 *Prestamistas* → Verificar identidad y datos antes de otorgar créditos.  
• 🕵️ *Investigadores* → Fuente ágil de información confiable.  
• 👔 *Empresas y freelancers* → Verificación de clientes o socios.  

📖 *Comandos principales*  
• */me* → Ver tu membresía activa  
• */menu* → Explorar todas las funciones  
• */id* → Vincular con grupos  
• */tokens* → Revisar tu saldo

━━━━━━━━━━━━━━━━━━━━━━━
📞 *Adquirí tu membresía ahora:* 3813885182  
━━━━━━━━━━━━━━━━━━━━━━━
`.trim();

    return {
        mensajePrincipal,
        mensajeVacunas: ''
    };
}

module.exports = generarMensajeResultado;




















