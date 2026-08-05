/**
 * aeatService — integración AEAT (envío H1, consulta estado, anulación).
 *
 * Frontera externa: `https` (red) y `fs` (lectura del certificado). Se mockean
 * ambos para NO tocar la red ni AEAT bajo ningún concepto — todos los envíos
 * "reales" van contra un https.request simulado. El grueso del servicio es
 * lógica pura de ramas: simulación de canal (verde/naranja/rojo por umbrales de
 * Math.random), parseo de respuestas XML por regex (MRN/código/canal presentes
 * o ausentes), extracción de LRN/aduana, y el switch demo-vs-configurado por
 * isConfigured(). El módulo exporta una INSTANCIA singleton: se mutan sus
 * campos de config en cada test para forzar cada rama.
 *
 * jest.config: resetMocks:true → restaurar implementaciones en beforeEach.
 */

const https = require('https');
const fs = require('fs');

jest.mock('https');
jest.mock('fs');

const svc = require('../../src/services/aeatService');

// Guardamos el estado original de la instancia para restaurarlo entre tests.
const ORIG = {
  environment: svc.environment,
  config: svc.config,
  certificatePath: svc.certificatePath,
  certificatePassword: svc.certificatePassword,
  representativeNIF: svc.representativeNIF
};

/** Deja el servicio en modo DEMO (sin certificado → isConfigured() === false). */
function modoDemo() {
  svc.certificatePath = undefined;
  svc.certificatePassword = undefined;
}

/** Deja el servicio en modo CONFIGURADO (cert + password presentes). */
function modoConfigurado() {
  svc.certificatePath = '/tmp/cert.p12';
  svc.certificatePassword = 'secreto';
}

/**
 * Simula una respuesta HTTPS de AEAT: https.request(options, cb) llama a cb(res)
 * y devuelve un objeto con write/end/on. `res` emite los chunks y luego 'end'.
 */
function mockHttpsResponse(bodyText, { failWith } = {}) {
  https.request.mockImplementation((options, cb) => {
    const clientReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((ev, handler) => {
        if (ev === 'error' && failWith) handler(failWith);
        return clientReq;
      })
    };
    if (!failWith) {
      const res = {
        on: (ev, handler) => {
          if (ev === 'data') handler(bodyText);
          if (ev === 'end') handler();
        }
      };
      cb(res);
    }
    return clientReq;
  });
}

beforeEach(() => {
  // Restaurar la instancia singleton a su estado original.
  Object.assign(svc, ORIG);
  fs.existsSync.mockReturnValue(false);
  fs.readFileSync.mockReturnValue(Buffer.from('pfx'));
});

// ==================== isConfigured ====================
describe('isConfigured', () => {
  test('false sin certificado', () => {
    modoDemo();
    expect(svc.isConfigured()).toBe(false);
  });

  test('true con cert y password', () => {
    modoConfigurado();
    expect(svc.isConfigured()).toBe(true);
  });

  test('false si falta el password aunque haya path', () => {
    svc.certificatePath = '/tmp/cert.p12';
    svc.certificatePassword = undefined;
    expect(svc.isConfigured()).toBe(false);
  });
});

