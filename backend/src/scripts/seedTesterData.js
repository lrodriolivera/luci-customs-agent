/**
 * Seed Demo Data for Tester User (Production-safe)
 * NO borra datos existentes - solo agrega datos para el tester
 *
 * Ejecutar: node src/scripts/seedTesterData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');

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
const ENSDeclaration = require('../models/ENSDeclaration');
const User = require('../models/User');

// ==================== Helpers ====================

const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const generateMRN = (year = 2026) => `${year}ES00${String(randomNumber(100000, 999999))}`;
const generateLRN = () => `LRN${Date.now()}${randomNumber(1000, 9999)}`;

// ==================== Data ====================

const clients = [
  { companyName: 'Electronica Iberica S.L.', nif: 'B12345678', eori: 'ESB12345678', city: 'Madrid', sector: 'electronics' },
  { companyName: 'Textiles del Mediterraneo', nif: 'A87654321', eori: 'ESA87654321', city: 'Valencia', sector: 'textiles' },
  { companyName: 'Importaciones Garcia', nif: 'B11223344', eori: 'ESB11223344', city: 'Barcelona', sector: 'general' },
  { companyName: 'Farmaceutica Novax', nif: 'A55667788', eori: 'ESA55667788', city: 'Bilbao', sector: 'pharma' },
  { companyName: 'Autopartes Express', nif: 'B99887766', eori: 'ESB99887766', city: 'Sevilla', sector: 'automotive' },
  { companyName: 'Alimentos Premium S.A.', nif: 'A44332211', eori: 'ESA44332211', city: 'Malaga', sector: 'food' },
  { companyName: 'Tech Solutions Iberia', nif: 'B77889900', eori: 'ESB77889900', city: 'Madrid', sector: 'tech' },
  { companyName: 'Muebles Modernos', nif: 'A22334455', eori: 'ESA22334455', city: 'Zaragoza', sector: 'furniture' }
];

const products = [
  { description: 'Smartphones Android 128GB', taricCode: '8517129000', weight: 0.2, value: 150, origin: 'CN' },
  { description: 'Tablets 10 pulgadas', taricCode: '8471300000', weight: 0.5, value: 200, origin: 'CN' },
  { description: 'Componentes electronicos varios', taricCode: '8542390000', weight: 2, value: 500, origin: 'TW' },
  { description: 'Camisetas algodon 100%', taricCode: '6109100000', weight: 0.3, value: 8, origin: 'BD' },
  { description: 'Pantalones vaqueros', taricCode: '6203423500', weight: 0.6, value: 15, origin: 'VN' },
  { description: 'Calzado deportivo', taricCode: '6404110000', weight: 0.8, value: 25, origin: 'CN' },
  { description: 'Piezas automovil - filtros', taricCode: '8421230000', weight: 1.5, value: 45, origin: 'JP' },
  { description: 'Baterias litio', taricCode: '8507600000', weight: 5, value: 800, origin: 'KR' },
  { description: 'Medicamentos genericos', taricCode: '3004900000', weight: 0.1, value: 50, origin: 'IN' },
  { description: 'Maquinaria industrial', taricCode: '8479899700', weight: 500, value: 15000, origin: 'DE' },
  { description: 'Aceite de oliva virgen extra', taricCode: '1509109000', weight: 20, value: 80, origin: 'IT' },
  { description: 'Vino tinto DOC', taricCode: '2204219200', weight: 15, value: 120, origin: 'FR' },
  { description: 'Muebles de madera', taricCode: '9403609000', weight: 50, value: 350, origin: 'PL' },
  { description: 'Juguetes plastico', taricCode: '9503007000', weight: 0.5, value: 5, origin: 'CN' }
];

const customsOffices = [
  { code: 'ES002801', name: 'Aduana de Barcelona Puerto' },
  { code: 'ES002804', name: 'Aduana de Barcelona Aeropuerto' },
  { code: 'ES004601', name: 'Aduana de Valencia Puerto' },
  { code: 'ES002901', name: 'Aduana de Madrid Aeropuerto' },
  { code: 'ES004101', name: 'Aduana de Algeciras Puerto' },
  { code: 'ES004801', name: 'Aduana de Bilbao Puerto' }
];

// ==================== Seed Functions ====================

async function seedExpeditions(userId, tenantId) {
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
      expeditionId: `EXP-TST-${String(i + 100).padStart(4, '0')}`,
      operationType: randomItem(['import', 'export']),
      transportMode: randomItem(transportModes),
      status,
      client: {
        companyName: client.companyName,
        nif: client.nif,
        eori: client.eori,
        contactPerson: 'Responsable Logistica',
        email: `contacto@${client.companyName.toLowerCase().replace(/\s/g, '')}.es`,
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      goods: [{
        itemNumber: 1,
        description: product.description,
        taricCode: product.taricCode,
        countryOfOrigin: product.origin,
        quantity,
        unitOfMeasure: 'KGM',
        netWeight: product.weight * quantity,
        grossWeight: product.weight * quantity * 1.1,
        invoiceValue: product.value * quantity,
        statisticalValue: product.value * quantity,
        customsValue: product.value * quantity
      }],
      transport: {
        mode: randomItem(transportModes),
        carrier: randomItem(['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'DHL', 'FedEx']),
        blNumber: `BL${randomNumber(10000000, 99999999)}`,
        containerNumbers: [`MSKU${randomNumber(1000000, 9999999)}`],
        vessel: 'MSC AURORA',
        voyage: `V${randomNumber(100, 999)}E`
      },
      customsOffice: {
        code: customsOffice.code,
        name: customsOffice.name,
        country: 'ES'
      },
      incoterm: randomItem(incoterms),
      declaration: hasChannel ? {
        type: 'H1',
        mrn: generateMRN(),
        lrn: generateLRN(),
        channel: randomItem(channels),
        submittedAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()),
        totalDuties: (product.value * quantity * randomNumber(21, 36)) / 100
      } : undefined,
      timeline: [{
        action: 'expedition_created',
        description: 'Expediente creado',
        performedBy: 'Sistema',
        timestamp: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      }],
      tenantId,
      createdBy: userId,
      createdAt: randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date()),
      updatedAt: new Date()
    });

    expeditions.push(expedition);
  }

  await Expedition.insertMany(expeditions);
  console.log(`  + ${expeditions.length} expedientes creados`);
  return expeditions;
}

async function seedRequirements(expeditions, userId) {
  console.log('Creando requerimientos...');

  const requirementTypes = ['documentary', 'physical', 'valuation', 'classification', 'origin', 'certificate'];
  const channels = ['orange', 'red'];
  const statuses = ['pending', 'in_progress', 'awaiting_client', 'submitted', 'resolved'];

  const requirements = [];
  const eligibleExpeditions = expeditions.filter(e =>
    e.declaration?.channel === 'orange' || e.declaration?.channel === 'red' ||
    ['orange_channel', 'red_channel'].includes(e.status)
  );

  for (let i = 0; i < Math.min(eligibleExpeditions.length * 2, 15); i++) {
    const expedition = randomItem(eligibleExpeditions);
    const reqType = randomItem(requirementTypes);
    const channel = randomItem(channels);

    const requirement = new Requirement({
      requirementNumber: `REQ-TST-2026-${String(i + 1).padStart(5, '0')}`,
      expeditionId: expedition._id,
      mrn: expedition.declaration?.mrn || generateMRN(),
      requirementType: reqType,
      channel,
      status: randomItem(statuses),
      subject: `Requerimiento ${reqType} - ${expedition.expeditionId}`,
      description: `Requerimiento de ${reqType} para expediente ${expedition.expeditionId}`,
      deadline: randomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      requestedItems: [{
        itemType: reqType === 'physical' ? 'physical_inspection' : 'document',
        description: `Documentacion solicitada para ${reqType}`,
        mandatory: true
      }],
      createdBy: userId,
      createdAt: randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date())
    });

    requirements.push(requirement);
  }

  if (requirements.length > 0) {
    await Requirement.insertMany(requirements);
  }
  console.log(`  + ${requirements.length} requerimientos creados`);
  return requirements;
}

async function seedDeadlines(expeditions, userId) {
  console.log('Creando plazos...');

  const deadlineConfigs = [
    { type: 'requirement_response', category: 'requirement', title: 'Respuesta a requerimiento AEAT' },
    { type: 'guarantee_expiration', category: 'guarantee', title: 'Vencimiento de garantia' },
    { type: 'transit_arrival', category: 'transit', title: 'Llegada de transito NCTS' },
    { type: 'declaration_submission', category: 'declaration', title: 'Plazo presentacion declaracion' },
    { type: 'payment_deadline', category: 'payment', title: 'Plazo de pago derechos' },
    { type: 'inspection_appointment', category: 'inspection', title: 'Cita de inspeccion fisica' },
    { type: 'appeal_deadline', category: 'requirement', title: 'Plazo para alegacion' },
    { type: 'document_presentation', category: 'declaration', title: 'Presentacion de documentos' }
  ];

  const deadlines = [];

  for (let i = 0; i < 20; i++) {
    const expedition = randomItem(expeditions);
    const config = randomItem(deadlineConfigs);
    const dueDate = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    const isOverdue = dueDate < new Date();

    const deadline = new Deadline({
      deadlineType: config.type,
      category: config.category,
      title: `${config.title} - ${expedition.expeditionId}`,
      description: `${config.title} para expediente ${expedition.expeditionId}`,
      dueDate,
      status: isOverdue ? randomItem(['overdue', 'completed']) : randomItem(['pending', 'approaching']),
      priority: randomItem(['low', 'medium', 'high', 'critical']),
      references: {
        expeditionId: expedition._id
      },
      externalReferences: {
        mrn: expedition.declaration?.mrn
      },
      createdBy: userId,
      createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
    });

    deadlines.push(deadline);
  }

  await Deadline.insertMany(deadlines);
  console.log(`  + ${deadlines.length} plazos creados`);
  return deadlines;
}

async function seedInspections(expeditions, userId) {
  console.log('Creando inspecciones...');

  const inspectionStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  const inspections = [];

  for (let i = 0; i < 10; i++) {
    const expedition = randomItem(expeditions);
    const status = randomItem(inspectionStatuses);
    const scheduledDate = randomDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

    const inspection = new Inspection({
      inspectionNumber: `INS-TST-2026-${String(i + 1).padStart(5, '0')}`,
      expeditionId: expedition._id,
      mrn: expedition.declaration?.mrn || generateMRN(),
      inspectionType: randomItem(['physical', 'documentary', 'scanner']),
      status,
      result: status === 'completed' ? randomItem(['approved', 'approved_conditions', 'rejected', 'pending_analysis']) : undefined,
      location: {
        type: randomItem(['port', 'airport', 'warehouse']),
        name: randomItem(['Puerto de Barcelona', 'Puerto de Valencia', 'Madrid Barajas']),
        address: 'Zona de inspeccion',
        city: randomItem(['Barcelona', 'Valencia', 'Madrid']),
        postalCode: String(randomNumber(10000, 50000))
      },
      scheduling: {
        scheduledDate,
        scheduledTime: `${randomNumber(8, 17)}:${randomItem(['00', '30'])}`,
        estimatedDuration: randomNumber(30, 180)
      },
      authority: {
        type: randomItem(['AEAT', 'SOIVRE', 'MAPA', 'SANIDAD']),
        office: randomItem(customsOffices).code,
        officeName: randomItem(customsOffices).name
      },
      inspector: {
        id: `INS-${randomNumber(1000, 9999)}`,
        name: `Inspector ${randomItem(['Garcia', 'Lopez', 'Martinez', 'Sanchez'])}`,
        badge: `${randomNumber(10000, 99999)}`,
        phone: `+34 6${randomNumber(10000000, 99999999)}`,
        email: `inspector${i}@aeat.es`
      },
      goods: {
        description: expedition.goods?.[0]?.description || 'Mercancia general',
        quantity: expedition.goods?.[0]?.quantity || randomNumber(100, 1000),
        weight: expedition.goods?.[0]?.grossWeight || randomNumber(100, 5000),
        packages: randomNumber(10, 100),
        containers: [`MSKU${randomNumber(1000000, 9999999)}`]
      },
      client: {
        companyName: expedition.client?.companyName || randomItem(clients).companyName,
        nif: expedition.client?.nif || randomItem(clients).nif,
        contactPerson: 'Responsable Logistica',
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      createdBy: userId,
      createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
    });

    inspections.push(inspection);
  }

  await Inspection.insertMany(inspections);
  console.log(`  + ${inspections.length} inspecciones creadas`);
  return inspections;
}

async function seedGuarantees(userId) {
  console.log('Creando garantias...');

  const guaranteeTypes = ['CGU', 'individual', 'deposit', 'bank_guarantee', 'insurance', 'surety'];
  const guarantees = [];

  for (let i = 0; i < 8; i++) {
    const client = randomItem(clients);
    const startDate = randomDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), new Date());
    const expiryDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    const totalAmount = randomNumber(50000, 500000);
    const consumedAmount = randomNumber(0, Math.floor(totalAmount * 0.7));
    const type = randomItem(guaranteeTypes);

    const guarantee = new Guarantee({
      grn: `26ES${String(randomNumber(10000000, 99999999))}`,
      owner: userId,
      type,
      usage: randomItem(['transit', 'customs_warehouse', 'temporary_import', 'duty_deferment']),
      name: `Garantia ${type} - ${client.companyName}`,
      description: `Garantia aduanera para operaciones de ${client.companyName}`,
      totalAmount,
      consumedAmount,
      availableAmount: totalAmount - consumedAmount,
      currency: 'EUR',
      guarantor: {
        type: randomItem(['bank', 'insurance', 'self']),
        name: randomItem(['Banco Santander', 'BBVA', 'CaixaBank', 'Mapfre Seguros']),
        policyNumber: `POL-${randomNumber(100000, 999999)}`
      },
      validFrom: startDate,
      validUntil: expiryDate,
      autoRenew: randomItem([true, false]),
      status: expiryDate > new Date() ? randomItem(['active', 'active', 'active', 'pending']) : 'expired',
      createdBy: userId,
      createdAt: startDate
    });

    guarantees.push(guarantee);
  }

  await Guarantee.insertMany(guarantees);
  console.log(`  + ${guarantees.length} garantias creadas`);
  return guarantees;
}

async function seedH7Declarations(userId, tenantId) {
  console.log('Creando declaraciones H7...');

  const carriers = [
    { code: 'DHL', name: 'DHL Express' },
    { code: 'UPS', name: 'United Parcel Service' },
    { code: 'FEDEX', name: 'FedEx' },
    { code: 'SEUR', name: 'SEUR' },
    { code: 'CORREOS', name: 'Correos de Espana' }
  ];

  const h7Declarations = [];

  for (let i = 0; i < 20; i++) {
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
      createdBy: userId,
      tenantId,
      operationType: 'B2C',
      trackingNumber: `${carrier.code}${randomNumber(100000000, 999999999)}`,
      carrier: { code: carrier.code, name: carrier.name },
      ecommercePlatform: randomItem(['AMAZON', 'EBAY', 'ALIEXPRESS', 'SHEIN', 'TEMU', null]),
      sender: {
        name: randomItem(['AliExpress Seller', 'Amazon Marketplace', 'eBay Seller', 'Shein Store']),
        address: { street: 'International Address', city: 'Origin City', country: originCountry }
      },
      recipient: {
        name: `Cliente Test ${i + 1}`,
        taxId: `${randomNumber(10000000, 99999999)}${randomItem(['A', 'B', 'C', 'D', 'E'])}`,
        address: {
          street: `Calle Ejemplo ${randomNumber(1, 100)}`,
          city: randomItem(['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao']),
          postalCode: String(randomNumber(10000, 50000)),
          country: 'ES'
        },
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      items: [{
        description: randomItem(['Funda movil silicona', 'Auriculares bluetooth', 'Cargador USB-C', 'Camiseta deportiva', 'Accesorios electronicos']),
        taricCode: randomItem(['8517790000', '8518300000', '8504409000', '6109902000', '9503007000']),
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
        vat: { rate: 21, amount: customsValue > 22 ? parseFloat((customsValue * 0.21).toFixed(2)) : 0, prepaid: false },
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
  console.log(`  + ${h7Declarations.length} declaraciones H7 creadas`);
  return h7Declarations;
}

async function seedTransits(userId, tenantId) {
  console.log('Creando transitos NCTS...');

  const transitTypes = ['T1', 'T2', 'T2F', 'TIR'];
  const transitStatuses = ['draft', 'submitted', 'accepted', 'released', 'in_transit', 'arrived', 'completed'];

  const destinationOffices = [
    { code: 'DE004600', name: 'Zollamt Hamburg', country: 'DE' },
    { code: 'FR001000', name: 'Bureau de douane Paris', country: 'FR' },
    { code: 'IT001001', name: 'Dogana di Milano', country: 'IT' },
    { code: 'NL000500', name: 'Douane Rotterdam', country: 'NL' },
    { code: 'BE000100', name: 'Douane Anvers', country: 'BE' }
  ];

  const transits = [];

  for (let i = 0; i < 12; i++) {
    const client = randomItem(clients);
    const departureOffice = randomItem(customsOffices);
    const destinationOffice = randomItem(destinationOffices);
    const status = randomItem(transitStatuses);
    const product = randomItem(products);

    const transit = new Transit({
      owner: userId,
      tenantId,
      mrn: status !== 'draft' ? generateMRN() : undefined,
      lrn: generateLRN(),
      reference: `TRN-TST-2026-${String(i + 1).padStart(5, '0')}`,
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
      departureOffice: { code: departureOffice.code, name: departureOffice.name, country: 'ES' },
      destinationOffice: { code: destinationOffice.code, name: destinationOffice.name, country: destinationOffice.country },
      transport: {
        mode: randomItem(['1', '2', '3', '4']),
        nationality: 'ES',
        identityAtDeparture: {
          vehicleType: 'truck',
          identification: `${randomNumber(1000, 9999)}${randomItem(['ABC', 'XYZ', 'KLM'])}`
        },
        containerIndicator: true,
        containers: [{ number: `MSKU${randomNumber(1000000, 9999999)}`, size: '40HC', goodsItems: [1] }],
        seals: [{ number: `SEAL${randomNumber(100000, 999999)}`, sealType: 'customs' }],
        sealCount: 1
      },
      route: { countries: ['ES', destinationOffice.country], bindingItinerary: false },
      goodsItems: [{
        itemNumber: 1,
        description: product.description,
        taricCode: product.taricCode,
        countryOfOrigin: product.origin,
        countryOfDestination: destinationOffice.country,
        grossWeight: randomNumber(1000, 25000),
        netWeight: randomNumber(900, 24000),
        packages: { count: randomNumber(10, 500), packageType: 'CT', marks: 'N/M' }
      }],
      dates: {
        declaration: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
      },
      deadlines: {
        arrivalDeadline: randomDate(new Date(), new Date(Date.now() + 10 * 24 * 60 * 60 * 1000))
      },
      createdAt: randomDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), new Date())
    });

    transits.push(transit);
  }

  await Transit.insertMany(transits);
  console.log(`  + ${transits.length} transitos creados`);
  return transits;
}

async function seedSpecialRegimes(userId) {
  console.log('Creando regimenes especiales...');

  const regimeConfigs = [
    { code: '51', type: 'inward_processing', name: 'Perfeccionamiento Activo' },
    { code: '53', type: 'temporary_admission', name: 'Importacion Temporal' },
    { code: '71', type: 'customs_warehouse', name: 'Deposito Aduanero' },
    { code: 'T1', type: 'external_transit', name: 'Transito Externo' },
    { code: 'T2', type: 'internal_transit', name: 'Transito Interno' }
  ];

  const regimes = [];

  for (let i = 0; i < 8; i++) {
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
      owner: userId,
      regimeCode: regimeConfig.code,
      regimeType: regimeConfig.type,
      authorization: {
        number: `ES${regimeConfig.code}${randomNumber(10000, 99999)}`,
        date: startDate,
        expiryDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000),
        controlOffice: randomItem(customsOffices).code,
        holder: { name: client.companyName, eori: client.eori, address: `${client.city}, Espana` }
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
        suspendedDuties: { tariff: suspendedDuties, vat: suspendedVAT, excise: 0, total: suspendedDuties + suspendedVAT }
      }],
      declarant: { name: client.companyName, eori: client.eori, address: `${client.city}, Espana`, representativeType: 'direct' },
      holder: { name: client.companyName, eori: client.eori, address: `${client.city}, Espana` },
      entryCustomsOffice: { code: randomItem(customsOffices).code, name: randomItem(customsOffices).name },
      startDate,
      deadlineDate,
      durationMonths: 12,
      totals: { customsValue, suspendedDuties, suspendedVAT, suspendedExcise: 0, totalGuaranteed: suspendedDuties + suspendedVAT },
      status: randomItem(['draft', 'pending', 'authorized', 'active', 'active', 'active']),
      createdAt: startDate
    });

    regimes.push(regime);
  }

  await SpecialRegime.insertMany(regimes);
  console.log(`  + ${regimes.length} regimenes especiales creados`);
  return regimes;
}

async function seedOEA(userId) {
  console.log('Creando certificaciones OEA...');

  const oeaTypes = ['OEAC', 'OEAS', 'OEAF'];
  const oeas = [];

  for (let i = 0; i < 4; i++) {
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
        status: randomItem(['approved', 'approved', 'renewal_pending']),
        applicationDate,
        approvalDate,
        effectiveDate: approvalDate,
        expirationDate,
        issuingAuthority: 'AEAT - Departamento de Aduanas e Impuestos Especiales',
        responsibleOffice: `Delegacion de ${client.city}`
      },
      benefits: [
        { code: 'GRD', name: 'Reduccion de Garantias', category: 'guarantee', description: 'Reduccion del 30% en garantias aduaneras', active: true, activatedDate: approvalDate },
        { code: 'PRC', name: 'Controles Prioritarios', category: 'priority', description: 'Tratamiento prioritario en controles', active: true, activatedDate: approvalDate }
      ],
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
        practicalCompetence: { status: 'met', lastVerified: new Date() }
      },
      createdBy: userId,
      createdAt: applicationDate
    });

    oeas.push(oea);
  }

  await OEA.insertMany(oeas);
  console.log(`  + ${oeas.length} certificaciones OEA creadas`);
  return oeas;
}

async function seedENSDeclarations(userId, tenantId) {
  console.log('Creando declaraciones ENS...');

  const transportConfigs = [
    { mode: 'ROAD', idType: 'VEHICLE_REGISTRATION', borderMode: '3', refType: 'CMR', id: () => `${randomNumber(1000, 9999)}${randomItem(['ABC', 'XYZ', 'KLM'])}` },
    { mode: 'RAIL', idType: 'TRAIN_NUMBER', borderMode: '2', refType: 'CIM', id: () => `TR${randomNumber(10000, 99999)}` },
    { mode: 'SEA', idType: 'VESSEL_IMO', borderMode: '1', refType: 'MBL', id: () => `IMO${randomNumber(1000000, 9999999)}` },
    { mode: 'AIR', idType: 'FLIGHT_NUMBER', borderMode: '4', refType: 'MAWB', id: () => `IB${randomNumber(1000, 9999)}` }
  ];

  const ensStatuses = ['draft', 'submitted', 'accepted', 'rejected'];
  const ensDeclarations = [];

  for (let i = 0; i < 8; i++) {
    const client = randomItem(clients);
    const product = randomItem(products);
    const status = randomItem(ensStatuses);
    const quantity = randomNumber(100, 5000);
    const tc = randomItem(transportConfigs);
    const office = randomItem(customsOffices);
    const grossMass = Math.round(product.weight * quantity * 1.1);

    const ens = new ENSDeclaration({
      createdBy: userId,
      tenantId,
      lrn: generateLRN(),
      mrn: status === 'accepted' ? generateMRN() : undefined,
      status,
      transportMode: tc.mode,
      entryOffice: {
        code: office.code,
        name: office.name,
        expectedArrival: randomDate(new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
      },
      carrier: {
        eori: 'ESB22477020',
        name: 'STRIX AI SL'
      },
      transportMeans: {
        identification: tc.id(),
        identificationType: tc.idType,
        nationality: 'ES',
        modeAtBorder: tc.borderMode
      },
      consignment: {
        referenceNumber: `REF${randomNumber(100000, 999999)}`,
        referenceType: tc.refType,
        grossMass: grossMass || 100,
        numberOfPackages: randomNumber(10, 500),
        goodsDescription: product.description,
        countryOfDispatch: randomItem(['CN', 'JP', 'KR', 'IN', 'DE', 'FR']),
        countryOfDestination: 'ES'
      },
      consignor: {
        name: randomItem(['Shanghai Exports Co.', 'Tokyo Trading Ltd.', 'Seoul Electronics']),
        address: {
          streetAndNumber: 'International Trade Zone',
          city: randomItem(['Shanghai', 'Tokyo', 'Seoul', 'Mumbai']),
          postcode: String(randomNumber(10000, 99999)),
          country: randomItem(['CN', 'JP', 'KR', 'IN'])
        }
      },
      consignee: {
        eori: client.eori,
        name: client.companyName,
        address: {
          streetAndNumber: `Calle Comercial ${randomNumber(1, 50)}`,
          city: client.city,
          postcode: String(randomNumber(10000, 50000)),
          country: 'ES'
        }
      },
      submittedAt: status !== 'draft' ? randomDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), new Date()) : undefined,
      createdAt: randomDate(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), new Date())
    });

    ensDeclarations.push(ens);
  }

  await ENSDeclaration.insertMany(ensDeclarations);
  console.log(`  + ${ensDeclarations.length} declaraciones ENS creadas`);
  return ensDeclarations;
}

async function seedCommunications(userId, expeditions, requirements) {
  console.log('Creando comunicaciones...');

  const communicationTypes = ['requirement_response', 'allegation', 'administrative_appeal', 'information_request', 'clarification', 'inspection_coordination'];
  const statuses = ['draft', 'pending_review', 'sent', 'awaiting_response', 'responded', 'resolved'];
  const communications = [];

  for (let i = 0; i < 15; i++) {
    const expedition = randomItem(expeditions);
    const requirement = requirements.length > 0 ? randomItem(requirements) : null;
    const commType = randomItem(communicationTypes);
    const status = randomItem(statuses);
    const createdAt = randomDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), new Date());
    const client = randomItem(clients);
    const authorityType = randomItem(['AEAT', 'SOIVRE', 'MAPA']);

    let category;
    if (['allegation', 'administrative_appeal'].includes(commType)) category = 'appeal';
    else if (['requirement_response', 'clarification'].includes(commType)) category = 'response';
    else if (commType === 'information_request') category = 'request';
    else category = 'coordination';

    const communication = new InspectorCommunication({
      communicationNumber: `COM-TST-2026-${String(i + 1).padStart(5, '0')}`,
      communicationType: commType,
      category,
      status,
      priority: randomItem(['low', 'normal', 'high', 'urgent']),
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
        name: authorityType === 'AEAT' ? 'Agencia Tributaria' : authorityType === 'SOIVRE' ? 'Servicio Oficial de Inspeccion' : 'Ministerio de Agricultura',
        office: `Aduana de ${randomItem(['Barcelona', 'Valencia', 'Madrid'])}`,
        city: randomItem(['Barcelona', 'Valencia', 'Madrid']),
        email: `${authorityType.toLowerCase()}@${authorityType.toLowerCase()}.gob.es`
      },
      inspector: {
        id: `INS-${randomNumber(1000, 9999)}`,
        name: `Inspector ${randomItem(['Garcia', 'Lopez', 'Martinez', 'Rodriguez'])}`,
        position: 'Inspector de Aduanas',
        department: 'Departamento de Aduanas',
        email: `inspector${randomNumber(1, 50)}@aeat.es`,
        phone: `+34 91${randomNumber(1000000, 9999999)}`
      },
      subject: `Comunicacion ${commType.replace(/_/g, ' ')} - ${client.companyName}`,
      description: `Comunicacion ${commType.replace(/_/g, ' ')} para ${client.companyName} - expediente ${expedition.expeditionId}`,
      legalBasis: [{
        law: 'Codigo Aduanero de la Union (Reglamento UE 952/2013)',
        article: randomItem(['Art. 22', 'Art. 44', 'Art. 188']),
        description: 'Base legal para la comunicacion'
      }],
      messages: [{
        direction: 'outgoing',
        messageType: 'initial',
        subject: `Comunicacion ${commType.replace(/_/g, ' ')}`,
        content: `Comunicacion presentada ante ${authorityType}.`,
        sentAt: ['sent', 'awaiting_response', 'responded', 'resolved'].includes(status) ? createdAt : undefined,
        sender: { name: 'STRIX AI SL', role: 'Representante Aduanero', organization: 'STRIX AI', email: 'aduanas@strixai.es' },
        recipient: { name: authorityType, role: 'Autoridad competente', organization: authorityType },
        channel: randomItem(['email', 'portal', 'electronic'])
      }],
      deadlines: {
        submissionDeadline: new Date(createdAt.getTime() + randomNumber(10, 30) * 24 * 60 * 60 * 1000),
        responseDeadline: new Date(createdAt.getTime() + randomNumber(30, 60) * 24 * 60 * 60 * 1000)
      },
      dates: {
        createdAt,
        sentAt: ['sent', 'awaiting_response', 'responded', 'resolved'].includes(status) ? createdAt : undefined,
        resolvedAt: status === 'resolved' ? new Date(createdAt.getTime() + randomNumber(30, 60) * 24 * 60 * 60 * 1000) : undefined
      },
      client: {
        name: client.companyName,
        nif: client.nif,
        eori: client.eori,
        email: `contacto@${client.companyName.toLowerCase().replace(/\s/g, '')}.es`,
        phone: `+34 6${randomNumber(10000000, 99999999)}`
      },
      representation: { type: 'direct', representativeName: 'STRIX AI SL', representativeNif: 'B22477020' },
      assignedTo: userId,
      createdBy: userId,
      timeline: [{ action: 'created', description: 'Comunicacion creada en el sistema', performedBy: userId, timestamp: createdAt }],
      tags: [authorityType, commType, category],
      active: status !== 'archived',
      createdAt,
      updatedAt: new Date()
    });

    communications.push(communication);
  }

  await InspectorCommunication.insertMany(communications);
  console.log(`  + ${communications.length} comunicaciones creadas`);
  return communications;
}

// ==================== Main ====================

async function seedAll() {
  try {
    console.log('\n=== Seed datos demo para Tester (produccion-safe) ===\n');
    await connectDB();

    // Find tester user
    const tester = await User.findOne({ email: 'tester@strixai.es' });
    if (!tester) {
      console.error('ERROR: Usuario tester@strixai.es no encontrado. Ejecuta createSuperAdmin.js primero.');
      process.exit(1);
    }

    const userId = tester._id;
    const tenantId = tester.tenantId;
    console.log(`Usuario: ${tester.email} (${userId})`);
    console.log(`Tenant:  ${tenantId}\n`);

    // Clean previous tester data if exists
    const existingExp = await Expedition.countDocuments({ createdBy: userId });
    if (existingExp > 0) {
      console.log(`Limpiando ${existingExp} expedientes previos del tester...`);
      await Promise.all([
        Expedition.deleteMany({ createdBy: userId }),
        Requirement.deleteMany({ createdBy: userId }),
        Deadline.deleteMany({ createdBy: userId }),
        Inspection.deleteMany({ createdBy: userId }),
        Guarantee.deleteMany({ $or: [{ owner: userId }, { createdBy: userId }] }),
        H7Declaration.deleteMany({ createdBy: userId }),
        Transit.deleteMany({ owner: userId }),
        SpecialRegime.deleteMany({ owner: userId }),
        OEA.deleteMany({ createdBy: userId }),
        ENSDeclaration.deleteMany({ createdBy: userId }),
        InspectorCommunication.deleteMany({ createdBy: userId })
      ]);
      console.log('Datos previos del tester eliminados.\n');
    }

    // Seed all data
    const expeditions = await seedExpeditions(userId, tenantId);
    const requirements = await seedRequirements(expeditions, userId);
    await seedDeadlines(expeditions, userId);
    await seedInspections(expeditions, userId);
    await seedGuarantees(userId);
    await seedH7Declarations(userId, tenantId);
    await seedTransits(userId, tenantId);
    await seedSpecialRegimes(userId);
    await seedOEA(userId);
    await seedENSDeclarations(userId, tenantId);
    await seedCommunications(userId, expeditions, requirements);

    // Summary
    console.log('\n=== Seed completado ===\n');
    console.log('Datos creados para tester@strixai.es:');
    console.log(`  Expedientes:          25`);
    console.log(`  Requerimientos:       ~15`);
    console.log(`  Plazos:               20`);
    console.log(`  Inspecciones:         10`);
    console.log(`  Garantias:            8`);
    console.log(`  H7 Declaraciones:     20`);
    console.log(`  Transitos NCTS:       12`);
    console.log(`  Regimenes Especiales: 8`);
    console.log(`  OEA:                  4`);
    console.log(`  ENS Declaraciones:    8`);
    console.log(`  Comunicaciones:       15`);
    console.log(`\n  TOTAL: ~145 registros\n`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\nERROR durante el seed:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedAll();
