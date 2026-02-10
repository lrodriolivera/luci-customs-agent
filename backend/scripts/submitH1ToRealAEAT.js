/**
 * Script para enviar H1 a AEAT REAL (no simulación)
 * Ejecutar: node scripts/submitH1ToRealAEAT.js
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Expedition } = require('../src/models');
const aeatRealService = require('../src/services/aeat/aeatRealService');
const certificateService = require('../src/services/aeat/certificateService');

const EXPEDITION_ID = '6972273f520352cc52803be4';

async function submitToRealAEAT() {
  try {
    console.log('='.repeat(60));
    console.log('ENVÍO H1 A AEAT REAL');
    console.log('='.repeat(60));

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n1. Conectado a MongoDB');

    // Obtener expediente
    const expedition = await Expedition.findById(EXPEDITION_ID);
    if (!expedition) {
      throw new Error('Expediente no encontrado');
    }
    if (!expedition.declaration || !expedition.declaration.xmlContent) {
      throw new Error('Expediente sin declaración H1 generada');
    }

    console.log('2. Expediente encontrado:', expedition.expeditionId);
    console.log('   LRN:', expedition.declaration.lrn);
    console.log('   XML length:', expedition.declaration.xmlContent.length, 'chars');

    // Info del servicio AEAT
    const info = aeatRealService.getInfo();
    console.log('\n3. Configuración AEAT:');
    console.log('   Entorno:', info.environment);
    console.log('   Base URL:', info.baseUrl);
    console.log('   SSL Cert:', info.sslStatus.certificateLoaded ? 'Cargado' : 'No cargado');
    console.log('   Simulación:', info.simulationMode ? 'SÍ' : 'NO');

    // Importar certificado al servicio de certificados
    console.log('\n4. Cargando certificado para firma...');
    const certPath = path.resolve(__dirname, '..', process.env.AEAT_CERTIFICATE_PATH);

    if (!fs.existsSync(certPath)) {
      throw new Error('Certificado no encontrado en: ' + certPath);
    }

    const certBuffer = fs.readFileSync(certPath);

    const importResult = await certificateService.importCertificate(
      certBuffer,
      process.env.AEAT_CERTIFICATE_PASSWORD,
      { alias: 'fnmt-jenifer' }
    );

    if (!importResult.success) {
      throw new Error('Error importando certificado: ' + importResult.error);
    }

    console.log('   Certificado importado:', importResult.certificateId);
    console.log('   Titular:', importResult.info.subject);

    // Intentar enviar a AEAT
    console.log('\n5. Enviando H1 a AEAT...');
    const wsdlUrl = aeatRealService.environment.ws3BaseUrl + aeatRealService.SERVICES.H1_SUBMIT.wsdl;
    console.log('   URL:', wsdlUrl);

    const result = await aeatRealService.submitH1Declaration(
      expedition.declaration.xmlContent,
      importResult.certificateId,
      process.env.AEAT_CERTIFICATE_PASSWORD,
      { expeditionId: expedition.expeditionId }
    );

    console.log('\n' + '='.repeat(60));
    console.log('RESULTADO:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

    // Si hay éxito, actualizar expediente
    if (result.success && result.mrn) {
      console.log('\n6. Actualizando expediente con respuesta AEAT...');
      expedition.declaration.mrn = result.mrn;
      expedition.declaration.channel = result.channel;
      expedition.declaration.status = 'submitted';
      expedition.declaration.aeatResponse = result;
      expedition.declaration.submittedAt = new Date();

      await expedition.save();
      console.log('   Expediente actualizado');
    }

    return result;

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR:');
    console.error('='.repeat(60));
    console.error('Mensaje:', error.message);
    if (error.code) console.error('Código:', error.code);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data?.substring?.(0, 500));
    }
    return { success: false, error: error.message };
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB');
  }
}

// Ejecutar
submitToRealAEAT()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  });