// ==================== submitH1 — modo demo (simulación) ====================
describe('submitH1 (demo)', () => {
  test('devuelve MRN simulado con formato AAES + hex, canal y duties coherentes', async () => {
    modoDemo();
    const xml = '<Root><LRN>LRN-123</LRN><DeclarationOfficeID>ES001234</DeclarationOfficeID></Root>';
    const r = await svc.submitH1(xml);

    expect(r.success).toBe(true);
    expect(r.simulated).toBe(true);
    expect(r.mrn).toMatch(/^\d{2}ES[0-9A-F]+$/);
    expect(r.status).toBe('accepted');
    expect(['green', 'orange', 'red']).toContain(r.channel);
    expect(r.channelDescription).toBeTruthy();
    // LRN y aduana se extraen del XML.
    expect(r.lrn).toBe('LRN-123');
    expect(r.customsOffice).toBe('ES001234');
    // totalAmount = duty + vat.
    expect(r.duties.totalAmount).toBe(r.duties.dutyAmount + r.duties.vatAmount);
    expect(r.aeatResponse.code).toBe('0000');
  });

  test('canal verde (random<0.70) → levante inmediato', async () => {
    modoDemo();
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.10);
    try {
      const r = await svc.submitH1('<Root/>');
      expect(r.channel).toBe('green');
      // Verde: estimatedRelease === acceptanceDate (mismo instante lógico, ambos "ahora").
      expect(new Date(r.estimatedRelease).getTime())
        .toBeLessThanOrEqual(new Date(r.acceptanceDate).getTime() + 1000);
    } finally {
      spy.mockRestore();
    }
  });

  test('canal naranja (0.70<=random<0.95) → levante +24h', async () => {
    modoDemo();
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.80);
    try {
      const r = await svc.submitH1('<Root/>');
      expect(r.channel).toBe('orange');
      expect(new Date(r.estimatedRelease).getTime())
        .toBeGreaterThan(new Date(r.acceptanceDate).getTime());
    } finally {
      spy.mockRestore();
    }
  });

  test('canal rojo (random>=0.95)', async () => {
    modoDemo();
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      const r = await svc.submitH1('<Root/>');
      expect(r.channel).toBe('red');
    } finally {
      spy.mockRestore();
    }
  });

  test('LRN/aduana null si no aparecen en el XML', async () => {
    modoDemo();
    const r = await svc.submitH1('<Root></Root>');
    expect(r.lrn).toBeNull();
    expect(r.customsOffice).toBeNull();
  });
});

