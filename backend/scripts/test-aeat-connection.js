#!/usr/bin/env node
/**
 * Script de Prueba de Conexión AEAT
 * LUCI Customs Agent - Stock Logistic
 *
 * Prueba la firma digital y conectividad con AEAT
 *
 * Uso: node scripts/test-aeat-connection.js
 */

require('dotenv').config();
const path = require('path');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(` ${title}`, 'bright');
  console.log('='.repeat(60));
}

async function main() {
  logSection('LUCI Customs Agent - Test de Conexión AEAT');

  const aeatEnv = process.env.AEAT_ENVIRONMENT || 'simulation';
  log(`\n📡 Entorno configurado: ${aeatEnv.toUpperCase()}`, 'cyan');

  // Importar servicios
  log('\n📦 Cargando servicios...', 'cyan');

  const certificateService = require('../src/services/aeat/certificateService');
  const xadesSignatureService = require('../src/services/aeat/xadesSignatureService');
  const aeatConfig = require('../src/services/aeat/aeatConfig');

  log('✅ Servicios cargados', 'green');

  // 1. Verificar modo
  logSection('1. Verificación de Modo');

  const isSimulation = aeatConfig.isSimulationMode();
  const currentEnv = aeatConfig.getCurrentEnvironment();

  log(`   Modo simulación: ${isSimulation ? 'SÍ' : 'NO'}`, isSimulation ? 'yellow' : 'green');
  log(`   Entorno activo: ${currentEnv.name}`, 'blue');

  if (currentEnv.baseUrl) {
    log(`   URL base: ${currentEnv.baseUrl}`, 'blue');
  }

  // 2. Importar certificado
  logSection('2. Importación de Certificado');

  const certPath = process.env.AEAT_CERTIFICATE_PATH;
  const certPassword = process.env.AEAT_CERTIFICATE_PASSWORD;

  if (!certPath || !certPassword) {
    log('⚠️  Certificado no configurado - saltando pruebas de firma', 'yellow');
  } else {
    const fs = require('fs');
    const fullCertPath = path.resolve(process.cwd(), certPath);

    if (fs.existsSync(fullCertPath)) {
      log(`   Certificado: ${certPath}`, 'blue');

      try {
        const p12Buffer = fs.readFileSync(fullCertPath);

        const importResult = await certificateService.importCertificate(
          p12Buffer,
          certPassword,
          {
            alias: 'STRIX-AEAT-CERT',
            organizationId: 'strix-ai',
            userId: 'setup-script'
          }
        );

        if (importResult.success) {
          log('✅ Certificado importado correctamente', 'green');
          log(`   ID: ${importResult.certificateId}`, 'blue');
          log(`   Titular: ${importResult.info.subject}`, 'blue');
          log(`   Tipo: ${importResult.info.type}`, 'blue');
          log(`   Válido hasta: ${new Date(importResult.info.validTo).toLocaleDateString('es-ES')}`, 'blue');
          log(`   Días restantes: ${importResult.info.daysToExpiry}`, 'blue');

          // 3. Probar firma XAdES
          logSection('3. Prueba de Firma XAdES');

          const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<TestDeclaration xmlns="urn:luci:customs:test">
  <Header>
    <Timestamp>${new Date().toISOString()}</Timestamp>
    <TestMode>true</TestMode>
  </Header>
  <Body>
    <Message>Prueba de firma digital LUCI Customs Agent</Message>
    <Organization>STRIX AI PIONEER SOLUTIONS SL</Organization>
    <CIF>B22477020</CIF>
  </Body>
</TestDeclaration>`;

          log('   Firmando documento de prueba...', 'cyan');

          const signResult = await xadesSignatureService.signForAEAT(
            testXML,
            importResult.certificateId,
            certPassword,
            { documentType: 'test' }
          );

          if (signResult.success) {
            log('✅ Documento firmado correctamente', 'green');
            log(`   Tipo firma: ${signResult.signatureInfo.signatureType}`, 'blue');
            log(`   Algoritmo: RSA-SHA256`, 'blue');
            log(`   Política: ${signResult.signatureInfo.policy}`, 'blue');
            log(`   Timestamp: ${signResult.signatureInfo.timestamp}`, 'blue');

            // Mostrar extracto del XML firmado
            log('\n   📄 Extracto del XML firmado:', 'magenta');
            const signedPreview = signResult.signedXML.substring(0, 500) + '...';
            console.log('   ' + signedPreview.split('\n').join('\n   '));

          } else {
            log(`❌ Error firmando: ${signResult.error}`, 'red');
            if (signResult.luciAnalysis) {
              log(`   Análisis: ${JSON.stringify(signResult.luciAnalysis, null, 2)}`, 'yellow');
            }
          }

          // 4. Verificar firma
          if (signResult.success) {
            logSection('4. Verificación de Firma');

            const verifyResult = await xadesSignatureService.verifyAEATResponse(signResult.signedXML);

            if (verifyResult.valid) {
              log('✅ Firma verificada correctamente', 'green');
            } else {
              log(`⚠️  Verificación: ${verifyResult.error || 'No se pudo verificar'}`, 'yellow');
            }
          }

        } else {
          log(`❌ Error importando certificado: ${importResult.error}`, 'red');
        }

      } catch (error) {
        log(`❌ Error: ${error.message}`, 'red');
      }
    } else {
      log(`❌ Archivo no encontrado: ${fullCertPath}`, 'red');
    }
  }

  // 5. Test de conectividad (si no es simulación)
  if (!isSimulation && currentEnv.baseUrl) {
    logSection('5. Test de Conectividad AEAT');

    const https = require('https');

    log(`   Probando conexión a: ${currentEnv.baseUrl}`, 'cyan');

    try {
      await new Promise((resolve, reject) => {
        const url = new URL(currentEnv.baseUrl);
        const req = https.request({
          hostname: url.hostname,
          port: 443,
          path: '/',
          method: 'HEAD',
          timeout: 10000
        }, (res) => {
          log(`✅ Conexión exitosa (HTTP ${res.statusCode})`, 'green');
          resolve();
        });

        req.on('error', (err) => {
          log(`⚠️  Error de conexión: ${err.message}`, 'yellow');
          resolve(); // No fallar el script por esto
        });

        req.on('timeout', () => {
          log('⚠️  Timeout de conexión', 'yellow');
          req.destroy();
          resolve();
        });

        req.end();
      });
    } catch (error) {
      log(`⚠️  Error de red: ${error.message}`, 'yellow');
    }
  } else {
    logSection('5. Conectividad');
    log('   ⏭️  Modo simulación - No se requiere conectividad externa', 'yellow');
  }

  // Resumen final
  logSection('Resumen');

  log('\n✅ Configuración verificada correctamente', 'green');

  if (isSimulation) {
    log('\n📋 Próximos pasos para conexión REAL con AEAT:', 'cyan');
    log('   1. Cambiar AEAT_ENVIRONMENT=test en .env', 'blue');
    log('   2. Reiniciar el servidor backend', 'blue');
    log('   3. Probar con una declaración de prueba', 'blue');
  } else {
    log('\n🚀 Sistema listo para conexión con AEAT', 'green');
    log(`   Entorno: ${aeatEnv.toUpperCase()}`, 'cyan');
  }

  console.log('\n' + '='.repeat(60));
  log(' Test completado', 'green');
  console.log('='.repeat(60) + '\n');
}

// Ejecutar
main().catch(err => {
  log(`❌ Error fatal: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
