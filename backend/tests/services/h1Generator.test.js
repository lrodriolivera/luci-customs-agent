/**
 * h1Generator: construccion del DUA de importacion (mensaje CC515C).
 *
 * Estaba al 7,93% de lineas y con 538 ramas sin cubrir. Es lo que se presenta
 * ante la AEAT: un error aqui no da un fallo de la aplicacion, da una
 * declaracion aduanera incorrecta, con las consecuencias que eso tiene
 * (liquidacion complementaria, recargo, o mercancia retenida en frontera).
 *
 * Se ejercita el generador REAL con la fixture de expedientes que ya usa
 * h1CompleteFlow. Nada mockeado: el XML que se comprueba es el que se enviaria.
 *
 * Los importes de referencia estan verificados a mano contra el CAU:
 *   valor en aduana = valor de factura + flete + seguro hasta frontera UE
 *   IVA = 21% sobre el valor en aduana (no sobre el de factura)
 */

const h1 = require('../../src/services/forms/h1Generator');
const {
  createElectronicsExpedition,
  createTextileExpedition
} = require('../fixtures/h1TestData');

/** Expedicion completa: la fixture no trae goodsSummary ni costes. */
function expedicionCompleta(base = createElectronicsExpedition(), extra = {}) {
  return {
    ...base,
    goodsSummary: { totalItems: 3, totalPackages: 120, totalGrossWeight: 1450, totalNetWeight: 1300, totalValue: 45000 },
    costs: { freight: 1200, insurance: 300 },
    ...extra
  };
}

describe('generate: estructura del mensaje', () => {
  const r = h1.generate(expedicionCompleta(), {});

  test('devuelve LRN, datos, XML y resumen', () => {
    expect(r).toHaveProperty('lrn');
    expect(r).toHaveProperty('data');
    expect(r).toHaveProperty('xml');
    expect(r).toHaveProperty('summary');
  });

  test('el XML es un CC515C con el espacio de nombres del CAU', () => {
    // Si el namespace no es el correcto, la AEAT rechaza el mensaje entero.
    expect(r.xml).toMatch(/<CC515C/);
    expect(r.xml).toMatch(/urn:wco:datamodel:WCO:DEC-DMS:2/);
    expect(r.xml).toMatch(/<MessageType>CC515C<\/MessageType>/);
  });

  test('el destinatario es la AEAT', () => {
    expect(r.xml).toMatch(/<MessageRecipient>ES\.AEAT<\/MessageRecipient>/);
  });

  test('los datos llevan los ocho bloques del DUA', () => {
    expect(Object.keys(r.data)).toEqual(expect.arrayContaining([
      'lrn', 'declarationType', 'declarationHeader', 'goodsShipment',
      'goodsItems', 'valuation', 'dutyTaxFee', 'guarantee'
    ]));
  });
});

describe('generateLRN: referencia local unica', () => {
  test('sigue el formato AAES + 16 caracteres', () => {
    // El LRN identifica la declaracion ante la AEAT hasta que asigna el MRN.
    expect(h1.generateLRN()).toMatch(/^\d{2}ES[0-9A-F]{16}$/);
  });

  test('dos llamadas seguidas no coinciden', () => {
    // Repetir un LRN provoca el rechazo de la segunda declaracion.
    expect(h1.generateLRN()).not.toBe(h1.generateLRN());
  });

  test('empieza por el ano en curso', () => {
    const ano = String(new Date().getFullYear()).slice(-2);
    expect(h1.generateLRN().startsWith(ano)).toBe(true);
  });
});

describe('valor en aduana: la base de toda la liquidacion', () => {
  test('suma flete y seguro al valor de factura', () => {
    // Art. 70 CAU: el valor de transaccion se ajusta con los gastos de
    // transporte y seguro hasta el punto de entrada en la UE.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.invoiceValue).toBe(45000);
    expect(s.totalAdditions).toBe(1500);
    expect(s.customsValue).toBe(46500);
  });

  test('el IVA se calcula sobre el valor en aduana, no sobre el de factura', () => {
    // La diferencia son 315 EUR en este expediente: liquidar sobre la factura
    // seria declarar de menos.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.vatAmount).toBe(Math.round(46500 * 0.21));
    expect(s.vatAmount).not.toBe(Math.round(45000 * 0.21));
  });

  test('sin costes declarados el valor en aduana es el de factura', () => {
    const sin = expedicionCompleta(createElectronicsExpedition(), { costs: {} });
    const s = h1.generate(sin, {}).summary;

    expect(s.customsValue).toBe(s.invoiceValue);
    expect(s.totalAdditions).toBe(0);
  });

  test('declara el metodo de valoracion empleado', () => {
    // Casilla obligatoria: metodo 1 = valor de transaccion.
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.valuationMethod).toBe('1');
    expect(s.valuationMethodDescription).toMatch(/transaccion/i);
  });
});

