/**
 * Catalogos PUE SOIVRE - Phase 5
 * Datos de referencia para el formulario AEAT PUE
 */

// =============================================
// ESPECIFICIDADES SOIVRE (Calidad Comercial)
// =============================================
const SOIVRE_SPECIFICITIES = [
  { code: 'NONE', label: 'No aplica ninguna de las especificidades' },
  { code: 'USE_LT_3Y', label: 'Uso < 3 anos' },
  { code: 'MAGNETS', label: 'Imanes y/o ventosas' },
  { code: 'KIDS_SHOES', label: 'Calzado de nino' },
  { code: 'SANDALS', label: 'Sandalias' },
  { code: 'EPI_CAT', label: 'EPI cat I, II o III' },
  { code: 'EPI_MICRO', label: 'EPI microbiologico' },
  { code: 'USE_PRO', label: 'Uso profesional' },
  { code: 'USE_CONS', label: 'Uso consumidor' },
  { code: 'ELECTRICAL', label: 'Aparato electrico o electronico' },
  { code: 'CONSTRUCTION_STRUCT', label: 'Uso construccion (estructural)' },
  { code: 'CONSTRUCTION_NON', label: 'Uso construccion (no estructural)' },
  { code: 'PLASTISOL', label: 'Estampado plastisol' },
  { code: 'WITH_CANDY', label: 'Con golosinas' },
  { code: 'WITH_COSMETICS', label: 'Con cosmeticos' },
  { code: 'ECO_DESIGN', label: 'Diseno ecologico' },
  { code: 'FAIR_SAMPLES', label: 'Mercancias para ferias' },
  { code: 'TRADE_SAMPLES', label: 'Muestrarios' },
  { code: 'NOT_AEE', label: 'NO AEE, NO componente, NO repuesto' },
  { code: 'CUSTOMS_CONTROL', label: 'Control, solicitado por la Aduana' },
  { code: 'ROHS_EXEMPT', label: 'Sometido a exencion ROHS (art RD 219/2013)' },
  { code: 'CHILD_SEAT', label: 'Silla infantil de seguridad' },
  { code: 'RII_PRO_USE', label: 'Uso profesional segun RII' },
  { code: 'RII_NON_PRO_USE', label: 'Uso no profesional segun RII' },
  { code: 'RII_SCRAP', label: 'RII tramitado por SCRAP' },
  { code: 'BATTERIES_REMOVABLE', label: 'AEE con pilas o baterias extraibles' },
  { code: 'BATTERIES_NON_REMOVABLE', label: 'AEE con pilas o baterias no extraibles' },
  { code: 'EU_REGISTER', label: 'Registro de AEE o PyA en otro estado miembro UE' },
  { code: 'RETURN', label: 'Retorno de mercancia' },
  { code: 'END_USER', label: 'Usuario final-uso propio-no vendedor' }
];

// =============================================
// ESPECIFICIDADES ROHS/RAEE (Residuos Electricos)
// =============================================
const ROHS_RAEE_SPECIFICITIES = [
  { code: 'NONE', label: 'Sin especificidad' },
  { code: 'ROHS_EXEMPT', label: 'Sometido a exencion RHS' },
  { code: 'RAEE_EXEMPT', label: 'Sometidas a otras exenciones RAEE o RPyA (art 2 RD 110/2015 o art 2 106/2008)' },
  { code: 'REFURBISH', label: 'AEE para reacondicionar' },
  { code: 'SOLAR_50CM', label: 'Paneles fotovoltaicos de mas de 50 cm' },
  { code: 'MOBILE_MACHINERY', label: 'Maquinaria movil de obras publicas' },
  { code: 'INDUSTRIAL_TOOL', label: 'Herramienta industrial fija de gran envergadura' },
  { code: 'FIXED_INSTALL', label: 'Instalacion fija de gran envergadura' },
  { code: 'MEDICAL_EXEMPT', label: 'Productos sanitarios exentos' },
  { code: 'REPAIR', label: 'Producto para reparar' },
  { code: 'NOT_AEE', label: 'NO AEE, NO componente, NO repuesto' },
  { code: 'CUSTOMS_CONTROL', label: 'Control, solicitado por la Aduana' },
  { code: 'USE_PRO', label: 'Uso profesional' },
  { code: 'RII_PRO_USE', label: 'Uso profesional segun RII' },
  { code: 'RII_NON_PRO_USE', label: 'Uso no profesional segun RII' },
  { code: 'RII_SCRAP', label: 'RII tramitado por SCRAP' },
  { code: 'BATTERIES_REMOVABLE', label: 'AEE con pilas o baterias extraibles' },
  { code: 'BATTERIES_NON_REMOVABLE', label: 'AEE con pilas o baterias no extraibles' },
  { code: 'EU_REGISTER', label: 'Registro de AEE o PyA en otro estado miembro UE' }
];

