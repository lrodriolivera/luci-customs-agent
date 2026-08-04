/**
 * xmlParser: parser de las respuestas XML que devuelve la AEAT.
 *
 * Logica PURA salvo el logger (que solo registra, no altera el flujo). Es el
 * codigo que interpreta la respuesta de la AEAT tras presentar una declaracion:
 * saca el MRN, el canal de inspeccion (verde/naranja/rojo), los errores
 * funcionales y los tributos liquidados. Un fallo aqui da por aceptada una
 * declaracion rechazada (o al reves) y lee mal el canal que decide si la
 * mercancia sale sola o va a inspeccion fisica. Se prueban los tres parsers y
 * los extractores por regex con sus multiples formatos (ES/EN, con/sin
 * namespace, CDATA).
 *
 * NO se mockea el parser: es justo el codigo bajo prueba. aeatConfig son
 * constantes reales del proyecto.
 */

const parser = require('../../../src/services/aeat/xmlParser');

describe('parseSubmissionResponse', () => {
  test('una respuesta vacia o no-string es un error de parseo controlado', () => {
    expect(parser.parseSubmissionResponse('').success).toBe(false);
    expect(parser.parseSubmissionResponse(null).status).toBe('parse_error');
    expect(parser.parseSubmissionResponse(42).errors[0].code).toBe('EMPTY_RESPONSE');
  });

  test('codigo 0000 -> aceptada, con MRN y canal traducido', () => {
    const xml = `<?xml version="1.0"?><R>
      <MRN>26ES00460199R1234567</MRN>
      <ResponseCode>0000</ResponseCode>
      <InspectionChannel>green</InspectionChannel>
    </R>`;
    const r = parser.parseSubmissionResponse(xml);

    expect(r.success).toBe(true);
    expect(r.status).toBe('accepted');
    expect(r.mrn).toBe('26ES00460199R1234567');
    expect(r.channel).toBe('green');
    expect(r.channelLabel).toBe('Canal Verde');
  });

  test('lee tambien los tags en castellano (CodigoRespuesta, CanalInspeccion)', () => {
    const xml = `<?xml version="1.0"?><R>
      <MovementReferenceNumber>26ESX</MovementReferenceNumber>
      <CodigoRespuesta>0000</CodigoRespuesta>
      <Canal>red</Canal>
    </R>`;
    const r = parser.parseSubmissionResponse(xml);
    expect(r.mrn).toBe('26ESX');
    expect(r.responseCode).toBe('0000');
  });

  test('un codigo desconocido se marca como unknown pero no revienta', () => {
    const xml = `<?xml version="1.0"?><R><ResponseCode>9999</ResponseCode></R>`;
    const r = parser.parseSubmissionResponse(xml);

    expect(r.status).toBe('unknown');
    expect(r.responseDescription).toMatch(/desconocido/i);
  });

  test('sin errores y con MRN se considera exito aunque el codigo no sea de aceptacion', () => {
    const xml = `<?xml version="1.0"?><R><MRN>26ESYY</MRN></R>`;
    const r = parser.parseSubmissionResponse(xml);
    expect(r.success).toBeTruthy();
  });

  test('trunca la respuesta cruda a 5000 caracteres', () => {
    const xml = '<?xml version="1.0"?><R><MRN>1</MRN>' + '<x>' + 'A'.repeat(6000) + '</x></R>';
    const r = parser.parseSubmissionResponse(xml);
    expect(r.rawResponse.endsWith('...[truncated]')).toBe(true);
  });
});

describe('parseQueryResponse', () => {
  test('respuesta vacia -> parse_error', () => {
    const r = parser.parseQueryResponse('');
    expect(r.success).toBe(false);
    expect(r.status).toBe('parse_error');
  });

  test('extrae estado, canal y fecha de levante y traduce el estado', () => {
    const xml = `<?xml version="1.0"?><R>
      <MRN>26ES1</MRN>
      <Status>released</Status>
      <Channel>green</Channel>
      <ReleaseDate>2026-08-04</ReleaseDate>
    </R>`;
    const r = parser.parseQueryResponse(xml);

    expect(r.success).toBe(true);
    expect(r.status).toBe('released');
    expect(r.statusDescription).toBe('Levante autorizado');
    expect(r.releaseDate).toBe('2026-08-04');
  });
});