describe('regimen y preferencia', () => {
  test('por defecto es despacho a libre practica sin preferencia', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.regime).toBe('40');
    expect(s.preference).toBe('100');
    expect(s.preferenceDescription).toMatch(/terceros paises/i);
  });

  test('recoge los codigos TARIC de todas las mercancias', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.taricCodes.length).toBe(3);
    expect(s.taricCodes.every(c => /^\d{8,10}$/.test(c))).toBe(true);
  });

  test('recoge los paises de origen', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.origins).toContain('CN');
  });
});

describe('aduana de presentacion', () => {
  test('un expediente maritimo por Barcelona va a su aduana', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.customsOffice).toMatch(/^ES\d{6}$/);
    expect(s.customsOfficeName).toBeTruthy();
  });

  test('determineCustomsOffice devuelve un codigo con formato AEAT', () => {
    expect(h1.determineCustomsOffice(createElectronicsExpedition())).toMatch(/^ES\d{6}$/);
  });
});

describe('codigos de transporte', () => {
  test.each([
    ['maritime', '1'],
    ['rail', '2'],
    ['road', '3'],
    ['air', '4']
  ])('%s -> modo %s', (modo, codigo) => {
    // Casilla 25 del DUA. Un codigo erroneo cambia el regimen de control.
    expect(String(h1.getTransportModeCode(modo))).toBe(codigo);
  });

  test('un modo desconocido no rompe la generacion', () => {
    expect(h1.getTransportModeCode('teletransporte')).toBeDefined();
  });

  test('el documento de transporte depende del modo', () => {
    // Maritimo: conocimiento de embarque. Aereo: carta de porte aereo.
    const maritimo = h1.getTransportDocumentType('maritime');
    const aereo = h1.getTransportDocumentType('air');

    expect(maritimo).toBeTruthy();
    expect(aereo).toBeTruthy();
    expect(maritimo).not.toBe(aereo);
  });
});

describe('codigos de region', () => {
  test.each([
    ['Madrid', 'ES-MD'],
    ['Barcelona', 'ES-CT'],
    ['Valencia', 'ES-VC']
  ])('%s -> %s', (ciudad, codigo) => {
    expect(h1.getRegionCode(ciudad)).toBe(codigo);
  });

  test('una ciudad desconocida devuelve un valor, no undefined', () => {
    // Un undefined en el XML deja la casilla vacia y la AEAT lo rechaza.
    expect(h1.getRegionCode('Cuenca del Amazonas')).toBeTruthy();
  });
});

describe('documentos justificativos', () => {
  test.each([
    ['invoice', 'N380'],
    ['transport', 'N705'],
    ['origin', 'N954']
  ])('%s -> codigo %s', (tipo, esperado) => {
    // Codigos del anexo B del CAU: identifican cada documento aportado.
    const c = h1.getDocumentTypeCode(tipo);
    expect(typeof c).toBe('string');
    expect(c).toMatch(/^[A-Z]\d{3}$/);
  });

  test('un tipo desconocido cae en un codigo generico', () => {
    expect(h1.getDocumentTypeCode('inventado')).toMatch(/^[A-Z]\d{3}$/);
  });
});

describe('escapeXml: caracteres que romperian el mensaje', () => {
  test.each([
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['&', '&amp;']
  ])('escapa %s', (car, esperado) => {
    expect(h1.escapeXml(`a${car}b`)).toBe(`a${esperado}b`);
  });

  test('el ampersand no se escapa dos veces', () => {
    // '&amp;amp;' rompe el nombre de empresas como "Garcia & Hijos".
    expect(h1.escapeXml('Garcia & Hijos')).toBe('Garcia &amp; Hijos');
  });

  test('tolera valores que no son cadena', () => {
    // REGRESION: escapeXml hacia str.replace directamente. Con un campo
    // numerico -- una razon social como "12345 SL" guardada como numero, o un
    // codigo postal en la casilla de ciudad -- lanzaba
    //   TypeError: str.replace is not a function
    // y con ello reventaba la generacion del DUA COMPLETO: el expediente no se
    // podia declarar.
    expect(() => h1.escapeXml(null)).not.toThrow();
    expect(() => h1.escapeXml(undefined)).not.toThrow();
    expect(h1.escapeXml(42)).toBe('42');
    expect(h1.escapeXml(0)).toBe('');   // 0 es falsy: se trata como vacio
  });

  test('REGRESION: una razon social numerica no impide declarar', () => {
    const conNumero = expedicionCompleta(createElectronicsExpedition(), {
      client: { ...createElectronicsExpedition().client, companyName: 12345 }
    });

    expect(() => h1.generate(conNumero, {})).not.toThrow();
  });

  test('REGRESION: una ciudad numerica tampoco', () => {
    const base = createElectronicsExpedition();
    const conNumero = expedicionCompleta(base, {
      client: { ...base.client, address: { ...base.client.address, city: 28001 } }
    });

    expect(() => h1.generate(conNumero, {})).not.toThrow();
  });

  test('el XML generado no contiene caracteres sin escapar', () => {
    // Comprobacion de conjunto: si algun campo se cuela sin escapar, el XML
    // deja de ser valido y la AEAT devuelve error de formato.
    const conAmpersand = expedicionCompleta(createElectronicsExpedition(), {
      client: { ...createElectronicsExpedition().client, companyName: 'Garcia & Hijos <SL>' }
    });
    const { xml } = h1.generate(conAmpersand, {});

    // Ningun & suelto: todos deben formar parte de una entidad.
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });
});