// =============================================
// UNIDADES DE MERCANCIA
// =============================================
const MERCHANDISE_UNITS = [
  { code: 'DOZ', label: 'Docenas' },
  { code: 'SET', label: 'Juegos' },
  { code: 'MTR', label: 'Metros' },
  { code: 'M2', label: 'Metros cuadrados' },
  { code: 'M3', label: 'Metros cubicos' },
  { code: 'PAR', label: 'Pares' },
  { code: 'UNI', label: 'Unidades Fisicas' },
  { code: 'KGM', label: 'Kilogramos' },
  { code: 'PCE', label: 'Piezas' },
  { code: 'TNE', label: 'Toneladas' }
];

// =============================================
// TIPOS DE CERTIFICADO SOLICITADO
// =============================================
const CERTIFICATE_TYPES = {
  COM: [
    { code: 'NORMAL', label: 'Declaracion Normal' },
    { code: 'NOT_APPLICABLE', label: 'Declara no procede la emision del certificado' },
    { code: 'CONSULT', label: 'Consulta si procede' }
  ],
  ROHS: [
    { code: 'NORMAL', label: 'Declaracion Normal' },
    { code: 'NOT_APPLICABLE', label: 'Declara no procede la emision del certificado' },
    { code: 'CONSULT', label: 'Consulta si procede' }
  ],
  RAEE: [
    { code: 'NORMAL', label: 'Declaracion Normal' },
    { code: 'NOT_APPLICABLE', label: 'Declara no procede la emision del certificado' },
    { code: 'CONSULT', label: 'Consulta si procede' }
  ]
};

// =============================================
// TIPOS DE DECLARACION SOIVRE
// =============================================
const DECLARATION_TYPES = [
  { code: 'EXPEDIENTE_NUEVO', label: 'Expediente SOIVRE nuevo' },
  { code: 'AMPLIACION', label: 'Ampliacion de expediente existente' },
  { code: 'RECTIFICACION', label: 'Rectificacion de expediente' }
];

// =============================================
// TIPOS DE OPERACION
// =============================================
const OPERATION_TYPES = [
  { code: 'ALTA', label: 'Alta' },
  { code: 'BAJA', label: 'Baja' },
  { code: 'MODIFICACION', label: 'Modificacion' }
];

// =============================================
// TIPOS DE DOCUMENTO
// =============================================
const DOCUMENT_TYPES = [
  { code: 'DUA', label: 'DUA' },
  { code: 'OTRA_DECLARACION', label: 'Otra declaracion' }
];

