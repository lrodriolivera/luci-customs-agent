/**
 * Seed Demo Data Script
 * Genera datos de prueba realistas para demostración del sistema LUCI
 *
 * Ejecutar: node src/scripts/seedDemoData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

// Import models
const Expedition = require('../models/Expedition');
const Requirement = require('../models/Requirement');
const Deadline = require('../models/Deadline');
const Inspection = require('../models/Inspection');
const Guarantee = require('../models/Guarantee');
const H7Declaration = require('../models/H7Declaration');
const Transit = require('../models/Transit');
const SpecialRegime = require('../models/SpecialRegime');
const OEA = require('../models/OEA');
const InspectorCommunication = require('../models/InspectorCommunication');
const User = require('../models/User');

// ==================== Helper Functions ====================

const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateMRN = (year = 2026) => {
  const num = String(randomNumber(100000, 999999));
  return `${year}ES00${num}`;
};

const generateLRN = () => {
  return `LRN${Date.now()}${randomNumber(1000, 9999)}`;
};

// ==================== Demo Data ====================

// Clientes demo
const clients = [
  { companyName: 'Electrónica Ibérica S.L.', nif: 'B12345678', eori: 'ESB12345678', city: 'Madrid', sector: 'electronics' },
  { companyName: 'Textiles del Mediterráneo', nif: 'A87654321', eori: 'ESA87654321', city: 'Valencia', sector: 'textiles' },
  { companyName: 'Importaciones García', nif: 'B11223344', eori: 'ESB11223344', city: 'Barcelona', sector: 'general' },
  { companyName: 'Farmacéutica Novax', nif: 'A55667788', eori: 'ESA55667788', city: 'Bilbao', sector: 'pharma' },
  { companyName: 'Autopartes Express', nif: 'B99887766', eori: 'ESB99887766', city: 'Sevilla', sector: 'automotive' },
  { companyName: 'Alimentos Premium S.A.', nif: 'A44332211', eori: 'ESA44332211', city: 'Málaga', sector: 'food' },
  { companyName: 'Tech Solutions Iberia', nif: 'B77889900', eori: 'ESB77889900', city: 'Madrid', sector: 'tech' },
  { companyName: 'Muebles Modernos', nif: 'A22334455', eori: 'ESA22334455', city: 'Zaragoza', sector: 'furniture' }
];

// Países de origen
const originCountries = ['CN', 'US', 'JP', 'KR', 'IN', 'VN', 'TW', 'TH', 'DE', 'FR', 'IT', 'UK', 'MX', 'BR'];

// Productos demo
const products = [
  { description: 'Smartphones Android 128GB', taricCode: '85171290', weight: 0.2, value: 150, origin: 'CN' },
  { description: 'Tablets 10 pulgadas', taricCode: '84713000', weight: 0.5, value: 200, origin: 'CN' },
  { description: 'Componentes electrónicos varios', taricCode: '85423900', weight: 2, value: 500, origin: 'TW' },
  { description: 'Camisetas algodón 100%', taricCode: '61091000', weight: 0.3, value: 8, origin: 'BD' },
  { description: 'Pantalones vaqueros', taricCode: '62034235', weight: 0.6, value: 15, origin: 'VN' },
  { description: 'Calzado deportivo', taricCode: '64041100', weight: 0.8, value: 25, origin: 'CN' },
  { description: 'Piezas automóvil - filtros', taricCode: '84212300', weight: 1.5, value: 45, origin: 'JP' },
  { description: 'Baterías litio', taricCode: '85076000', weight: 5, value: 800, origin: 'KR' },
  { description: 'Medicamentos genéricos', taricCode: '30049000', weight: 0.1, value: 50, origin: 'IN' },
  { description: 'Maquinaria industrial', taricCode: '84798997', weight: 500, value: 15000, origin: 'DE' },
  { description: 'Aceite de oliva virgen extra', taricCode: '15091090', weight: 20, value: 80, origin: 'IT' },
  { description: 'Vino tinto DOC', taricCode: '22042192', weight: 15, value: 120, origin: 'FR' },
  { description: 'Muebles de madera', taricCode: '94036090', weight: 50, value: 350, origin: 'PL' },
  { description: 'Juguetes plástico', taricCode: '95030070', weight: 0.5, value: 5, origin: 'CN' }
];

// Puertos y aduanas
const customsOffices = [
  { code: 'ES002801', name: 'Aduana de Barcelona Puerto' },
  { code: 'ES002804', name: 'Aduana de Barcelona Aeropuerto' },
  { code: 'ES004601', name: 'Aduana de Valencia Puerto' },
  { code: 'ES002901', name: 'Aduana de Madrid Aeropuerto' },
  { code: 'ES004101', name: 'Aduana de Algeciras Puerto' },
  { code: 'ES004801', name: 'Aduana de Bilbao Puerto' }
];

// ==================== Seed Functions ====================

async function seedExpeditions(tenantId) {
  console.log('Creando expedientes...');

  const statuses = ['draft', 'pending_documents', 'documents_received', 'documents_validated', 'declaration_submitted', 'green_channel', 'orange_channel', 'red_channel', 'levante', 'completed'];
  const channels = ['green', 'orange', 'red'];
  const transportModes = ['maritime', 'air', 'road', 'rail'];
  const incoterms = ['FOB', 'CIF', 'EXW', 'DDP', 'DAP', 'CFR'];

  const expeditions = [];

  for (let i = 0; i < 25; i++) {
    const client = randomItem(clients);
    const product = randomItem(products);
    const quantity = randomNumber(100, 5000);
    const customsOffice = randomItem(customsOffices);
    const status = randomItem(statuses);
    const hasChannel = ['green_channel', 'orange_channel', 'red_channel', 'levante', 'completed'].includes(status);

    const expedition = new Expedition({
      tenantId,
      expeditionId: `EXP-2026-${String(i + 100).padStart(4, '0')}`,
      operationType: randomItem(['import', 'export']),
      transportMode: randomItem(transportModes),
      status,
      priority: randomItem(['low', 'normal', 'high', 'urgent']),
      client: {
        companyName: client.companyName,
        nif: client.nif,
        eori: client.eori,
        address: {
          street: `Calle Principal ${randomNumber(1, 100)}`,
          city: client.city,
          postalCode: String(randomNumber(10000, 50000)),
          country: 'ES'
        },
        contact: {
          name: `Contacto ${i + 1}`,
          email: `contacto${i + 1}@${client.companyName.toLowerCase().replace(/\s/g, '')}.es`,
          phone: `+34 6${randomNumber(10000000, 99999999)}`
        }
      },
      goods: [{
        itemNumber: 1,
        description: product.description,
        taricCode: product.taricCode,
        quantity: quantity,
        unitType: 'pcs',
        netWeight: product.weight * quantity,
        grossWeight: product.weight * quantity * 1.1,
        invoiceValue: product.value * quantity,
        currency: 'EUR',
        originCountry: product.origin
      }],
      transport: {
        carrier: `Carrier ${randomNumber(1, 10)}`,
        vesselName: transportModes === 'maritime' ? `MV ${randomItem(['EVER GIVEN', 'MAERSK LINE', 'MSC GULSUN', 'CMA CGM'])}` : undefined,
        voyageNumber: `VOY${randomNumber(1000, 9999)}`,
        containerNumber: `MSKU${randomNumber(1000000, 9999999)}`,
        blNumber: `BL${Date.now()}`,
        eta: randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      },
      incoterm: {
        code: randomItem(incoterms),
        place: client.city
      },
      declaration: hasChannel ? {
        mrn: generateMRN(),
        lrn: generateLRN(),
        submittedAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
        channel: status === 'green_channel' || status === 'levante' || status === 'completed' ? 'green' :
                 status === 'orange_channel' ? 'orange' :
                 status === 'red_channel' ? 'red' : randomItem(channels),
        channelAssignedAt: randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()),
        customsOffice: customsOffice.code,
        customsOfficeName: customsOffice.name
      } : undefined,
      customsValue: {
        invoiceTotal: product.value * quantity,
        freight: randomNumber(200, 2000),
        insurance: randomNumber(50, 500),
        adjustments: 0,
        totalValue: product.value * quantity + randomNumber(250, 2500),
        currency: 'EUR'
      },
      duties: hasChannel ? {
        tariffRate: randomNumber(0, 15),
        tariffAmount: (product.value * quantity * randomNumber(0, 15)) / 100,
        vatRate: 21,
        vatAmount: (product.value * quantity * 21) / 100,
        totalDuties: (product.value * quantity * randomNumber(21, 36)) / 100
      } : undefined,
      timeline: [
        {
          action: 'expedition_created',
          description: 'Expediente creado',
          performedBy: 'Sistema',
          timestamp: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        }
      ],
      createdAt: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date()),
      updatedAt: new Date()
    });

    expeditions.push(expedition);
  }

  await Expedition.insertMany(expeditions);
  console.log(`✓ ${expeditions.length} expedientes creados`);
  return expeditions;
}

async function seedRequirements(expeditions) {
  console.log('Creando requerimientos...');

  const requirementTypes = ['documentary', 'physical', 'valuation', 'classification', 'origin', 'certificate'];
  const statuses = ['pending', 'in_progress', 'awaiting_client', 'submitted', 'under_review', 'resolved', 'rejected', 'closed'];

  const requirements = [];

  // Solo crear requerimientos para expedientes con canal naranja o rojo
  const eligibleExpeditions = expeditions.filter(e =>
    e.declaration?.channel === 'orange' || e.declaration?.channel === 'red' ||
    e.status === 'orange_channel' || e.status === 'red_channel'
  );

  for (const expedition of eligibleExpeditions) {
    const numRequirements = randomNumber(1, 3);

    for (let i = 0; i < numRequirements; i++) {
      const type = randomItem(requirementTypes);
      const status = randomItem(statuses);

      const requestedItems = [];
      if (type === 'documentary') {
        const docs = [
          { desc: 'Factura comercial original', itemType: 'document' },
          { desc: 'Certificado de origen EUR.1', itemType: 'origin_proof' },
          { desc: 'Packing list detallado', itemType: 'document' },
          { desc: 'Ficha técnica del producto', itemType: 'classification_proof' },
          { desc: 'Contrato de compraventa', itemType: 'valuation_proof' }
        ];
        const numDocs = randomNumber(2, 4);
        for (let j = 0; j < numDocs; j++) {
          requestedItems.push({
            itemType: docs[j].itemType,
            description: docs[j].desc,
            mandatory: j < 2,
            provided: randomItem([true, false]),
            providedAt: randomItem([true, false]) ? new Date() : undefined
          });
        }
      } else if (type === 'physical') {
        requestedItems.push({
          itemType: 'physical_inspection',
          description: 'Inspección física de la mercancía',
          mandatory: true,
          provided: false
        });
      }

      const requirement = new Requirement({
        requirementNumber: `REQ-2026-${String(requirements.length + 1).padStart(5, '0')}`,
        expeditionId: expedition._id,
        mrn: expedition.declaration?.mrn || generateMRN(),
        lrn: expedition.declaration?.lrn,
        requirementType: type,
        channel: expedition.declaration?.channel || randomItem(['orange', 'red']),
        status,
        priority: randomItem(['low', 'normal', 'high', 'urgent']),
        issuingAuthority: randomItem(['AEAT', 'AEAT', 'AEAT', 'SOIVRE', 'MAPA', 'SANIDAD']),
        subject: type === 'documentary' ? 'Requerimiento de documentación complementaria' :
                 type === 'physical' ? 'Notificación de inspección física' :
                 type === 'scanner' ? 'Control mediante escáner' : 'Análisis de laboratorio',
        description: `Requerimiento ${type} para expediente ${expedition.expeditionId}`,
        legalBasis: 'Art. 188 CAU - Control aduanero',
        deadline: randomDate(new Date(), new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)),
        requestedItems,
        customsOffice: {
          code: expedition.declaration?.customsOffice,
          name: expedition.declaration?.customsOfficeName
        },
        inspector: type !== 'documentary' ? {
          name: `Inspector ${randomNumber(1, 20)}`,
          badge: `INS-${randomNumber(1000, 9999)}`,
          phone: `+34 91${randomNumber(1000000, 9999999)}`
        } : undefined,
        physicalInspection: type === 'physical' ? {
          scheduledDate: randomDate(new Date(), new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          location: randomItem(['Puerto de Barcelona', 'ZAL Valencia', 'Centro Madrid Barajas', 'Puerto de Algeciras']),
          instructions: 'Presentar contenedor para inspección física completa'
        } : undefined,
        receivedAt: randomDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), new Date()),
        createdAt: randomDate(new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), new Date())
      });

      requirements.push(requirement);
    }
  }

  if (requirements.length > 0) {
    await Requirement.insertMany(requirements);
  }
  console.log(`✓ ${requirements.length} requerimientos creados`);
  return requirements;
}

async function seedDeadlines(expeditions) {
  console.log('Creando plazos...');

  const deadlineTypes = [
    'requirement_response', 'guarantee_expiration', 'guarantee_renewal',
    'regime_ultimation', 'certificate_expiration', 'declaration_submission',
    'inspection_appointment', 'payment_deadline', 'appeal_deadline'
  ];

  const statusOptions = ['pending', 'approaching', 'urgent', 'critical', 'completed', 'overdue'];
  const impactOptions = ['none', 'low', 'medium', 'high', 'critical'];

  const deadlines = [];

  // Crear deadlines variados
  for (let i = 0; i < 30; i++) {
    const type = randomItem(deadlineTypes);
    const expedition = randomItem(expeditions);
    const client = randomItem(clients);

    const dueDate = randomDate(
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 días adelante
    );

    const isOverdue = dueDate < new Date();
    const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));

    let status;
    if (isOverdue) {
      status = randomItem(['overdue', 'completed']);
    } else if (daysUntil <= 1) {
      status = 'critical';
    } else if (daysUntil <= 3) {
      status = 'urgent';
    } else if (daysUntil <= 7) {
      status = 'approaching';
    } else {
      status = 'pending';
    }

    const category = type.includes('guarantee') ? 'guarantee' :
                     type.includes('regime') ? 'regime' :
                     type.includes('certificate') ? 'certificate' :
                     type.includes('inspection') ? 'inspection' :
                     type.includes('payment') ? 'payment' :
                     type.includes('declaration') ? 'declaration' : 'requirement';

    const deadline = new Deadline({
      deadlineType: type,
      category,
      title: `${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - ${client.companyName}`,
      description: `Plazo de ${type.replace(/_/g, ' ')} para ${client.companyName}`,
      dueDate,
      references: {
        expeditionId: expedition._id
      },
      externalReferences: {
        mrn: expedition.declaration?.mrn
      },
      status,
      priority: randomItem(['low', 'medium', 'high', 'critical']),
      impact: randomItem(impactOptions),
      impactDescription: 'Incumplimiento puede generar sanciones o pérdida de beneficios',
      client: {
        companyName: client.companyName,
        nif: client.nif
      },
      alertConfig: [
        { daysBeforeDeadline: 7, alertType: 'system', enabled: true },
        { daysBeforeDeadline: 3, alertType: 'email', enabled: true },
        { daysBeforeDeadline: 1, alertType: 'all', enabled: true }
      ],
      notes: i % 3 === 0 ? 'Requiere atención prioritaria' : undefined,
      createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
    });

    deadlines.push(deadline);
  }

  await Deadline.insertMany(deadlines);
  console.log(`✓ ${deadlines.length} plazos creados`);
  return deadlines;
}

async function seedInspections(expeditions) {
  console.log('Creando inspecciones...');

  const inspectionTypes = ['physical', 'documentary', 'scanner', 'soivre', 'mapa', 'sanidad', 'miterd', 'combined'];
  const authorityTypes = ['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD', 'MITERD'];
  const locationTypes = ['port', 'airport', 'warehouse', 'customs_office'];
  const statusOptions = ['requested', 'scheduled', 'confirmed', 'in_progress', 'completed', 'pending_results'];
  const resultOptions = ['approved', 'approved_conditions', 'rejected', 'pending_analysis'];

  const inspections = [];

  for (let i = 0; i < 20; i++) {
    const expedition = randomItem(expeditions);
    const scheduledDate = randomDate(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    );
    const isPast = scheduledDate < new Date();
    const status = isPast ? randomItem(['completed', 'pending_results']) : randomItem(['requested', 'scheduled', 'confirmed']);
    const locationType = randomItem(locationTypes);
    const inspectionType = randomItem(inspectionTypes);

    const inspection = new Inspection({
      inspectionNumber: `INS-2026-${String(i + 1).padStart(5, '0')}`,
      expeditionId: expedition._id,
      mrn: expedition.declaration?.mrn || generateMRN(),
      inspectionType,
      status,
      result: status === 'completed' ? randomItem(resultOptions) : undefined,
      location: {
        type: locationType,
        name: locationType === 'port' ? randomItem(['Puerto de Barcelona', 'Puerto de Valencia', 'Puerto de Algeciras']) :
              locationType === 'airport' ? randomItem(['Madrid Barajas', 'Barcelona El Prat']) :
              'Centro Aduanero',
        address: 'Zona de inspección',
        city: randomItem(['Barcelona', 'Valencia', 'Madrid', 'Algeciras']),
        postalCode: String(randomNumber(10000, 50000))
      },
      scheduling: {
        requestedDate: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), scheduledDate),
        scheduledDate: scheduledDate,
        scheduledTime: `${randomNumber(8, 17)}:${randomItem(['00', '30'])}`,
        estimatedDuration: randomNumber(30, 180)
      },
      execution: status === 'completed' ? {
        startedAt: scheduledDate,
        completedAt: new Date(scheduledDate.getTime() + randomNumber(30, 180) * 60 * 1000),
        actualDuration: randomNumber(30, 180)
      } : undefined,
      authority: {
        type: randomItem(authorityTypes),
        office: randomItem(customsOffices).code,
        officeName: randomItem(customsOffices).name
      },
      inspector: {
        id: `INS-${randomNumber(1000, 9999)}`,
        name: `Inspector ${randomItem(['García', 'López', 'Martínez', 'Sánchez', 'Fernández'])}`,
        badge: `${randomNumber(10000, 99999)}`,
        phone: `+34 6${randomNumber(10000000, 99999999)}`,
        email: `inspector${i}@aeat.es`
      },
      goods: {
        description: expedition.goods?.[0]?.description || 'Mercancía general',
        quantity: expedition.goods?.[0]?.quantity || randomNumber(100, 1000),
        weight: expedition.goods?.[0]?.grossWeight || randomNumber(100, 5000),
        packages: randomNumber(10, 100),
        containers: [`MSKU${randomNumber(1000000, 9999999)}`]
      },
      client: {
        companyName: expedition.client?.companyName || randomItem(clients).companyName,
        nif: expedition.client?.nif || randomItem(clients).nif,
        contactPerson: 'Responsable Logística',
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      notes: i % 4 === 0 ? 'Mercancía sensible - requiere precaución especial' : undefined,
      createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
    });

    inspections.push(inspection);
  }

  await Inspection.insertMany(inspections);
  console.log(`✓ ${inspections.length} inspecciones creadas`);
  return inspections;
}

async function seedGuarantees(demoUserId) {
  console.log('Creando garantías...');

  const guaranteeTypes = ['CGU', 'individual', 'deposit', 'bank_guarantee', 'insurance', 'surety'];
  const usageTypes = ['transit', 'customs_warehouse', 'temporary_import', 'inward_processing', 'duty_deferment', 'general'];

  const guarantees = [];

  for (let i = 0; i < 12; i++) {
    const client = randomItem(clients);
    const startDate = randomDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), new Date());
    const expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const totalAmount = randomNumber(50000, 500000);
    const consumedAmount = randomNumber(0, Math.floor(totalAmount * 0.7));
    const type = randomItem(guaranteeTypes);

    const guarantee = new Guarantee({
      grn: `26ES${String(randomNumber(10000000, 99999999))}`,
      owner: demoUserId,
      type,
      usage: randomItem(usageTypes),
      name: `Garantía ${type} - ${client.companyName}`,
      description: `Garantía aduanera para operaciones de ${client.companyName}`,
      totalAmount,
      consumedAmount,
      availableAmount: totalAmount - consumedAmount,
      currency: 'EUR',
      guarantor: {
        type: randomItem(['bank', 'insurance', 'self']),
        name: randomItem(['Banco Santander', 'BBVA', 'CaixaBank', 'Mapfre Seguros', 'AXA Seguros']),
        policyNumber: `POL-${randomNumber(100000, 999999)}`
      },
      validFrom: startDate,
      validUntil: expiryDate,
      autoRenew: randomItem([true, false]),
      status: expiryDate > new Date() ? randomItem(['active', 'active', 'active', 'pending']) : 'expired',
      alertThresholds: {
        lowBalancePercent: 20,
        expiryWarningDays: 30
      },
      createdAt: startDate
    });

    guarantees.push(guarantee);
  }

  await Guarantee.insertMany(guarantees);
  console.log(`✓ ${guarantees.length} garantías creadas`);
  return guarantees;
}

async function seedH7Declarations(demoUserId, tenantId) {
  console.log('Creando declaraciones H7...');

  const carriers = [
    { code: 'DHL', name: 'DHL Express' },
    { code: 'UPS', name: 'United Parcel Service' },
    { code: 'FEDEX', name: 'FedEx' },
    { code: 'TNT', name: 'TNT Express' },
    { code: 'SEUR', name: 'SEUR' },
    { code: 'CORREOS', name: 'Correos de España' }
  ];

  const h7Declarations = [];

  for (let i = 0; i < 35; i++) {
    const carrier = randomItem(carriers);
    const unitValue = randomNumber(5, 50);
    const quantity = randomNumber(1, 3);
    const totalValue = unitValue * quantity;
    const netWeight = parseFloat((randomNumber(1, 20) / 10).toFixed(2));
    const grossWeight = parseFloat((netWeight * 1.1).toFixed(2));
    const shippingCost = randomNumber(5, 20);
    const customsValue = totalValue + shippingCost;
    const status = randomItem(['draft', 'validating', 'pending', 'submitted', 'accepted', 'released']);
    const originCountry = randomItem(['CN', 'US', 'UK', 'HK', 'KR', 'JP']);

    const h7 = new H7Declaration({
      tenantId,
      createdBy: demoUserId,
      operationType: 'B2C',
      trackingNumber: `${carrier.code}${randomNumber(100000000, 999999999)}`,
      carrier: {
        code: carrier.code,
        name: carrier.name
      },
      ecommercePlatform: randomItem(['AMAZON', 'EBAY', 'ALIEXPRESS', 'SHEIN', 'TEMU', null]),
      sender: {
        name: randomItem(['AliExpress Seller', 'Amazon Marketplace', 'eBay Seller', 'Shein Store', 'Temu Shop']),
        address: {
          street: 'International Address',
          city: 'Origin City',
          country: originCountry
        }
      },
      recipient: {
        name: `Cliente Demo ${i + 1}`,
        taxId: `${randomNumber(10000000, 99999999)}${randomItem(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'])}`,
        address: {
          street: `Calle Ejemplo ${randomNumber(1, 100)}, ${randomNumber(1, 5)}º`,
          city: randomItem(['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga']),
          postalCode: String(randomNumber(10000, 50000)),
          country: 'ES'
        },
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      items: [{
        description: randomItem([
          'Funda móvil silicona', 'Auriculares bluetooth TWS', 'Cargador USB-C rápido',
          'Camiseta deportiva', 'Accesorios electrónicos', 'Decoración hogar', 'Juguetes niños'
        ]),
        taricCode: randomItem(['85177900', '85183000', '85044090', '61099020', '95030070', '39269097']),
        quantity,
        unitOfMeasure: 'PCE',
        unitValue,
        totalValue,
        netWeight,
        countryOfOrigin: originCountry
      }],
      totals: {
        intrinsicValue: totalValue,
        shippingCost,
        insuranceCost: 0,
        customsValue,
        grossWeight,
        netWeight,
        packages: 1
      },
      duties: {
        tariff: { rate: 0, amount: 0 },
        vat: {
          rate: 21,
          amount: customsValue > 22 ? parseFloat((customsValue * 0.21).toFixed(2)) : 0,
          prepaid: false
        },
        handlingFee: 0,
        totalDue: customsValue > 22 ? parseFloat((customsValue * 0.21).toFixed(2)) : 0
      },
      status,
      submittedAt: status !== 'draft' && status !== 'validating' ? randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()) : undefined,
      releasedAt: status === 'released' ? new Date() : undefined,
      createdAt: randomDate(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), new Date())
    });

    h7Declarations.push(h7);
  }

  await H7Declaration.insertMany(h7Declarations);
  console.log(`✓ ${h7Declarations.length} declaraciones H7 creadas`);
  return h7Declarations;
}

async function seedTransits(demoUserId, tenantId) {
  console.log('Creando tránsitos NCTS...');

  const transitTypes = ['T1', 'T2', 'T2F', 'TIR'];
  const transitStatuses = ['draft', 'submitted', 'accepted', 'released', 'in_transit', 'arrived', 'goods_released', 'completed'];
  const transportModes = ['1', '2', '3', '4']; // 1=Sea, 2=Rail, 3=Road, 4=Air

  const transits = [];

  const destinationOffices = [
    { code: 'DE004600', name: 'Zollamt Hamburg', country: 'DE' },
    { code: 'FR001000', name: 'Bureau de douane Paris', country: 'FR' },
    { code: 'IT001001', name: 'Dogana di Milano', country: 'IT' },
    { code: 'NL000500', name: 'Douane Rotterdam', country: 'NL' },
    { code: 'BE000100', name: 'Douane Anvers', country: 'BE' }
  ];

  for (let i = 0; i < 15; i++) {
    const client = randomItem(clients);
    const departureOffice = randomItem(customsOffices);
    const destinationOffice = randomItem(destinationOffices);
    const status = randomItem(transitStatuses);
    const product = randomItem(products);

    const transit = new Transit({
      tenantId,
      owner: demoUserId,
      mrn: status !== 'draft' ? generateMRN() : undefined,
      lrn: generateLRN(),
      reference: `TRN-2026-${String(i + 1).padStart(5, '0')}`,
      transitType: randomItem(transitTypes),
      status,
      principal: {
        eori: client.eori,
        name: client.companyName,
        address: {
          street: `Calle Principal ${randomNumber(1, 100)}`,
          city: client.city,
          postalCode: String(randomNumber(10000, 50000)),
          country: 'ES'
        }
      },
      guarantee: {
        type: randomItem(['1', '2', '3', '9']),
        grn: `26ES${String(randomNumber(10000000, 99999999))}`,
        amount: randomNumber(10000, 100000),
        currency: 'EUR'
      },
      departureOffice: {
        code: departureOffice.code,
        name: departureOffice.name,
        country: 'ES'
      },
      destinationOffice: {
        code: destinationOffice.code,
        name: destinationOffice.name,
        country: destinationOffice.country
      },
      transport: {
        mode: randomItem(transportModes),
        nationality: 'ES',
        identityAtDeparture: {
          vehicleType: 'truck',
          identification: `${randomNumber(1000, 9999)}${randomItem(['ABC', 'XYZ', 'KLM'])}`
        },
        containerIndicator: true,
        containers: [{
          number: `MSKU${randomNumber(1000000, 9999999)}`,
          size: '40HC',
          goodsItems: [1]
        }],
        seals: [{
          number: `SEAL${randomNumber(100000, 999999)}`,
          sealType: 'customs'
        }],
        sealCount: 1
      },
      route: {
        countries: ['ES', destinationOffice.country],
        bindingItinerary: false
      },
      goodsItems: [{
        itemNumber: 1,
        description: product.description,
        taricCode: product.taricCode,
        countryOfOrigin: product.origin,
        countryOfDestination: destinationOffice.country,
        grossWeight: randomNumber(1000, 25000),
        netWeight: randomNumber(900, 24000),
        packages: {
          count: randomNumber(10, 500),
          packageType: 'CT',
          marks: 'N/M'
        }
      }],
      dates: {
        declaration: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date()),
        releaseAtDeparture: status !== 'draft' && status !== 'submitted' ? randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()) : undefined
      },
      deadlines: {
        arrivalDeadline: randomDate(new Date(), new Date(Date.now() + 10 * 24 * 60 * 60 * 1000))
      },
      createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
    });

    transits.push(transit);
  }

  await Transit.insertMany(transits);
  console.log(`✓ ${transits.length} tránsitos creados`);
  return transits;
}

async function seedSpecialRegimes(demoUserId) {
  console.log('Creando regímenes especiales...');

  const regimeConfigs = [
    { code: '51', type: 'inward_processing', name: 'Perfeccionamiento Activo' },
    { code: '53', type: 'temporary_admission', name: 'Importación Temporal' },
    { code: '71', type: 'customs_warehouse', name: 'Depósito Aduanero' },
    { code: 'T1', type: 'external_transit', name: 'Tránsito Externo' },
    { code: 'T2', type: 'internal_transit', name: 'Tránsito Interno' }
  ];

  const regimes = [];

  for (let i = 0; i < 10; i++) {
    const client = randomItem(clients);
    const regimeConfig = randomItem(regimeConfigs);
    const startDate = randomDate(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), new Date());
    const deadlineDate = new Date(startDate.getTime() + randomNumber(180, 365) * 24 * 60 * 60 * 1000);
    const product = randomItem(products);
    const quantity = randomNumber(1000, 50000);
    const customsValue = product.value * quantity;
    const suspendedDuties = customsValue * 0.05;
    const suspendedVAT = customsValue * 0.21;

    const regime = new SpecialRegime({
      owner: demoUserId,
      regimeCode: regimeConfig.code,
      regimeType: regimeConfig.type,
      authorization: {
        number: `ES${regimeConfig.code}${randomNumber(10000, 99999)}`,
        date: startDate,
        expiryDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000),
        controlOffice: randomItem(customsOffices).code,
        holder: {
          name: client.companyName,
          eori: client.eori,
          address: `${client.city}, España`
        }
      },
      goods: [{
        description: product.description,
        taricCode: product.taricCode,
        quantity,
        unitOfMeasure: 'KGM',
        netWeight: product.weight * quantity,
        grossWeight: product.weight * quantity * 1.1,
        customsValue,
        countryOfOrigin: product.origin,
        suspendedDuties: {
          tariff: suspendedDuties,
          vat: suspendedVAT,
          excise: 0,
          total: suspendedDuties + suspendedVAT
        }
      }],
      declarant: {
        name: client.companyName,
        eori: client.eori,
        address: `${client.city}, España`,
        representativeType: 'direct'
      },
      holder: {
        name: client.companyName,
        eori: client.eori,
        address: `${client.city}, España`
      },
      entryCustomsOffice: {
        code: randomItem(customsOffices).code,
        name: randomItem(customsOffices).name
      },
      startDate,
      deadlineDate,
      durationMonths: 12,
      totals: {
        customsValue,
        suspendedDuties,
        suspendedVAT,
        suspendedExcise: 0,
        totalGuaranteed: suspendedDuties + suspendedVAT
      },
      status: randomItem(['draft', 'pending', 'authorized', 'active', 'active', 'active']),
      createdAt: startDate
    });

    regimes.push(regime);
  }

  await SpecialRegime.insertMany(regimes);
  console.log(`✓ ${regimes.length} regímenes especiales creados`);
  return regimes;
}

async function seedOEA(demoUserId) {
  console.log('Creando certificaciones OEA...');

  const oeaTypes = ['OEAC', 'OEAS', 'OEAF'];

  const oeas = [];

  for (let i = 0; i < 5; i++) {
    const client = clients[i];
    const certType = randomItem(oeaTypes);
    const applicationDate = randomDate(new Date(Date.now() - 900 * 24 * 60 * 60 * 1000), new Date(Date.now() - 730 * 24 * 60 * 60 * 1000));
    const approvalDate = new Date(applicationDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expirationDate = new Date(approvalDate.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);

    const oea = new OEA({
      organization: {
        name: client.companyName,
        nif: client.nif,
        eori: client.eori,
        address: {
          street: `Calle Principal ${randomNumber(1, 100)}`,
          city: client.city,
          postalCode: String(randomNumber(10000, 50000)),
          province: client.city,
          country: 'ES'
        },
        contact: {
          name: `Contacto ${client.companyName}`,
          position: 'Responsable Aduanas',
          email: `aduanas@${client.companyName.toLowerCase().replace(/\s/g, '')}.es`,
          phone: `+34 91${randomNumber(1000000, 9999999)}`
        },
        legalRepresentative: {
          name: `Representante Legal ${i + 1}`,
          nif: `${randomNumber(10000000, 99999999)}${randomItem(['A', 'B', 'C'])}`,
          position: 'Director General'
        }
      },
      certification: {
        type: certType,
        number: `ES${certType}${randomNumber(10000, 99999)}`,
        status: randomItem(['approved', 'approved', 'approved', 'renewal_pending', 'reevaluation']),
        applicationDate,
        approvalDate,
        effectiveDate: approvalDate,
        expirationDate,
        issuingAuthority: 'AEAT - Departamento de Aduanas e Impuestos Especiales',
        responsibleOffice: `Delegación de ${client.city}`
      },
      benefits: [
        {
          code: 'GRD',
          name: 'Reducción de Garantías',
          category: 'guarantee',
          description: 'Reducción del 30% en garantías aduaneras',
          active: true,
          activatedDate: approvalDate
        },
        {
          code: 'PRC',
          name: 'Controles Prioritarios',
          category: 'priority',
          description: 'Tratamiento prioritario en controles físicos y documentales',
          active: true,
          activatedDate: approvalDate
        },
        {
          code: 'SMP',
          name: 'Simplificaciones',
          category: 'simplification',
          description: 'Acceso a procedimientos simplificados de declaración',
          active: true,
          activatedDate: approvalDate
        }
      ],
      guaranteeReduction: {
        level: randomItem(['reduced_30', 'reduced_50', 'none']),
        approvedDate: approvalDate
      },
      compliance: {
        currentStatus: randomItem(['excellent', 'good', 'acceptable']),
        lastAssessmentDate: randomDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), new Date()),
        nextAssessmentDate: randomDate(new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
        riskScore: randomNumber(10, 40)
      },
      requirements: {
        customsCompliance: { status: 'met', lastVerified: new Date() },
        recordKeeping: { status: 'met', lastVerified: new Date() },
        financialSolvency: { status: 'met', lastVerified: new Date() },
        practicalCompetence: { status: 'met', lastVerified: new Date() },
        securityStandards: { status: certType !== 'OEAC' ? 'met' : 'not_applicable', lastVerified: new Date() }
      },
      createdBy: demoUserId,
      createdAt: applicationDate
    });

    oeas.push(oea);
  }

  await OEA.insertMany(oeas);
  console.log(`✓ ${oeas.length} certificaciones OEA creadas`);
  return oeas;
}

async function seedCommunications(demoUserId, expeditions, requirements) {
  console.log('Creando comunicaciones...');

  const communicationTypes = [
    'requirement_response', 'allegation', 'administrative_appeal', 'economic_appeal',
    'information_request', 'clarification', 'notification_response', 'inspection_coordination',
    'voluntary_rectification', 'prior_consultation'
  ];

  const categories = ['response', 'appeal', 'request', 'notification', 'coordination'];
  const statuses = ['draft', 'pending_review', 'approved', 'sent', 'delivered', 'awaiting_response', 'responded', 'resolved', 'archived'];
  const priorities = ['low', 'normal', 'high', 'urgent'];
  const authorityTypes = ['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD', 'MITERD'];
  const channels = ['email', 'portal', 'registered_mail', 'electronic'];

  const resolutionStatuses = ['favorable', 'unfavorable', 'partial', 'inadmissible', 'withdrawn'];

  const communications = [];

  for (let i = 0; i < 25; i++) {
    const client = randomItem(clients);
    const commType = randomItem(communicationTypes);
    const status = randomItem(statuses);
    const expedition = randomItem(expeditions);
    const requirement = requirements.length > 0 ? randomItem(requirements) : null;
    const authorityType = randomItem(authorityTypes);

    // Determinar categoría basada en tipo
    let category;
    if (['allegation', 'administrative_appeal', 'economic_appeal', 'judicial_appeal'].includes(commType)) {
      category = 'appeal';
    } else if (['requirement_response', 'notification_response', 'clarification'].includes(commType)) {
      category = 'response';
    } else if (['information_request', 'prior_consultation'].includes(commType)) {
      category = 'request';
    } else if (commType === 'inspection_coordination') {
      category = 'coordination';
    } else {
      category = 'notification';
    }

    // Generar fechas
    const createdAt = randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date());
    const submissionDeadline = new Date(createdAt.getTime() + randomNumber(10, 30) * 24 * 60 * 60 * 1000);
    const responseDeadline = new Date(submissionDeadline.getTime() + randomNumber(15, 45) * 24 * 60 * 60 * 1000);

    // Subjects variados según tipo
    const subjectTemplates = {
      'requirement_response': `Respuesta a requerimiento ${requirement?.requirementNumber || 'REQ-2026-00001'} - ${client.companyName}`,
      'allegation': `Alegaciones contra liquidación provisional - ${client.companyName}`,
      'administrative_appeal': `Recurso de reposición contra resolución AEAT - ${client.companyName}`,
      'economic_appeal': `Recurso económico-administrativo TEAR - ${client.companyName}`,
      'information_request': `Solicitud de información complementaria - ${client.companyName}`,
      'clarification': `Aclaración sobre clasificación arancelaria ${expedition.goods?.[0]?.taricCode || '8517'}`,
      'notification_response': `Respuesta a notificación de inspección - ${client.companyName}`,
      'inspection_coordination': `Coordinación inspección física - Puerto Barcelona`,
      'voluntary_rectification': `Rectificación voluntaria DUA - MRN ${expedition.declaration?.mrn || generateMRN()}`,
      'prior_consultation': `Consulta vinculante sobre origen preferencial - ${client.companyName}`
    };

    const typePrefix = commType.substring(0, 3).toUpperCase();
    const communication = new InspectorCommunication({
      communicationNumber: `COM-${typePrefix}-2026-${String(i + 1).padStart(5, '0')}`,
      communicationType: commType,
      category,
      status,
      priority: randomItem(priorities),
      references: {
        expeditionId: expedition._id,
        requirementId: requirement?._id
      },
      externalReferences: {
        mrn: expedition.declaration?.mrn || generateMRN(),
        requirementNumber: requirement?.requirementNumber,
        expedientNumber: `EXP-AEAT-${randomNumber(10000, 99999)}-2026`
      },
      authority: {
        type: authorityType,
        name: authorityType === 'AEAT' ? 'Agencia Tributaria' :
              authorityType === 'SOIVRE' ? 'Servicio Oficial de Inspección' :
              authorityType === 'MAPA' ? 'Ministerio de Agricultura' :
              authorityType === 'SANIDAD' ? 'Ministerio de Sanidad' : 'MITERD',
        office: authorityType === 'AEAT' ? `Aduana de ${randomItem(['Barcelona', 'Valencia', 'Madrid', 'Algeciras'])}` : undefined,
        city: randomItem(['Barcelona', 'Valencia', 'Madrid', 'Bilbao', 'Sevilla']),
        email: `${authorityType.toLowerCase()}@${authorityType.toLowerCase()}.gob.es`
      },
      inspector: {
        id: `INS-${randomNumber(1000, 9999)}`,
        name: `Inspector ${randomItem(['García', 'López', 'Martínez', 'Rodríguez', 'Fernández'])}`,
        position: 'Inspector de Aduanas',
        department: 'Departamento de Aduanas e II.EE.',
        email: `inspector${randomNumber(1, 50)}@aeat.es`,
        phone: `+34 91${randomNumber(1000000, 9999999)}`
      },
      subject: subjectTemplates[commType] || `Comunicación administrativa - ${client.companyName}`,
      description: `Comunicación ${commType.replace(/_/g, ' ')} iniciada para ${client.companyName} relacionada con expediente ${expedition.expeditionId}`,
      legalBasis: [
        {
          law: 'Código Aduanero de la Unión (Reglamento UE 952/2013)',
          article: randomItem(['Art. 22', 'Art. 44', 'Art. 188', 'Art. 198']),
          description: 'Base legal para la comunicación'
        }
      ],
      arguments: category === 'appeal' ? [
        {
          title: 'Primer argumento',
          content: 'Argumentación principal sobre la procedencia del recurso basada en la correcta interpretación de la normativa aplicable.',
          order: 1
        },
        {
          title: 'Segundo argumento',
          content: 'Argumentación subsidiaria sobre la improcedencia de la sanción o liquidación por defectos formales.',
          order: 2
        }
      ] : [],
      petition: category === 'appeal' ? 'Se solicita la anulación total del acto administrativo impugnado y devolución de cantidades indebidamente ingresadas' : undefined,
      messages: [
        {
          direction: 'outgoing',
          messageType: 'initial',
          subject: subjectTemplates[commType],
          content: `Comunicación inicial presentada ante ${authorityType} en relación con el expediente.`,
          sentAt: ['sent', 'delivered', 'awaiting_response', 'responded', 'resolved'].includes(status) ? createdAt : undefined,
          sender: {
            name: 'STRIX AI SL',
            role: 'Representante Aduanero',
            organization: 'STRIX AI',
            email: 'aduanas@strixai.es'
          },
          recipient: {
            name: authorityType,
            role: 'Autoridad competente',
            organization: authorityType
          },
          channel: randomItem(channels)
        }
      ],
      deadlines: {
        submissionDeadline,
        responseDeadline,
        silenceDate: new Date(responseDeadline.getTime() + 30 * 24 * 60 * 60 * 1000)
      },
      dates: {
        createdAt,
        sentAt: ['sent', 'delivered', 'awaiting_response', 'responded', 'resolved'].includes(status) ? createdAt : undefined,
        receivedAt: ['delivered', 'awaiting_response', 'responded', 'resolved'].includes(status) ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000) : undefined,
        respondedAt: ['responded', 'resolved'].includes(status) ? new Date(createdAt.getTime() + randomNumber(10, 30) * 24 * 60 * 60 * 1000) : undefined,
        resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + randomNumber(30, 60) * 24 * 60 * 60 * 1000) : undefined
      },
      resolution: status === 'resolved' ? {
        status: randomItem(resolutionStatuses),
        date: new Date(createdAt.getTime() + randomNumber(30, 60) * 24 * 60 * 60 * 1000),
        summary: 'Resolución emitida por la autoridad competente',
        resolutionNumber: `RES-${randomNumber(10000, 99999)}-2026`,
        appealable: true,
        appealDeadline: new Date(createdAt.getTime() + randomNumber(60, 90) * 24 * 60 * 60 * 1000)
      } : undefined,
      economicImpact: category === 'appeal' ? {
        claimedAmount: randomNumber(5000, 50000),
        recognizedAmount: status === 'resolved' ? randomNumber(0, 30000) : undefined,
        penaltyAmount: randomNumber(500, 5000),
        totalAmount: randomNumber(5500, 55000),
        currency: 'EUR'
      } : undefined,
      client: {
        name: client.companyName,
        nif: client.nif,
        eori: client.eori,
        email: `contacto@${client.companyName.toLowerCase().replace(/\s/g, '')}.es`,
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      representation: {
        type: 'direct',
        representativeName: 'STRIX AI SL',
        representativeNif: 'B12345678'
      },
      assignedTo: demoUserId,
      createdBy: demoUserId,
      timeline: [
        {
          action: 'created',
          description: 'Comunicación creada en el sistema',
          performedBy: demoUserId,
          timestamp: createdAt
        }
      ],
      internalNotes: i % 3 === 0 ? 'Comunicación prioritaria - seguimiento especial' : undefined,
      followUp: {
        required: !['resolved', 'archived'].includes(status),
        nextAction: !['resolved', 'archived'].includes(status) ? 'Verificar estado de tramitación' : undefined,
        nextActionDate: !['resolved', 'archived'].includes(status) ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined
      },
      tags: [authorityType, commType, category],
      active: status !== 'archived',
      createdAt,
      updatedAt: new Date()
    });

    communications.push(communication);
  }

  await InspectorCommunication.insertMany(communications);
  console.log(`✓ ${communications.length} comunicaciones creadas`);
  return communications;
}

// ==================== Main Seed Function ====================

async function seedAll() {
  try {
    console.log('\n🌱 Iniciando seed de datos de demostración...\n');

    // Connect to database
    await connectDB();
    console.log('✓ Conectado a MongoDB\n');

    // Get or create demo user
    console.log('Buscando usuario demo...');
    let demoUser = await User.findOne({ email: 'demo@luci.es' });
    if (!demoUser) {
      demoUser = await User.findOne({});
    }
    if (!demoUser) {
      console.log('Creando usuario demo...');
      demoUser = new User({
        name: 'Usuario Demo',
        email: 'demo@luci.es',
        password: 'demo123456',
        role: 'admin'
      });
      await demoUser.save();
    }
    const demoUserId = demoUser._id;
    console.log(`✓ Usuario demo: ${demoUser.email} (${demoUserId})\n`);

    // Los listados filtran por query.tenantId = req.user.tenantId, asi que sin
    // esto los datos sembrados quedan invisibles en la UI aunque existan en la
    // BD. Ya paso: 191 documentos huerfanos en produccion (2/Ago/2026).
    const demoTenantId = demoUser.tenantId;
    if (!demoTenantId) {
      console.warn('⚠ El usuario demo no tiene tenantId: los datos no se veran en la UI.');
      console.warn('  Ejecuta antes createSuperAdmin.js, que crea el tenant de testing.\n');
    } else {
      console.log(`✓ Tenant demo: ${demoTenantId}\n`);
    }

    // Clear existing data
    console.log('Limpiando datos existentes...');
    await Promise.all([
      Expedition.deleteMany({}),
      Requirement.deleteMany({}),
      Deadline.deleteMany({}),
      Inspection.deleteMany({}),
      Guarantee.deleteMany({}),
      H7Declaration.deleteMany({}),
      Transit.deleteMany({}),
      SpecialRegime.deleteMany({}),
      OEA.deleteMany({}),
      InspectorCommunication.deleteMany({})
    ]);
    console.log('✓ Datos anteriores eliminados\n');

    // Seed data
    const expeditions = await seedExpeditions(demoTenantId);
    const requirements = await seedRequirements(expeditions);
    await seedDeadlines(expeditions);
    await seedInspections(expeditions);
    await seedGuarantees(demoUserId);
    await seedH7Declarations(demoUserId, demoTenantId);
    await seedTransits(demoUserId, demoTenantId);
    await seedSpecialRegimes(demoUserId);
    await seedOEA(demoUserId);
    await seedCommunications(demoUserId, expeditions, requirements);

    console.log('\n✅ Seed completado exitosamente!\n');

    // Summary
    console.log('📊 Resumen de datos creados:');
    console.log(`   - Expedientes: ${await Expedition.countDocuments()}`);
    console.log(`   - Requerimientos: ${await Requirement.countDocuments()}`);
    console.log(`   - Plazos: ${await Deadline.countDocuments()}`);
    console.log(`   - Inspecciones: ${await Inspection.countDocuments()}`);
    console.log(`   - Garantías: ${await Guarantee.countDocuments()}`);
    console.log(`   - H7 Declaraciones: ${await H7Declaration.countDocuments()}`);
    console.log(`   - Tránsitos: ${await Transit.countDocuments()}`);
    console.log(`   - Regímenes Especiales: ${await SpecialRegime.countDocuments()}`);
    console.log(`   - OEA: ${await OEA.countDocuments()}`);
    console.log(`   - Comunicaciones: ${await InspectorCommunication.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante el seed:', error);
    process.exit(1);
  }
}

// Run
seedAll();
