/**
 * Peticiones salientes a URLs configuradas por un tenant (webhooks de workflow).
 *
 * Hallazgo F3 del escaneo del 3/Nov/2026: la accion call_webhook llamaba con
 * axios a cualquier URL que un admin de tenant pusiera en el workflow y
 * guardaba la respuesta: SSRF con lectura desde la red del backend (servicios
 * internos, 169.254.169.254...).
 *
 * utils/safeOutboundRequest: solo https, IP resuelta no privada / loopback /
 * link-local / metadata, comprobada en el momento de conectar (sin
 * re-resolucion entre comprobar y conectar), y sin seguir redirecciones.
 */

const { esIpBloqueada, validarUrlSaliente, crearLookupSeguro } = require('../../src/utils/safeOutboundRequest');

describe('esIpBloqueada', () => {
  test.each([
    '127.0.0.1', '127.1.2.3', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.10',
    '169.254.169.254', '169.254.0.1', '0.0.0.0', '100.64.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd00:ec2::254', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'ff02::1'
  ])('bloquea %s', (ip) => {
    expect(esIpBloqueada(ip)).toBe(true);
  });

  test.each(['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '192.169.0.1', '2606:4700:4700::1111'])(
    'permite la IP publica %s', (ip) => {
      expect(esIpBloqueada(ip)).toBe(false);
    }
  );

  test('lo que no es una IP se trata como bloqueado', () => {
    expect(esIpBloqueada('no-es-ip')).toBe(true);
  });
});

describe('validarUrlSaliente', () => {
  test.each([
    ['http://example.com/hook', /https/],
    ['ftp://example.com', /https/],
    ['file:///etc/passwd', /https/],
    ['https://127.0.0.1/admin', /no permitida/],
    ['https://169.254.169.254/latest/meta-data/', /no permitida/],
    ['https://[::1]/', /no permitida/],
    ['https://user:pass@example.com/', /credenciales/],
    ['no es una url', /no valida/]
  ])('rechaza %s', (url, motivo) => {
    expect(() => validarUrlSaliente(url)).toThrow(motivo);
  });

  test('acepta una URL https publica', () => {
    expect(validarUrlSaliente('https://erp.example.com/api/customs/complete').hostname).toBe('erp.example.com');
  });
});

describe('crearLookupSeguro (IP resuelta al conectar)', () => {
  const resolverCon = (direcciones) => (host, opts, cb) => cb(null, direcciones);
  const usar = (lookup, host = 'erp.example.com') => new Promise((resolve) => {
    lookup(host, { all: false }, (err, address, family) => resolve({ err, address, family }));
  });

  test('un dominio que resuelve a una IP publica conecta a esa IP', async () => {
    const r = await usar(crearLookupSeguro(resolverCon([{ address: '93.184.216.34', family: 4 }])));
    expect(r.err).toBeNull();
    expect(r.address).toBe('93.184.216.34');
    expect(r.family).toBe(4);
  });

  test('un dominio que resuelve a una IP interna se rechaza (DNS que apunta dentro)', async () => {
    const r = await usar(crearLookupSeguro(resolverCon([{ address: '10.1.2.3', family: 4 }])));
    expect(r.err).toBeInstanceOf(Error);
    expect(r.err.message).toMatch(/no permitida/);
  });

  test('si alguna de las IP resueltas es interna se rechaza todo', async () => {
    const r = await usar(crearLookupSeguro(resolverCon([
      { address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }
    ])));
    expect(r.err).toBeInstanceOf(Error);
  });

  test('propaga el error de resolucion', async () => {
    const r = await usar(crearLookupSeguro((h, o, cb) => cb(new Error('ENOTFOUND'))));
    expect(r.err.message).toBe('ENOTFOUND');
  });

  test('responde en formato all:true si se lo piden', async () => {
    const lookup = crearLookupSeguro(resolverCon([{ address: '93.184.216.34', family: 4 }]));
    const r = await new Promise((resolve) => lookup('x', { all: true }, (err, list) => resolve({ err, list })));
    expect(r.list).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
});
