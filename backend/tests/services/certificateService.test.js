/**
 * certificateService: gestion de certificados FNMT para firma ante AEAT.
 *
 * Es un singleton con almacen en memoria (`this.certificates` Map). Todo el
 * modulo es logica pura + crypto real (node-forge para parsear P12, crypto para
 * cifrar aes-256-cbc). NO depende de aiService: los cuatro helpers `_getLuci*`
 * construyen objetos directamente, asi que no se mockea NADA del codigo bajo
 * prueba. La unica frontera de sistema real es `_simulateOCSPCheck`, que hace un
 * setTimeout(100ms); se ejercita con jest.useFakeTimers para no esperar.
 *
 * En vez de leer .p12 de disco, se genera un certificado X.509 + par RSA real
 * con node-forge dentro del test (emisor FNMT, keyUsage digitalSignature, fechas
 * controladas para disparar las ramas de alerta por expiracion) y se empaqueta
 * como P12. Asi `importCertificate` ejecuta el parseo y el cifrado reales, no un
 * mock. El almacen en memoria del singleton se limpia entre tests.
 *
 * REGRESIÓN (fix 6/Ago, SECURITY_AUDIT.md): antes importCertificate devolvía
 * `error: validation.error`, pero _validateCertificate expone el detalle en
 * `validation.errors` (array), no en `.error` -> el motivo del rechazo llegaba
 * `undefined`. Ahora `error` es el string con los motivos (join) y `errors` es
 * el array. Los tests de abajo fijan que el motivo real SÍ llega en `error`
 * (además de en luciAnalysis.summary, que es lo que ya leía la UI).
 */

const forge = require('node-forge');
const certificateService = require('../../src/services/aeat/certificateService');

// Vacia el almacen en memoria del singleton antes de cada test.
beforeEach(() => {
  certificateService.certificates.clear();
});

/**
 * Genera un P12 (Buffer) con un cert X.509 autofirmado real.
 * Por defecto: emisor FNMT, persona fisica, con permiso de firma y vigente.
 */
function generarP12({
  password = 'test123',
  diasHastaExpiracion = 365,
  diasDesdeInicio = 1,
  cn = 'JUAN PEREZ GARCIA',
  issuerCN = 'AC FNMT Usuarios',
  issuerO = 'FNMT-RCM',
  ou = null,
  org = null,
  serialNumber = null,
  keyUsageSign = true
} = {}) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';

  const base = Date.now();
  cert.validity.notBefore = new Date(base - diasDesdeInicio * 24 * 3600 * 1000);
  cert.validity.notAfter = new Date(base + diasHastaExpiracion * 24 * 3600 * 1000);

  const subjectAttrs = [{ shortName: 'CN', value: cn }];
  if (ou) subjectAttrs.push({ shortName: 'OU', value: ou });
  if (org) subjectAttrs.push({ shortName: 'O', value: org });
  if (serialNumber) subjectAttrs.push({ name: 'serialNumber', value: serialNumber });
  cert.setSubject(subjectAttrs);

  const issuerAttrs = [{ shortName: 'CN', value: issuerCN }];
  if (issuerO) issuerAttrs.push({ shortName: 'O', value: issuerO });
  cert.setIssuer(issuerAttrs);

  const exts = [{ name: 'basicConstraints', cA: false }];
  if (keyUsageSign) {
    exts.push({ name: 'keyUsage', digitalSignature: true, nonRepudiation: true });
  } else {
    exts.push({ name: 'keyUsage', keyEncipherment: true });
  }
  cert.setExtensions(exts);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

/** Importa un P12 recien generado y devuelve el resultado del servicio. */
async function importarCertValido(opts = {}) {
  const { password = 'test123', metadata = {}, ...certOpts } = opts;
  const p12 = generarP12({ password, ...certOpts });
  return certificateService.importCertificate(p12, password, metadata);
}

