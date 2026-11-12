/**
 * Interpretación de la respuesta del H1 CAU. La respuesta de admisión es el
 * ejemplo oficial de la «Guía Técnica de Importación adaptada al CAU» v3.20.
 */
const { interpretarRespuestaH1Cau } = require('../../../src/services/aeat/h1CauResponse');

const NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/CC415AV1Sal.xsd';
const sobre = (contenido) => `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body Id="Body"><es:CC415AV1Sal xmlns:es="${NS}"><Message><messageIdentification>LUCI-1</messageIdentification></Message>${contenido}</es:CC415AV1Sal></env:Body></env:Envelope>`;

const ADMISION = sobre(`<CC415R><ACK>
  <ImportOperation><LRN>415MMI202306090003</LRN><MRN>23ES002801I02777R1</MRN><declarationType>IM</declarationType><additionalDeclarationType>A</additionalDeclarationType><domain>10</domain></ImportOperation>
  <CustomsOfficeOfImport><referenceNumber>ES002801</referenceNumber></CustomsOfficeOfImport>
  <Importer><identificationNumber>ES89890001K</identificationNumber></Importer>
  <Declarant><identificationNumber>ES89890001K</identificationNumber></Declarant><Representative/>
  <edeclarationCSVId>6BJFKFVW6DQSK55G</edeclarationCSVId><operationRegistered>0</operationRegistered><requiredPCADocuments>S</requiredPCADocuments>
  <GoodsItem><declarationGoodsItemNumber>00001</declarationGoodsItemNumber>
    <PCA><code>SIF01 SOIVRE Mº Comercio</code><TaricMeasure><taricMeasureCode>COM</taricMeasureCode><DocumentRequired><type>1310</type></DocumentRequired><DocumentRequired><type>1314</type></DocumentRequired></TaricMeasure></PCA>
    <PCA><code>SIF11 SOIVRE PUE</code><TaricMeasure><taricMeasureCode>COM</taricMeasureCode><DocumentRequired><type>1235</type></DocumentRequired></TaricMeasure></PCA>
    <Notification/></GoodsItem>
</ACK><CC426R/><CC428R>
  <declarationAcceptanceDateAndTime>2023-06-09T13:05:48</declarationAcceptanceDateAndTime><riskAnalysisResultCodeAEAT>A</riskAnalysisResultCodeAEAT>
  <DutiesAndTaxesAEAT><payableTaxAmount>17.70</payableTaxAmount><amountToGuarantee>17.70</amountToGuarantee><releaseVATGuaranteeExemption>5.35</releaseVATGuaranteeExemption></DutiesAndTaxesAEAT>
  <GoodsItem><declarationGoodsItemNumber>00001</declarationGoodsItemNumber><CalculationOfTaxes><preference>100</preference>
    <DutiesAndTaxes><sequenceNumber>1</sequenceNumber><taxType>A00</taxType><methodOfPayment>A</methodOfPayment><TaxBase><sequenceNumber>1</sequenceNumber><taxRate>7</taxRate><amount>100.0</amount><payableTaxAmount>7.0</payableTaxAmount><amountToGuarantee>7.0</amountToGuarantee></TaxBase></DutiesAndTaxes>
    <DutiesAndTaxes><sequenceNumber>2</sequenceNumber><taxType>B00</taxType><methodOfPayment>A</methodOfPayment><TaxBase><sequenceNumber>1</sequenceNumber><taxRate>10</taxRate><amount>107.0</amount><payableTaxAmount>10.7</payableTaxAmount><amountToGuarantee>10.7</amountToGuarantee></TaxBase></DutiesAndTaxes>
  </CalculationOfTaxes></GoodsItem>
</CC428R></CC415R>`);