// =============================================
// CODCICE - CENTROS DEL S.I. SOIVRE
// =============================================
const SOIVRE_CENTERS = [
  { code: '01', name: 'SOIVRE Alava', province: 'Alava' },
  { code: '02', name: 'SOIVRE Albacete', province: 'Albacete' },
  { code: '03', name: 'SOIVRE Alicante', province: 'Alicante' },
  { code: '04', name: 'SOIVRE Almeria', province: 'Almeria' },
  { code: '05', name: 'SOIVRE Avila', province: 'Avila' },
  { code: '06', name: 'SOIVRE Badajoz', province: 'Badajoz' },
  { code: '08', name: 'SOIVRE Barcelona', province: 'Barcelona' },
  { code: '09', name: 'SOIVRE Burgos', province: 'Burgos' },
  { code: '10', name: 'SOIVRE Caceres', province: 'Caceres' },
  { code: '11', name: 'SOIVRE Cadiz', province: 'Cadiz' },
  { code: '12', name: 'SOIVRE Castellon', province: 'Castellon' },
  { code: '13', name: 'SOIVRE Ciudad Real', province: 'Ciudad Real' },
  { code: '14', name: 'SOIVRE Cordoba', province: 'Cordoba' },
  { code: '15', name: 'SOIVRE A Coruna', province: 'A Coruna' },
  { code: '17', name: 'SOIVRE Girona', province: 'Girona' },
  { code: '18', name: 'SOIVRE Granada', province: 'Granada' },
  { code: '20', name: 'SOIVRE Guipuzcoa', province: 'Guipuzcoa' },
  { code: '21', name: 'SOIVRE Huelva', province: 'Huelva' },
  { code: '22', name: 'SOIVRE Huesca', province: 'Huesca' },
  { code: '23', name: 'SOIVRE Jaen', province: 'Jaen' },
  { code: '24', name: 'SOIVRE Leon', province: 'Leon' },
  { code: '25', name: 'SOIVRE Lleida', province: 'Lleida' },
  { code: '26', name: 'SOIVRE La Rioja', province: 'La Rioja' },
  { code: '27', name: 'SOIVRE Lugo', province: 'Lugo' },
  { code: '28', name: 'SOIVRE Madrid', province: 'Madrid' },
  { code: '29', name: 'SOIVRE Malaga', province: 'Malaga' },
  { code: '30', name: 'SOIVRE Murcia', province: 'Murcia' },
  { code: '31', name: 'SOIVRE Navarra', province: 'Navarra' },
  { code: '32', name: 'SOIVRE Ourense', province: 'Ourense' },
  { code: '33', name: 'SOIVRE Asturias', province: 'Asturias' },
  { code: '34', name: 'SOIVRE Palencia', province: 'Palencia' },
  { code: '35', name: 'SOIVRE Las Palmas', province: 'Las Palmas' },
  { code: '36', name: 'SOIVRE Pontevedra', province: 'Pontevedra' },
  { code: '37', name: 'SOIVRE Salamanca', province: 'Salamanca' },
  { code: '38', name: 'SOIVRE S.C. Tenerife', province: 'S.C. Tenerife' },
  { code: '39', name: 'SOIVRE Cantabria', province: 'Cantabria' },
  { code: '40', name: 'SOIVRE Segovia', province: 'Segovia' },
  { code: '41', name: 'SOIVRE Sevilla', province: 'Sevilla' },
  { code: '42', name: 'SOIVRE Soria', province: 'Soria' },
  { code: '43', name: 'SOIVRE Tarragona', province: 'Tarragona' },
  { code: '44', name: 'SOIVRE Teruel', province: 'Teruel' },
  { code: '45', name: 'SOIVRE Toledo', province: 'Toledo' },
  { code: '46', name: 'SOIVRE Valencia', province: 'Valencia' },
  { code: '47', name: 'SOIVRE Valladolid', province: 'Valladolid' },
  { code: '48', name: 'SOIVRE Bizkaia', province: 'Bizkaia' },
  { code: '49', name: 'SOIVRE Zamora', province: 'Zamora' },
  { code: '50', name: 'SOIVRE Zaragoza', province: 'Zaragoza' },
  { code: '51', name: 'SOIVRE Ceuta', province: 'Ceuta' },
  { code: '52', name: 'SOIVRE Melilla', province: 'Melilla' }
];