describe('importCertificate', () => {
  test('importa un P12 FNMT valido: extrae info, cifra y almacena', async () => {
    const r = await importarCertValido({ metadata: { alias: 'mi cert', organizationId: 'org1' } });

    expect(r.success).toBe(true);
    expect(r.certificateId).toMatch(/^[0-9a-f]{16}$/); // sha256 truncado a 16 hex
    expect(r.info.subject).toBe('JUAN PEREZ GARCIA');
    expect(r.info.issuer).toContain('FNMT');
    expect(r.info.type).toBe('FNMT_PF');
    expect(r.info.validFor).toEqual(['H1', 'H7', 'AES', 'NCTS']);
    expect(r.alerts.level).toBe('ok'); // 365 dias -> sin alerta
    expect(r.luciAnalysis.aeatCompatibility.h1Import).toBe(true);
    // realmente quedo almacenado
    expect(certificateService.certificates.has(r.certificateId)).toBe(true);
  });

  test('un P12 con contraseña incorrecta falla y LUCI sugiere causas', async () => {
    const p12 = generarP12({ password: 'buena' });
    const r = await certificateService.importCertificate(p12, 'mala');

    expect(r.success).toBe(false);
    expect(r.luciAnalysis.possibleCauses).toEqual(
      expect.arrayContaining([expect.stringMatching(/Contraseña incorrecta/)])
    );
    expect(certificateService.certificates.size).toBe(0);
  });

  test('un buffer que no es P12 falla de forma controlada', async () => {
    const r = await certificateService.importCertificate(Buffer.from('esto no es un p12'), 'x');
    expect(r.success).toBe(false);
    expect(r.error).toBeTruthy();
    expect(r.luciAnalysis.interpretation).toMatch(/Error al procesar/i);
  });

  test('cert de emisor NO FNMT es rechazado por _validateCertificate', async () => {
    const r = await importarCertValido({ issuerCN: 'DigiCert', issuerO: 'DigiCert Inc' });
    expect(r.success).toBe(false);
    // REGRESIÓN: el motivo del rechazo ahora llega en `error` (string) y en
    // `errors` (array), no solo en luciAnalysis.summary.
    expect(r.error).toMatch(/Emisor no reconocido/);
    expect(r.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Emisor no reconocido/)]));
    expect(r.luciAnalysis.summary).toMatch(/Emisor no reconocido/);
    expect(certificateService.certificates.size).toBe(0);
  });

  test('cert sin permiso de firma es rechazado', async () => {
    const r = await importarCertValido({ keyUsageSign: false });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no tiene permisos de firma/);
    expect(r.luciAnalysis.summary).toMatch(/no tiene permisos de firma/);
  });

  test('detecta FNMT_REP por OU=REPRESENTANTE y habilita VUA', async () => {
    const r = await importarCertValido({ ou: 'REPRESENTANTE', org: 'ACME SL' });
    expect(r.success).toBe(true);
    expect(r.info.type).toBe('FNMT_REP');
    expect(r.info.validFor).toContain('VUA');
  });

  test('detecta FNMT_PJ por O + serialNumber CIF', async () => {
    const r = await importarCertValido({ org: 'ACME SL', serialNumber: 'CIFB12345678' });
    expect(r.success).toBe(true);
    expect(r.info.type).toBe('FNMT_PJ');
    expect(r.info.validFor).toContain('SILICIE');
  });

  test('un cert que expira en 20 dias entra con alerta warning', async () => {
    const r = await importarCertValido({ diasHastaExpiracion: 20 });
    expect(r.success).toBe(true);
    expect(r.alerts.level).toBe('warning');
    // LUCI recomienda renovar
    const acciones = r.luciAnalysis.recommendations.map(x => x.action);
    expect(acciones).toContain('Renovar certificado');
  });
});

