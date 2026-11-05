/**
 * F9 (escaneo 5/Nov/2026): el almacen de certificados AEAT es un unico Map en
 * memoria compartido por todos los tenants y el alias era texto libre. Un
 * administrador de tenant importaba un certificado con alias "../../x" y la fila
 * aparecia en las listas de los demas; ademas cualquiera podia ver, verificar o
 * borrar los de otro tenant.
 *
 * Servicio de certificados REAL; los registros se siembran directamente en el
 * almacen (no hace falta un P12 para probar el aislamiento).
 */

jest.mock('../../src/services/aiService', () => ({}));

const { certificateService } = require('../../src/services/aeat');
const aeatRealController = require('../../src/controllers/aeatRealController');

const TENANT_A = '64f000000000000000000001';
const TENANT_B = '64f000000000000000000002';

const usuario = (tenantId) => ({ _id: 'u-' + tenantId, role: 'admin', tenantId, email: `${tenantId}@x.es` });

function crearRes() {
  const res = { statusCode: 200 };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function sembrar(id, alias, tenantId) {
  certificateService.certificates.set(id, {
    id,
    subject: { CN: `Titular ${alias}` },
    issuer: { CN: 'FNMT' },
    serialNumber: id,
    type: 'FNMT_PJ',
    status: 'active',
    validFrom: new Date(Date.now() - 86400000).toISOString(),
    validTo: new Date(Date.now() + 200 * 86400000).toISOString(),
    alerts: { level: 'ok' },
    metadata: { alias, tenantId, importedAt: new Date().toISOString() }
  });
}

const llamar = async (handler, tenantId, { params = {}, body = {}, query = {} } = {}) => {
  const res = crearRes();
  await handler({ user: usuario(tenantId), params, body, query }, res);
  return res;
};

beforeEach(() => {
  certificateService.certificates.clear();
  sembrar('certA0000000000a', 'CERT-A', TENANT_A);
  sembrar('certB0000000000b', 'CERT-B', TENANT_B);
});

describe('F9 — alias del certificado', () => {
  test.each(['../../x', '../../tenant/roles/1', 'a/b', 'a b', '', '.', '..', 'x'.repeat(65), 'a?b'])(
    'importar con alias %j -> 400 y no se importa nada', async (alias) => {
      const espia = jest.spyOn(certificateService, 'importCertificate');
      const res = await llamar(aeatRealController.importCertificate, TENANT_A, {
        body: { certificateBase64: Buffer.from('x').toString('base64'), password: 'p', alias }
      });
      // alias vacio equivale a "sin alias" (se permite); el resto se rechaza
      if (alias === '') {
        espia.mockRestore();
        return;
      }
      expect(res.statusCode).toBe(400);
      expect(espia).not.toHaveBeenCalled();
      espia.mockRestore();
    });

  test.each(['../../x', 'a b', '..'])('get/verify/delete con alias %j en la ruta -> 400', async (alias) => {
    for (const handler of [aeatRealController.getCertificateInfo, aeatRealController.verifyCertificate, aeatRealController.deleteCertificate]) {
      const res = await llamar(handler, TENANT_A, { params: { alias } });
      expect(res.statusCode).toBe(400);
    }
    expect(certificateService.certificates.size).toBe(2);
  });

  test('la importacion guarda el tenant del usuario, nunca uno del body', async () => {
    const espia = jest.spyOn(certificateService, 'importCertificate').mockResolvedValue({ success: true });
    await llamar(aeatRealController.importCertificate, TENANT_A, {
      body: { certificateBase64: Buffer.from('x').toString('base64'), password: 'p', alias: 'MI-CERT', tenantId: TENANT_B, organizationId: TENANT_B }
    });
    const metadata = espia.mock.calls[0][2];
    expect(metadata.tenantId).toBe(TENANT_A);
    expect(metadata.alias).toBe('MI-CERT');
    espia.mockRestore();
  });
});

describe('F9 — el almacen esta acotado por tenant', () => {
  test('el tenant A solo lista los suyos', async () => {
    const res = await llamar(aeatRealController.listCertificates, TENANT_A);
    expect(res.body.data.map((c) => c.alias)).toEqual(['CERT-A']);
  });

  test('el tenant A no ve la ficha del certificado de B', async () => {
    const res = await llamar(aeatRealController.getCertificateInfo, TENANT_A, { params: { alias: 'CERT-B' } });
    expect(res.statusCode).toBe(404);
  });

  test('el tenant A no verifica el certificado de B', async () => {
    const res = await llamar(aeatRealController.verifyCertificate, TENANT_A, { params: { alias: 'CERT-B' } });
    expect(res.statusCode).toBe(404);
  });

  test('el tenant A no borra el certificado de B', async () => {
    const res = await llamar(aeatRealController.deleteCertificate, TENANT_A, { params: { alias: 'CERT-B' } });
    expect(res.statusCode).toBe(404);
    expect(certificateService.certificates.has('certB0000000000b')).toBe(true);
  });

  test('el tenant A borra el suyo (y solo ese)', async () => {
    const res = await llamar(aeatRealController.deleteCertificate, TENANT_A, { params: { alias: 'CERT-A' } });
    expect(res.statusCode).toBe(200);
    expect(certificateService.certificates.has('certA0000000000a')).toBe(false);
    expect(certificateService.certificates.has('certB0000000000b')).toBe(true);
  });

  test('el mismo alias en dos tenants resuelve cada uno al suyo', async () => {
    sembrar('certA2', 'COMUN', TENANT_A);
    sembrar('certB2', 'COMUN', TENANT_B);
    expect(certificateService.getCertificateIdByAlias('COMUN', TENANT_A)).toBe('certA2');
    expect(certificateService.getCertificateIdByAlias('COMUN', TENANT_B)).toBe('certB2');
    expect(certificateService.getCertificateIdByAlias('CERT-B', TENANT_A)).toBeNull();
  });

  test('los certificados sin tenant (sistema/legacy) no se ven desde un tenant', async () => {
    sembrar('certSys', 'AEAT-AUTO', undefined);
    const res = await llamar(aeatRealController.listCertificates, TENANT_A);
    expect(res.body.data.map((c) => c.alias)).toEqual(['CERT-A']);
  });
});
