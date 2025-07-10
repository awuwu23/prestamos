// credito.js

function simularCredito(monto) {
    if (isNaN(monto) || monto <= 0) {
        return '❌ Debe ingresar un monto válido. Ejemplo: /credito 50000';
    }

    const semanas = [4, 5, 6, 7, 8];
    const interesSemanal = 0.10;

    let resultado = `📊 *Simulación de crédito para $${monto.toLocaleString('es-AR')}*

`;

    semanas.forEach(sem => {
        const totalInteres = monto * interesSemanal * sem;
        const total = monto + totalInteres;
        const cuota = total / sem;

        resultado += `🗓️ *${sem} semanas:*
` +
                    `• 💰 Cuota semanal: $${cuota.toFixed(2)}
` +
                    `• 🔁 Total a pagar: $${total.toFixed(2)} (${sem} x $${cuota.toFixed(2)})

`;
    });

    resultado += `💡 *Condiciones:*
` +
                 `• Interés del 10% semanal (≈40% mensual)
` +
                 `• Cliente debe estar aprobado por el bot (/dni)
` +
                 `• O presentar garantía real o ingresos comprobables

` +
                 `🧠 *Consejo para prestamistas:*
` +
                 `• Otorgar montos menores a $100.000 a nuevos clientes.
` +
                 `• Clientes con buen scoring y sin deudas pueden recibir hasta $300.000.
` +
                 `• Se recomienda comenzar con plazos cortos (4 a 6 semanas) para evaluar comportamiento de pago.`;

    return resultado;
}

module.exports = {
    simularCredito
};