describe('getCertificateForSigning', () => {
  test('con la contraseña correcta devuelve cert y clave descifrados', async () => {
    const imp = await importarCertValido({ password: 'firma123' });
    const r = await certificateService.getCertificateForSigning(imp.certificateId, 'firma123');

    expect(r.success).toBe(true);
    expect(r.certPem).toMatch(/BEGIN CERTIFICATE/);
    expect(r.keyPem).toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(r.info.subject).toBe('JUAN PEREZ GARCIA');
  });

  test('contraseña incorrecta falla sin exponer los datos', async () => {
    const imp = await importarCertValido({ password: 'firma123' });
    const r = await certificateService.getCertificateForSigning(imp.certificateId, 'otra');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Contraseña incorrecta/);
  });

  test('certificado inexistente falla', async () => {
    const r = await certificateService.getCertificateForSigning('noexiste', 'x');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });

  test('certificado no activo (revocado) no se entrega para firmar', async () => {
    const imp = await importarCertValido();
    certificateService.certificates.get(imp.certificateId).status = 'revoked';
    const r = await certificateService.getCertificateForSigning(imp.certificateId, 'test123');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no activo/i);
  });

  test('certificado expirado se marca EXPIRED y no se entrega', async () => {
    const imp = await importarCertValido();
    // forzamos validTo al pasado
    const rec = certificateService.certificates.get(imp.certificateId);
    rec.validTo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const r = await certificateService.getCertificateForSigning(imp.certificateId, 'test123');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/expirado/i);
    expect(rec.status).toBe('expired');
  });
});

describe('listCertificates', () => {
  test('lista todos y resume conteos; ordena por proximidad de expiracion', async () => {
    const lejano = await importarCertValido({ diasHastaExpiracion: 300, cn: 'LEJANO' });
    const cercano = await importarCertValido({ diasHastaExpiracion: 5, cn: 'CERCANO' });

    const r = await certificateService.listCertificates();
    expect(r.success).toBe(true);
    expect(r.summary.total).toBe(2);
    expect(r.summary.active).toBe(2);
    // el mas proximo a expirar va primero
    expect(r.certificates[0].id).toBe(cercano.certificateId);
    expect(r.certificates[1].id).toBe(lejano.certificateId);
    // el cercano (5 dias) cuenta como pendiente de renovacion (critical)
    expect(r.summary.pendingRenewal).toBe(1);
  });

  test('filtra por organizationId', async () => {
    await importarCertValido({ metadata: { organizationId: 'org-a' }, cn: 'A' });
    await importarCertValido({ metadata: { organizationId: 'org-b' }, cn: 'B' });

    const r = await certificateService.listCertificates('org-a');
    expect(r.summary.total).toBe(1);
    expect(r.certificates[0].subject).toBe('A');
  });

  test('marca EXPIRED en la lista los certificados cuya fecha ya paso', async () => {
    const imp = await importarCertValido();
    certificateService.certificates.get(imp.certificateId).validTo =
      new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const r = await certificateService.listCertificates();
    expect(r.certificates[0].status).toBe('expired');
    expect(r.summary.expired).toBe(1);
    expect(r.summary.active).toBe(0);
  });
});

describe('verifyCertificateStatus (OCSP simulado)', () => {
  test('un cert activo devuelve OCSP good y isValid=true', async () => {
    jest.useFakeTimers();
    try {
      const imp = await importarCertValido();
      const promesa = certificateService.verifyCertificateStatus(imp.certificateId);
      await jest.advanceTimersByTimeAsync(200); // salta la latencia simulada de 100ms
      const r = await promesa;

      expect(r.success).toBe(true);
      expect(r.verification.ocspStatus).toBe('good');
      expect(r.verification.isValid).toBe(true);
      expect(r.luciAnalysis.status).toMatch(/Verificado/);
    } finally {
      jest.useRealTimers();
    }
  });

  test('un cert revocado devuelve OCSP revoked y actualiza el estado', async () => {
    jest.useFakeTimers();
    try {
      const imp = await importarCertValido();
      certificateService.certificates.get(imp.certificateId).status = 'revoked';
      const promesa = certificateService.verifyCertificateStatus(imp.certificateId);
      await jest.advanceTimersByTimeAsync(200);
      const r = await promesa;

      expect(r.verification.ocspStatus).toBe('revoked');
      expect(r.verification.isValid).toBe(false);
      expect(r.luciAnalysis.interpretation).toMatch(/revocado/i);
    } finally {
      jest.useRealTimers();
    }
  });

  test('certificado inexistente falla', async () => {
    const r = await certificateService.verifyCertificateStatus('noexiste');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });
});

