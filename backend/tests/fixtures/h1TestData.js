/**
 * H1 Declaration Test Data Fixtures
 * Complete test data for end-to-end H1 workflow testing
 * LUCI Customs Agent - Stock Logistic
 */

/**
 * Spanish Importer Company - Test Client
 */
const testClient = {
  companyName: 'Importaciones Mediterráneo S.L.',
  nif: 'B22477020', // Real NIF format
  eori: 'ESB22477020000',
  address: {
    street: 'Avinguda Diagonal 445, Planta 5',
    city: 'Barcelona',
    postalCode: '08036',
    country: 'ES',
    province: 'Barcelona'
  },
  contact: {
    name: 'María García López',
    email: 'maria.garcia@importmed.es',
    phone: '+34 932 001 234',
    position: 'Responsable Comercio Exterior'
  },
  taxInfo: {
    vatNumber: 'ESB22477020',
    regime: 'general'
  }
};

/**
 * Chinese Exporter - Test Supplier
 */
const testExporter = {
  companyName: 'Shanghai Electronics Manufacturing Co., Ltd.',
  address: 'No. 888 Industry Road, Pudong New Area',
  city: 'Shanghai',
  postalCode: '200120',
  country: 'CN',
  contact: {
    name: 'Wei Chen',
    email: 'wei.chen@shem-china.cn',
    phone: '+86 21 5888 8888'
  }
};

/**
 * Customs Agent Representative
 */
const testDeclarant = {
  companyName: 'Strix AI Pioneer Solutions S.L.',
  nif: 'B22477020',
  eori: 'ESB22477020000',
  representationType: 'direct', // direct or indirect
  address: {
    street: 'Calle Innovación 42',
    city: 'Barcelona',
    postalCode: '08018',
    country: 'ES'
  }
};

/**
 * Test Goods - Electronics Import (Common H1 case)
 */
const testGoodsElectronics = [
  {
    itemNumber: 1,
    description: 'Ordenadores portátiles con pantalla LCD 15.6 pulgadas, procesador Intel i5, 8GB RAM, 256GB SSD',
    descriptionEn: 'Laptop computers with 15.6 inch LCD screen, Intel i5 processor, 8GB RAM, 256GB SSD',
    taricCode: '84713000', // Laptops
    hsCode: '847130',
    originCountry: 'CN',
    quantity: 100,
    unit: 'PCE', // Pieces
    grossWeight: 350,
    netWeight: 300,
    invoiceValue: 45000,
    currency: 'EUR',
    packages: {
      quantity: 25,
      type: 'CTN', // Cartons
      marks: 'SHEM-2024-001'
    },
    countryOfOrigin: 'CN',
    // Duty calculation
    dutyRate: 0, // 0% for laptops (TARIC)
    vatRate: 21 // 21% Spanish VAT
  },
  {
    itemNumber: 2,
    description: 'Ratones ópticos inalámbricos USB 2.4GHz',
    descriptionEn: 'Wireless optical USB mice 2.4GHz',
    taricCode: '84716060', // Computer mice
    hsCode: '847160',
    originCountry: 'CN',
    quantity: 500,
    unit: 'PCE',
    grossWeight: 75,
    netWeight: 60,
    invoiceValue: 2500,
    currency: 'EUR',
    packages: {
      quantity: 10,
      type: 'CTN',
      marks: 'SHEM-2024-002'
    },
    countryOfOrigin: 'CN',
    dutyRate: 0,
    vatRate: 21
  },
  {
    itemNumber: 3,
    description: 'Teclados mecánicos USB con retroiluminación RGB',
    descriptionEn: 'Mechanical USB keyboards with RGB backlight',
    taricCode: '84716070', // Computer keyboards
    hsCode: '847160',
    originCountry: 'CN',
    quantity: 200,
    unit: 'PCE',
    grossWeight: 180,
    netWeight: 160,
    invoiceValue: 6000,
    currency: 'EUR',
    packages: {
      quantity: 10,
      type: 'CTN',
      marks: 'SHEM-2024-003'
    },
    countryOfOrigin: 'CN',
    dutyRate: 0,
    vatRate: 21
  }
];

/**
 * Test Goods - Textile Import (Requires specific certificates)
 */
const testGoodsTextiles = [
  {
    itemNumber: 1,
    description: 'Tejidos de algodón estampados, peso superior a 200 g/m2, para confección',
    descriptionEn: 'Printed cotton fabrics, weight exceeding 200 g/m2, for clothing',
    taricCode: '52084200', // Cotton fabrics > 200g/m2
    hsCode: '520842',
    originCountry: 'CN',
    quantity: 5000,
    unit: 'KG',
    grossWeight: 5200,
    netWeight: 5000,
    invoiceValue: 25000,
    currency: 'EUR',
    packages: {
      quantity: 50,
      type: 'BAL', // Bales
      marks: 'TEXTILE-CN-001'
    },
    countryOfOrigin: 'CN',
    dutyRate: 8, // 8% for cotton textiles
    vatRate: 21
  }
];

