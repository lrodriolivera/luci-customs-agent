/**
 * Base de conocimiento aduanero: regímenes e incoterms.
 *
 * El frontend (DeclarationGenerator, DutyCalculator) consultaba
 * /ai/knowledge/regime/:code y /ai/knowledge/incoterm/:code, rutas que NO
 * existian en el backend: caian al fallback de la SPA, devolvian el index.html
 * con 200 y el panel informativo quedaba permanentemente vacio. Aqui se sirven
 * esos datos de verdad.
 *
 * Datos estaticos y estables (codigos de regimen de la UE e Incoterms 2020);
 * no requieren IA ni BD.
 */

// Regimenes aduaneros de la UE mas habituales (código de régimen solicitado).
const REGIMES = {
  '40': {
    code: '40',
    name: 'Despacho a libre práctica con despacho a consumo',
    description: 'Importación definitiva: la mercancía queda en libre práctica y despachada a consumo en la UE. Se liquidan derechos arancelarios e IVA de importación.',
    requirements: [
      'Factura comercial',
      'Documento de transporte (CMR, B/L, AWB según modo)',
      'Certificado de origen si se solicita preferencia',
      'Licencias o certificados específicos según mercancía'
    ],
    vat: 'IVA de importación exigible en el despacho (salvo diferimiento autorizado).',
    typical_use: 'Importación estándar de un tercer país para venta o consumo en España.'
  },
  '42': {
    code: '42',
    name: 'Despacho a libre práctica con entrega intracomunitaria exenta',
    description: 'Importación en un Estado miembro con entrega intracomunitaria posterior exenta de IVA a otro Estado miembro. El IVA se devenga en el país de destino.',
    requirements: [
      'Factura comercial',
      'NIF-IVA del adquirente en el Estado miembro de destino',
      'Prueba de la expedición/transporte a otro Estado miembro',
      'Documento de transporte'
    ],
    vat: 'Exento de IVA de importación; el IVA se liquida en el Estado miembro de destino (entrega intracomunitaria).',
    typical_use: 'Importación en España para reexpedir la mercancía a otro país de la UE sin pagar IVA en España.'
  },
  '44': {
    code: '44',
    name: 'Destino especial (uso final)',
    description: 'Despacho a libre práctica con exención o reducción de derechos por el destino específico de la mercancía (uso final autorizado).',
    requirements: [
      'Autorización de destino especial',
      'Factura comercial y documento de transporte',
      'Compromiso de dar a la mercancía el uso final declarado'
    ],
    vat: 'IVA de importación según reglas generales; los derechos pueden reducirse por el destino especial.',
    typical_use: 'Mercancía que se beneficia de un arancel reducido por su uso final (p. ej. determinados componentes industriales).'
  },
  '51': {
    code: '51',
    name: 'Perfeccionamiento activo',
    description: 'Introducción de mercancía no UE para transformarla y reexportarla, con suspensión de derechos e IVA de importación.',
    requirements: [
      'Autorización de perfeccionamiento activo',
      'Factura comercial y documento de transporte',
      'Garantía por los derechos suspendidos',
      'Contabilidad de existencias'
    ],
    vat: 'IVA de importación suspendido mientras dure el régimen.',
    typical_use: 'Importar materias primas para fabricar un producto que se reexportará fuera de la UE.'
  },
  '53': {
    code: '53',
    name: 'Importación temporal',
    description: 'Mercancía no UE que entra temporalmente con exención total o parcial de derechos e IVA, con obligación de reexportar sin transformación.',
    requirements: [
      'Autorización de importación temporal (o cuaderno ATA)',
      'Garantía por los derechos e IVA suspendidos',
      'Prueba del carácter temporal y compromiso de reexportación'
    ],
    vat: 'IVA de importación suspendido; se reexporta sin devengo si se cumplen las condiciones.',
    typical_use: 'Maquinaria o material de exposición/ferias que entra por un periodo limitado y vuelve a salir.'
  },
  '61': {
    code: '61',
    name: 'Reimportación (retorno de mercancía)',
    description: 'Reintroducción en la UE de mercancía previamente exportada, con exención de derechos si se cumplen las condiciones de retorno.',
    requirements: [
      'Prueba de la exportación previa (DUA/declaración de exportación)',
      'Factura comercial',
      'Prueba de que la mercancía es la misma y no ha sido transformada'
    ],
    vat: 'Exención de IVA de importación si se cumplen las condiciones de retorno; en caso contrario, IVA general.',
    typical_use: 'Devolución de mercancía exportada que no se vendió o fue rechazada por el cliente.'
  },
  '71': {
    code: '71',
    name: 'Depósito aduanero',
    description: 'Almacenamiento de mercancía no UE en un depósito aduanero con suspensión de derechos e IVA hasta su despacho o reexportación.',
    requirements: [
      'Autorización de depósito aduanero',
      'Garantía por los derechos e IVA suspendidos',
      'Contabilidad de existencias del depósito'
    ],
    vat: 'IVA de importación suspendido mientras la mercancía permanece en depósito.',
    typical_use: 'Almacenar mercancía importada sin pagar derechos hasta decidir su destino (venta UE o reexportación).'
  }
};