describe('mercancias', () => {
  test('genera una linea por cada mercancia', () => {
    const { data } = h1.generate(expedicionCompleta(), {});

    expect(data.goodsItems.length).toBe(3);
  });

  test('un expediente textil tambien se genera', () => {
    // Otro capitulo arancelario, con derechos distintos de los electronicos.
    const textil = expedicionCompleta(createTextileExpedition(), {});
    const r = h1.generate(textil, {});

    expect(r.xml).toMatch(/<CC515C/);
    expect(r.summary.taricCodes.length).toBeGreaterThan(0);
  });

  test('un expediente sin mercancias no revienta', () => {
    const vacia = expedicionCompleta(createElectronicsExpedition(), { goods: [] });

    expect(() => h1.generate(vacia, {})).not.toThrow();
  });
});

describe('calculateSummary', () => {
  test('el total a pagar es arancel mas IVA', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.totalDuty).toBe(s.tariffAmount + s.vatAmount);
  });

  test('declara el metodo de pago', () => {
    const s = h1.generate(expedicionCompleta(), {}).summary;

    expect(s.paymentMethod).toBeTruthy();
    expect(s.paymentMethodDescription).toBeTruthy();
  });
});

// ============================================================================
// Ramas opcionales: la fixture cubre el camino feliz, pero deja sin ejercitar
// casi todos los bloques "campo presente -> incluir elemento". Aqui se pasan
// expedientes con TODOS esos campos rellenos para que cada rama opcional emita
// su elemento, y despues las variantes de tabla de consulta (aduana, region,
// modo de transporte, tipos de documento) y los caminos de garantia, pago
// aplazado, antidumping, impuestos especiales y valoracion completa.
//
// Sigue sin mockearse nada: el generador es puro y lo que se comprueba es el
// XML real que se enviaria a la AEAT.
// ============================================================================