// ==================== submitH1 — modo configurado (envío "real" mockeado) ====================
describe('submitH1 (configurado)', () => {
  test('flujo completo: firma, envelope, envío y parseo con MRN + código 0000', async () => {
    modoConfigurado();
    mockHttpsResponse(
      '<Resp><MRN>25ESABCDEF</MRN><ResponseCode>0000</ResponseCode>' +
      '<InspectionChannel>GREEN</InspectionChannel></Resp>'
    );
    const r = await svc.submitH1('<Root><LRN>L1</LRN></Root>');
    expect(r.success).toBe(true);
    expect(r.mrn).toBe('25ESABCDEF');
    expect(r.responseCode).toBe('0000');
    expect(r.channel).toBe('green');
    expect(https.request).toHaveBeenCalled();
  });

  test('respuesta sin MRN/código/canal → success false y valores por defecto', async () => {
    modoConfigurado();
    mockHttpsResponse('<Resp>vacía</Resp>');
    const r = await svc.submitH1('<Root/>');
    expect(r.success).toBeFalsy(); // codeMatch es null → success queda null (falsy)
    expect(r.mrn).toBeNull();
    expect(r.responseCode).toBe('UNKNOWN');
    expect(r.channel).toBeNull();
  });

  test('adjunta el certificado cliente (pfx) cuando existe en disco', async () => {
    modoConfigurado();
    fs.existsSync.mockReturnValue(true);
    mockHttpsResponse('<Resp><ResponseCode>0000</ResponseCode></Resp>');
    await svc.submitH1('<Root/>');
    const opts = https.request.mock.calls[0][0];
    expect(opts.pfx).toBeDefined();
    expect(opts.passphrase).toBe('secreto');
    expect(opts.hostname).not.toMatch(/^https:\/\//); // se le quita el esquema
  });

  test('propaga el error si la petición HTTPS falla', async () => {
    modoConfigurado();
    mockHttpsResponse(null, { failWith: new Error('ECONNRESET') });
    await expect(svc.submitH1('<Root/>')).rejects.toThrow('ECONNRESET');
  });
});

// ==================== queryStatus ====================
describe('queryStatus', () => {
  test('demo: devuelve estado LEVANTE simulado', async () => {
    modoDemo();
    const r = await svc.queryStatus('25ESABCDEF');
    expect(r.simulated).toBe(true);
    expect(r.status).toBe('accepted');
    expect(r.channel).toBe('green');
    expect(r.mrn).toBe('25ESABCDEF');
  });

  test('configurado: parsea Status y Channel de la respuesta', async () => {
    modoConfigurado();
    mockHttpsResponse('<Resp><Status>RELEASED</Status><Channel>ORANGE</Channel></Resp>');
    const r = await svc.queryStatus('25ESABCDEF');
    expect(r.success).toBe(true);
    expect(r.status).toBe('RELEASED');
    expect(r.channel).toBe('orange');
  });

  test('configurado: valores por defecto si faltan campos', async () => {
    modoConfigurado();
    mockHttpsResponse('<Resp/>');
    const r = await svc.queryStatus('X');
    expect(r.status).toBe('unknown');
    expect(r.channel).toBeNull();
  });

  test('configurado: propaga error de red', async () => {
    modoConfigurado();
    mockHttpsResponse(null, { failWith: new Error('timeout') });
    await expect(svc.queryStatus('X')).rejects.toThrow('timeout');
  });
});

// ==================== cancelDeclaration ====================
describe('cancelDeclaration', () => {
  test('demo: anulación simulada correcta', async () => {
    modoDemo();
    const r = await svc.cancelDeclaration('25ESABCDEF', 'error de datos');
    expect(r.success).toBe(true);
    expect(r.status).toBe('cancelled');
    expect(r.mrn).toBe('25ESABCDEF');
  });

  test('configurado: aún no implementado en producción → lanza', async () => {
    modoConfigurado();
    await expect(svc.cancelDeclaration('X', 'r'))
      .rejects.toThrow('Cancel not implemented for production');
  });
});

// ==================== _signXml ====================
describe('_signXml', () => {
  test('lanza si no hay certificatePath', async () => {
    svc.certificatePath = undefined;
    await expect(svc._signXml('<x/>')).rejects.toThrow('Certificate path not configured');
  });

  test('devuelve el XML tal cual cuando hay certificado (firma pendiente)', async () => {
    svc.certificatePath = '/tmp/cert.p12';
    await expect(svc._signXml('<x/>')).resolves.toBe('<x/>');
  });
});

// ==================== _buildSoapEnvelope / _buildQueryXml ====================
describe('constructores XML', () => {
  test('envelope SOAP incluye NIF del representante y la operación', () => {
    svc.representativeNIF = 'B99999999';
    const env = svc._buildSoapEnvelope('<Decl/>', 'submitH1');
    expect(env).toContain('B99999999');
    expect(env).toContain('submitH1Request');
    expect(env).toContain('<Decl/>');
  });

  test('query XML incluye el MRN', () => {
    const q = svc._buildQueryXml('25ESABCDEF');
    expect(q).toContain('<MRN>25ESABCDEF</MRN>');
    expect(q).toContain('STATUS');
  });
});

// ==================== _parseResponse / _parseQueryResponse (ramas de regex) ====================
describe('parseo de respuestas', () => {
  test('_parseResponse: código distinto de 0000 → success false', () => {
    const r = svc._parseResponse('<R><ResponseCode>2001</ResponseCode></R>');
    expect(r.success).toBe(false);
    expect(r.responseCode).toBe('2001');
  });

  test('_parseResponse: canal se pasa a minúsculas', () => {
    const r = svc._parseResponse('<R><ResponseCode>0000</ResponseCode><InspectionChannel>RED</InspectionChannel></R>');
    expect(r.channel).toBe('red');
  });

  test('_parseQueryResponse: sin campos → unknown/null', () => {
    const r = svc._parseQueryResponse('');
    expect(r.status).toBe('unknown');
    expect(r.channel).toBeNull();
  });
});

// ==================== _extractLRN / _extractCustomsOffice ====================
describe('extractores', () => {
  test('_extractLRN encuentra y devuelve null si no hay', () => {
    expect(svc._extractLRN('<x><LRN>ABC</LRN></x>')).toBe('ABC');
    expect(svc._extractLRN('<x/>')).toBeNull();
  });

  test('_extractCustomsOffice encuentra y devuelve null si no hay', () => {
    expect(svc._extractCustomsOffice('<x><DeclarationOfficeID>ES1</DeclarationOfficeID></x>')).toBe('ES1');
    expect(svc._extractCustomsOffice('<x/>')).toBeNull();
  });
});