// =============================================
// CODPI - PUNTOS DE INSPECCION SOIVRE
// Por codigo de centro (CodCice)
// =============================================
const INSPECTION_POINTS = {
  '03': [
    { code: 'PI-03-001', name: 'Puerto de Alicante', type: 'SEA' },
    { code: 'PI-03-002', name: 'Aeropuerto Alicante-Elche', type: 'AIR' }
  ],
  '04': [
    { code: 'PI-04-001', name: 'Puerto de Almeria', type: 'SEA' },
    { code: 'PI-04-002', name: 'Aduana de Almeria', type: 'ROAD' }
  ],
  '08': [
    { code: 'PI-08-001', name: 'Puerto de Barcelona - Muelle Adosado', type: 'SEA' },
    { code: 'PI-08-002', name: 'Puerto de Barcelona - Terminal BEST', type: 'SEA' },
    { code: 'PI-08-003', name: 'Puerto de Barcelona - Terminal APM', type: 'SEA' },
    { code: 'PI-08-004', name: 'Aeropuerto El Prat Terminal Cargo', type: 'AIR' },
    { code: 'PI-08-005', name: 'Zona Franca Barcelona', type: 'MULTIMODAL' },
    { code: 'PI-08-006', name: 'Puerto Seco de Barcelona', type: 'ROAD' }
  ],
  '11': [
    { code: 'PI-11-001', name: 'Puerto de Algeciras', type: 'SEA' },
    { code: 'PI-11-002', name: 'Puerto de Cadiz', type: 'SEA' },
    { code: 'PI-11-003', name: 'Zona Franca de Cadiz', type: 'MULTIMODAL' }
  ],
  '15': [
    { code: 'PI-15-001', name: 'Puerto de A Coruna', type: 'SEA' },
    { code: 'PI-15-002', name: 'Aduana de A Coruna', type: 'ROAD' }
  ],
  '17': [
    { code: 'PI-17-001', name: 'Aduana de La Junquera', type: 'ROAD' },
    { code: 'PI-17-002', name: 'Puerto de Palamos', type: 'SEA' }
  ],
  '20': [
    { code: 'PI-20-001', name: 'Puerto de Pasajes', type: 'SEA' },
    { code: 'PI-20-002', name: 'Aduana de Irun', type: 'ROAD' }
  ],
  '21': [
    { code: 'PI-21-001', name: 'Puerto de Huelva', type: 'SEA' }
  ],
  '28': [
    { code: 'PI-28-001', name: 'Aeropuerto Madrid-Barajas T1 Cargo', type: 'AIR' },
    { code: 'PI-28-002', name: 'Aeropuerto Madrid-Barajas T4 Cargo', type: 'AIR' },
    { code: 'PI-28-003', name: 'Puerto Seco de Coslada', type: 'ROAD' },
    { code: 'PI-28-004', name: 'Aduana de Mercamadrid', type: 'ROAD' },
    { code: 'PI-28-005', name: 'Centro de Carga Aerea (CCA)', type: 'AIR' }
  ],
  '29': [
    { code: 'PI-29-001', name: 'Puerto de Malaga', type: 'SEA' },
    { code: 'PI-29-002', name: 'Aeropuerto de Malaga', type: 'AIR' }
  ],
  '30': [
    { code: 'PI-30-001', name: 'Puerto de Cartagena', type: 'SEA' },
    { code: 'PI-30-002', name: 'Aduana de Murcia', type: 'ROAD' }
  ],
  '31': [
    { code: 'PI-31-001', name: 'Aduana de Pamplona', type: 'ROAD' }
  ],
  '33': [
    { code: 'PI-33-001', name: 'Puerto de Gijon', type: 'SEA' },
    { code: 'PI-33-002', name: 'Puerto de Aviles', type: 'SEA' }
  ],
  '35': [
    { code: 'PI-35-001', name: 'Puerto de Las Palmas', type: 'SEA' },
    { code: 'PI-35-002', name: 'Aeropuerto de Gran Canaria', type: 'AIR' },
    { code: 'PI-35-003', name: 'Puerto de Arrecife (Lanzarote)', type: 'SEA' }
  ],
  '36': [
    { code: 'PI-36-001', name: 'Puerto de Vigo', type: 'SEA' },
    { code: 'PI-36-002', name: 'Puerto de Marin', type: 'SEA' },
    { code: 'PI-36-003', name: 'Aeropuerto de Vigo', type: 'AIR' }
  ],
  '38': [
    { code: 'PI-38-001', name: 'Puerto de Santa Cruz de Tenerife', type: 'SEA' },
    { code: 'PI-38-002', name: 'Aeropuerto Tenerife Sur', type: 'AIR' },
    { code: 'PI-38-003', name: 'Aeropuerto Tenerife Norte', type: 'AIR' }
  ],
  '39': [
    { code: 'PI-39-001', name: 'Puerto de Santander', type: 'SEA' }
  ],
  '41': [
    { code: 'PI-41-001', name: 'Puerto de Sevilla', type: 'SEA' },
    { code: 'PI-41-002', name: 'Aeropuerto de Sevilla', type: 'AIR' }
  ],
  '43': [
    { code: 'PI-43-001', name: 'Puerto de Tarragona', type: 'SEA' }
  ],
  '46': [
    { code: 'PI-46-001', name: 'Puerto de Valencia - Terminal MSC', type: 'SEA' },
    { code: 'PI-46-002', name: 'Puerto de Valencia - Terminal Noatum', type: 'SEA' },
    { code: 'PI-46-003', name: 'Puerto de Valencia - Terminal APM', type: 'SEA' },
    { code: 'PI-46-004', name: 'Aeropuerto de Valencia', type: 'AIR' },
    { code: 'PI-46-005', name: 'Puerto Seco de Valencia', type: 'ROAD' }
  ],
  '48': [
    { code: 'PI-48-001', name: 'Puerto de Bilbao', type: 'SEA' },
    { code: 'PI-48-002', name: 'Aeropuerto de Bilbao', type: 'AIR' }
  ],
  '50': [
    { code: 'PI-50-001', name: 'Puerto Seco de Zaragoza (PLAZA)', type: 'MULTIMODAL' },
    { code: 'PI-50-002', name: 'Aeropuerto de Zaragoza', type: 'AIR' }
  ],
  '51': [
    { code: 'PI-51-001', name: 'Puerto de Ceuta', type: 'SEA' }
  ],
  '52': [
    { code: 'PI-52-001', name: 'Puerto de Melilla', type: 'SEA' }
  ]
};

module.exports = {
  SOIVRE_SPECIFICITIES,
  ROHS_RAEE_SPECIFICITIES,
  MERCHANDISE_UNITS,
  CERTIFICATE_TYPES,
  DECLARATION_TYPES,
  OPERATION_TYPES,
  DOCUMENT_TYPES,
  SOIVRE_CENTERS,
  INSPECTION_POINTS
};
