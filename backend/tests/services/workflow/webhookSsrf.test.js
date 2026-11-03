/**
 * Las acciones call_webhook y call_api de workflow no hacen SSRF.
 *
 * Hallazgo F3: un admin de tenant (el registro publico da uno) guardaba un
 * workflow con webhookUrl apuntando a una direccion interna, lo ejecutaba y
 * leia la respuesta en el registro de la ejecucion. call_api tenia el mismo
 * patron con apiUrl.
 *
 * Se mockea axios (frontera de red): se comprueba que una URL no permitida ni
 * siquiera llega a axios, y que las permitidas salen con un agente https que
 * valida la IP al conectar y sin seguir redirecciones.
 */

jest.mock('axios', () => jest.fn());
jest.mock('../../../src/services/emailService', () => ({}));
jest.mock('../../../src/models', () => ({ Expedition: {}, Deadline: {}, Requirement: {} }));

const axios = require('axios');
const { actionHandlers: handlers } = require('../../../src/services/workflow/actionHandlers');

function ejecucion() {
  return {
    executionId: 'EXEC-1',
    actionResults: [{ actionId: 'a1' }],
    addActionLog: jest.fn()
  };
}

const contexto = { trigger: { event: 'x' }, entityType: 'expedition', entityId: 'e1', entity: {} };

beforeEach(() => {
  axios.mockReset();
  axios.mockResolvedValue({ status: 200, data: { ok: true } });
});

describe.each([
  ['call_webhook', (url) => ({ webhookUrl: url })],
  ['call_api', (url) => ({ apiUrl: url })]
])('%s', (accion, config) => {
  test.each([
    'http://erp.example.com/hook',
    'https://127.0.0.1:8080/admin',
    'https://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'https://10.0.0.5/interno',
    'https://[::1]/'
  ])('rechaza %s sin llamar a axios', async (url) => {
    await expect(handlers[accion](config(url), contexto, ejecucion())).rejects.toThrow();
    expect(axios).not.toHaveBeenCalled();
  });

  test('una URL https publica sale sin redirecciones y con el agente que valida la IP', async () => {
    await handlers[accion](config('https://erp.example.com/api/customs/complete'), contexto, ejecucion());

    expect(axios).toHaveBeenCalledTimes(1);
    const opciones = axios.mock.calls[0][0];
    expect(opciones.url).toBe('https://erp.example.com/api/customs/complete');
    expect(opciones.maxRedirects).toBe(0);
    expect(opciones.httpsAgent).toBeDefined();
    expect(typeof opciones.httpsAgent.options.lookup).toBe('function');
    expect(opciones.proxy).toBe(false);
  });
});
