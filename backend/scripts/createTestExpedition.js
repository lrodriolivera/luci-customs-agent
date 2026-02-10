/**
 * Script para crear expediente de prueba y enviar H1 a AEAT
 * Ejecutar: node scripts/createTestExpedition.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Importar modelos y servicios
const { Expedition } = require('../src/models');

const testExpeditionData = {
  operationType: 'import',
  transportMode: 'maritime',
  status: 'documents_validated',

  client: {
    companyName: 'Importaciones Mediterráneo S.L.',
    nif: 'B22477020',
    eori: 'ESB22477020000',
    address: {
      street: 'Avinguda Diagonal 445',
      city: 'Barcelona',
      postalCode: '08036',
      country: 'ES'
    },
    contact: {
      name: 'María García López',
      email: 'maria.garcia@importmed.es',
      phone: '+34 932 001 234'
    }
  },

  exporter: {
    companyName: 'Shanghai Electronics Manufacturing Co., Ltd.',
    address: 'No. 888 Industry Road, Pudong New Area',
    city: 'Shanghai',
    country: 'CN'
  },

  goods: [
    {
      itemNumber: 1,
      description: 'Ordenadores portátiles con pantalla LCD 15.6 pulgadas, procesador Intel i5, 8GB RAM',
      taricCode: '84713000',
      hsCode: '847130',
      originCountry: 'CN',
      quantity: 50,
      unit: 'PCE',
      grossWeight: 175,
      netWeight: 150,
      invoiceValue: 22500,
      currency: 'EUR',
      packages: {
        quantity: 10,
        type: 'CTN',
        marks: 'SHEM-TEST-001'
      }
    },
    {
      itemNumber: 2,
      description: 'Ratones ópticos inalámbricos USB 2.4GHz',
      taricCode: '84716060',
      hsCode: '847160',
      originCountry: 'CN',
      quantity: 200,
      unit: 'PCE',
      grossWeight: 30,
      netWeight: 24,
      invoiceValue: 1000,
      currency: 'EUR',
      packages: {
        quantity: 4,
        type: 'CTN',
        marks: 'SHEM-TEST-002'
      }
    },
    {
      itemNumber: 3,
      description: 'Teclados mecánicos USB con retroiluminación RGB',
      taricCode: '84716070',
      hsCode: '847160',
      originCountry: 'CN',
      quantity: 100,
      unit: 'PCE',
      grossWeight: 90,
      netWeight: 80,
      invoiceValue: 3000,
      currency: 'EUR',
      packages: {
        quantity: 5,
        type: 'CTN',
        marks: 'SHEM-TEST-003'
      }
    }
  ],

  transport: {
    carrier: 'MSC Mediterranean Shipping Company',
    vehicleId: 'MSC GÜLSÜN',
    documentType: 'BL',
    documentNumber: 'MSCU-TEST-2026-001',
    arrivalPort: 'ESBCN',
    departurePort: 'CNSHA',
    loadingPlace: 'Shanghai, China',
    unloadingPlace: 'Puerto de Barcelona'
  },

  incoterm: {
    code: 'CIF',
    place: 'Barcelona'
  },

  invoiceTotal: 26500,
  customsValue: 27300,

  documents: [
    {
      type: 'commercial_invoice',
      fileName: 'invoice_SHEM_2026_TEST.pdf',
      status: 'validated',
      uploadedAt: new Date(),
      extractedData: {
        invoiceNumber: 'INV-SHEM-2026-TEST',
        invoiceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        totalAmount: 26500,
        currency: 'EUR'
      }
    },
    {
      type: 'packing_list',
      fileName: 'packing_SHEM_2026_TEST.pdf',
      status: 'validated',
      uploadedAt: new Date(),
      extractedData: {
        totalPackages: 19,
        totalGrossWeight: 295,
        totalNetWeight: 254
      }
    },
    {
      type: 'bill_of_lading',
      fileName: 'bl_MSCU_TEST_2026.pdf',
      status: 'validated',
      uploadedAt: new Date(),
      extractedData: {
        blNumber: 'MSCU-TEST-2026-001',
        vessel: 'MSC GÜLSÜN',
        containers: ['MSCU1234567']
      }
    }
  ],

  timeline: [
    {
      action: 'expedition_created',
      description: 'Expediente de prueba creado para test H1',
      performedBy: 'Sistema - Script de prueba',
      timestamp: new Date()
    }
  ]
};

async function createTestExpedition() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs');
    console.log('Conectado a MongoDB');

    console.log('\nCreando expediente de prueba...');
    const expedition = new Expedition(testExpeditionData);
    await expedition.save();

    console.log('\n========================================');
    console.log('EXPEDIENTE CREADO EXITOSAMENTE');
    console.log('========================================');
    console.log('ID:', expedition._id);
    console.log('Expedition ID:', expedition.expeditionId);
    console.log('Estado:', expedition.status);
    console.log('Cliente:', expedition.client.companyName);
    console.log('Artículos:', expedition.goods.length);
    console.log('Valor aduanero:', expedition.customsValue, 'EUR');
    console.log('Documentos:', expedition.documents.length);
    console.log('========================================');

    return expedition;

  } catch (error) {
    console.error('Error:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\nDesconectado de MongoDB');
  }
}

// Ejecutar
createTestExpedition()
  .then(exp => {
    console.log('\nExpediente listo para ver en frontend');
    console.log('URL: http://localhost:3001/expeditions/' + exp._id);
    process.exit(0);
  })
  .catch(err => {
    console.error('Fallo al crear expediente:', err.message);
    process.exit(1);
  });
