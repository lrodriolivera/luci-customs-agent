/**
 * oeaService (OEA - Operador Economico Autorizado): helpers PUROS.
 *
 * El servicio entero toca el modelo OEA (Mongo) para el ciclo de vida de una
 * certificacion, pero una franja grande es logica de negocio pura: el catalogo
 * de beneficios por tipo (OEAC/OEAS/OEAF), las REDUCCIONES DE GARANTIA por tipo
 * (calculo critico segun la prioridad del proyecto), las simplificaciones
 * aplicables, el reconocimiento mutuo, la validacion de la solicitud y la
 * evaluacion del estado de cumplimiento. Nada de eso sale a la BD.
 *
 * Que se mockea y por que: SOLO el modelo OEA, y unicamente para que el modulo
 * cargue sin abrir Mongoose. NINGUN helper bajo prueba usa el modelo, asi que el
 * mock nunca interviene en la logica que se asegura. logger es inofensivo.
 *
 * OEAF combina OEAC + OEAS; es el punto donde mas facil se cuela un fallo de
 * cobertura de garantias, por eso se cubre explicitamente.
 */

jest.mock('../../src/models/OEA', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findExpiring: jest.fn()
}));

const oea = require('../../src/services/oeaService');

describe('getBenefitsByType: catalogo de beneficios por tipo', () => {
  test('OEAC devuelve los 6 beneficios aduaneros marcados para OEAC/OEAF', () => {
    const benefits = oea.getBenefitsByType('OEAC');
    expect(benefits).toHaveLength(6);
    expect(benefits.every(b => b.types.includes('OEAC') && b.types.includes('OEAF'))).toBe(true);
    expect(benefits.map(b => b.code)).toContain('OEAC-01');
  });

  test('OEAS devuelve los 5 beneficios de seguridad', () => {
    const benefits = oea.getBenefitsByType('OEAS');
    expect(benefits).toHaveLength(5);
    expect(benefits.map(b => b.code)).toContain('OEAS-04');
  });

  test('OEAF combina beneficios de OEAC y OEAS (6 + 5)', () => {
    const benefits = oea.getBenefitsByType('OEAF');
    expect(benefits).toHaveLength(11);
  });

  test('un tipo invalido devuelve una lista vacia', () => {
    expect(oea.getBenefitsByType('OTRO')).toEqual([]);
    expect(oea.getBenefitsByType(undefined)).toEqual([]);
  });
});

describe('getGuaranteeReductionForType: reduccion de garantia (calculo critico)', () => {
  test('OEAF exime al 100% garantia global y transito', () => {
    expect(oea.getGuaranteeReductionForType('OEAF')).toEqual({ comprehensive: 100, transit: 100 });
  });

  test('OEAC reduce 50% global y 30% transito', () => {
    expect(oea.getGuaranteeReductionForType('OEAC')).toEqual({ comprehensive: 50, transit: 30 });
  });

  test('OEAS no da reduccion (0/0)', () => {
    expect(oea.getGuaranteeReductionForType('OEAS')).toEqual({ comprehensive: 0, transit: 0 });
  });

  test('un tipo sin reduccion definida devuelve null', () => {
    expect(oea.getGuaranteeReductionForType('OTRO')).toBeNull();
  });
});

describe('simplificaciones aplicables por tipo', () => {
  test('OEAC accede a las 6 simplificaciones (todas exigen OEAC/OEAF)', () => {
    const simps = oea.getSimplificationsForType('OEAC');
    expect(simps).toHaveLength(6);
    expect(simps.every(s => s.applicableTo.includes('OEAC'))).toBe(true);
    expect(simps.map(s => s.code)).toContain('GGR');
  });

  test('OEAS no accede a ninguna simplificacion de la lista', () => {
    expect(oea.getSimplificationsForType('OEAS')).toHaveLength(0);
  });

  test('getAvailableSimplifications filtra igual por tipo', () => {
    expect(oea.getAvailableSimplifications('OEAF')).toHaveLength(6);
    expect(oea.getAvailableSimplifications('OEAS')).toHaveLength(0);
  });

  test('getSimplificationsCatalog expone toda la lista con applicableTo', () => {
    const cat = oea.getSimplificationsCatalog();
    expect(cat).toHaveLength(6);
    expect(cat[0].applicableTo).toEqual(cat[0].requirements);
  });
});