// Incoterms 2020: efecto en el valor en aduana y punto de entrega.
const INCOTERMS = {
  EXW: { code: 'EXW', name: 'Ex Works (En fábrica)', valueAdjustment: 'Añadir todos los costes hasta la frontera de la UE (transporte, seguro, carga).', deliveryPoint: 'En las instalaciones del vendedor.' },
  FCA: { code: 'FCA', name: 'Free Carrier (Franco transportista)', valueAdjustment: 'Añadir flete y seguro hasta la frontera de la UE.', deliveryPoint: 'Entregado al transportista designado.' },
  FOB: { code: 'FOB', name: 'Free On Board (Franco a bordo)', valueAdjustment: 'Añadir flete y seguro hasta la frontera de la UE.', deliveryPoint: 'A bordo del buque en el puerto de origen.' },
  CFR: { code: 'CFR', name: 'Cost and Freight (Coste y flete)', valueAdjustment: 'Incluye flete; añadir seguro hasta la frontera de la UE.', deliveryPoint: 'A bordo del buque; el flete lo paga el vendedor.' },
  CIF: { code: 'CIF', name: 'Cost, Insurance and Freight (Coste, seguro y flete)', valueAdjustment: 'Ya incluye flete y seguro hasta el puerto de destino.', deliveryPoint: 'A bordo del buque; flete y seguro pagados por el vendedor.' },
  CIP: { code: 'CIP', name: 'Carriage and Insurance Paid To (Transporte y seguro pagados hasta)', valueAdjustment: 'Ya incluye flete y seguro hasta el destino convenido.', deliveryPoint: 'Entregado al transportista; flete y seguro pagados.' },
  CPT: { code: 'CPT', name: 'Carriage Paid To (Transporte pagado hasta)', valueAdjustment: 'Incluye flete; añadir seguro hasta la frontera de la UE.', deliveryPoint: 'Entregado al transportista; flete pagado por el vendedor.' },
  DAP: { code: 'DAP', name: 'Delivered At Place (Entregado en lugar)', valueAdjustment: 'Restar los costes posteriores a la entrada en la UE incluidos en el precio.', deliveryPoint: 'En el lugar de destino convenido, sin descargar.' },
  DPU: { code: 'DPU', name: 'Delivered at Place Unloaded (Entregado en lugar descargado)', valueAdjustment: 'Restar los costes posteriores a la entrada en la UE incluidos en el precio.', deliveryPoint: 'En el lugar de destino, ya descargado.' },
  DDP: { code: 'DDP', name: 'Delivered Duty Paid (Entregado con derechos pagados)', valueAdjustment: 'Restar derechos e impuestos de importación incluidos en el precio.', deliveryPoint: 'En el destino final, con todos los trámites e impuestos pagados por el vendedor.' }
};

/** GET /api/knowledge/regime/:code */
const getRegime = (req, res) => {
  const code = String(req.params.code || '').trim();
  const info = REGIMES[code];
  if (!info) {
    return res.status(404).json({ error: `Régimen ${code} no encontrado`, code });
  }
  res.json(info);
};

/** GET /api/knowledge/incoterm/:code */
const getIncoterm = (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const info = INCOTERMS[code];
  if (!info) {
    return res.status(404).json({ error: `Incoterm ${code} no encontrado`, code });
  }
  res.json(info);
};

/** GET /api/knowledge/regimes — listado completo */
const listRegimes = (_req, res) => res.json({ regimes: Object.values(REGIMES) });

/** GET /api/knowledge/incoterms — listado completo */
const listIncoterms = (_req, res) => res.json({ incoterms: Object.values(INCOTERMS) });

module.exports = { getRegime, getIncoterm, listRegimes, listIncoterms, REGIMES, INCOTERMS };
