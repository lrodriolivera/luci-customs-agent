#!/usr/bin/env node
/**
 * Script de Configuración de Certificado AEAT
 * LUCI Customs Agent - Stock Logistic
 *
 * Este script importa y verifica el certificado digital para AEAT
 *
 * Uso: node scripts/setup-certificate.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
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
  logSection('LUCI Customs Agent - Configuración de Certificado AEAT');

  // 1. Verificar variables de entorno
  log('\n📋 Verificando configuración...', 'cyan');

  const certPath = process.env.AEAT_CERTIFICATE_PATH;
  const certPassword = process.env.AEAT_CERTIFICATE_PASSWORD;
  const aeatEnv = process.env.AEAT_ENVIRONMENT || 'simulation';

  if (!certPath) {
    log('❌ ERROR: AEAT_CERTIFICATE_PATH no está configurado en .env', 'red');
    process.exit(1);
  }

  if (!certPassword) {
    log('❌ ERROR: AEAT_CERTIFICATE_PASSWORD no está configurado en .env', 'red');
    process.exit(1);
  }

  log(`   Entorno AEAT: ${aeatEnv}`, 'blue');
  log(`   Ruta certificado: ${certPath}`, 'blue');

  // 2. Verificar que el archivo existe
  const fullPath = path.resolve(process.cwd(), certPath);

  if (!fs.existsSync(fullPath)) {
    log(`❌ ERROR: No se encontró el certificado en: ${fullPath}`, 'red');
    process.exit(1);
  }

  log('✅ Archivo de certificado encontrado', 'green');

  // 3. Intentar leer y parsear el certificado
  log('\n🔐 Leyendo certificado P12...', 'cyan');

  try {
    const p12Buffer = fs.readFileSync(fullPath);
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword);

    log('✅ Certificado leído correctamente', 'green');

    // 4. Extraer información del certificado
    log('\n📄 Extrayendo información del certificado...', 'cyan');

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certBag = certBags[forge.pki.oids.certBag];
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBag || certBag.length === 0) {
      log('❌ ERROR: No se encontró certificado en el archivo P12', 'red');
      process.exit(1);
    }

    if (!keyBag || keyBag.length === 0) {
      log('❌ ERROR: No se encontró clave privada en el archivo P12', 'red');
      process.exit(1);
    }

    const certificate = certBag[0].cert;

    // 5. Mostrar información del certificado
    logSection('Información del Certificado');

    const subject = certificate.subject.attributes.reduce((acc, attr) => {
      acc[attr.shortName || attr.name] = attr.value;
      return acc;
    }, {});

    const issuer = certificate.issuer.attributes.reduce((acc, attr) => {
      acc[attr.shortName || attr.name] = attr.value;
      return acc;
    }, {});

    const validFrom = certificate.validity.notBefore;
    const validTo = certificate.validity.notAfter;
    const now = new Date();
    const daysToExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

    console.log('\n📌 Titular:');
    log(`   Nombre: ${subject.CN || 'N/A'}`, 'blue');
    log(`   Organización: ${subject.O || 'N/A'}`, 'blue');
    log(`   NIF/NIE: ${subject.serialNumber || 'N/A'}`, 'blue');
    if (subject.organizationIdentifier) {
      log(`   CIF Empresa: ${subject.organizationIdentifier.replace('VATES-', '')}`, 'blue');
    }

    console.log('\n🏛️  Emisor:');
    log(`   ${issuer.CN || issuer.O || 'N/A'}`, 'blue');

    console.log('\n📅 Validez:');
    log(`   Desde: ${validFrom.toLocaleDateString('es-ES')}`, 'blue');
    log(`   Hasta: ${validTo.toLocaleDateString('es-ES')}`, 'blue');

    if (daysToExpiry > 30) {
      log(`   Estado: ✅ Vigente (${daysToExpiry} días restantes)`, 'green');
    } else if (daysToExpiry > 0) {
      log(`   Estado: ⚠️  Próximo a expirar (${daysToExpiry} días restantes)`, 'yellow');
    } else {
      log(`   Estado: ❌ EXPIRADO`, 'red');
      process.exit(1);
    }

    // 6. Verificar tipo de certificado
    console.log('\n🎫 Tipo de Certificado:');

    let certType = 'FNMT_PF'; // Default: Persona Física
    let certTypeName = 'Persona Física';

    // Detectar tipo de certificado
    const issuerCN = issuer.CN || '';
    const subjectCN = subject.CN || '';

    // Certificado de Representante (AC Representación o R: en el CN)
    if (issuerCN.toLowerCase().includes('representaci') || subjectCN.includes('(R:')) {
      certType = 'FNMT_REP';
      certTypeName = 'Representante FNMT (ideal para agente aduanas)';
      log(`   ✅ ${certTypeName}`, 'green');
    } else if (subject.O && subject.serialNumber && subject.serialNumber.includes('CIF')) {
      certType = 'FNMT_PJ';
      certTypeName = 'Persona Jurídica';
      log(`   ${certTypeName}`, 'blue');
    } else {
      log(`   ${certTypeName}`, 'blue');
    }

    // 7. Operaciones permitidas
    console.log('\n📋 Operaciones AEAT Permitidas:');

    const operations = {
      'FNMT_REP': ['H1 Importación', 'H7 Bajo Valor', 'AES Exportación', 'NCTS Tránsito', 'SILICIE', 'VUA'],
      'FNMT_PJ': ['H1 Importación', 'H7 Bajo Valor', 'AES Exportación', 'NCTS Tránsito', 'SILICIE'],
      'FNMT_PF': ['H1 Importación', 'H7 Bajo Valor', 'AES Exportación', 'NCTS Tránsito']
    };

    const allowedOps = operations[certType] || operations['FNMT_PF'];
    allowedOps.forEach(op => log(`   ✅ ${op}`, 'green'));

    // 8. Resumen final
    logSection('Resumen de Configuración');

    log('\n✅ Certificado configurado correctamente', 'green');
    log(`\n   Entorno: ${aeatEnv.toUpperCase()}`, 'cyan');

    if (aeatEnv === 'simulation') {
      log('\n⚠️  Actualmente en modo SIMULACIÓN', 'yellow');
      log('   Para usar conexión real con AEAT, cambie AEAT_ENVIRONMENT a "test" o "production"', 'yellow');
    } else if (aeatEnv === 'test') {
      log('\n📡 Modo PRUEBAS - Conectará con entorno de pruebas AEAT', 'cyan');
      log('   URL: https://www1.agenciatributaria.gob.es', 'blue');
    } else if (aeatEnv === 'production') {
      log('\n🚀 Modo PRODUCCIÓN - Conectará con AEAT real', 'green');
      log('   URL: https://www.agenciatributaria.gob.es', 'blue');
    }

    console.log('\n' + '='.repeat(60));
    log(' Configuración completada exitosamente', 'green');
    console.log('='.repeat(60) + '\n');

    // Retornar información para uso programático
    return {
      success: true,
      certificate: {
        subject: subject.CN,
        organization: subject.O,
        nif: subject.serialNumber,
        cif: subject.organizationIdentifier,
        issuer: issuer.CN,
        validFrom,
        validTo,
        daysToExpiry,
        type: certType,
        typeName: certTypeName
      },
      environment: aeatEnv,
      allowedOperations: allowedOps
    };

  } catch (error) {
    if (error.message.includes('PKCS#12 MAC could not be verified')) {
      log('❌ ERROR: Contraseña incorrecta', 'red');
    } else if (error.message.includes('Invalid PFX')) {
      log('❌ ERROR: Archivo P12/PFX inválido o corrupto', 'red');
    } else {
      log(`❌ ERROR: ${error.message}`, 'red');
    }
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(err => {
    log(`❌ Error fatal: ${err.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };
