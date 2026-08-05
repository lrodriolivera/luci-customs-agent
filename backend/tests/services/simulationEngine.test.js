/**
 * SimulationEngine: motor de respuestas AEAT simuladas.
 *
 * Es lo que responde cuando LUCI corre SIN conexion real a la AEAT (demos,
 * pruebas, entornos sin certificado). Decide si una declaracion se acepta, por
 * que canal (verde/amarillo/naranja/rojo), que certificados o documentos pide y
 * que error devuelve. Si el motor validara mal el XML o asignara un canal que
 * no toca, la simulacion enseñaria al usuario un flujo que no se corresponde con
 * el real.
 *
 * El motor tiene dos fuentes de no-determinismo EXTERNAS a su logica: el reloj
 * (`new Date`) y `Math.random`. Ninguna de las dos es "el codigo bajo prueba":
 * son entradas del sistema. Para ejercitar las ramas de escenario y de canal de
 * forma deterministe se fija `Math.random` con una secuencia controlada (no se
 * mockea ningun metodo del propio motor) y, donde el codigo lo permite, se usa
 * su propio gancho `options.forceScenario`. Asi corre la logica real.
 *
 * El delay de red (`_simulateDelay`) usa setTimeout real; con jest.useFakeTimers
 * se avanza el reloj para no esperar 1,5 s por test.
 */

const SimulationEngine = require('../../src/services/aeat/simulationEngine');
const { INSPECTION_CHANNELS, RESPONSE_CODES } = require('../../src/services/aeat/aeatConfig');

/** XML H1 minimo que pasa todas las validaciones estructurales. */
function xmlH1Valido(extra = '') {
  return `<?xml version="1.0"?>
<CC515C>
  <LRN>26ESL0001</LRN>
  <DeclarationOfficeID>ES002801</DeclarationOfficeID>
  <Importer><IdentificationID>ESB12345678</IdentificationID></Importer>
  <GoodsItem><Classification><ID>84713000</ID></Classification></GoodsItem>
  <GrossMass>120</GrossMass>
  ${extra}
</CC515C>`;
}

/** XML AES minimo valido (exportacion). */
function xmlAESValido(extra = '') {
  return `<?xml version="1.0"?>
<CC515C>
  <LRN>26ESL0002</LRN>
  <DeclarationOfficeID>ES002801</DeclarationOfficeID>
  <Exporter><IdentificationID>ESB12345678</IdentificationID></Exporter>
  <CountryOfDestinationCode>US</CountryOfDestinationCode>
  <ExitOfficeID>ES002801</ExitOfficeID>
  ${extra}
</CC515C>`;
}

/**
 * Fija Math.random para que devuelva una secuencia dada (y luego repita el
 * ultimo valor). Devuelve el spy para restaurar.
 */
function fijarRandom(secuencia) {
  let i = 0;
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    const v = secuencia[Math.min(i, secuencia.length - 1)];
    i++;
    return v;
  });
}

describe('generadores de identificadores', () => {
  const engine = new SimulationEngine();

  test('MRN de importacion lleva prefijo IM y 20 caracteres', () => {
    const mrn = engine.generateMRN('H1');
    expect(mrn).toMatch(/^\d{2}ESIM[0-9A-Z]+$/);
    expect(mrn.startsWith(new Date().getFullYear().toString().slice(-2) + 'ESIM')).toBe(true);
  });

  test('MRN de exportacion (AES/export) lleva prefijo EX', () => {
    expect(engine.generateMRN('AES')).toMatch(/^\d{2}ESEX/);
    expect(engine.generateMRN('export')).toMatch(/^\d{2}ESEX/);
  });

  test('LRN empieza por AAESL', () => {
    expect(engine.generateLRN()).toMatch(/^\d{2}ESL[0-9A-F]{8}$/);
  });

  test('el digito de control es base-36 de un solo caracter', () => {
    const d = engine._calculateCheckDigit('26ESIMABCDEF1234');
    expect(d).toMatch(/^[0-9A-Z]$/);
  });

  test('el constructor respeta delayMs y errorRate de las options', () => {
    const e = new SimulationEngine({ delayMs: 10, errorRate: 0.5 });
    expect(e.delayMs).toBe(10);
    expect(e.errorRate).toBe(0.5);
  });
});