/**
 * Test Goods - Food Products (Requires sanitary certificates)
 */
const testGoodsFood = [
  {
    itemNumber: 1,
    description: 'Aceite de oliva virgen extra, envasado en botellas de 1 litro',
    descriptionEn: 'Extra virgin olive oil, bottled in 1 liter containers',
    taricCode: '15091090', // Olive oil
    hsCode: '150910',
    originCountry: 'TN', // Tunisia
    quantity: 10000,
    unit: 'LTR',
    grossWeight: 10500,
    netWeight: 10000,
    invoiceValue: 35000,
    currency: 'EUR',
    packages: {
      quantity: 1000,
      type: 'CTN',
      marks: 'OLIVE-TN-2024'
    },
    countryOfOrigin: 'TN',
    dutyRate: 0, // 0% with EUR-MED preferential
    vatRate: 10, // Reduced VAT for food
    preferentialOrigin: true,
    preferenceCode: '300' // EUR-MED preference
  }
];

/**
 * Transport Details - Maritime (Most common)
 */
const testTransportMaritime = {
  mode: 'maritime',
  carrier: 'MSC Mediterranean Shipping Company',
  vesselName: 'MSC GÜLSÜN',
  imoNumber: '9839430',
  voyageNumber: 'MSC-2024-EU-038',
  documentType: 'BL', // Bill of Lading
  documentNumber: 'MSCU123456789',
  containerNumbers: ['MSCU1234567', 'MSCU2345678'],
  sealNumbers: ['SEAL001', 'SEAL002'],
  departurePort: 'CNSHA', // Shanghai
  departureDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  arrivalPort: 'ESBCN', // Barcelona
  arrivalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  loadingPlace: 'Shanghai, China',
  unloadingPlace: 'Puerto de Barcelona'
};

/**
 * Transport Details - Air
 */
const testTransportAir = {
  mode: 'air',
  carrier: 'China Southern Airlines',
  flightNumber: 'CZ345',
  awbNumber: '784-12345678', // Air Waybill
  documentType: 'AWB',
  documentNumber: '784-12345678',
  departurePort: 'CNPVG', // Shanghai Pudong
  departureDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  arrivalPort: 'LEMD', // Madrid Barajas
  arrivalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  loadingPlace: 'Shanghai Pudong International Airport',
  unloadingPlace: 'Adolfo Suárez Madrid-Barajas Airport'
};

/**
 * Transport Details - Road
 */
const testTransportRoad = {
  mode: 'road',
  carrier: 'TIR Transport International S.A.',
  truckPlate: '1234 ABC',
  trailerPlate: 'R-5678-XYZ',
  driverName: 'Jean-Pierre Dubois',
  driverId: 'FR123456789',
  documentType: 'CMR',
  documentNumber: 'CMR-2024-EU-001234',
  departurePort: 'FRPAR', // Paris
  departureDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  arrivalPort: 'ESBCN', // Barcelona
  arrivalDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  loadingPlace: 'París, Francia',
  unloadingPlace: 'Barcelona, España',
  tirCarnetNumber: 'TIR-EU-2024-00567'
};

/**
 * Incoterms for different scenarios
 */
const testIncoterms = {
  cifBarcelona: { code: 'CIF', place: 'Barcelona' },
  fobShanghai: { code: 'FOB', place: 'Shanghai' },
  ddpMadrid: { code: 'DDP', place: 'Madrid' },
  exwFactory: { code: 'EXW', place: 'Shanghai Factory' }
};

/**
 * Test Documents - Validated
 */
const testDocumentsValidated = [
  {
    type: 'commercial_invoice',
    documentCode: 'N380',
    fileName: 'invoice_SHEM_2024_001.pdf',
    fileSize: 245678,
    mimeType: 'application/pdf',
    status: 'validated',
    uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    validatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    extractedData: {
      invoiceNumber: 'INV-SHEM-2024-001',
      invoiceDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      totalAmount: 53500,
      currency: 'EUR',
      seller: 'Shanghai Electronics Manufacturing Co., Ltd.',
      buyer: 'Importaciones Mediterráneo S.L.'
    },
    aiConfidence: 95
  },
  {
    type: 'packing_list',
    documentCode: 'N714',
    fileName: 'packing_list_SHEM_2024_001.pdf',
    fileSize: 156234,
    mimeType: 'application/pdf',
    status: 'validated',
    uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    validatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    extractedData: {
      totalPackages: 45,
      totalGrossWeight: 605,
      totalNetWeight: 520,
      packageTypes: ['CTN']
    },
    aiConfidence: 92
  },
  {
    type: 'bill_of_lading',
    documentCode: 'N705',
    fileName: 'bl_MSCU123456789.pdf',
    fileSize: 312456,
    mimeType: 'application/pdf',
    status: 'validated',
    uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    validatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    extractedData: {
      blNumber: 'MSCU123456789',
      shipper: 'Shanghai Electronics Manufacturing Co., Ltd.',
      consignee: 'Importaciones Mediterráneo S.L.',
      vessel: 'MSC GÜLSÜN',
      voyage: 'MSC-2024-EU-038',
      containers: ['MSCU1234567', 'MSCU2345678'],
      portOfLoading: 'Shanghai',
      portOfDischarge: 'Barcelona'
    },
    aiConfidence: 97
  }
];

