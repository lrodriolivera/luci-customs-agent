/**
 * Script para enviar H1 de prueba a AEAT (simulación)
 * Ejecutar: node scripts/submitH1Test.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Expedition } = require('../src/models');
const crypto = require('crypto');

const EXPEDITION_ID = '6972273f520352cc52803be4';

// Función de simulación AEAT directa
function simulateAEATSubmission(xml) {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomPart = crypto.randomBytes(7).toString('hex').toUpperCase();
  const mrn = `${year}ESIM${randomPart}`;

  // Simular asignación de canal (70% verde, 25% naranja, 5% rojo)
  const random = Math.random();
  let channel;
  if (random < 0.70) channel = 'green';
  else if (random < 0.95) channel = 'orange';
  else channel = 'red';

  // Extraer LRN del XML
  const lrnMatch = xml.match(/<LRN>([^<]+)<\/LRN>/);
  const lrn = lrnMatch ? lrnMatch[1] : 'UNKNOWN';

  return {
    success: true,
    simulated: true,
    mrn,
    lrn,
    status: 'accepted',
    channel,
    channelDescription: {
      'green': 'Canal Verde - Levante autorizado',
      'orange': 'Canal Naranja - Revisión documental',
      'red': 'Canal Rojo - Inspección física'
    }[channel],
    acceptanceDate: new Date().toISOString(),
    customsOffice: 'ES002801',
    message: `[SIMULACIÓN] Declaración aceptada - Canal ${channel.toUpperCase()}`,
    duties: {
      dutyAmount: 1626,
      vatAmount: 5082,
      totalAmount: 6708
    },
    estimatedRelease: channel === 'green'
      ? new Date().toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    aeatResponse: {
      code: '0000',
      description: 'Declaración aceptada',
      timestamp: new Date().toISOString()
    }
  };
}

async function submitH1() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs');
    console.log('Conectado\n');

    // 1. Obtener expediente
    console.log('1. Obteniendo expediente:', EXPEDITION_ID);
    const expedition = await Expedition.findById(EXPEDITION_ID);

    if (!expedition) {
      throw new Error('Expediente no encontrado');
    }

    console.log('   Expedition ID:', expedition.expeditionId);
    console.log('   Estado:', expedition.status);
    console.log('   Cliente:', expedition.client.companyName);

    // Verificar que tiene declaración H1
    if (!expedition.declaration || !expedition.declaration.xmlContent) {
      throw new Error('El expediente no tiene declaración H1 generada');
    }

    console.log('   LRN:', expedition.declaration.lrn);
    console.log('   Estado declaración:', expedition.declaration.status);

    // 2. Enviar a AEAT (simulación)
    console.log('\n2. Enviando a AEAT (simulación)...');

    const submitResult = simulateAEATSubmission(expedition.declaration.xmlContent);

    console.log('\n========================================');
    console.log('RESPUESTA AEAT (SIMULADA)');
    console.log('========================================');
    console.log('Success:', submitResult.success);
    console.log('MRN:', submitResult.mrn);
    console.log('Canal:', submitResult.channel);
    console.log('Derechos:', JSON.stringify(submitResult.duties, null, 2));
    console.log('========================================\n');

    // 3. Actualizar expediente con resultado
    console.log('3. Actualizando expediente...');

    expedition.declaration.status = 'submitted';
    expedition.declaration.mrn = submitResult.mrn;
    expedition.declaration.channel = submitResult.channel;
    expedition.declaration.submittedAt = new Date();
    expedition.declaration.aeatResponse = submitResult;

    // Cambiar estado según canal
    const channelStatusMap = {
      'green': 'green_channel',
      'orange': 'orange_channel',
      'red': 'red_channel'
    };
    expedition.status = channelStatusMap[submitResult.channel] || 'declaration_submitted';

    // Agregar a timeline
    expedition.timeline.push({
      action: 'declaration_submitted',
      description: `H1 enviado a AEAT (simulación). MRN: ${submitResult.mrn}. Canal: ${submitResult.channel}`,
      performedBy: 'Sistema - Script de prueba',
      timestamp: new Date(),
      metadata: {
        mrn: submitResult.mrn,
        channel: submitResult.channel,
        simulated: true
      }
    });

    await expedition.save();
    console.log('   Estado actualizado:', expedition.status);

    // 4. Procesar según canal
    console.log('\n4. Procesando canal:', submitResult.channel);

    if (submitResult.channel === 'green') {
      // Generar levante automático
      const levanteNumber = `LEV${new Date().getFullYear()}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

      expedition.levante = {
        number: levanteNumber,
        date: new Date(),
        type: 'automatic',
        status: 'authorized'
      };

      expedition.timeline.push({
        action: 'levante_generated',
        description: `Levante automático generado: ${levanteNumber}`,
        performedBy: 'Sistema',
        timestamp: new Date()
      });

      expedition.status = 'levante';
      await expedition.save();

      console.log('   ✓ LEVANTE AUTOMÁTICO:', levanteNumber);
      console.log('   ✓ Mercancía puede ser retirada');

    } else if (submitResult.channel === 'orange') {
      // Canal naranja - requerimiento documental
      console.log('   → Canal NARANJA - Se requiere revisión documental');
      console.log('   → Se creará requerimiento automáticamente');

    } else if (submitResult.channel === 'red') {
      // Canal rojo - inspección física
      console.log('   → Canal ROJO - Se requiere inspección física');
      console.log('   → Se programará cita con inspector');
    }

    // Resumen final
    console.log('\n========================================');
    console.log('RESUMEN FINAL');
    console.log('========================================');
    console.log('Expediente:', expedition.expeditionId);
    console.log('MRN:', expedition.declaration.mrn);
    console.log('LRN:', expedition.declaration.lrn);
    console.log('Estado:', expedition.status);
    console.log('Canal:', expedition.declaration.channel);
    if (expedition.levante) {
      console.log('Levante:', expedition.levante.number);
    }
    console.log('========================================');
    console.log('\nPuedes ver el expediente en:');
    console.log('http://localhost:3001/expeditions/' + expedition._id);

    return expedition;

  } catch (error) {
    console.error('\nError:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB');
  }
}

// Ejecutar
submitH1()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
