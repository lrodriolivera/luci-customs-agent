/**
 * Helper unico de identificacion aduanera: ninguna declaracion lleva un EORI
 * inventado ("ESundefined"), vacio o de otra empresa.
 */
const {
  eoriDe, representanteDelTenant, exigirEori, declarantePara, ErrorValidacion
} = require('../../../src/services/forms/identificadorAduanero');

describe('eoriDe', () => {
  test('devuelve el eori si existe', () => {
    expect(eoriDe({ eori: 'ESB11111111', nif: 'B22222222' })).toBe('ESB11111111');
  });
  test('sin eori compone ES + nif cuando el nif es una cadena no vacia', () => {
    expect(eoriDe({ nif: 'B22222222' })).toBe('ESB22222222');
  });
  test('ambos vacios -> null, nunca ESundefined ni ESnull', () => {
    expect(eoriDe({})).toBeNull();
    expect(eoriDe({ eori: '', nif: '' })).toBeNull();
    expect(eoriDe({ eori: null, nif: null })).toBeNull();
    expect(eoriDe(undefined)).toBeNull();
    expect(eoriDe(null)).toBeNull();
  });
  test('nif que no es cadena -> null', () => {
    expect(eoriDe({ nif: 123456 })).toBeNull();
    expect(eoriDe({ nif: {} })).toBeNull();
    expect(eoriDe({ nif: '   ' })).toBeNull();
  });
  test('normaliza a mayusculas y recorta espacios', () => {
    expect(eoriDe({ eori: ' esb11111111 ' })).toBe('ESB11111111');
    expect(eoriDe({ nif: ' b22222222 ' })).toBe('ESB22222222');
  });
  test('un eori que no es cadena se ignora', () => {
    expect(eoriDe({ eori: 5, nif: 'B22222222' })).toBe('ESB22222222');
  });
});

describe('representanteDelTenant', () => {
  const tenant = {
    name: 'Agencia Uno',
    customsConfig: { eoriNumbers: { ES: 'ESA11111111', NL: 'NL123456789' } },
    businessInfo: { eori: 'ESB99999999' },
    primaryContact: { name: 'Ana', email: 'ana@x.es', phone: '600' }
  };
  test('usa el EORI del pais configurado en customsConfig', () => {
    const r = representanteDelTenant(tenant, 'NL');
    expect(r.eori).toBe('NL123456789');
    expect(r.companyName).toBe('Agencia Uno');
    expect(r.contact).toEqual({ name: 'Ana', email: 'ana@x.es', phone: '600' });
    expect(r.representationType).toBe('indirect');
  });
  test('por defecto ES', () => {
    expect(representanteDelTenant(tenant).eori).toBe('ESA11111111');
  });
  test('sin EORI de ese pais cae a businessInfo.eori solo para ES', () => {
    const t = { ...tenant, customsConfig: { eoriNumbers: {} } };
    expect(representanteDelTenant(t, 'ES').eori).toBe('ESB99999999');
    expect(representanteDelTenant(t, 'NL').eori).toBeNull();
  });
  test('sin ninguno -> eori null', () => {
    expect(representanteDelTenant({ name: 'X' }).eori).toBeNull();
    expect(representanteDelTenant(null).eori).toBeNull();
    expect(representanteDelTenant(undefined).companyName).toBeNull();
  });
  test('prefiere companyName y no inventa nombre ni contacto', () => {
    const r = representanteDelTenant({ companyName: 'Razon SL', name: 'Corto' });
    expect(r.companyName).toBe('Razon SL');
    expect(r.contact).toEqual({ name: null, email: null, phone: null });
  });
  test('un EORI aun cifrado (sin clave) no se usa', () => {
    const t = { name: 'X', businessInfo: { eori: 'v1:abcdef' } };
    expect(representanteDelTenant(t).eori).toBeNull();
  });
});

describe('exigirEori', () => {
  test('devuelve el valor si existe', () => {
    expect(exigirEori('ESB1', 'representante')).toBe('ESB1');
  });
  test('representante: 422 con aviso hacia Ajustes > Aduanas', () => {
    let e;
    try { exigirEori(null, 'representante'); } catch (x) { e = x; }
    expect(e).toBeInstanceOf(ErrorValidacion);
    expect(e.status).toBe(422);
    expect(e.message).toBe('Falta el EORI del representante: configúralo en Ajustes > Aduanas');
  });
  test('cliente: 422 con aviso hacia la ficha del cliente', () => {
    let e;
    try { exigirEori('', 'cliente'); } catch (x) { e = x; }
    expect(e.status).toBe(422);
    expect(e.message).toBe('Falta el EORI del cliente: complétalo en la ficha del cliente');
  });
});

describe('declarantePara', () => {
  const tenant = {
    name: 'Agencia Uno',
    customsConfig: { eoriNumbers: { ES: 'ESA11111111' } },
    primaryContact: { name: 'Ana', email: 'ana@x.es' }
  };
  test('el representante del expediente con EORI manda', () => {
    const d = declarantePara({ representative: { eori: 'ESR1', companyName: 'Rep SL', contact: { name: 'Rosa' } } }, tenant);
    expect(d.eori).toBe('ESR1');
    expect(d.companyName).toBe('Rep SL');
    expect(d.contact.name).toBe('Rosa');
  });
  test('sin representante usa el del tenant', () => {
    const d = declarantePara({}, tenant);
    expect(d.eori).toBe('ESA11111111');
    expect(d.companyName).toBe('Agencia Uno');
    expect(d.contact.name).toBe('Ana');
  });
  test('representante sin EORI ni NIF: se ignora y se usa el tenant', () => {
    expect(declarantePara({ representative: { companyName: 'X' } }, tenant).eori).toBe('ESA11111111');
  });
  test('representante con solo NIF compone ES+NIF', () => {
    const d = declarantePara({ representative: { nif: 'b3', companyName: 'Rep' } }, tenant);
    expect(d.eori).toBe('ESB3');
  });
  test('sin representante ni tenant -> 422 del representante', () => {
    expect(() => declarantePara({}, undefined)).toThrow(/Falta el EORI del representante/);
    expect(() => declarantePara({}, { name: 'X' })).toThrow(ErrorValidacion);
  });
  test('sin nombre -> 422 y nunca STRIX AI SL', () => {
    const t = { customsConfig: { eoriNumbers: { ES: 'ESA1' } } };
    let e; try { declarantePara({}, t); } catch (x) { e = x; }
    expect(e.status).toBe(422);
    expect(e.message).toMatch(/nombre del representante/);
  });
  test('sin contacto no inventa "Departamento Aduanas"', () => {
    const d = declarantePara({}, { name: 'A', customsConfig: { eoriNumbers: { ES: 'ESA1' } } });
    expect(d.contact.name).toBeNull();
  });
});