describe('parseCancelResponse', () => {
  test('codigo 0000 -> anulacion aceptada', () => {
    const r = parser.parseCancelResponse('<R><ResponseCode>0000</ResponseCode><CancellationDate>2026-08-04</CancellationDate></R>');
    expect(r.success).toBe(true);
    expect(r.cancellationDate).toBe('2026-08-04');
  });

  test('CancellationAccepted=true tambien cuenta como aceptada', () => {
    const r = parser.parseCancelResponse('<R><CancellationAccepted>true</CancellationAccepted></R>');
    expect(r.success).toBe(true);
  });

  test('otro codigo -> no aceptada', () => {
    const r = parser.parseCancelResponse('<R><ResponseCode>1004</ResponseCode></R>');
    expect(r.success).toBe(false);
  });
});

describe('_extractValue: multiples formatos', () => {
  test('extrae un tag sin namespace', () => {
    expect(parser._extractValue('<MRN>26ES</MRN>', 'MRN')).toBe('26ES');
  });

  test('extrae un tag con prefijo de namespace', () => {
    expect(parser._extractValue('<ns:MRN>26ES</ns:MRN>', 'MRN')).toBe('26ES');
  });

  test('extrae un tag con atributos', () => {
    expect(parser._extractValue('<MRN lang="es">26ES</MRN>', 'MRN')).toBe('26ES');
  });

  test('extrae contenido CDATA', () => {
    expect(parser._extractValue('<Desc><![CDATA[texto libre]]></Desc>', 'Desc')).toBe('texto libre');
  });

  test('un tag ausente devuelve null', () => {
    expect(parser._extractValue('<R></R>', 'MRN')).toBeNull();
  });

  test('_extractAllValues devuelve todos los valores no vacios de un tag repetido', () => {
    const vals = parser._extractAllValues('<L><Item>A</Item><Item></Item><Item>B</Item></L>', 'Item');
    expect(vals).toEqual(['A', 'B']);
  });
});

describe('_extractErrors: los tres patrones AEAT', () => {
  test('patron Error/Code/Description enriquece con RESPONSE_CODES', () => {
    const errs = parser._extractErrors('<Error><Code>1000</Code><Description>Formato malo</Description></Error>');

    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe('1000');
    expect(errs[0].severity).toBe('error'); // viene de RESPONSE_CODES[1000]
  });

  test('patron FunctionalError (ErrorCode/ErrorReason)', () => {
    const errs = parser._extractErrors('<FunctionalError><ErrorCode>E1</ErrorCode><ErrorReason>Motivo</ErrorReason></FunctionalError>');
    expect(errs[0]).toEqual(expect.objectContaining({ code: 'E1', message: 'Motivo' }));
  });

  test('patron ErrorMessage simple', () => {
    const errs = parser._extractErrors('<ErrorMessage>Algo fallo</ErrorMessage>');
    expect(errs[0]).toEqual({ code: 'ERROR', message: 'Algo fallo' });
  });

  test('sin errores devuelve lista vacia', () => {
    expect(parser._extractErrors('<R><MRN>1</MRN></R>')).toEqual([]);
  });
});

describe('_extractWarnings', () => {
  test('extrae advertencias con Code + Message/Description', () => {
    const w = parser._extractWarnings('<Warning><Code>W1</Code><Message>Aviso</Message></Warning>');
    expect(w[0]).toEqual({ code: 'W1', message: 'Aviso' });
  });
});

