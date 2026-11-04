#!/usr/bin/env node
/**
 * Backfill del tenantId de InspectorCommunication y ChatMessage.
 *
 * Contexto: b8b5b02 anadio tenantId a estos dos modelos y acoto sus listados
 * por el (utils/tenantListGuard). Los documentos anteriores no lo tienen, asi
 * que dejan de salir para los usuarios con tenant. Este script lo copia de su
 * expediente:
 *   - InspectorCommunication: references.expeditionId
 *   - ChatMessage:            expedition
 *
 * - Por defecto NO escribe nada (dry-run): informa de lo que haria. Para
 *   aplicar hay que pasar --apply.
 * - Idempotente: solo mira documentos sin tenantId y la escritura vuelve a
 *   exigir tenantId vacio, asi que se puede repetir sin efecto.
 * - Informa, por id, de los documentos que no puede resolver y por que:
 *   'sin expediente', 'expediente inexistente' o 'expediente sin tenant'.
 *   Esos quedan como estaban: hay que decidir a mano a que tenant pertenecen.
 *
 * Uso (desde backend/):
 *   node scripts/backfillTenantId.js            # dry-run: solo informa
 *   node scripts/backfillTenantId.js --apply    # escribe
 */

const mongoose = require('mongoose');
const { InspectorCommunication, ChatMessage, Expedition } = require('../src/models');

const SIN_TENANT = { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] };

const OBJETIVOS = [
  { nombre: 'InspectorCommunication', Modelo: InspectorCommunication, campoExpediente: 'references.expeditionId' },
  { nombre: 'ChatMessage', Modelo: ChatMessage, campoExpediente: 'expedition' }
];

function leerRuta(doc, ruta) {
  return ruta.split('.').reduce((v, k) => (v == null ? v : v[k]), doc);
}

async function procesar({ nombre, Modelo, campoExpediente }, { apply, logger }) {
  // Se lee con el driver (sin Mongoose): estos documentos antiguos son
  // justamente los que no tienen tenantId, y no hay que pasar por el guard ni
  // por la validacion del esquema para leerlos.
  const pendientes = await Modelo.collection
    .find(SIN_TENANT, { projection: { _id: 1, [campoExpediente]: 1 } })
    .toArray();

  const informe = { pendientes: pendientes.length, resolubles: 0, actualizados: 0, sinResolver: [] };
  const cacheExpedientes = new Map();

  for (const doc of pendientes) {
    const expeditionId = leerRuta(doc, campoExpediente);
    if (!expeditionId) {
      informe.sinResolver.push({ id: doc._id, motivo: 'sin expediente' });
      continue;
    }

    const clave = String(expeditionId);
    if (!cacheExpedientes.has(clave)) {
      const exp = await Expedition.collection.findOne({ _id: expeditionId }, { projection: { tenantId: 1 } });
      cacheExpedientes.set(clave, exp);
    }
    const exp = cacheExpedientes.get(clave);

    if (!exp) {
      informe.sinResolver.push({ id: doc._id, expeditionId, motivo: 'expediente inexistente' });
      continue;
    }
    if (!exp.tenantId) {
      informe.sinResolver.push({ id: doc._id, expeditionId, motivo: 'expediente sin tenant' });
      continue;
    }

    informe.resolubles += 1;
    if (apply) {
      const r = await Modelo.collection.updateOne(
        { _id: doc._id, ...SIN_TENANT },
        { $set: { tenantId: exp.tenantId } }
      );
      informe.actualizados += r.modifiedCount;
    }
  }

  logger.info(`[${nombre}] sin tenantId: ${informe.pendientes} | resolubles: ${informe.resolubles} | ` +
    `${apply ? 'actualizados' : 'se actualizarian'}: ${apply ? informe.actualizados : informe.resolubles} | ` +
    `sin resolver: ${informe.sinResolver.length}`);
  for (const x of informe.sinResolver) {
    logger.warn(`[${nombre}] ${x.id} sin resolver: ${x.motivo}${x.expeditionId ? ` (expediente ${x.expeditionId})` : ''}`);
  }
  return informe;
}

/**
 * @param {{ apply?: boolean, logger?: { info: Function, warn: Function } }} opciones
 */
async function backfillTenantId({ apply = false, logger = console } = {}) {
  const informe = { dryRun: !apply };
  for (const objetivo of OBJETIVOS) {
    informe[objetivo.nombre] = await procesar(objetivo, { apply, logger });
  }
  return informe;
}

async function main() {
  require('dotenv').config();
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Conectado a Mongo. Modo: ${apply ? 'APLICAR' : 'DRY-RUN (no se escribe nada; usa --apply para aplicar)'}`);
  try {
    const informe = await backfillTenantId({ apply });
    const sinResolver = informe.InspectorCommunication.sinResolver.length + informe.ChatMessage.sinResolver.length;
    if (sinResolver > 0) {
      console.log(`\n${sinResolver} documento(s) sin resolver: revisarlos a mano (ver avisos arriba).`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error en el backfill:', err);
    process.exit(1);
  });
}

module.exports = { backfillTenantId };