describe('_validateEORI', () => {
  test.each([
    ['ESB12345678', true],
    ['DE123456789012345', true],
    ['es b', false],         // minusculas + espacio no casan tras upper
    ['E12345', false],       // solo una letra de pais
    ['ESB1234567890123456789', false] // demasiado largo (>15 tras el pais)
  ])('%s -> %s', (eori, esperado) => {
    expect(new SimulationEngine()._validateEORI(eori)).toBe(esperado);
  });

  test('vacio o nulo es invalido', () => {
    const e = new SimulationEngine();
    expect(e._validateEORI('')).toBe(false);
    expect(e._validateEORI(null)).toBe(false);
  });
});

describe('_validateXmlStructure: errores y warnings', () => {
  const engine = new SimulationEngine();

  test('XML nulo o no-string es error 1000', () => {
    const r = engine._validateXmlStructure(null, 'H1');
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('1000');
  });

  test('sin raiz valida da error 1003', () => {
    const r = engine._validateXmlStructure('<?xml version="1.0"?><Otra><LRN>1</LRN></Otra>', 'H1');
    expect(r.errors.some(e => e.code === '1003')).toBe(true);
  });

  test('sin declaracion <?xml genera warning 4000 (pero no invalida)', () => {
    const xml = '<CC515C><LRN>26ESL1</LRN><DeclarationOfficeID>ES002801</DeclarationOfficeID><Importer><IdentificationID>ESB1</IdentificationID></Importer><GoodsItem><Classification><ID>84713000</ID></Classification></GoodsItem></CC515C>';
    const r = engine._validateXmlStructure(xml, 'H1');
    expect(r.warnings.some(w => w.code === '4000')).toBe(true);
  });

  test('sin LRN da error 1004', () => {
    const xml = '<?xml version="1.0"?><CC515C><DeclarationOfficeID>ES002801</DeclarationOfficeID><Importer><IdentificationID>ESB1</IdentificationID></Importer><GoodsItem><Classification><ID>84713000</ID></Classification></GoodsItem></CC515C>';
    const r = engine._validateXmlStructure(xml, 'H1');
    expect(r.errors.some(e => e.field === 'LRN')).toBe(true);
  });

  test('aduana no reconocida en catalogo da warning 4002', () => {
    const r = engine._validateXmlStructure(xmlH1Valido().replace('ES002801', 'ESRARO99'), 'H1');
    expect(r.warnings.some(w => w.code === '4002')).toBe(true);
  });

  test('sin DeclarationOfficeID da error 1004', () => {
    const xml = '<?xml version="1.0"?><CC515C><LRN>26ESL1</LRN><Importer><IdentificationID>ESB1</IdentificationID></Importer><GoodsItem><Classification><ID>84713000</ID></Classification></CC515C>';
    const r = engine._validateXmlStructure(xml, 'H1');
    expect(r.errors.some(e => e.field === 'DeclarationOfficeID')).toBe(true);
  });

  test('un XML H1 completo es valido', () => {
    expect(engine._validateXmlStructure(xmlH1Valido(), 'H1').valid).toBe(true);
  });
});