describe('_extractDuties y _extractNumeric', () => {
  test('agrega derechos, IVA y total (con moneda por defecto EUR)', () => {
    const xml = '<R><DutyAmount>100.50</DutyAmount><VATAmount>250.00</VATAmount></R>';
    const d = parser._extractDuties(xml);

    expect(d.dutyAmount).toBe(100.5);
    expect(d.vatAmount).toBe(250);
    expect(d.totalAmount).toBe(350.5); // se calcula si no viene TotalAmount
    expect(d.currency).toBe('EUR');
  });

  test('sin ningun importe devuelve null', () => {
    expect(parser._extractDuties('<R><MRN>1</MRN></R>')).toBeNull();
  });

  test('_extractNumeric limpia simbolos de moneda y devuelve numero', () => {
    expect(parser._extractNumeric('<A>1500.75 EUR</A>', 'A')).toBe(1500.75);
  });

  test('_extractNumeric devuelve null cuando no hay digitos o el tag falta', () => {
    expect(parser._extractNumeric('<A>EUR</A>', 'A')).toBeNull();
    expect(parser._extractNumeric('<R></R>', 'A')).toBeNull();
  });
});

describe('_getStatusDescription', () => {
  test('traduce los estados conocidos', () => {
    expect(parser._getStatusDescription('accepted')).toBe('Declaracion aceptada');
    expect(parser._getStatusDescription('HELD')).toBe('Retenida'); // insensible a mayusculas
  });

  test('un estado desconocido se devuelve tal cual', () => {
    expect(parser._getStatusDescription('marciano')).toBe('marciano');
  });
});

describe('validateXmlStructure', () => {
  test('un XML nulo es invalido', () => {
    const r = parser.validateXmlStructure(null);
    expect(r.valid).toBe(false);
    expect(r.issues[0]).toMatch(/vacio/);
  });

  test('detecta falta de declaracion XML y de elemento raiz', () => {
    const r = parser.validateXmlStructure('<Otro></Otro>', 'CC515C');
    expect(r.issues.some(i => /declaracion XML/.test(i))).toBe(true);
    expect(r.issues.some(i => /raiz/.test(i))).toBe(true);
  });

  test('un XML bien formado con el raiz esperado es valido', () => {
    const r = parser.validateXmlStructure('<?xml version="1.0"?><CC515C><a>1</a></CC515C>', 'CC515C');
    expect(r.valid).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  test('detecta un & sin escapar', () => {
    const r = parser.validateXmlStructure('<?xml version="1.0"?><CC515C>Tom & Jerry</CC515C>', 'CC515C');
    expect(r.issues.some(i => /sin escapar/.test(i))).toBe(true);
  });

  test('detecta un desbalance grosero de tags de apertura/cierre', () => {
    // Muchas aperturas sin cierre (>5 de diferencia) -> issue de desbalance.
    const xml = '<?xml version="1.0"?><CC515C><a><b><c><d><e><f><g></CC515C>';
    const r = parser.validateXmlStructure(xml, 'CC515C');
    expect(r.issues.some(i => /desbalance/.test(i))).toBe(true);
  });
});

describe('parseSoapResponse', () => {
  test('extrae el body SOAP y parsea el contenido', () => {
    const soap = `<soapenv:Envelope><soapenv:Body>
      <R><MRN>26ES1</MRN><ResponseCode>0000</ResponseCode></R>
    </soapenv:Body></soapenv:Envelope>`;
    const r = parser.parseSoapResponse(soap);

    expect(r.success).toBe(true);
    expect(r.mrn).toBe('26ES1');
  });

  test('un SOAP Fault se traduce a error controlado', () => {
    const soap = `<soapenv:Envelope><soapenv:Body>
      <soapenv:Fault><faultcode>Server</faultcode><faultstring>Boom</faultstring></soapenv:Fault>
    </soapenv:Body></soapenv:Envelope>`;
    const r = parser.parseSoapResponse(soap);

    expect(r.success).toBe(false);
    expect(r.status).toBe('soap_fault');
    expect(r.errors[0].message).toBe('Boom');
  });

  test('sin envelope SOAP cae al parser de submission directo', () => {
    const r = parser.parseSoapResponse('<?xml version="1.0"?><R><MRN>26ES1</MRN></R>');
    expect(r.mrn).toBe('26ES1');
  });
});
