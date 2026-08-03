/**
 * Logica de negocio de oeaService.
 *
 * Complementa oeaPueOwnership.test.js, que cubre la propiedad. Aqui se cubren
 * las dos funciones con consecuencia real:
 *
 * - validateApplication: decide si una solicitud OEA puede presentarse. Un
 *   falso positivo la manda a la AEAT incompleta.
 * - calculateGuaranteeReduction: reduce el importe de la garantia que el
 *   operador tiene que constituir. Un error aqui es dinero inmovilizado de mas
 *   o una garantia insuficiente ante Aduanas.
 */

const mockOEA = { findById: jest.fn() };

jest.mock('../../src/models/OEA', () => mockOEA);
jest.mock('../../src/models', () => ({ OEA: mockOEA, Guarantee: { findById: jest.fn() } }));

const oeaService = require('../../src/services/oeaService');

/** Los errores son objetos {field, message}; se compara por field. */
const campos = (r) => r.errors.map(e => e.field);

/** Solicitud OEA completa, la que si deberia pasar la validacion. */
function solicitud(overrides = {}) {
  return {
    certification: { type: 'OEAC' },
    organization: {
      name: 'STRIX AI SL',
      nif: 'B22477020',
      eori: 'ESB22477020',
      address: { street: 'Calle 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
      contact: { name: 'Luis Rodriguez', email: 'luis@strixai.es', phone: '+34600000000' },
      legalRepresentative: { name: 'Jenifer Romero', nif: '70073780W' },
      ...overrides.organization
    }
  };
}

describe('oeaService.validateApplication', () => {
  test('una solicitud completa es valida', () => {
    const r = oeaService.validateApplication(solicitud());

    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test.each(['name', 'nif', 'eori'])('falta %s -> invalida', (campo) => {
    const s = solicitud();
    delete s.organization[campo];

    const r = oeaService.validateApplication(s);

    expect(r.valid).toBe(false);
    expect(campos(r)).toContain(`organization.${campo}`);
  });

  test('exige un tipo de certificacion valido', () => {
    const s = solicitud();
    s.certification = { type: 'INVENTADO' };

    expect(campos(oeaService.validateApplication(s))).toContain('certification.type');
  });

  test('una direccion sin ciudad se considera incompleta', () => {
    const s = solicitud();
    s.organization.address = { street: 'Calle 1' };

    const r = oeaService.validateApplication(s);

    expect(campos(r)).toContain('organization.address');
  });

  test('exige contacto con nombre y email', () => {
    const s = solicitud();
    s.organization.contact = {};

    const r = oeaService.validateApplication(s);

    expect(campos(r)).toContain('organization.contact.name');
    expect(campos(r)).toContain('organization.contact.email');
  });

  test('exige representante legal', () => {
    const s = solicitud();
    delete s.organization.legalRepresentative;

    const r = oeaService.validateApplication(s);

    expect(campos(r)).toContain('organization.legalRepresentative');
  });

  test('acumula todos los errores, no solo el primero', () => {
    // Quien rellena el formulario debe ver de una vez todo lo que le falta.
    const r = oeaService.validateApplication({ organization: {} });

    expect(r.errors.length).toBeGreaterThanOrEqual(7);
  });

  test('REGRESION: una solicitud sin contacto ni representante NO es valida', () => {
    // Habia dos validateApplication: el metodo de la clase y una asignacion a
    // la instancia que lo sobrescribia. submitForReview llamaba a la segunda,
    // que solo miraba nombre, NIF, EORI y tipo — asi que una solicitud sin
    // direccion, sin contacto y sin representante legal pasaba a revision.
    const r = oeaService.validateApplication({
      organization: { name: 'X SL', nif: 'B1', eori: 'ESB1' },
      certification: { type: 'OEAC' }
    });

    expect(r.valid).toBe(false);
    expect(campos(r)).toEqual(expect.arrayContaining([
      'organization.address',
      'organization.contact.name',
      'organization.legalRepresentative'
    ]));
  });
});

describe('oeaService.calculateGuaranteeReduction', () => {
  beforeEach(() => jest.clearAllMocks());

  /** OEA aprobada con el porcentaje de reduccion indicado. */
  function oeaAprobada(pct, tipo = 'OEAC') {
    return {
      certification: { status: 'approved', number: 'ESOEAC0001', type: tipo },
      getGuaranteeReductionPercentage: () => pct
    };
  }

  test('aplica la reduccion sobre el importe original', () => {
    mockOEA.findById.mockResolvedValue(oeaAprobada(30));

    return oeaService.calculateGuaranteeReduction('o1', 10000).then(r => {
      expect(r.applicable).toBe(true);
      expect(r.reductionPercentage).toBe(30);
      expect(r.reducedAmount).toBe(7000);
      expect(r.originalAmount).toBe(10000);
    });
  });

  test('una OEA no aprobada no reduce nada', async () => {
    // Solo la certificacion en vigor da derecho a la reduccion: aplicarla antes
    // dejaria la garantia por debajo de lo exigido por Aduanas.
    mockOEA.findById.mockResolvedValue({
      certification: { status: 'under_review', type: 'OEAC' },
      getGuaranteeReductionPercentage: () => 30
    });

    const r = await oeaService.calculateGuaranteeReduction('o1', 10000);

    expect(r.applicable).toBe(false);
    expect(r.reducedAmount).toBe(10000);
    expect(r.reductionPercentage).toBe(0);
  });

  test('una OEA inexistente no reduce nada', async () => {
    mockOEA.findById.mockResolvedValue(null);

    const r = await oeaService.calculateGuaranteeReduction('o9', 5000);

    expect(r.applicable).toBe(false);
    expect(r.reducedAmount).toBe(5000);
  });

  test('una reduccion del 0% se marca como no aplicable', async () => {
    mockOEA.findById.mockResolvedValue(oeaAprobada(0));

    const r = await oeaService.calculateGuaranteeReduction('o1', 10000);

    expect(r.applicable).toBe(false);
    expect(r.reducedAmount).toBe(10000);
  });

  test('la reduccion del 100% deja la garantia a cero', async () => {
    mockOEA.findById.mockResolvedValue(oeaAprobada(100, 'OEAF'));

    const r = await oeaService.calculateGuaranteeReduction('o1', 10000);

    expect(r.reducedAmount).toBe(0);
    expect(r.applicable).toBe(true);
  });

  test('el motivo indica el tipo de OEA y el porcentaje', async () => {
    mockOEA.findById.mockResolvedValue(oeaAprobada(50, 'OEAF'));

    const r = await oeaService.calculateGuaranteeReduction('o1', 10000);

    expect(r.reason).toContain('OEAF');
    expect(r.reason).toContain('50');
  });
});

describe('oeaService: catalogos', () => {
  test('los beneficios por defecto dependen del tipo de certificacion', () => {
    const oeac = oeaService.getDefaultBenefits('OEAC');
    const oeas = oeaService.getDefaultBenefits('OEAS');

    expect(oeac).toBeDefined();
    expect(oeas).toBeDefined();
    expect(JSON.stringify(oeac)).not.toBe(JSON.stringify(oeas));
  });

  test('el catalogo de socios de reconocimiento mutuo no esta vacio', () => {
    // Son los paises con acuerdo de reconocimiento mutuo con la UE.
    const socios = oeaService.getMutualRecognitionPartners();

    expect(Array.isArray(socios)).toBe(true);
    expect(socios.length).toBeGreaterThan(0);
  });

  test('el catalogo de beneficios no esta vacio', () => {
    expect(Object.keys(oeaService.getBenefitsCatalog()).length).toBeGreaterThan(0);
  });
});