describe('getRenewalAlerts', () => {
  test('solo alerta de los que expiran dentro de 60 dias, ordenados por urgencia', async () => {
    await importarCertValido({ diasHastaExpiracion: 300, cn: 'SANO' });       // sin alerta
    const critico = await importarCertValido({ diasHastaExpiracion: 3, cn: 'CRITICO' });
    const aviso = await importarCertValido({ diasHastaExpiracion: 25, cn: 'AVISO' });

    const r = await certificateService.getRenewalAlerts();
    expect(r.success).toBe(true);
    expect(r.alerts).toHaveLength(2); // el sano queda fuera
    // ordenado por daysToExpiry ascendente -> critico primero
    expect(r.alerts[0].certificateId).toBe(critico.certificateId);
    expect(r.alerts[0].level).toBe('critical');
    expect(r.alerts[1].certificateId).toBe(aviso.certificateId);
    expect(r.alerts[1].level).toBe('warning');
    expect(r.luciAnalysis.status).toBe('critical');
    expect(r.luciAnalysis.summary.criticalCount).toBe(1);
  });

  test('sin certificados proximos a expirar, LUCI reporta todo vigente', async () => {
    await importarCertValido({ diasHastaExpiracion: 300 });
    const r = await certificateService.getRenewalAlerts();
    expect(r.alerts).toHaveLength(0);
    expect(r.luciAnalysis.status).toBe('ok');
  });
});

describe('deleteCertificate', () => {
  test('elimina un certificado existente', async () => {
    const imp = await importarCertValido();
    const r = await certificateService.deleteCertificate(imp.certificateId);
    expect(r.success).toBe(true);
    expect(r.deletedCertificate.id).toBe(imp.certificateId);
    expect(certificateService.certificates.has(imp.certificateId)).toBe(false);
  });

  test('eliminar uno inexistente devuelve error controlado', async () => {
    const r = await certificateService.deleteCertificate('noexiste');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });
});

describe('validateCertificateForOperation', () => {
  test('FNMT_PF es valido para H1 pero NO para SILICIE', async () => {
    const imp = await importarCertValido();

    const h1 = await certificateService.validateCertificateForOperation(imp.certificateId, 'H1');
    expect(h1.valid).toBe(true);
    expect(h1.checks.isValidForOperation).toBe(true);
    expect(h1.luciAnalysis.canProceed).toBe(true);

    const silicie = await certificateService.validateCertificateForOperation(imp.certificateId, 'SILICIE');
    expect(silicie.valid).toBe(false);
    expect(silicie.checks.isValidForOperation).toBe(false);
    // recomienda obtener cert de representante/PJ para SILICIE
    expect(silicie.luciAnalysis.recommendations.some(x => /representante o persona jur[ií]dica/i.test(x)))
      .toBe(true);
  });

  test('un cert revocado no es valido para ninguna operacion', async () => {
    const imp = await importarCertValido();
    certificateService.certificates.get(imp.certificateId).status = 'revoked';
    const r = await certificateService.validateCertificateForOperation(imp.certificateId, 'H1');
    expect(r.valid).toBe(false);
    expect(r.checks.isActive).toBe(false);
    expect(r.luciAnalysis.message).toMatch(/estado "revoked"/);
  });

  test('un cert expirado no es valido', async () => {
    const imp = await importarCertValido();
    certificateService.certificates.get(imp.certificateId).validTo =
      new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const r = await certificateService.validateCertificateForOperation(imp.certificateId, 'H1');
    expect(r.valid).toBe(false);
    expect(r.checks.notExpired).toBe(false);
    expect(r.luciAnalysis.message).toMatch(/expirado/i);
  });

  test('certificado inexistente falla', async () => {
    const r = await certificateService.validateCertificateForOperation('noexiste', 'H1');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });
});