describe('_validateH1Specific', () => {
  const engine = new SimulationEngine();

  test('sin importador da error', () => {
    const errors = [], warnings = [];
    engine._validateH1Specific('<CC515C><GoodsItem/></CC515C>', errors, warnings);
    expect(errors.some(e => e.field === 'Importer')).toBe(true);
  });

  test('EORI del importador con formato invalido da error 2001', () => {
    const errors = [], warnings = [];
    engine._validateH1Specific('<Importer><IdentificationID>x</IdentificationID></Importer><GoodsItem><Classification><ID>84713000</ID></Classification></GoodsItem>', errors, warnings);
    expect(errors.some(e => e.code === '2001')).toBe(true);
  });

  test('sin partidas de mercancia da error', () => {
    const errors = [], warnings = [];
    engine._validateH1Specific('<Importer><IdentificationID>ESB1</IdentificationID></Importer>', errors, warnings);
    expect(errors.some(e => e.field === 'GoodsItems')).toBe(true);
  });

  test('TARIC demasiado corto da warning 2002', () => {
    const errors = [], warnings = [];
    engine._validateH1Specific('<Importer><IdentificationID>ESB1</IdentificationID></Importer><GoodsItem><Classification><ID>847</ID></Classification></GoodsItem>', errors, warnings);
    expect(warnings.some(w => w.code === '2002')).toBe(true);
  });

  test('peso bruto no positivo da error 2004', () => {
    const errors = [], warnings = [];
    engine._validateH1Specific(xmlH1Valido().replace('<GrossMass>120</GrossMass>', '<GrossMass>0</GrossMass>'), errors, warnings);
    expect(errors.some(e => e.code === '2004')).toBe(true);
  });
});

describe('_validateAESSpecific', () => {
  const engine = new SimulationEngine();

  test('sin exportador da error', () => {
    const errors = [], warnings = [];
    engine._validateAESSpecific('<CC515C></CC515C>', errors, warnings);
    expect(errors.some(e => e.field === 'Exporter')).toBe(true);
  });

  test('sin pais destino da error', () => {
    const errors = [], warnings = [];
    engine._validateAESSpecific('<Exporter><IdentificationID>ESB1</IdentificationID></Exporter>', errors, warnings);
    expect(errors.some(e => e.field === 'CountryOfDestination')).toBe(true);
  });

  test('EORI de exportador invalido da error 2001', () => {
    const errors = [], warnings = [];
    engine._validateAESSpecific('<Exporter><IdentificationID>1</IdentificationID></Exporter><CountryOfDestinationCode>US</CountryOfDestinationCode><ExitOfficeID>ES1</ExitOfficeID>', errors, warnings);
    expect(errors.some(e => e.code === '2001')).toBe(true);
  });

  test('sin ExitOfficeID da warning 4003', () => {
    const errors = [], warnings = [];
    engine._validateAESSpecific('<Exporter><IdentificationID>ESB1</IdentificationID></Exporter><CountryOfDestinationCode>US</CountryOfDestinationCode>', errors, warnings);
    expect(warnings.some(w => w.code === '4003')).toBe(true);
  });
});

describe('_determineScenario: seleccion por valor/origen/TARIC', () => {
  const engine = new SimulationEngine({ errorRate: 0.05 });

  afterEach(() => jest.restoreAllMocks());

  test('la tasa de error dispara random_error', () => {
    fijarRandom([0.01]); // < errorRate 0.05
    expect(engine._determineScenario(xmlH1Valido(), {})).toBe('random_error');
  });

  test('valor > 100.000 con random bajo -> inspeccion por alto valor', () => {
    fijarRandom([0.9, 0.1]); // 1º no dispara error; 2º < 0.4
    const xml = xmlH1Valido('<TotalInvoiceAmount>150000</TotalInvoiceAmount>');
    expect(engine._determineScenario(xml, {})).toBe('high_value_inspection');
  });

  test('valor > 100.000 con random alto -> success_with_warnings', () => {
    fijarRandom([0.9, 0.9]);
    const xml = xmlH1Valido('<TotalInvoiceAmount>150000</TotalInvoiceAmount>');
    expect(engine._determineScenario(xml, {})).toBe('success_with_warnings');
  });

  test('valor entre 50k y 100k con random alto -> success', () => {
    fijarRandom([0.9, 0.9]);
    const xml = xmlH1Valido('<TotalInvoiceAmount>60000</TotalInvoiceAmount>');
    expect(engine._determineScenario(xml, {})).toBe('success');
  });

  test('origen de riesgo (CN) con random bajo -> origin_review', () => {
    fijarRandom([0.9, 0.1]); // <0.25
    const xml = xmlH1Valido('<CountryOfDispatchCode>CN</CountryOfDispatchCode>');
    expect(engine._determineScenario(xml, {})).toBe('origin_review');
  });

  test('TARIC sensible (cap. 22, bebidas) con random bajo -> certificate_required', () => {
    fijarRandom([0.9, 0.1]); // <0.30
    const xml = xmlH1Valido('<Classification><ID>22030000</ID></Classification>');
    expect(engine._determineScenario(xml, {})).toBe('certificate_required');
  });

  test('caso normal -> success', () => {
    fijarRandom([0.9]);
    const xml = xmlH1Valido('<Classification><ID>94036000</ID></Classification>'); // cap 94 no sensible
    expect(engine._determineScenario(xml, {})).toBe('success');
  });
});