describe('respuesta del H1 CAU: admisión', () => {
  const r = interpretarRespuestaH1Cau(ADMISION);

  test('reconoce la admisión y saca MRN, LRN, CSV y fecha de admisión', () => {
    expect(r).toMatchObject({
      success: true, tipo: 'admitida', mrn: '23ES002801I02777R1', lrn: '415MMI202306090003', csv: '6BJFKFVW6DQSK55G',
      operacionRegistrada: '0', operacionRegistradaTexto: 'Admisión de declaración completa', fechaAdmision: '2023-06-09T13:05:48', mensajeId: 'LUCI-1'
    });
  });

  test('el circuito amarillo se lee como amarillo, no como verde', () => {
    expect(r.circuito).toBe('A');
    expect(r.channel).toBe('yellow');
  });

  test('guarda la liquidación de la AEAT por partida', () => {
    expect(r.liquidacion.totalAPagar).toBe(17.7);
    expect(r.liquidacion.totalAGarantizar).toBe(17.7);
    expect(r.liquidacion.partidas[0].tributos).toEqual([
      { tipo: 'A00', medioDePago: 'A', bases: [{ tipoImpositivo: 7, unidad: null, cantidad: null, importe: 100, cuota: 7, aGarantizar: 7 }] },
      { tipo: 'B00', medioDePago: 'A', bases: [{ tipoImpositivo: 10, unidad: null, cantidad: null, importe: 107, cuota: 10.7, aGarantizar: 10.7 }] }
    ]);
  });

  test('guarda los certificados que exige cada organismo', () => {
    expect(r.certificados.requeridos).toBe('S');
    expect(r.certificados.partidas[0].organismos.map((o) => [o.organismo, o.medidas[0].documentos])).toEqual([
      ['SIF01 SOIVRE Mº Comercio', ['1310', '1314']], ['SIF11 SOIVRE PUE', ['1235']]
    ]);
  });

  test('una predeclaración sin análisis de riesgos no tiene circuito ni liquidación', () => {
    const pre = interpretarRespuestaH1Cau(sobre('<CC415R><ACK><ImportOperation><LRN>L1</LRN><customsRegistrationNumber>26ES00280112345678</customsRegistrationNumber></ImportOperation><operationRegistered>63</operationRegistered></ACK></CC415R>'));
    expect(pre).toMatchObject({ success: true, mrn: null, numeroRegistro: '26ES00280112345678', channel: null, circuito: null, liquidacion: null });
  });
});

describe('respuesta del H1 CAU: rechazos', () => {
  test('un error funcional no es una admisión aunque traiga MRN', () => {
    const r = interpretarRespuestaH1Cau(sobre(`<CC456A>
      <ImportOperation><LRN>L1</LRN><MRN>23ES002801I02777R1</MRN><rejectionCode>12</rejectionCode><rejectionReason>Declaración rechazada</rejectionReason></ImportOperation>
      <FunctionalError><errorPointer>/CC415A/GoodsShipment/GoodsShipmentItem[1]/statisticalValue</errorPointer><errorCode>12</errorCode><errorReason>C0630</errorReason><remarks>Valor estadístico obligatorio</remarks></FunctionalError>
      <FunctionalError><errorPointer>/CC415A/Declarant/ContactPerson</errorPointer><errorCode>13</errorCode><errorReason>ESC0008</errorReason><originalAttributeValue>X</originalAttributeValue></FunctionalError>
    </CC456A>`));

    expect(r.success).toBe(false);
    expect(r.tipo).toBe('error_funcional');
    expect(r.mrn).toBeNull();
    expect(r.rechazo).toEqual({ codigo: '12', motivo: 'Declaración rechazada' });
    expect(r.errores).toHaveLength(2);
    expect(r.errores[1]).toMatchObject({ codigo: '13', motivo: 'ESC0008', valor: 'X' });
    expect(r.error).toContain('C0630 Valor estadístico obligatorio');
    expect(r.error).toContain('ESC0008');
  });

  test('un error de XML dice dónde está', () => {
    const r = interpretarRespuestaH1Cau(sobre('<CD917A><XmlError><errorLineNumber>12</errorLineNumber><errorColumnNumber>4</errorColumnNumber><errorPointer>/CC415A/Importer</errorPointer><errorCode>14</errorCode><errorText>Elemento no esperado</errorText></XmlError></CD917A>'));

    expect(r).toMatchObject({ success: false, tipo: 'error_xml', error: 'Elemento no esperado (/CC415A/Importer)' });
    expect(r.errores[0]).toMatchObject({ linea: 12, columna: 4 });
  });

  test('un fallo SOAP del servidor se puede reenviar; uno del cliente, no', () => {
    const fault = (codigo) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:${codigo}</faultcode><faultstring>Servicio no disponible</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

    expect(interpretarRespuestaH1Cau(fault('Server'))).toMatchObject({ success: false, tipo: 'fault', reintentable: true, error: 'Servicio no disponible' });
    expect(interpretarRespuestaH1Cau(fault('Client')).reintentable).toBe(false);
  });

  test('una respuesta vacía, ajena o que no es XML no se toma por buena', () => {
    expect(interpretarRespuestaH1Cau('')).toMatchObject({ success: false, error: 'La AEAT respondió sin contenido' });
    expect(interpretarRespuestaH1Cau('<html><body>503</body></html>')).toMatchObject({ success: false, tipo: 'desconocida' });
    expect(interpretarRespuestaH1Cau('<a><b></a>').success).toBe(false);
    expect(interpretarRespuestaH1Cau(sobre('')).error).toBe('La respuesta no trae ni admisión ni errores');
    expect(interpretarRespuestaH1Cau(undefined).success).toBe(false);
  });
});
