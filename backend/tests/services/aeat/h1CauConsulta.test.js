/**
 * Consulta de una declaración de importación CAU por MRN. La petición se
 * valida contra el XSD oficial; la respuesta se monta con la estructura de
 * `ES_ConsultaImportacionR.xsd` (la guía no trae un ejemplo completo).
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildConsultaH1CauXML, interpretarConsultaH1Cau } = require('../../../src/services/aeat/h1CauConsulta');

const ESQUEMA = path.join(__dirname, '../../fixtures/aeat-cau/ConsultaImportacionV3Ent.xsd');
const siHayXmllint = spawnSync('xmllint', ['--version']).status === 0 ? test : test.skip;
const NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adip/jdit/ws/cci/ConsultaImportacionV3Sal.xsd';
const sobre = (contenido) => `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><es:ConsultaImportacionV3Sal xmlns:es="${NS}"><Message><messageIdentification>M1</messageIdentification></Message>${contenido}</es:ConsultaImportacionV3Sal></env:Body></env:Envelope>`;

describe('consulta H1 CAU: petición', () => {
  const xml = buildConsultaH1CauXML({ mensajeId: 'LUCI2611121000000001234', mrn: ' 26es002801i01bmdr0 ', fecha: new Date('2026-11-12T09:30:00Z') });

  test('lleva el MRN normalizado y la fecha en hora de Madrid', () => {
    expect(xml).toContain('<ConsultaCompleta><MRN>26ES002801I01BMDR0</MRN></ConsultaCompleta>');
    expect(xml).toContain('<preparationDateAndTime>2026-11-12T10:30:00</preparationDateAndTime>');
  });

  test('rechaza un MRN mal formado antes de preguntar a la AEAT', () => {
    expect(() => buildConsultaH1CauXML({ mensajeId: 'X', mrn: '123' })).toThrow('MRN');
    expect(() => buildConsultaH1CauXML({ mensajeId: 'X' })).toThrow('MRN');
  });

  siHayXmllint('valida contra el XSD de la AEAT', () => {
    const cuerpo = /<soapenv:Body>\s*([\s\S]*?)\s*<\/soapenv:Body>/.exec(xml)[1];
    const fichero = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'consulta-')), 'mensaje.xml');
    fs.writeFileSync(fichero, `<?xml version="1.0" encoding="UTF-8"?>\n${cuerpo}`);
    expect(() => execFileSync('xmllint', ['--noout', '--schema', ESQUEMA, fichero], { stdio: 'pipe' })).not.toThrow();
  });
});

describe('consulta H1 CAU: respuesta', () => {
  test('saca el estado, el circuito, el levante, la liquidación y lo que pide la aduana', () => {
    const r = interpretarConsultaH1Cau(sobre(`<ConsultaCompletaR>
      <DeclarationManagement>
        <operationRegistered>96</operationRegistered><requiredPCADocuments>S</requiredPCADocuments><goodsReleaseStatus>L</goodsReleaseStatus>
        <underControl>0</underControl><documentationPending>1</documentationPending><paymentStatus>PA</paymentStatus>
        <declarationRegistrationDateAndTime>2026-11-12T10:57:04</declarationRegistrationDateAndTime>
        <declarationAcceptanceDateAndTime>2026-11-12T10:57:04</declarationAcceptanceDateAndTime>
        <riskAnalysisResultCodeAEAT>N</riskAnalysisResultCodeAEAT><releaseDateAndTime>2026-11-13T09:00:00</releaseDateAndTime>
        <releaseCSVId>CSVLEVANTE</releaseCSVId>
      </DeclarationManagement>
      <ImportOperation><MRN>26ES002801I01BMDR0</MRN></ImportOperation>
      <RequestedDocuments><sequenceNumber>1</sequenceNumber><declarationGoodsItemNumber>1</declarationGoodsItemNumber><type>N380</type><description>Factura comercial</description></RequestedDocuments>
      <Notification><code>1</code><text>Aporte la factura</text></Notification>
      <CC429R_CD><ControlResult><code>A1</code><date>2026-11-13</date><pendingSamplingResults>0</pendingSamplingResults></ControlResult></CC429R_CD>
      <DutiesTaxesAndGuarantee><DutiesAndTaxesAEAT><payableTaxAmount>3552.00</payableTaxAmount><amountToGuarantee>0</amountToGuarantee></DutiesAndTaxesAEAT></DutiesTaxesAndGuarantee>
    </ConsultaCompletaR>`));

    expect(r).toMatchObject({ success: true, tipo: 'encontrada', mrn: '26ES002801I01BMDR0' });
    expect(r.estado).toMatchObject({
      operacionRegistrada: '96', levante: 'L', circuito: 'N', channel: 'orange', documentacionPendiente: '1', pago: 'PA',
      certificadosRequeridos: 'S', fechaAdmision: '2026-11-12T10:57:04', fechaLevante: '2026-11-13T09:00:00', csvLevante: 'CSVLEVANTE'
    });
    expect(r.liquidacion).toMatchObject({ totalAPagar: 3552, totalAGarantizar: 0 });
    expect(r.documentosSolicitados).toEqual([{ partida: 1, tipo: 'N380', descripcion: 'Factura comercial' }]);
    expect(r.notificaciones).toEqual([{ codigo: '1', texto: 'Aporte la factura' }]);
    expect(r.resultadoControl).toEqual({ codigo: 'A1', fecha: '2026-11-13', observaciones: null });
  });

  test('respuesta real de la AEAT (preproducción, recinto de pruebas 009999, 12/11/2026)', () => {
    const real = fs.readFileSync(path.join(__dirname, '../../fixtures/aeat-cau/consulta-respuesta-real-009999.xml'), 'utf8');

    const r = interpretarConsultaH1Cau(real);

    expect(r).toMatchObject({ success: true, tipo: 'encontrada', mrn: '26ES009999I0026SR0' });
    expect(r.estado).toMatchObject({
      operacionRegistrada: '64', levante: 'P', pago: 'PL', circuito: 'A', channel: 'yellow', certificadosRequeridos: 'S',
      fechaRegistro: '2026-11-12T11:40:38', fechaAdmision: '2026-11-12T11:40:38', fechaLevante: null
    });
    // Lo mismo en palabras, con los textos de las guías de la AEAT.
    expect(r.estado.pendencias).toBe('N');
    expect(r.estado.textos).toEqual({
      operacionRegistrada: 'Declaración completa activada', levante: 'Pendiente de despacho', pago: 'Pendiente de contracción',
      pendencias: 'No tiene pendencias', bajoControl: null, documentacionPendiente: null
    });
    // La liquidación y los certificados con la misma forma que la respuesta al presentar.
    expect(r.liquidacion).toEqual({
      totalAPagar: 355.2, totalAGarantizar: 355.2,
      partidas: [{ numero: 1, preferencia: '100', tributos: [
        { tipo: 'A00', medioDePago: 'A', bases: [{ tipoImpositivo: 12, unidad: null, cantidad: null, importe: 1000, cuota: 120, aGarantizar: 120 }] },
        { tipo: 'B00', medioDePago: 'A', bases: [{ tipoImpositivo: 21, unidad: null, cantidad: null, importe: 1120, cuota: 235.2, aGarantizar: 235.2 }] }
      ] }]
    });
    expect(r.certificados).toEqual({ requeridos: 'S', partidas: [{ numero: 1, organismos: [
      { organismo: 'SIF01', nombre: 'SOIVRE Mº Comercio', medidas: [{ medida: 'COM', documentos: ['1310', '1314'] }] },
      { organismo: 'SIF11', nombre: 'SOIVRE PUE', medidas: [{ medida: 'COM', documentos: ['1235'] }] }
    ] }] });
  });

  test('sin análisis de riesgos no hay circuito ni liquidación', () => {
    const r = interpretarConsultaH1Cau(sobre('<ConsultaCompletaR><DeclarationManagement><operationRegistered>63</operationRegistered><requiredPCADocuments>Z</requiredPCADocuments><declarationRegistrationDateAndTime>2026-11-12T10:00:00</declarationRegistrationDateAndTime></DeclarationManagement><ImportOperation><customsRegistrationNumber>26ES00280112345678</customsRegistrationNumber></ImportOperation></ConsultaCompletaR>'));

    expect(r).toMatchObject({ success: true, mrn: null, numeroRegistro: '26ES00280112345678', liquidacion: null });
    expect(r.estado).toMatchObject({ circuito: null, channel: null, fechaLevante: null });
    expect(r.estado.textos.operacionRegistrada).toBe('Declaración completa pendiente de activar');
  });

  test('una declaración que no existe llega como error funcional con su motivo', () => {
    const r = interpretarConsultaH1Cau(sobre('<CC456A><FunctionalError><errorPointer>MRN</errorPointer><errorCode>99</errorCode><errorReason>21151</errorReason><remarks>Declaración no encontrada</remarks></FunctionalError></CC456A>'));

    expect(r).toMatchObject({ success: false, tipo: 'error_funcional', error: '21151 Declaración no encontrada' });
  });

  test('fallos SOAP, respuestas vacías o ajenas no se toman por buenas', () => {
    expect(interpretarConsultaH1Cau('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>No disponible</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>'))
      .toMatchObject({ success: false, tipo: 'fault', reintentable: true, error: 'No disponible' });
    expect(interpretarConsultaH1Cau('').success).toBe(false);
    expect(interpretarConsultaH1Cau('<html/>').success).toBe(false);
    expect(interpretarConsultaH1Cau(sobre('')).error).toBe('La respuesta no trae ni la declaración ni errores');
    expect(interpretarConsultaH1Cau(sobre('<CD917A><XmlError><errorText>Elemento no esperado</errorText></XmlError></CD917A>'))).toMatchObject({ tipo: 'error_xml', error: 'Elemento no esperado' });
  });
});