describe('_executeScenario: cada rama arma su respuesta', () => {
  const engine = new SimulationEngine();

  afterEach(() => jest.restoreAllMocks());

  test('success: acepta, asigna canal y genera derechos en H1', () => {
    fijarRandom([0.0]); // canal verde (random < 0.7)
    const r = engine._executeScenario('success', xmlH1Valido(), 'H1', []);
    expect(r.success).toBe(true);
    expect(r.status).toBe('accepted');
    expect(r.channel).toBe('green');
    expect(r.duties).not.toBeNull();
    expect(r.aeatResponse.code).toBe('0000');
    expect(r.nextSteps.length).toBeGreaterThan(0);
  });

  test('success en AES no genera duties pero si exportInfo', () => {
    fijarRandom([0.0]);
    const r = engine._executeScenario('success', xmlAESValido(), 'AES', []);
    expect(r.duties).toBeNull();
    expect(r.exportInfo).not.toBeNull();
    expect(r.exportInfo.mrn_status).toBe('awaiting_exit');
  });

  test('success_with_warnings: estado accepted_warnings y bloque warnings', () => {
    fijarRandom([0.0]);
    const r = engine._executeScenario('success_with_warnings', xmlH1Valido(), 'H1', []);
    expect(r.status).toBe('accepted_warnings');
    expect(r.warnings[0].code).toBe('4000');
    expect(r.aeatResponse.code).toBe('0002');
  });

  test('high_value_inspection: canal naranja, motivo y documentos', () => {
    const r = engine._executeScenario('high_value_inspection', xmlH1Valido(), 'H1', []);
    expect(r.channel).toBe('orange');
    expect(r.inspectionReason).toMatch(/valor/i);
    expect(r.documentRequest.length).toBe(3);
    expect(r.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('origin_review: canal naranja por origen', () => {
    const r = engine._executeScenario('origin_review', xmlH1Valido(), 'H1', []);
    expect(r.channel).toBe('orange');
    expect(r.inspectionReason).toMatch(/origen/i);
  });

  test('certificate_required: canal amarillo, certificados y autoridades', () => {
    const r = engine._executeScenario('certificate_required', xmlH1Valido(), 'H1', []);
    expect(r.channel).toBe('yellow');
    expect(r.status).toBe('pending_documents');
    expect(r.pendingCertificates.length).toBeGreaterThanOrEqual(1);
    expect(r.controlAuthorities.length).toBeGreaterThanOrEqual(1);
    expect(r.aeatResponse.code).toBe('0001');
  });

  test('random_error: no exito, sin canal, con errorDetails', () => {
    fijarRandom([0.0]); // elige el primer codigo de error (2001)
    const r = engine._executeScenario('random_error', xmlH1Valido(), 'H1', []);
    expect(r.success).toBe(false);
    expect(r.channel).toBeNull();
    expect(r.aeatResponse.code).toBe('2001');
    expect(r.errorDetails.field).toBe('Importer.EORI');
  });

  test('escenario desconocido cae a success', () => {
    fijarRandom([0.0]);
    const r = engine._executeScenario('inventado', xmlH1Valido(), 'H1', []);
    expect(r.success).toBe(true);
    expect(r.status).toBe('accepted');
  });

  test('adjunta validationWarnings cuando los hay', () => {
    fijarRandom([0.0]);
    const warns = [{ code: '4002', message: 'x' }];
    const r = engine._executeScenario('success', xmlH1Valido(), 'H1', warns);
    expect(r.validationWarnings).toEqual(warns);
  });

  test('el MRN y LRN salen en la respuesta; LRN se extrae del XML', () => {
    fijarRandom([0.0]);
    const r = engine._executeScenario('success', xmlH1Valido(), 'H1', []);
    expect(r.lrn).toBe('26ESL0001'); // el del XML, no uno generado
    expect(r.customsOffice).toBe('ES002801');
    expect(r.customsOfficeName).toBe('Barcelona - Puerto');
  });
});

describe('_assignChannel: distribucion de canales', () => {
  const engine = new SimulationEngine();
  afterEach(() => jest.restoreAllMocks());

  test('random 0 -> verde; medio -> naranja; alto -> rojo', () => {
    fijarRandom([0.0]);
    expect(engine._assignChannel().code).toBe('green');
    jest.restoreAllMocks();
    fijarRandom([0.8]); // 0.7 <= 0.8 < 0.95
    expect(engine._assignChannel().code).toBe('orange');
    jest.restoreAllMocks();
    fijarRandom([0.99]);
    expect(engine._assignChannel().code).toBe('red');
  });

  test('con sesgo naranja: bajo -> verde, medio -> naranja, alto -> rojo', () => {
    fijarRandom([0.1]); // < 1 - 0.5 - 0.05 = 0.45
    expect(engine._assignChannel({ biasToward: 'orange', orangeProbability: 0.5 }).code).toBe('green');
    jest.restoreAllMocks();
    fijarRandom([0.7]); // entre 0.45 y 0.95
    expect(engine._assignChannel({ biasToward: 'orange', orangeProbability: 0.5 }).code).toBe('orange');
    jest.restoreAllMocks();
    fijarRandom([0.99]);
    expect(engine._assignChannel({ biasToward: 'orange', orangeProbability: 0.5 }).code).toBe('red');
  });
});

describe('helpers de fechas y derechos', () => {
  const engine = new SimulationEngine();
  afterEach(() => jest.restoreAllMocks());

  test('_calculateDeadline devuelve solo dias habiles (nunca sabado/domingo)', () => {
    const fecha = engine._calculateDeadline(10);
    const dia = new Date(fecha).getUTCDay();
    expect(dia).not.toBe(0);
    expect(dia).not.toBe(6);
  });

  test('_generateDuties de alto valor produce importes mayores y cuadra el total', () => {
    fijarRandom([0.5]);
    const d = engine._generateDuties(true);
    expect(d.currency).toBe('EUR');
    expect(d.totalAmount).toBeCloseTo(d.dutyAmount + d.vatAmount, 1);
    expect(d.breakdown.vatRate).toBe(21);
  });

  test('_generatePendingCertificates devuelve 1 o 2 certificados', () => {
    fijarRandom([0.9]); // > 0.5 -> count 2
    const certs = engine._generatePendingCertificates();
    expect(certs.length).toBe(2);
    expect(certs[0]).toHaveProperty('authority');
  });

  test('_getNextSteps por canal, con fallback a green', () => {
    expect(engine._getNextSteps('red', 'H1')[0]).toMatch(/retenida/i);
    expect(engine._getNextSteps('yellow', 'H1')[0]).toMatch(/certificados/i);
    expect(engine._getNextSteps('canalinventado', 'H1')).toEqual(engine._getNextSteps('green', 'H1'));
  });
});

describe('extractores de XML', () => {
  const engine = new SimulationEngine();

  test('_extractValue lee etiquetas con y sin namespace', () => {
    expect(engine._extractValue('<LRN>ABC</LRN>', 'LRN')).toBe('ABC');
    expect(engine._extractValue('<ns:LRN>XYZ</ns:LRN>', 'LRN')).toBe('XYZ');
    expect(engine._extractValue('<Otra>1</Otra>', 'LRN')).toBeNull();
  });

  test('_extractNumericValue limpia el formato y devuelve null si no hay numero', () => {
    expect(engine._extractNumericValue('<Amt>1.234,00 EUR</Amt>', 'Amt')).not.toBeNull();
    expect(engine._extractNumericValue('<Amt>abc</Amt>', 'Amt')).toBeNull();
    expect(engine._extractNumericValue('<Otra>1</Otra>', 'Amt')).toBeNull();
  });

  test('_extractAllTaricCodes deduplica y descarta codigos cortos', () => {
    const xml = '<Classification><ID>84713000</ID></Classification><ClassificationID>84713000</ClassificationID><TARIC>123</TARIC>';
    const codes = engine._extractAllTaricCodes(xml);
    expect(codes).toContain('84713000');
    expect(codes).not.toContain('123'); // <8 digitos
    expect(new Set(codes).size).toBe(codes.length); // sin duplicados
  });
});

describe('flujos async completos (con timers falsos)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  async function resolverConDelay(promesa) {
    await jest.runOnlyPendingTimersAsync();
    return promesa;
  }

  test('simulateH1Submission con XML invalido devuelve error de validacion', async () => {
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateH1Submission('no es xml valido'));
    expect(r.success).toBe(false);
    expect(r.status).toBe('validation_error');
    expect(r.errorCount).toBeGreaterThan(0);
  });

  test('simulateH1Submission con XML valido y forceScenario success -> aceptada', async () => {
    fijarRandom([0.0]);
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateH1Submission(xmlH1Valido(), { forceScenario: 'success' }));
    expect(r.success).toBe(true);
    expect(r.declarationType).toBe('H1');
  });

  test('simulateAESSubmission con forceScenario success -> aceptada con exportInfo', async () => {
    fijarRandom([0.0]);
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateAESSubmission(xmlAESValido(), { forceScenario: 'success' }));
    expect(r.success).toBe(true);
    expect(r.exportInfo).not.toBeNull();
  });

  test('simulateQueryStatus con MRN corto es invalido', async () => {
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateQueryStatus('123'));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/invalido/i);
  });

  test('simulateQueryStatus devuelve un estado determinista por hash del MRN', async () => {
    const engine = new SimulationEngine({ delayMs: 500 });
    const mrn = '26ESIMABCDEF12340';
    const r1 = await resolverConDelay(engine.simulateQueryStatus(mrn));
    expect(r1.success).toBe(true);
    expect(r1.mrn).toBe(mrn);
    expect(r1.history.length).toBe(3);
    // Mismo MRN -> mismo estado (el hash es determinista).
    const r2 = await resolverConDelay(engine.simulateQueryStatus(mrn));
    expect(r2.status).toBe(r1.status);
  });

  test('simulateCancelDeclaration exito (random alto) -> cancelled', async () => {
    fijarRandom([0.9]); // > 0.1 -> exito
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateCancelDeclaration('26ESIMABCDEF1234', 'error de datos'));
    expect(r.success).toBe(true);
    expect(r.status).toBe('cancelled');
    expect(r.reason).toBe('error de datos');
  });

  test('simulateCancelDeclaration rechazo (random bajo) -> cancellation_rejected', async () => {
    fijarRandom([0.0]); // < 0.1 -> rechazo
    const engine = new SimulationEngine({ delayMs: 500 });
    const r = await resolverConDelay(engine.simulateCancelDeclaration('26ESIMABCDEF1234', 'x'));
    expect(r.success).toBe(false);
    expect(r.status).toBe('cancellation_rejected');
  });
});