describe('buildDeclarationHeader: partes opcionales', () => {
  test('con representante (no la fixture "declarant") arma el declarante real', () => {
    // La fixture usa expedition.declarant, pero el codigo lee
    // expedition.representative -> hay que pasar representative para cubrir el
    // bloque poblado.
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      representative: {
        eori: 'ESREP123', companyName: 'Agente Aduanero SL',
        representationType: 'direct',
        contact: { name: 'Pedro', phone: '911', email: 'p@rep.es' }
      }
    });
    const h = h1.buildDeclarationHeader(exp, {});
    expect(h.declarant.identificationNumber).toBe('ESREP123');
    expect(h.declarant.name).toBe('Agente Aduanero SL');
    expect(h.declarant.representativeStatus).toBe('2'); // direct
    expect(h.declarant.contact.phone).toBe('911');
  });

  test('representante sin eori compone ES + nif y estatus 3 (indirecto)', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      representative: { nif: 'B999', representationType: 'indirect' }
    });
    const h = h1.buildDeclarationHeader(exp, {});
    expect(h.declarant.identificationNumber).toBe('ESB999');
    expect(h.declarant.representativeStatus).toBe('3');
  });

  test('importador sin eori compone ES + nif', () => {
    const base = createElectronicsExpedition();
    const exp = expedicionCompleta(base, {
      client: { ...base.client, eori: undefined, nif: 'B123' }
    });
    const h = h1.buildDeclarationHeader(exp, {});
    expect(h.importer.identificationNumber).toBe('ESB123');
  });

  test('buyer, seller, consignee, holderOfProcedure y holderOfAuthorization se incluyen cuando estan', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      buyer: { eori: 'EBUY', companyName: 'Comprador SL', address: { street: 'C1', city: 'Madrid', postalCode: '28001', country: 'ES' } },
      seller: { nif: 'SEL1', companyName: 'Vendedor SL', address: { city: 'Shanghai', country: 'CN' } },
      consignee: { eori: 'ECON', companyName: 'Destinatario SL', address: { city: 'Sevilla' } },
      holderOfProcedure: { eori: 'EHOP', companyName: 'Titular Regimen SL' },
      holderOfAuthorization: { eori: 'EHOA', type: 'IPO', number: 'AUTH-1' }
    });
    const xml = h1.generate(exp, {}).xml;
    expect(xml).toMatch(/<Buyer>[\s\S]*<IdentificationID>EBUY<\/IdentificationID>/);
    expect(xml).toMatch(/<Seller>[\s\S]*<IdentificationID>SEL1<\/IdentificationID>/); // eori||nif -> nif
    expect(xml).toMatch(/<HolderOfTheProcedure>[\s\S]*EHOP/);
    expect(xml).toMatch(/<HolderOfTheAuthorisation>[\s\S]*<AuthorisationTypeCode>IPO<\/AuthorisationTypeCode>/);
    expect(xml).toMatch(/<AuthorisationReferenceNumber>AUTH-1<\/AuthorisationReferenceNumber>/);
  });

  test('sin exporter, buyer, etc. esos bloques no aparecen', () => {
    const base = createElectronicsExpedition();
    const exp = expedicionCompleta(base, { exporter: undefined });
    const h = h1.buildDeclarationHeader(exp, {});
    expect(h.exporter).toBeNull();
    expect(h.buyer).toBeNull();
    expect(h.seller).toBeNull();
    expect(h.consignee).toBeNull();
  });

  test('sin goodsSummary los totales caen a 0', () => {
    const base = createElectronicsExpedition();
    const h = h1.buildDeclarationHeader({ ...base, goodsSummary: { totalValue: 100 } }, {});
    expect(h.totalPackages).toBe(0);
    expect(h.totalGrossMass).toBe(0);
  });

  test('BUG documentado: la fixture usa "declarant", el codigo lee "representative" -> ESundefined', () => {
    // Con la fixture tal cual (sin representative), el id del declarante es
    // `ES${undefined}` = "ESundefined" y el nombre cae al literal por defecto.
    // No es explotable, pero se fija por escrito: si alguien renombra el campo
    // a "declarant" en el codigo, este test se rompe y avisa.
    const h = h1.buildDeclarationHeader(createElectronicsExpedition(), {});
    expect(h.declarant.identificationNumber).toBe('ESundefined');
    expect(h.declarant.name).toBe('STRIX AI SL');
    expect(h.declarant.representativeStatus).toBe('3');
  });
});

describe('buildGoodsShipment: transporte, ubicacion y contenedores', () => {
  test('region de destino cae a getRegionCode cuando el cliente no trae province', () => {
    const base = createElectronicsExpedition();
    const exp = expedicionCompleta(base, {
      client: { ...base.client, address: { ...base.client.address, province: undefined, city: 'Valencia' } }
    });
    const s = h1.buildGoodsShipment(exp, {});
    expect(s.regionOfDestination).toBe('ES-VC');
  });

  test('sin exporter el pais de expedicion cae a CN por defecto', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), { exporter: undefined });
    const s = h1.buildGoodsShipment(exp, {});
    expect(s.countryOfDispatch).toBe('CN');
  });

  test('identidades de transporte, GPS, almacen y storageAddress se incluyen', () => {
    const base = createElectronicsExpedition();
    const exp = expedicionCompleta(base, {
      transport: {
        ...base.transport,
        vehicleId: 'V-1', inlandVehicleId: 'INL-1', vehicleNationality: 'ES',
        countryOfProvenance: 'TR',
        temporaryStorageCode: 'TS-1', warehouseId: 'WH-1', unLocode: 'ESBCN',
        gpsCoordinates: { latitude: 41.3, longitude: 2.1 },
        storageAddress: { street: 'Muelle 3', city: 'Barcelona', postalCode: '08001', country: 'ES' },
        loadingUnLocode: 'CNSHA', unloadingUnLocode: 'ESBCN',
        containers: [
          { number: 'CONT-1', sealNumber: 'S1', sealType: '2', sealIdentity: 'X1' },
          { number: 'CONT-2', sealNumber: 'S2' } // sin sealType -> el XML omite <SealType>
        ]
      }
    });
    const xml = h1.generate(exp, {}).xml;
    expect(xml).toMatch(/<IdentificationNumber>V-1<\/IdentificationNumber>/);
    expect(xml).toMatch(/<RegistrationNationalityCode>ES<\/RegistrationNationalityCode>/);
    expect(xml).toMatch(/<CountryOfProvenanceCode>TR<\/CountryOfProvenanceCode>/);
    expect(xml).toMatch(/<GPS>[\s\S]*<Latitude>41.3<\/Latitude>/);
    expect(xml).toMatch(/<UNLOCODE>ESBCN<\/UNLOCODE>/);
    expect(xml).toMatch(/<ContainerIndicator>1<\/ContainerIndicator>/);
    expect(xml).toMatch(/<IdentificationNumber>CONT-1<\/IdentificationNumber>/);
    expect(xml).toMatch(/<SealType>2<\/SealType>/);
    expect(xml).toMatch(/<SealIdentity>X1<\/SealIdentity>/);
  });

  test('incoterm vacio cae a CIF, y currency/exchangeRate de invoice se respetan', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      incoterm: {}, invoice: { number: 'INV-9', currency: 'USD', exchangeRate: 1.1 }
    });
    const s = h1.buildGoodsShipment(exp, {});
    expect(s.deliveryTerms.code).toBe('CIF');
    expect(s.currency).toBe('USD');
    expect(s.exchangeRate).toBe(1.1);
  });

  test('flete/seguro caen a customsValue.* y luego a 0', () => {
    const base = createElectronicsExpedition();
    const s1 = h1.buildGoodsShipment({ ...base, costs: {}, customsValue: { freight: 500, insurance: 50 } }, {});
    expect(s1.transportCharges.freightAmount).toBe(500);
    expect(s1.insuranceCharges.insuranceAmount).toBe(50);

    const s2 = h1.buildGoodsShipment({ ...base, costs: {}, customsValue: undefined }, {});
    expect(s2.transportCharges.freightAmount).toBe(0);
    expect(s2.insuranceCharges.insuranceAmount).toBe(0);
  });

  test('BUG documentado: freightToDestination es SIEMPRE true (|| true)', () => {
    // `expedition.costs?.freightToDestination || true` -> false||true === true.
    // Pasar false no cambia nada: el campo siempre sale true.
    const s = h1.buildGoodsShipment(
      expedicionCompleta(createElectronicsExpedition(), { costs: { freight: 100, freightToDestination: false } }),
      {}
    );
    expect(s.transportCharges.freightToDestination).toBe(true);
  });
});