describe('checkComplianceRequirements: requisitos por tipo', () => {
  test('OEAC NO exige normas de seguridad; el resto son obligatorias', () => {
    const req = oea.checkComplianceRequirements('OEAC');
    expect(req.securityStandards.required).toBe(false);
    expect(req.customsCompliance.required).toBe(true);
    expect(req.recordKeeping.required).toBe(true);
    expect(req.financialSolvency.required).toBe(true);
    expect(req.practicalCompetence.required).toBe(true);
  });

  test('OEAS y OEAF SI exigen normas de seguridad', () => {
    expect(oea.checkComplianceRequirements('OEAS').securityStandards.required).toBe(true);
    expect(oea.checkComplianceRequirements('OEAF').securityStandards.required).toBe(true);
  });
});

describe('assessComplianceStatus: semaforo de cumplimiento', () => {
  const ok = { status: 'met' };
  const parcial = { status: 'partial' };
  const falla = { status: 'not_met' };

  test('cualquier requisito no cumplido es critico', () => {
    const req = { customsCompliance: falla, recordKeeping: ok, financialSolvency: ok, practicalCompetence: ok };
    expect(oea.assessComplianceStatus(req, 'OEAC')).toBe('critical');
  });

  test('mas de un parcial es warning', () => {
    const req = { customsCompliance: parcial, recordKeeping: parcial, financialSolvency: ok, practicalCompetence: ok };
    expect(oea.assessComplianceStatus(req, 'OEAC')).toBe('warning');
  });

  test('exactamente un parcial es aceptable', () => {
    const req = { customsCompliance: parcial, recordKeeping: ok, financialSolvency: ok, practicalCompetence: ok };
    expect(oea.assessComplianceStatus(req, 'OEAC')).toBe('acceptable');
  });

  test('todo cumplido es excelente', () => {
    const req = { customsCompliance: ok, recordKeeping: ok, financialSolvency: ok, practicalCompetence: ok };
    expect(oea.assessComplianceStatus(req, 'OEAC')).toBe('excellent');
  });

  test('para OEAS/OEAF la seguridad tambien cuenta en el semaforo', () => {
    const req = { customsCompliance: ok, recordKeeping: ok, financialSolvency: ok, practicalCompetence: ok, securityStandards: falla };
    expect(oea.assessComplianceStatus(req, 'OEAF')).toBe('critical');
  });
});

describe('calculateExpirationDate: la certificacion OEA dura 5 anos', () => {
  test('suma 5 anos a la fecha de aprobacion dada', () => {
    const exp = oea.calculateExpirationDate('2026-01-15');
    expect(exp.getFullYear()).toBe(2031);
    expect(exp.getMonth()).toBe(0);
  });

  test('sin fecha parte de hoy y suma 5 anos', () => {
    const exp = oea.calculateExpirationDate();
    const esperado = new Date().getFullYear() + 5;
    expect(exp.getFullYear()).toBe(esperado);
  });
});

describe('generateOEANumber: numero de certificado', () => {
  test('compone pais + tipo + anho y toma el pais del EORI', () => {
    const num = oea.generateOEANumber('OEAC', 'ESB22477020');
    expect(num.startsWith(`ESOEAC${new Date().getFullYear()}`)).toBe(true);
  });

  test('sin EORI el pais cae a ES', () => {
    expect(oea.generateOEANumber('OEAF', undefined).startsWith('ESOEAF')).toBe(true);
  });
});