/**
 * Additional Documents for specific scenarios
 */
const testDocumentsCertificates = {
  eur1: {
    type: 'eur1',
    documentCode: 'N864',
    fileName: 'eur1_certificate_TN_2024.pdf',
    status: 'validated',
    extractedData: {
      certificateNumber: 'EUR1-TN-2024-00456',
      issueDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      exporterCountry: 'TN',
      originDeclaration: 'Tunisia'
    }
  },
  sanitaryCertificate: {
    type: 'sanitary_certificate',
    documentCode: 'C620',
    fileName: 'sanitary_cert_food_2024.pdf',
    status: 'validated',
    extractedData: {
      certificateNumber: 'SAN-ES-2024-12345',
      issuingAuthority: 'Ministerio de Sanidad',
      validUntil: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }
  },
  ceDeclaration: {
    type: 'ce_declaration',
    documentCode: 'C057',
    fileName: 'ce_declaration_electronics.pdf',
    status: 'validated',
    extractedData: {
      manufacturer: 'Shanghai Electronics Manufacturing Co., Ltd.',
      productDescription: 'Laptop computers, mice, keyboards',
      standards: ['EN 55032', 'EN 55035', 'EN 62368-1']
    }
  },
  certificateOfOrigin: {
    type: 'certificate_origin',
    documentCode: 'U069',
    fileName: 'coo_china_2024.pdf',
    status: 'validated',
    extractedData: {
      certificateNumber: 'COO-CN-SHA-2024-08765',
      origin: 'China',
      chamber: 'Shanghai Chamber of Commerce'
    }
  }
};

/**
 * Customs Office Codes
 */
const customsOffices = {
  barcelonaPort: { code: 'ES002801', name: 'Barcelona - Aduana Marítima' },
  barcelonaAirport: { code: 'ES002805', name: 'Barcelona - El Prat' },
  valenciaPort: { code: 'ES004601', name: 'Valencia - Puerto' },
  madridAirport: { code: 'ES002101', name: 'Madrid - Barajas' },
  algecirasPort: { code: 'ES003001', name: 'Algeciras - Puerto' },
  bilbaoPort: { code: 'ES004801', name: 'Bilbao - Puerto' }
};

/**
 * Declaration Regimes
 */
const regimes = {
  freeCirculation: { code: '40', description: 'Despacho a libre práctica y consumo' },
  freeCirculationIntraEU: { code: '42', description: 'Libre práctica + entrega intra-UE' },
  endUse: { code: '44', description: 'Libre práctica con destino final' },
  activeProcessing: { code: '51', description: 'Perfeccionamiento activo' },
  temporaryImport: { code: '53', description: 'Importación temporal' },
  reimport: { code: '61', description: 'Reimportación' },
  customsWarehouse: { code: '71', description: 'Depósito aduanero' }
};

/**
 * Preference Codes
 */
const preferences = {
  mfn: { code: '100', description: 'Arancel NMF (terceros países)' },
  spg: { code: '200', description: 'Sistema de Preferencias Generalizadas' },
  preferential: { code: '300', description: 'Aranceles preferenciales (EUR.1, EUR-MED)' },
  customsUnion: { code: '400', description: 'Unión aduanera (ATR - Turquía)' }
};

/**
 * Complete Expedition for Electronics Import (Standard H1)
 */
const createElectronicsExpedition = (overrides = {}) => ({
  operationType: 'import',
  transportMode: 'maritime',
  status: 'documents_validated',
  client: testClient,
  exporter: testExporter,
  declarant: testDeclarant,
  goods: testGoodsElectronics,
  transport: testTransportMaritime,
  incoterm: testIncoterms.cifBarcelona,
  documents: testDocumentsValidated,
  invoiceTotal: 53500,
  customsValue: 54200, // CIF value (invoice + freight + insurance)
  customsOffice: customsOffices.barcelonaPort.code,
  ...overrides
});

