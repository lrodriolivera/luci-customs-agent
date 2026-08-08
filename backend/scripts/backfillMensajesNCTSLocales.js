#!/usr/bin/env node
/**
 * Backfill de la marca `exchanged` en los mensajes NCTS fabricados en local.
 *
 * Contexto: tres transiciones de transito anotaban mensajes NCTS que LUCI genera
 * en local y que nunca salen ni entran por la red, sin distinguirlos de los que
 * si se intercambian con AEAT:
 *
 *   - `releaseAtDeparture`   -> IE029, ademas con `direction: 'inbound'`, lo que
 *                               afirma que AEAT ha liberado la mercancia.
 *   - `recordControlResult`  -> IE143
 *   - `initiateEnquiry`      -> IE118
 *
 * El campo `Transit.messages.exchanged` usa `default: true` para no reetiquetar
 * como falsos los mensajes historicos, que en su mayoria son intercambios
 * reales (IE015, IE028, IE160, IE044). El efecto secundario es que los transitos
 * guardados antes del fix siguen presentando su IE029/IE143/IE118 como
 * intercambio con la aduana. Este script los marca.
 *
 * Es seguro identificarlos por tipo: en `transitService` no hay mas de un sitio
 * que empuje cada uno de los tres, asi que todos los IE029/IE143/IE118
 * existentes provienen de esas tres transiciones locales.
 *
 * Idempotente: solo toca los mensajes que aun no llevan la clave `exchanged`.
 *
 * Uso:
 *   node scripts/backfillMensajesNCTSLocales.js           # aplica los cambios
 *   node scripts/backfillMensajesNCTSLocales.js --dry-run # solo informa
 */
require('dotenv').config();

/** Tipos que LUCI fabrica sin que salga nada por la red. */
const TIPOS_LOCALES = ['IE029', 'IE143', 'IE118'];

/**
 * Un mensaje historico fabricado en local es el que tiene uno de esos tipos y
 * aun no lleva la marca. Si ya la lleva (en cualquier valor) se respeta: el
 * backfill corrige ausencias, no decisiones.
 */
function esMensajeLocalHistorico(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return false;
  if (mensaje.exchanged !== undefined && mensaje.exchanged !== null) return false;
  return TIPOS_LOCALES.includes(mensaje.type);
}

/**
 * @returns {{mensajes: object[], cambios: number}} lista nueva (sin mutar la
 * original) con los mensajes locales marcados.
 */
function planificarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) return { mensajes: [], cambios: 0 };

  let cambios = 0;
  const salida = mensajes.map((m) => {
    if (!esMensajeLocalHistorico(m)) return m;
    cambios += 1;

    const marcado = { ...m, exchanged: false };
    // El IE029 es una autorizacion de la aduana de partida: mientras no se
    // reciba de verdad, no puede figurar como entrante. Los IE143/IE118 salen
    // conceptualmente del operador, asi que conservan su `outbound`.
    if (m.type === 'IE029') delete marcado.direction;
    return marcado;
  });

  return { mensajes: salida, cambios };
}

async function main() {
  const mongoose = require('mongoose');
  const { Transit } = require('../src/models');

  const DRY_RUN = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Conectado a Mongo. Modo: ${DRY_RUN ? 'DRY-RUN' : 'APLICAR'}`);

  const candidatos = await Transit.find({
    'messages.type': { $in: TIPOS_LOCALES }
  }).select('_id lrn mrn messages').lean();

  console.log(`Transitos con mensajes de tipo local: ${candidatos.length}`);

  let transitosTocados = 0;
  let mensajesMarcados = 0;

  for (const t of candidatos) {
    const plan = planificarMensajes(t.messages);
    if (plan.cambios === 0) continue;

    if (!DRY_RUN) {
      await Transit.updateOne({ _id: t._id }, { $set: { messages: plan.mensajes } });
    }
    transitosTocados += 1;
    mensajesMarcados += plan.cambios;
    console.log(`  ${t.lrn}${t.mrn ? ` (${t.mrn})` : ''}: ${plan.cambios} mensaje(s) marcados como locales`);
  }

  console.log('--- Resumen ---');
  console.log(`  Transitos actualizados${DRY_RUN ? ' (simulado)' : ''}: ${transitosTocados}`);
  console.log(`  Mensajes marcados como no intercambiados: ${mensajesMarcados}`);

  await mongoose.disconnect();
}

module.exports = { TIPOS_LOCALES, esMensajeLocalHistorico, planificarMensajes };

if (require.main === module) {
  main().catch((err) => {
    console.error('Error en el backfill:', err);
    process.exit(1);
  });
}
