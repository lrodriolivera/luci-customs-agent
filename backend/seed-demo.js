const mongoose = require('mongoose');
require('dotenv').config();

const Expedition = require('./src/models/Expedition');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luci-customs';

const demoExpeditions = [
  {
    expeditionId: 'EXP-2024-001',
    operationType: 'import',
    transportMode: 'maritime',
    status: 'documents_received',
    priority: 'normal',
    client: {
      companyName: 'Textiles Barcelona S.L.',
      nif: 'B12345678',
      eori: 'ES12345678000',
      address: { street: 'Calle Industria 45', city: 'Barcelona', postalCode: '08025', country: 'ES' },
      contact: { name: 'Maria Garcia', email: 'maria@textilesbarcelona.com', phone: '+34 612 345 678' }
    },
    exporter: { companyName: 'Shanghai Textiles Co Ltd', address: '123 Industrial Road', city: 'Shanghai', country: 'CN' },
    goods: [{
      itemNumber: 1,
      description: 'Cotton fabrics for textile manufacturing',
      descriptionEs: 'Tejidos de algodon para confeccion textil',
      taricCode: '5208210000',
      hsCode: '520821',
      originCountry: 'CN',
      quantity: 5000,
      unit: 'KG',
      grossWeight: 5200,
      netWeight: 5000,
      invoiceValue: 45000,
      packages: { quantity: 100, type: 'CTN', marks: 'TEXTILES BCN' },
      dutyRate: 12,
      vatRate: 21
    }],
    transport: { carrier: 'MSC', vehicleId: 'MSC GENEVA', documentType: 'BL', documentNumber: 'MSCUGE123456', arrivalPort: 'ESBCN', arrivalDate: new Date('2024-12-15') },
    incoterm: { code: 'CIF', place: 'Barcelona' },
    calculations: { invoiceTotal: 45000, freightCost: 2500, insuranceCost: 450, customsValue: 47950, totalDuties: 5754, totalVat: 11278 },
    declaration: { type: 'H1', regime: '40', preference: '100', status: 'draft' },
    internalNotes: 'Cliente habitual. Preferencia MFN aplicable.'
  },
  {
    expeditionId: 'EXP-2024-002',
    operationType: 'import',
    transportMode: 'air',
    status: 'validating_documents',
    priority: 'high',
    client: {
      companyName: 'ElectroMadrid S.A.',
      nif: 'A87654321',
      eori: 'ES87654321000',
      address: { street: 'Avenida de la Industria 120', city: 'Madrid', postalCode: '28021', country: 'ES' },
      contact: { name: 'Carlos Rodriguez', email: 'carlos@electromadrid.es', phone: '+34 623 456 789' }
    },
    exporter: { companyName: 'Samsung Electronics Co', city: 'Seoul', country: 'KR' },
    goods: [{
      itemNumber: 1,
      description: 'Electronic components - Integrated circuits',
      descriptionEs: 'Componentes electronicos - Circuitos integrados',
      taricCode: '8542310000',
      hsCode: '854231',
      originCountry: 'KR',
      quantity: 50000,
      unit: 'PCE',
      grossWeight: 250,
      netWeight: 200,
      invoiceValue: 125000,
      packages: { quantity: 25, type: 'CTN' },
      dutyRate: 0,
      vatRate: 21
    }],
    transport: { carrier: 'Korean Air', vehicleId: 'KE913', documentType: 'AWB', documentNumber: '180-12345678', arrivalPort: 'ESMAD', arrivalDate: new Date('2024-12-10') },
    incoterm: { code: 'FOB', place: 'Seoul' },
    calculations: { invoiceTotal: 125000, freightCost: 3500, insuranceCost: 1250, customsValue: 129750, totalDuties: 0, totalVat: 27248 },
    declaration: { type: 'H1', regime: '40', status: 'draft' },
    internalNotes: 'Componentes electronicos exentos de arancel.'
  },
  {
    expeditionId: 'EXP-2024-003',
    operationType: 'export',
    transportMode: 'maritime',
    status: 'ready_for_declaration',
    client: {
      companyName: 'Vinos Rioja Export S.L.',
      nif: 'B26123456',
      eori: 'ES26123456000',
      address: { street: 'Carretera de Logrono km 5', city: 'Haro', postalCode: '26200', country: 'ES' },
      contact: { name: 'Ana Martinez', email: 'ana@vinosrioja.com', phone: '+34 634 567 890' }
    },
    goods: [{
      itemNumber: 1,
      description: 'Red wine DOC Rioja - Reserve 2019',
      descriptionEs: 'Vino tinto DOC Rioja - Reserva 2019',
      taricCode: '2204210600',
      hsCode: '220421',
      originCountry: 'ES',
      quantity: 12000,
      unit: 'BTL',
      grossWeight: 15000,
      netWeight: 9000,
      invoiceValue: 180000,
      packages: { quantity: 1000, type: 'CTN' }
    }],
    transport: { carrier: 'Maersk', vehicleId: 'MAERSK SEVILLE', documentType: 'BL', documentNumber: 'MAEU987654', departurePort: 'ESBIO', departureDate: new Date('2024-12-20') },
    incoterm: { code: 'CIF', place: 'New York' },
    calculations: { invoiceTotal: 180000, freightCost: 4500, insuranceCost: 1800 },
    declaration: { type: 'AES', regime: '10', status: 'draft' },
    internalNotes: 'Exportacion a USA. Requiere certificado sanitario.'
  },
  {
    expeditionId: 'EXP-2024-004',
    operationType: 'import',
    transportMode: 'maritime',
    status: 'pending_documents',
    priority: 'urgent',
    client: {
      companyName: 'Maquinaria Industrial Valencia S.A.',
      nif: 'A46789012',
      eori: 'ES46789012000',
      address: { street: 'Poligono Industrial Norte, Nave 15', city: 'Valencia', postalCode: '46120', country: 'ES' },
      contact: { name: 'Pedro Sanchez', email: 'pedro@maquinariavlc.com', phone: '+34 645 678 901' }
    },
    exporter: { companyName: 'Tokyo Machinery Corp', city: 'Tokyo', country: 'JP' },
    goods: [{
      itemNumber: 1,
      description: 'CNC machinery for metal processing',
      descriptionEs: 'Maquinaria CNC para mecanizado de metales',
      taricCode: '8457100000',
      hsCode: '845710',
      originCountry: 'JP',
      quantity: 2,
      unit: 'PCE',
      grossWeight: 8500,
      netWeight: 8000,
      invoiceValue: 285000,
      packages: { quantity: 4, type: 'CRT' },
      dutyRate: 1.5,
      vatRate: 21
    }],
    transport: { carrier: 'NYK Line', vehicleId: 'NYK VENUS', documentType: 'BL', documentNumber: 'NYKUVE2024', arrivalPort: 'ESVLC', arrivalDate: new Date('2024-12-22') },
    incoterm: { code: 'CFR', place: 'Valencia' },
    calculations: { invoiceTotal: 285000, freightCost: 8500, insuranceCost: 2850, customsValue: 296350, totalDuties: 4445, totalVat: 63167 },
    declaration: { type: 'H1', regime: '40', status: 'draft' },
    internalNotes: 'URGENTE - Maquinaria industrial.'
  },
  {
    expeditionId: 'EXP-2024-005',
    operationType: 'import',
    transportMode: 'maritime',
    status: 'completed',
    client: {
      companyName: 'Alimentacion Mediterranea S.L.',
      nif: 'B03456789',
      eori: 'ES03456789000',
      address: { street: 'Calle del Puerto 78', city: 'Alicante', postalCode: '03001', country: 'ES' },
      contact: { name: 'Laura Fernandez', email: 'laura@alimed.es', phone: '+34 656 789 012' }
    },
    exporter: { companyName: 'Tunisia Olive Oil Co', city: 'Tunis', country: 'TN' },
    goods: [{
      itemNumber: 1,
      description: 'Extra virgin olive oil - bulk',
      descriptionEs: 'Aceite de oliva virgen extra - a granel',
      taricCode: '1509100090',
      hsCode: '150910',
      originCountry: 'TN',
      quantity: 20000,
      unit: 'LTR',
      grossWeight: 19000,
      netWeight: 18400,
      invoiceValue: 68000,
      packages: { quantity: 1, type: 'TNK' },
      dutyRate: 0,
      vatRate: 10
    }],
    transport: { carrier: 'CTN Lines', vehicleId: 'COSTA TUNISIA', documentType: 'BL', documentNumber: 'CTN2024789', arrivalPort: 'ESALC', arrivalDate: new Date('2024-11-28') },
    incoterm: { code: 'CIF', place: 'Alicante' },
    calculations: { invoiceTotal: 68000, freightCost: 2200, insuranceCost: 680, customsValue: 70880, totalDuties: 0, totalVat: 7088 },
    declaration: { type: 'H1', regime: '40', preference: '300', mrn: 'ES24ESALC000123456', status: 'accepted', channel: 'green' },
    internalNotes: 'Importacion completada. Preferencia EUR-MED aplicada.',
    completedAt: new Date('2024-11-30')
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    for (const exp of demoExpeditions) {
      const exists = await Expedition.findOne({ expeditionId: exp.expeditionId });
      if (!exists) {
        await Expedition.create(exp);
        console.log('Creada:', exp.expeditionId, '-', exp.client.companyName);
      } else {
        console.log('Ya existe:', exp.expeditionId);
      }
    }

    console.log('\n=== DATOS DE PRUEBA CREADOS ===');
    console.log('Expedientes disponibles:');
    console.log('- EXP-2024-001: Textiles Barcelona (Import maritimo desde China)');
    console.log('- EXP-2024-002: ElectroMadrid (Import aereo desde Corea)');
    console.log('- EXP-2024-003: Vinos Rioja (Export maritimo a USA)');
    console.log('- EXP-2024-004: Maquinaria Valencia (Import maritimo desde Japon) - URGENTE');
    console.log('- EXP-2024-005: Alimentacion Mediterranea (Completado - Tunisia)');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

seed();