/**
 * Complete Expedition for Textile Import (May trigger Orange channel)
 */
const createTextileExpedition = (overrides = {}) => ({
  operationType: 'import',
  transportMode: 'maritime',
  status: 'documents_validated',
  client: testClient,
  exporter: testExporter,
  declarant: testDeclarant,
  goods: testGoodsTextiles,
  transport: testTransportMaritime,
  incoterm: testIncoterms.cifBarcelona,
  documents: testDocumentsValidated,
  invoiceTotal: 25000,
  customsValue: 25800,
  customsOffice: customsOffices.barcelonaPort.code,
  ...overrides
});

/**
 * Complete Expedition for Food Import (May trigger Red channel - sanitary inspection)
 */
const createFoodExpedition = (overrides = {}) => ({
  operationType: 'import',
  transportMode: 'maritime',
  status: 'documents_validated',
  client: testClient,
  exporter: {
    companyName: 'Tunisia Olive Oil Export S.A.',
    address: 'Rue de l\'Industrie 45',
    city: 'Sfax',
    country: 'TN'
  },
  declarant: testDeclarant,
  goods: testGoodsFood,
  transport: {
    ...testTransportMaritime,
    departurePort: 'TNSFA', // Sfax, Tunisia
    containerNumbers: ['MSKU9876543']
  },
  incoterm: testIncoterms.cifBarcelona,
  documents: [
    ...testDocumentsValidated,
    testDocumentsCertificates.eur1,
    testDocumentsCertificates.sanitaryCertificate
  ],
  invoiceTotal: 35000,
  customsValue: 36200,
  customsOffice: customsOffices.barcelonaPort.code,
  ...overrides
});

/**
 * Expected channel responses for testing
 */
const channelExpectations = {
  green: {
    channel: 'green',
    expectedActions: ['levante_generated', 'notification_sent'],
    expectedStatus: 'green_channel',
    requirementCreated: false
  },
  orange: {
    channel: 'orange',
    expectedActions: ['requirement_created', 'notification_sent'],
    expectedStatus: 'orange_channel',
    requirementCreated: true,
    requirementType: 'documentary'
  },
  red: {
    channel: 'red',
    expectedActions: ['requirement_created', 'inspection_scheduled', 'notification_sent'],
    expectedStatus: 'red_channel',
    requirementCreated: true,
    requirementType: 'physical'
  }
};

/**
 * Test Requirement Responses
 */
const requirementResponses = {
  documentary: {
    responseType: 'documentary',
    notes: 'Se adjunta documentación adicional solicitada según requerimiento',
    documents: [
      testDocumentsCertificates.certificateOfOrigin,
      testDocumentsCertificates.ceDeclaration
    ]
  },
  physical: {
    responseType: 'inspection_coordination',
    notes: 'Mercancía disponible para inspección en el recinto aduanero',
    inspectionDetails: {
      location: 'Terminal de Contenedores - Puerto de Barcelona',
      contactPerson: 'Juan Martínez',
      contactPhone: '+34 600 123 456',
      containerLocation: 'Zona B, Fila 15, Posición 3'
    }
  }
};

/**
 * Physical Inspection Results
 */
const inspectionResults = {
  approved: {
    result: 'approved',
    findings: 'Mercancía conforme a declaración. Sin discrepancias detectadas.',
    discrepancies: [],
    actaNumber: `ACTA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`
  },
  partialApproved: {
    result: 'partial',
    findings: 'Pequeña discrepancia en peso detectada. Se aplica ajuste.',
    discrepancies: [
      {
        field: 'grossWeight',
        declared: '605 kg',
        found: '598 kg',
        severity: 'minor',
        adjustment: -35 // EUR adjustment in duties
      }
    ],
    actaNumber: `ACTA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`
  },
  rejected: {
    result: 'rejected',
    findings: 'Mercancía no conforme. Clasificación arancelaria incorrecta.',
    discrepancies: [
      {
        field: 'taricCode',
        declared: '84713000',
        found: '84715000',
        severity: 'major',
        action: 'reclassification_required'
      }
    ],
    actaNumber: `ACTA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`
  }
};

module.exports = {
  // Base entities
  testClient,
  testExporter,
  testDeclarant,

  // Goods
  testGoodsElectronics,
  testGoodsTextiles,
  testGoodsFood,

  // Transport
  testTransportMaritime,
  testTransportAir,
  testTransportRoad,

  // Incoterms
  testIncoterms,

  // Documents
  testDocumentsValidated,
  testDocumentsCertificates,

  // Reference data
  customsOffices,
  regimes,
  preferences,

  // Expedition factories
  createElectronicsExpedition,
  createTextileExpedition,
  createFoodExpedition,

  // Test expectations
  channelExpectations,
  requirementResponses,
  inspectionResults
};
