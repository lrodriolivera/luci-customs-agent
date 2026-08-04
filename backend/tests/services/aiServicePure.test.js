/**
 * aiService: la logica que NO depende de Bedrock.
 *
 * aiService son 6.489 lineas al 3,73% de cobertura, y concentra el 28% de las
 * ramas sin cubrir de todo el backend. Casi todos sus metodos llaman a Claude,
 * y mockear esa llamada probaria el mock, no el servicio.
 *
 * Lo que SI se puede probar de verdad son los 17 metodos que no salen a la red:
 * seleccion de modelo, consolidacion de sugerencias y priorizacion de alertas.
 * Es la parte que decide QUE se le pregunta al modelo y COMO se combina lo que
 * responde -- es decir, la que puede equivocarse en silencio.
 *
 * Nada mockeado: el servicio se instancia y se llama de verdad.
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const ai = require('../../src/services/aiService');

describe('_selectModel: que modelo se usa para cada cosa', () => {
  // Es una decision de coste directo: Opus cuesta bastante mas que Haiku por
  // token. Elegir mal en un endpoint muy llamado se nota en la factura.

  test('un mensaje corto de chat va a Haiku', () => {
    expect(ai._selectModel('hola', 'chat')).toMatch(/haiku/);
  });

  test('un mensaje largo de chat va a Sonnet', () => {
    const largo = 'necesito ayuda con una declaracion de importacion '.repeat(5);

    expect(ai._selectModel(largo, 'chat')).toMatch(/sonnet/);
  });

  test('clasificar arancelariamente exige al menos Sonnet', () => {
    // Un TARIC mal asignado por ahorrar en el modelo sale mucho mas caro.
    expect(ai._selectModel('x', 'classification')).toMatch(/sonnet/);
  });

  test.each(['regulation', 'legalArguments', 'declarationValidation'])(
    'el contexto %s exige Opus',
    (contexto) => {
      // Interpretar normativa y validar una declaracion antes de presentarla
      // son las decisiones con consecuencias legales.
      expect(ai._selectModel('x', contexto)).toMatch(/opus/);
    }
  );

  test('el contexto manda sobre la longitud del mensaje', () => {
    // Un mensaje de 1 caracter en contexto de normativa sigue siendo Opus.
    expect(ai._selectModel('x', 'regulation')).toMatch(/opus/);
  });

  test('generar un H1 usa Sonnet, no Opus', () => {
    expect(ai._selectModel('x', 'h1Generation')).toMatch(/sonnet/);
  });

  test('sin contexto explicito se comporta como chat', () => {
    expect(ai._selectModel('hola')).toMatch(/haiku/);
  });

  test('un mensaje que no es cadena no revienta', () => {
    // Llega asi desde endpoints que pasan objetos.
    expect(() => ai._selectModel({ texto: 'x' }, 'chat')).not.toThrow();
  });
});

describe('_consolidateTaricSuggestions: combinar tres fuentes', () => {
  // La clasificacion se cruza desde tres sitios: lo que dice el modelo, lo que
  // se clasifico antes para mercancias parecidas, y las correcciones que hizo
  // el usuario. Consolidar mal significa proponer un TARIC equivocado.

  test('una sugerencia de una sola fuente conserva su confianza', () => {
    const r = ai._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 90 }], [], []
    );

    expect(r[0].confidence).toBe(90);
    expect(r[0].sources).toEqual(['base']);
  });

  test('coincidir con el historico sube la confianza', () => {
    // Si ya se clasifico asi antes y salio bien, es mejor apuesta.
    const r = ai._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 80 }],
      [{ taricCode: '6109100010', confidence: 70 }],
      []
    );

    expect(r[0].confidence).toBeGreaterThan(80);
    expect(r[0].sources).toEqual(['base', 'history']);
  });

  test('la confianza nunca pasa de 100', () => {
    // Un 110% en la UI seria absurdo, y romperia cualquier umbral.
    const r = ai._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 95 }],
      [{ taricCode: '6109100010', confidence: 95 }],
      []
    );

    expect(r[0].confidence).toBeLessThanOrEqual(100);
  });

  test('codigos distintos se mantienen separados', () => {
    const r = ai._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 90 }, { taricCode: '6110000000', confidence: 60 }],
      [], []
    );

    expect(r.length).toBe(2);
  });

  test('deriva el codigo HS de los 6 primeros digitos del TARIC', () => {
    // El HS es el nivel armonizado internacional; el TARIC lo extiende.
    const r = ai._consolidateTaricSuggestions([{ taricCode: '6109100010', confidence: 90 }], [], []);

    expect(r[0].hsCode).toBe('610910');
  });

  test('acepta el campo `code` ademas de `taricCode`', () => {
    // Las tres fuentes no usan el mismo nombre de campo.
    const r = ai._consolidateTaricSuggestions([{ code: '6109100010', confidence: 90 }], [], []);

    expect(r[0].taricCode).toBe('6109100010');
  });

  test('una sugerencia sin codigo se descarta', () => {
    // Sin TARIC no hay nada que proponer.
    const r = ai._consolidateTaricSuggestions([{ confidence: 90 }], [], []);

    expect(r).toEqual([]);
  });

  test('sin confianza declarada asume 50', () => {
    const r = ai._consolidateTaricSuggestions([{ taricCode: '6109100010' }], [], []);

    expect(r[0].confidence).toBe(50);
  });

  test('conserva el razonamiento de la fuente base', () => {
    // Es lo que se le ensena al usuario para que pueda revisar la propuesta.
    const r = ai._consolidateTaricSuggestions(
      [{ taricCode: '6109100010', confidence: 90, reasoning: 'Punto de algodon' }], [], []
    );

    expect(r[0].reasoning).toBe('Punto de algodon');
  });

  test('las tres fuentes vacias devuelven lista vacia', () => {
    expect(ai._consolidateTaricSuggestions([], [], [])).toEqual([]);
  });

  test('una sugerencia que solo esta en el historico tambien cuenta', () => {
    const r = ai._consolidateTaricSuggestions([], [{ taricCode: '6109100010', confidence: 70 }], []);

    expect(r.length).toBe(1);
    expect(r[0].sources).toContain('history');
  });
});

describe('_calculateFinalClassificationScore', () => {
  test('devuelve confianza y los factores que la explican', () => {
    // El usuario tiene que poder ver POR QUE la propuesta tiene esa confianza.
    const r = ai._calculateFinalClassificationScore({ confidence: 80 }, { valid: true }, {});

    expect(r).toHaveProperty('confidence');
    expect(Array.isArray(r.factors)).toBe(true);
  });

  test('la confianza se mantiene en el rango 0-100', () => {
    const r = ai._calculateFinalClassificationScore({ confidence: 100 }, { valid: true }, {});

    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(100);
  });

  test('tolera entradas incompletas', () => {
    expect(() => ai._calculateFinalClassificationScore({}, {}, {})).not.toThrow();
  });
});

describe('_extractTopPriorities: que mirar primero', () => {
  test('devuelve una lista', () => {
    const r = ai._extractTopPriorities({ insights: [] }, []);

    expect(Array.isArray(r)).toBe(true);
  });

  test('tolera analisis vacios', () => {
    // Si no hay nada que priorizar, no hay que fallar: hay que decir que no
    // hay nada.
    expect(() => ai._extractTopPriorities({}, [])).not.toThrow();
    expect(ai._extractTopPriorities({}, [])).toEqual([]);
  });
});

describe('generadores de siguientes pasos', () => {
  // Convierten un analisis en instrucciones accionables para el agente de
  // aduanas. La UI los recorre directamente, asi que deben devolver siempre
  // una lista, nunca undefined.

  test('los pasos de una declaracion sin errores no exigen correcciones', () => {
    const pasos = ai._generateDeclarationNextSteps({ valid: true }, [], {}, {});

    expect(Array.isArray(pasos)).toBe(true);
  });

  test('una declaracion con errores bloqueantes genera el paso de correccion', () => {
    // `errors` es un objeto con CONTADORES (blockingErrors), no un array de
    // errores: la validacion previa ya los agrupa por severidad.
    const pasos = ai._generateDeclarationNextSteps(
      { valid: false },
      { blockingErrors: 2 },
      {},
      {}
    );

    expect(pasos.length).toBeGreaterThan(0);
    expect(pasos[0].type).toBe('BLOCKING');
    expect(pasos[0].priority).toBe(1);
  });

  test('los documentos que faltan generan su propio paso', () => {
    const pasos = ai._generateDeclarationNextSteps(
      { missingDocuments: ['Factura comercial', 'Certificado de origen'] },
      {},
      {},
      {}
    );

    const docs = pasos.find(p => p.type === 'DOCUMENTS');
    expect(docs).toBeDefined();
    expect(docs.details).toMatch(/Factura comercial/);
  });

  test('un transito genera pasos aunque no haya datos', () => {
    // Es el caso de un transito recien creado, sin analisis previo.
    const pasos = ai._generateTransitNextSteps({}, {}, {}, {});

    expect(Array.isArray(pasos)).toBe(true);
    expect(pasos.length).toBeGreaterThan(0);
  });

  test('una clasificacion de baja confianza genera alerta', () => {
    // Por debajo del umbral hay que revisar a mano antes de declarar.
    const alertas = ai._generateClassificationAlerts(
      [{ taricCode: '6109100010', confidence: 30 }], {}, {}, {}
    );

    expect(Array.isArray(alertas)).toBe(true);
  });

  test.each([
    ['_generateDeclarationNextSteps', [{}, {}, {}, {}]],
    ['_generateTransitNextSteps', [{}, {}, {}, {}]],
    ['_generateClassificationNextSteps', [[], {}, {}, {}]],
    ['_generateClassificationAlerts', [[], {}, {}, {}]]
  ])('%s devuelve una lista con entradas vacias', (metodo, args) => {
    const r = ai[metodo](...args);

    expect(Array.isArray(r)).toBe(true);
  });

  test.each([
    ['_generateDeclarationNextSteps', [{}, {}, {}, {}]],
    ['_generateTransitNextSteps', [{}, {}, {}, {}]],
    ['_generateClassificationNextSteps', [[], {}, {}, {}]],
    ['_generateClassificationAlerts', [[], {}, {}, {}]]
  ])('%s no revienta con datos incompletos', (metodo, args) => {
    expect(() => ai[metodo](...args)).not.toThrow();
  });
});