describe('getDefaultBenefits: beneficios iniciales inactivos', () => {
  test('OEAF arranca con 11 beneficios, todos inactivos', () => {
    const benefits = oea.getDefaultBenefits('OEAF');
    expect(benefits).toHaveLength(11);
    expect(benefits.every(b => b.active === false && b.activatedDate === null)).toBe(true);
  });

  test('OEAS arranca solo con los 5 de seguridad', () => {
    expect(oea.getDefaultBenefits('OEAS')).toHaveLength(5);
  });

  test('un tipo desconocido no da beneficios', () => {
    expect(oea.getDefaultBenefits('OTRO')).toEqual([]);
  });
});

describe('catalogos estaticos', () => {
  test('getBenefitsCatalog devuelve los tres grupos', () => {
    const cat = oea.getBenefitsCatalog();
    expect(cat).toHaveProperty('OEAC');
    expect(cat).toHaveProperty('OEAS');
    expect(cat).toHaveProperty('OEAF');
  });

  test('getMutualRecognitionPartners incluye a EE.UU. y Reino Unido', () => {
    const partners = oea.getMutualRecognitionPartners();
    const codes = partners.map(p => p.countryCode);
    expect(codes).toContain('US');
    expect(codes).toContain('GB');
  });

  test('getInfo describe el modulo con periodo de 5 anos', () => {
    expect(oea.getInfo().certificationPeriod).toBe('5 years');
  });

  test('getAuditTypes enumera los cuatro tipos de auditoria', () => {
    expect(oea.getAuditTypes()).toEqual(['internal', 'external', 'aeat', 'renewal']);
  });
});

describe('validateApplication: la solicitud exige datos completos', () => {
  /** Solicitud completa y valida. */
  function solicitudValida(extra = {}) {
    return {
      organization: {
        name: 'STRIX AI SL',
        nif: 'B22477020',
        eori: 'ESB22477020',
        address: { city: 'Madrid' },
        contact: { name: 'Luis', email: 'luis@strixai.es' },
        legalRepresentative: { name: 'Jenifer' }
      },
      certification: { type: 'OEAC' },
      ...extra
    };
  }

  test('una solicitud completa es valida', () => {
    const r = oea.validateApplication(solicitudValida());
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test('falta el tipo de certificacion -> invalida', () => {
    const r = oea.validateApplication(solicitudValida({ certification: { type: 'OTRO' } }));
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.field)).toContain('certification.type');
  });

  test('regresion: sin direccion, contacto ni representante legal es invalida (bug arreglado)', () => {
    // Estas 4 comprobaciones vivian muertas en el metodo de clase; la version de
    // la instancia las ejecuta de verdad. Una solicitud sin ellas NO debe pasar.
    const r = oea.validateApplication({
      organization: { name: 'X', nif: 'B1', eori: 'ES1' },
      certification: { type: 'OEAC' }
    });
    expect(r.valid).toBe(false);
    const campos = r.errors.map(e => e.field);
    expect(campos).toContain('organization.address');
    expect(campos).toContain('organization.contact.name');
    expect(campos).toContain('organization.contact.email');
    expect(campos).toContain('organization.legalRepresentative');
  });

  test('una solicitud vacia acumula todos los errores', () => {
    const r = oea.validateApplication({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(7);
  });
});

describe('validateAuditData: validacion de auditoria', () => {
  test('una auditoria completa y coherente es valida', () => {
    const r = oea.validateAuditData({ date: '2026-01-01', type: 'aeat', result: 'passed' });
    expect(r.valid).toBe(true);
  });

  test('tipo y resultado invalidos y sin fecha acumulan tres errores', () => {
    const r = oea.validateAuditData({ type: 'x', result: 'y' });
    expect(r.valid).toBe(false);
    expect(r.errors.map(e => e.field).sort()).toEqual(['date', 'result', 'type']);
  });
});