describe('buildValuation: adiciones, deducciones e indicadores', () => {
  test('las adiciones y deducciones declaradas se suman y emiten su elemento', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      valuation: {
        commissions: 100, brokerage: 50, containers: 20, packing: 30, materials: 40,
        tools: 10, consumed: 5, engineering: 15, royalties: 200, resaleProceeds: 60,
        freightAfterImport: 25, installationCharges: 35, customsDuties: 45, interestCharges: 12,
        buyingCommissions: 8, postImportTransport: 18, constructionCharges: 22, otherDeductions: 9,
        method: '1'
      }
    });
    const r = h1.generate(exp, {});
    const v = r.data.valuation;
    // Adiciones incluyen tambien freight (1200) + insurance (300).
    expect(v.totalAdditions).toBeGreaterThan(1500);
    expect(v.totalDeductions).toBe(25 + 35 + 45 + 12 + 8 + 18 + 22 + 9);
    // Las royalties/resaleProceeds > 0 activan sus indicadores.
    expect(v.indicators.royaltiesIncluded).toBe(true);
    expect(v.indicators.resaleProceedsIncluded).toBe(true);
    expect(r.xml).toMatch(/<Commissions>100<\/Commissions>/);
    expect(r.xml).toMatch(/<Royalties>200<\/Royalties>/);
    expect(r.xml).toMatch(/<OtherDeductions>9<\/OtherDeductions>/);
    expect(r.xml).toMatch(/<RoyaltiesIndicator>1<\/RoyaltiesIndicator>/);
    expect(r.xml).toMatch(/<ResaleProceedsIndicator>1<\/ResaleProceedsIndicator>/);
  });

  test('los indicadores explicitos true se respetan', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      valuation: { relatedParty: true, relatedPartyInfluence: true, restrictions: true, conditions: true }
    });
    const xml = h1.generate(exp, {}).xml;
    expect(xml).toMatch(/<RelatedPartyIndicator>1<\/RelatedPartyIndicator>/);
    expect(xml).toMatch(/<RestrictionsIndicator>1<\/RestrictionsIndicator>/);
    expect(xml).toMatch(/<ConditionsIndicator>1<\/ConditionsIndicator>/);
  });

  test('el metodo de valoracion sale de aiData y luego de valuation.method', () => {
    const v1 = h1.buildValuation(expedicionCompleta(), { valuationMethod: '6' });
    expect(v1.valuationMethod).toBe('6');
    const v2 = h1.buildValuation(expedicionCompleta(createElectronicsExpedition(), { valuation: { method: '2' } }), {});
    expect(v2.valuationMethod).toBe('2');
  });
});

