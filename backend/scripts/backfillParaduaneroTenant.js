#!/usr/bin/env node
/**
 * Backfill del tenantId de los controles paraduaneros existentes.
 *
 * Contexto (SECURITY_AUDIT.md): ParaduaneroControl no declaraba tenantId, de
 * modo que el guard ensureSameTenant caia en su rama legacy "sin tenant ->
 * permitido" (fuga cross-tenant potencial) y el listado, que filtra por
 * tenantId, salia siempre vacio. Al declarar el campo, los controles ANTIGUOS
 * siguen sin el; este script lo rellena copiandolo de su expediente.
 *
 * Es idempotente: solo toca los controles que aun no tienen tenantId y cuyo
 * expediente si lo tiene. Se puede ejecutar tantas veces como haga falta.
 *
 * Uso:
 *   node scripts/backfillParaduaneroTenant.js          # aplica los cambios
 *   node scripts/backfillParaduaneroTenant.js --dry-run # solo informa
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { ParaduaneroControl, Expedition } = require('../src/models');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGODB_URI en el entorno.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Conectado a Mongo. Modo: ${DRY_RUN ? 'DRY-RUN' : 'APLICAR'}`);

  // Controles sin tenantId (los que existian antes del fix)
  const sinTenant = await ParaduaneroControl.find({
    $or: [{ tenantId: { $exists: false } }, { tenantId: null }]
  }).select('_id expeditionId').lean();

  console.log(`Controles sin tenantId: ${sinTenant.length}`);

  let actualizados = 0;
  let huerfanos = 0;
  let sinTenantEnExpediente = 0;

  for (const ctrl of sinTenant) {
    if (!ctrl.expeditionId) {
      huerfanos += 1;
      continue;
    }
    const exp = await Expedition.findById(ctrl.expeditionId).select('tenantId').lean();
    if (!exp) {
      huerfanos += 1;
      continue;
    }
    if (!exp.tenantId) {
      // El propio expediente es legacy sin tenant: no hay de donde copiar.
      sinTenantEnExpediente += 1;
      continue;
    }
    if (!DRY_RUN) {
      await ParaduaneroControl.updateOne(
        { _id: ctrl._id },
        { $set: { tenantId: exp.tenantId } }
      );
    }
    actualizados += 1;
  }

  console.log('--- Resumen ---');
  console.log(`  Actualizados${DRY_RUN ? ' (simulado)' : ''}: ${actualizados}`);
  console.log(`  Huerfanos (sin expediente): ${huerfanos}`);
  console.log(`  Expediente sin tenant (no se puede copiar): ${sinTenantEnExpediente}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Error en el backfill:', err);
  process.exit(1);
});
