/**
 * Netherlands Customs Codes for DMS 4.0 and DECO
 * National codes (NXXXX format) replacing old AGS 9XXXX codes
 */

const NL_CODES = {
  // Customs Offices (complete list)
  customsOffices: {
    'NL000231': { name: 'Breda', type: 'inland' },
    'NL000251': { name: 'Rotterdam Rijnmond', type: 'port' },
    'NL000297': { name: 'Rotterdam Haven', type: 'port' },
    'NL000396': { name: 'Amsterdam', type: 'port' },
    'NL000399': { name: 'Schiphol', type: 'airport' },
    'NL000440': { name: 'Eindhoven', type: 'inland' },
    'NL000441': { name: 'Heerlen', type: 'inland' },
    'NL000447': { name: 'Maastricht', type: 'inland' },
    'NL000448': { name: 'Venlo', type: 'inland' },
    'NL000460': { name: 'Groningen', type: 'inland' },
    'NL000461': { name: 'Leeuwarden', type: 'inland' },
    'NL000471': { name: 'Enschede', type: 'inland' },
    'NL000480': { name: 'Arnhem', type: 'inland' },
    'NL000490': { name: 'Utrecht', type: 'inland' },
    'NL000501': { name: 'Den Haag', type: 'inland' },
    'NL000511': { name: 'Vlissingen', type: 'port' },
  },

  // Document type codes (DMS 4.0 NXXXX format)
  documentTypes: {
    // Transport documents
    transport: {
      'N740': 'Air waybill',
      'N741': 'Master air waybill',
      'N714': 'House waybill',
      'N730': 'Road consignment note (CMR)',
      'N720': 'Rail consignment note (CIM)',
      'N750': 'Delivery note',
      'N760': 'Multimodal transport document',
      'N785': 'Cargo manifest',
      'N705': 'Bill of lading',
      'N704': 'Master bill of lading',
      'N706': 'House bill of lading',
      'N710': 'Sea waybill',
    },
    // Previous documents
    previous: {
      'NMRN': 'MRN of previous declaration',
      'N830': 'Summary declaration',
      'N821': 'Temporary storage declaration',
      'N822': 'Entry summary declaration (ENS)',
      'N337': 'T1 transit document',
      'N380': 'Commercial invoice',
      'N270': 'Delivery note packing list',
    },
    // Additional documents
    additional: {
      'N853': 'Health certificate',
      'N861': 'Certificate of origin',
      'N862': 'Preferential certificate of origin (EUR.1)',
      'N864': 'EUR-MED certificate',
      'N865': 'GSP Form A',
      'N851': 'Phytosanitary certificate',
      'N852': 'Veterinary certificate',
      'N955': 'CITES permit',
    },
    // Authorization documents
    authorization: {
      'N990': 'Customs comprehensive guarantee',
      'N991': 'Individual guarantee',
      'C505': 'AEO certificate - customs simplifications',
      'C506': 'AEO certificate - security and safety',
      'C601': 'Inward processing authorization',
      'C602': 'Outward processing authorization',
    },
    // Supporting documents
    supporting: {
      'N380': 'Commercial invoice',
      'N325': 'Pro forma invoice',
      'N386': 'Customs value declaration',
      'N271': 'Packing list',
      'N935': 'Binding tariff information (BTI)',
      'N954': 'Import license',
    },
    // DECO specific
    deco: {
      'N380': 'Commercial invoice / order confirmation',
      'N730': 'Postal receipt / tracking number',
      'N740': 'Air waybill (express)',
    }
  },

  // Procedure codes (requested + previous) for DMS 4.0
  procedures: {
    import: {
      // Requested procedure + previous procedure
      '4000': 'Free circulation, no previous procedure',
      '4051': 'Free circulation, from inward processing',
      '4053': 'Free circulation, from temporary import',
      '4054': 'Free circulation, from active refinement',
      '4071': 'Free circulation, from customs warehouse',
      '4078': 'Free circulation, from free zone',
      '4200': 'Free circulation with VAT exemption (Art. 143 UCC)',
      '4400': 'Free circulation, simultaneous re-export',
      '6110': 'Re-import, from temporary export',
      '6123': 'Re-import with repair',
      '7100': 'Customs warehouse entry',
      '7110': 'Customs warehouse, from another warehouse',
      '5100': 'Inward processing',
      '5300': 'Temporary admission',
    },
    export: {
      '1000': 'Definitive export',
      '1040': 'Definitive export of processed products (outward processing)',
      '2100': 'Temporary export',
      '2300': 'Temporary export for repair',
      '3100': 'Re-export after inward processing',
      '3151': 'Re-export after customs warehousing',
    },
    deco: {
      'C07': 'DECO standard import (H7)',
      'C08': 'DECO with IOSS',
      'C09': 'DECO with special arrangements (postal)',
    }
  },

  // Transaction nature codes (2 digits in DMS vs 1 in AGS)
  transactionNature: {
    '11': 'Outright purchase/sale',
    '12': 'Goods for sale on approval or after trial',
    '13': 'Barter trade',
    '14': 'Financial leasing',
    '21': 'Return/replacement of goods free of charge',
    '22': 'Replacement of returned goods',
    '23': 'Replacement of goods not returned',
    '30': 'Transactions involving transfer of ownership without financial compensation',
    '41': 'Contract work (processing under contract)',
    '42': 'Repair/maintenance against payment',
    '51': 'Goods returning after contract work',
    '52': 'Goods returning after repair',
    '60': 'Goods for government/NATO use',
    '70': 'Construction or engineering projects',
    '80': 'Other transactions',
    '91': 'Hire, loan, operational leasing',
  },

  // Payment methods
  paymentMethods: {
    'A': 'Cash payment',
    'B': 'Payment by credit card',
    'C': 'Payment by cheque',
    'D': 'Other (bank transfer, etc.)',
    'E': 'Deferred payment',
    'G': 'Payment via fiscal representative',
    'H': 'Electronic credit transfer',
    'R': 'Garantia (GRN)',
  },

  // Valuation methods
  valuationMethods: {
    '1': 'Transaction value of imported goods',
    '2': 'Transaction value of identical goods',
    '3': 'Transaction value of similar goods',
    '4': 'Deductive method',
    '5': 'Computed value method',
    '6': 'Fall-back method',
  },

  // DMS response status codes
  responseCodes: {
    'ACCEPTED': { code: '01', description: 'Declaracion aceptada', success: true },
    'RELEASED': { code: '02', description: 'Mercancias liberadas', success: true },
    'REJECTED': { code: '03', description: 'Declaracion rechazada', success: false },
    'PENDING_CORRECTION': { code: '04', description: 'Pendiente de correccion por declarante', success: false },
    'UNDER_CONTROL': { code: '05', description: 'En control aduanero', success: true },
    'CORRECTION_REQUIRED': { code: '06', description: 'Correccion requerida', success: false },
    'INVALIDATED': { code: '07', description: 'Invalidada', success: false },
    'DOCUMENT_CONTROL': { code: '10', description: 'Control documental', success: true },
    'PHYSICAL_CONTROL': { code: '11', description: 'Control fisico', success: true },
    'PENDING_PAYMENT': { code: '20', description: 'Pendiente de pago', success: true },
  },

  // Map old AGS 9XXXX codes to new DMS NXXXX codes
  agsToNxxx: {
    '91000': 'N380',  // Commercial invoice
    '92000': 'N730',  // CMR
    '92100': 'N740',  // AWB
    '92200': 'N705',  // B/L
    '93000': 'N861',  // Certificate of origin
    '94000': 'N853',  // Health certificate
    '95000': 'N851',  // Phytosanitary
    '96000': 'N862',  // EUR.1
    '97000': 'N271',  // Packing list
    '98000': 'N990',  // Guarantee
  },

  // Helper functions
  getOfficeName(code) {
    return NL_CODES.customsOffices[code]?.name || code;
  },

  getDocumentName(code) {
    for (const category of Object.values(NL_CODES.documentTypes)) {
      if (category[code]) return category[code];
    }
    return code;
  },

  isPortOffice(code) {
    return NL_CODES.customsOffices[code]?.type === 'port';
  },

  isAirportOffice(code) {
    return NL_CODES.customsOffices[code]?.type === 'airport';
  },

  getOfficesByType(type) {
    return Object.entries(NL_CODES.customsOffices)
      .filter(([_, info]) => info.type === type)
      .map(([code, info]) => ({ code, ...info }));
  },
};

module.exports = NL_CODES;