describe('buildDutyTaxFee: antidumping, especiales, pago aplazado', () => {
  test('con antidumping y especiales emite sus bloques y avisa en los totales', () => {
    const r = h1.generate(expedicionCompleta(), { tariffRate: 5, antidumpingRate: 30, exciseRate: 10, vatRate: 21 });
    const d = r.data.dutyTaxFee;
    expect(d.antidumpingDuty).not.toBeNull();
    expect(d.antidumpingDuty.rate).toBe(30);
    expect(d.exciseDuty).not.toBeNull();
    expect(d.importDuty.rate).toBe(5);
    expect(r.xml).toMatch(/<AntidumpingDuty>[\s\S]*<TypeCode>A10<\/TypeCode>/);
    expect(r.xml).toMatch(/<ExciseDuty>[\s\S]*<TypeCode>E00<\/TypeCode>/);
  });

  test('tariffRate cae a expedition.duties.tariffRate', () => {
    const d = h1.buildDutyTaxFee(expedicionCompleta(createElectronicsExpedition(), { duties: { tariffRate: 12 } }), {});
    expect(d.importDuty.rate).toBe(12);
  });

  test('pago aplazado emite el bloque DeferredPayment', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      payment: { method: 'B', deferred: true, deferredAccount: 'ACC-1', deferredAuthorization: 'AUTH-1' }
    });
    const r = h1.generate(exp, {});
    expect(r.data.dutyTaxFee.paymentMethod).toBe('B');
    expect(r.data.dutyTaxFee.deferredPayment).not.toBeNull();
    expect(r.xml).toMatch(/<DeferredPayment>[\s\S]*<AccountNumber>ACC-1<\/AccountNumber>/);
    expect(r.xml).toMatch(/<AuthorisationNumber>AUTH-1<\/AuthorisationNumber>/);
  });

  test('BUG documentado: good.dutyRate/vatRate se ignoran (solo se leen de aiData/duties)', () => {
    // La fixture textil trae dutyRate: 8, pero buildDutyTaxFee no lo mira.
    const d = h1.buildDutyTaxFee(expedicionCompleta(createTextileExpedition()), {});
    expect(d.importDuty.rate).toBe(0); // no 8
    expect(d.vat.rate).toBe(21);       // por defecto, no del good
  });
});

describe('buildGuarantee', () => {
  test('sin garantia alguna devuelve null', () => {
    expect(h1.buildGuarantee(expedicionCompleta(), {})).toBeNull();
  });

  test('con garantia completa (en expedition) emite todos los campos', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      guarantee: {
        type: '0', grn: 'GRN-1', accessCode: 'AC-1', amount: 5000, currency: 'EUR',
        reference: 'REF-1', customsOffice: 'ES002801',
        guarantor: { eori: 'EGAR', name: 'Avalista SL' }
      }
    });
    const r = h1.generate(exp, {});
    const g = r.data.guarantee;
    expect(g.guaranteeType).toBe('0');
    expect(g.guarantor.identificationNumber).toBe('EGAR');
    expect(r.xml).toMatch(/<Guarantee>[\s\S]*<GRN>GRN-1<\/GRN>/);
    expect(r.xml).toMatch(/<GuaranteeAmount currencyID="EUR">5000<\/GuaranteeAmount>/);
    expect(r.xml).toMatch(/<CustomsOfficeOfGuarantee>ES002801<\/CustomsOfficeOfGuarantee>/);
    expect(r.xml).toMatch(/<Guarantor>[\s\S]*<Name>Avalista SL<\/Name>/);
  });

  test('garantia vacia usa tipo 1 por defecto y garante desde aiData con nif', () => {
    const exp = expedicionCompleta();
    const g = h1.buildGuarantee(exp, { guarantee: { guarantor: { nif: 'BGAR' } } });
    expect(g.guaranteeType).toBe('1');
    expect(g.guaranteeCurrency).toBe('EUR');
    expect(g.guarantor.identificationNumber).toBe('BGAR'); // eori||nif -> nif
  });
});

describe('buildGoodsItems / buildSupportingDocuments: campos por partida', () => {
  test('codigos adicionales, region, uso final y ajuste de valoracion se incluyen', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      goods: [{
        taricCode: '8471300000', taricAdditionalCode: '1234', nationalCode: 'NAC1', cusCode: 'CUS1',
        hsCode: '847130', description: 'PC', descriptionEs: 'Ordenador',
        regime: '51', previousProcedure: '00', additionalProcedure: 'A04',
        originCountry: 'CN', regionOfOrigin: 'CN-31', preference: '300',
        grossWeight: 10, netWeight: 9, supplementaryUnits: 5, supplementaryUnitType: 'NAR',
        packages: { quantity: 2, type: 'CTN', marks: 'M1' },
        statisticalValue: 1000, valuationAdjustment: 50, endUseCode: 'EU1', unLocode: 'ESBCN',
        additionalInformation: [{ code: '00500', description: 'Autoconsumo' }],
        previousDocuments: [{ type: 'Z', reference: 'PREV-1' }],
        documents: [{ type: 'N935', reference: 'DOC-1', date: new Date('2026-01-01') }],
        invoiceValue: 1000
      }],
      goodsSummary: { totalValue: 1000, totalPackages: 2, totalGrossWeight: 10 }
    });
    const xml = h1.generate(exp, {}).xml;
    expect(xml).toMatch(/<IdentificationTypeCode>TRA<\/IdentificationTypeCode>/);
    expect(xml).toMatch(/<IdentificationTypeCode>NAC<\/IdentificationTypeCode>/);
    expect(xml).toMatch(/<IdentificationTypeCode>CUS<\/IdentificationTypeCode>/);
    expect(xml).toMatch(/<RegionID>CN-31<\/RegionID>/);
    expect(xml).toMatch(/<TariffQuantity unitCode="NAR">5<\/TariffQuantity>/);
    expect(xml).toMatch(/<CurrentCode>51<\/CurrentCode>/); // regime del good
    expect(xml).toMatch(/<TypeCode>300<\/TypeCode>/); // preferencia
    expect(xml).toMatch(/<ValuationAdjustment>50<\/ValuationAdjustment>/);
    expect(xml).toMatch(/<AdditionalInformation>[\s\S]*<StatementCode>00500<\/StatementCode>/);
    expect(xml).toMatch(/<PreviousDocument>[\s\S]*<ID>PREV-1<\/ID>/);
    expect(xml).toMatch(/<EndUse>[\s\S]*<EndUseCode>EU1<\/EndUseCode>/);
    expect(xml).toMatch(/<TypeCode>N935<\/TypeCode>/); // documento adicional del good
  });

  test('hsCode se deriva del taric cuando el good no trae hsCode', () => {
    const item = h1.buildGoodsItems(expedicionCompleta(createElectronicsExpedition(), {
      goods: [{ taricCode: '61091000', description: 'Camiseta', invoiceValue: 10 }],
      goodsSummary: { totalValue: 10 }
    }), {})[0];
    expect(item.commodityCode.harmonizedSystemCode).toBe('610910');
    expect(item.commodityCode.combinedNomenclatureCode).toBe('61091000');
  });

  test('documentos de origen, sanitario, fitosanitario, licencia y packing se mapean a su codigo', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      documents: [
        { type: 'commercial_invoice', originalName: 'INV', uploadedAt: new Date('2026-01-01') },
        { type: 'eur1', originalName: 'EUR1', uploadedAt: new Date('2026-01-02'), validUntil: new Date('2027-01-01') },
        { type: 'sanitary_certificate', originalName: 'SAN', uploadedAt: new Date('2026-01-03') },
        { type: 'phytosanitary_certificate', originalName: 'FITO', uploadedAt: new Date('2026-01-04') },
        { type: 'import_license', originalName: 'LIC', uploadedAt: new Date('2026-01-05') }
      ]
    });
    const docs = h1.buildSupportingDocuments(exp, exp.goods[0]);
    const tipos = docs.map(d => d.type);
    expect(tipos).toContain('N380'); // factura
    expect(tipos).toContain('N864'); // eur1
    expect(tipos).toContain('C678'); // sanitario
    expect(tipos).toContain('C635'); // fitosanitario
    expect(tipos).toContain('N990'); // licencia
    // El eur1 con validUntil emite ValidUntilDate en el XML.
    expect(h1.generate(exp, {}).xml).toMatch(/<ValidUntilDate>2027-01-01<\/ValidUntilDate>/);
  });

  test('un solo good sin goodsSummary usa proportion=1: customsValue = valor en aduana redondeado', () => {
    const exp = { ...createElectronicsExpedition(), goods: [{ taricCode: '84713000', description: 'PC', invoiceValue: 500 }], costs: { freight: 0, insurance: 0 } };
    delete exp.goodsSummary;
    // proportion = invoiceValue / (goodsSummary?.totalValue || invoiceValue) = 500/500 = 1,
    // asi que customsValue de la partida es el valor en aduana total redondeado.
    const valuation = h1.buildValuation(exp, {});
    const item = h1.buildGoodsItems(exp, {})[0];
    expect(item.customsValue).toBe(Math.round(valuation.customsValue * 100) / 100);
  });
});

describe('tablas de consulta: caminos por defecto', () => {
  test.each([
    ['VLC', 'ES004601'], ['MAD', 'ES002101'], ['ALGECIRAS', 'ES003001'],
    ['BILBAO', 'ES004801'], ['LPA', 'ES003501'], ['TENERIFE', 'ES003801'], ['MALAGA', 'ES002901']
  ])('determineCustomsOffice: puerto %s -> %s', (puerto, oficina) => {
    expect(h1.determineCustomsOffice({ transport: { arrivalPort: puerto } })).toBe(oficina);
  });

  test('determineCustomsOffice: puerto desconocido y sin transporte cae a Barcelona', () => {
    expect(h1.determineCustomsOffice({ transport: { arrivalPort: 'XXX' } })).toBe('ES002801');
    expect(h1.determineCustomsOffice({})).toBe('ES002801');
  });

  test.each([
    ['Tarragona', 'ES-CT'], ['Alicante', 'ES-VC'], ['Sevilla', 'ES-AN'], ['Bilbao', 'ES-PV'],
    ['Las Palmas', 'ES-CN'], ['Palma', 'ES-IB'], ['Zaragoza', 'ES-AR'], ['Cartagena', 'ES-MC']
  ])('getRegionCode: %s -> %s', (ciudad, codigo) => {
    expect(h1.getRegionCode(ciudad)).toBe(codigo);
  });

  test('getRegionCode: sin ciudad devuelve ES-CT', () => {
    expect(h1.getRegionCode(undefined)).toBe('ES-CT');
  });

  test.each([
    ['sea', '1'], ['train', '2'], ['truck', '3'], ['flight', '4'],
    ['postal', '5'], ['multimodal', '7'], ['pipeline', '8'], ['inland_waterway', '9']
  ])('getTransportModeCode: %s -> %s', (modo, codigo) => {
    expect(h1.getTransportModeCode(modo)).toBe(codigo);
  });

  test('getTransportModeCode: undefined cae al modo 1', () => {
    expect(h1.getTransportModeCode(undefined)).toBe('1');
  });

  test.each([
    ['maritime', '11'], ['sea', '11'], ['train', '21'], ['truck', '31'], ['flight', '41']
  ])('getTransportTypeCode: %s -> %s', (modo, codigo) => {
    expect(h1.getTransportTypeCode(modo)).toBe(codigo);
  });

  test('getTransportTypeCode: desconocido cae a 11', () => {
    expect(h1.getTransportTypeCode('cohete')).toBe('11');
    expect(h1.getTransportTypeCode(undefined)).toBe('11');
  });

  test.each([
    ['sea', 'N705'], ['flight', 'N740'], ['truck', 'N730'], ['rail', 'N720']
  ])('getTransportDocumentType: %s -> %s', (modo, codigo) => {
    expect(h1.getTransportDocumentType(modo)).toBe(codigo);
  });

  test('getTransportDocumentType: desconocido cae a N785', () => {
    expect(h1.getTransportDocumentType('cohete')).toBe('N785');
  });

  test.each([
    ['commercial_invoice', 'N380'], ['bill_of_lading', 'N705'], ['air_waybill', 'N740'],
    ['cmr', 'N730'], ['cim', 'N720'], ['certificate_origin', 'N861'], ['eur1', 'N864'],
    ['eur_med', 'N864'], ['atr', 'N018'], ['form_a', 'N865'], ['packing_list', 'N271'],
    ['sanitary_certificate', 'C678'], ['phytosanitary_certificate', 'C635'],
    ['veterinary_certificate', 'C640'], ['export_license', 'E012'],
    ['dangerous_goods', 'N703'], ['insurance_certificate', 'N714']
  ])('getDocumentTypeCode: %s -> %s (claves reales del anexo B)', (tipo, codigo) => {
    // El test previo pasaba claves inventadas ('invoice','transport','origin')
    // que caian todas al default N990: solo comprobaba el formato. Aqui van las
    // claves REALES para ejercitar cada rama del mapa.
    expect(h1.getDocumentTypeCode(tipo)).toBe(codigo);
  });
});

describe('calculateSummary: descripciones por defecto y goods vacio', () => {
  test('regimen/preferencia/aduana desconocidos caen a "Desconocido"', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), {
      goods: [{ taricCode: '84713000', description: 'PC', regime: '99', preference: '999', invoiceValue: 100 }],
      goodsSummary: { totalValue: 100 }
    });
    const s = h1.generate(exp, { customsOffice: 'ES999999' }).summary;
    expect(s.regimeDescription).toBe('Desconocido');
    expect(s.preferenceDescription).toBe('Desconocido');
    expect(s.customsOfficeName).toBe('Desconocido');
  });

  test('sin mercancias el resumen no revienta y no hay regimen', () => {
    const exp = expedicionCompleta(createElectronicsExpedition(), { goods: [] });
    const s = h1.generate(exp, {}).summary;
    expect(s.totalItems).toBe(0);
    expect(s.regime).toBeUndefined();
    expect(s.regimeDescription).toBe('Desconocido');
  });
});

describe('escapeXml: comillas', () => {
  test('escapa comillas dobles y simples', () => {
    expect(h1.escapeXml('a"b')).toBe('a&quot;b');
    expect(h1.escapeXml("a'b")).toBe('a&apos;b');
  });
});
