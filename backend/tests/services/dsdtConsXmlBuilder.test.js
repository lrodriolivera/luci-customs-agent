/**
 * Consulta de declaraciones sumarias (DSDT) en la AEAT, servicio DSDTCons.
 * Guia tecnica v1.1; los XML de respuesta son los ejemplos 8.10 y 8.11 de la guia.
 */
const {
  buildDSDTConsXML, parseDSDTConsResponse, referenciaDeSumaria, ENDPOINT
} = require('../../src/services/aeat/dsdtConsXmlBuilder');

const NS_SAL = 'https://www3.agenciatributaria.gob.es/static_files/common/internet/dep/aduanas/es/aeat/adds/jdit/ws/DSDTConsV1Sal.xsd';

const respuesta = (cuerpo) => `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Header/><env:Body Id="Body">
<dsd:DSDTConsV1Sal xmlns:dsd="${NS_SAL}">
  <dsd:Message><dsd:CorrSender>89890001K</dsd:CorrSender><dsd:CorrId>ACME_2020_0000000000001</dsd:CorrId><dsd:Sender>PRE.AEAT</dsd:Sender><dsd:PreparationDate>20201103125028</dsd:PreparationDate></dsd:Message>
  ${cuerpo}
</dsd:DSDTConsV1Sal></env:Body></env:Envelope>`;

// Ejemplo 8.10 de la guia (aceptacion), con dos contenedores.
const ACEPTADA = respuesta(`<dsd:CodRespuesta>AC</dsd:CodRespuesta>
  <dsd:DSDTInfo>
    <dsd:MRN>20ES00999880000384</dsd:MRN><dsd:Clave>99980000038</dsd:Clave><dsd:Recinto>9998</dsd:Recinto>
    <dsd:IdTransporte>20201101IBE00001</dsd:IdTransporte><dsd:EstadoCab>DA</dsd:EstadoCab>
    <dsd:Activada>S</dsd:Activada><dsd:FecActivacion>20201101</dsd:FecActivacion>
    <dsd:PAR>
      <dsd:Partida>00001</dsd:Partida><dsd:EstadoPar>DA</dsd:EstadoPar><dsd:TipoPar>AV</dsd:TipoPar>
      <dsd:BultosDecPar>20</dsd:BultosDecPar><dsd:PesoBrutoDecPar>20.5</dsd:PesoBrutoDecPar>
      <dsd:BultosSaldoPar>30</dsd:BultosSaldoPar><dsd:PesoBrutoSaldoPar>30</dsd:PesoBrutoSaldoPar>
      <dsd:Conocimiento>9915643520199349301</dsd:Conocimiento>
      <dsd:TipoDocAsoc>DG5</dsd:TipoDocAsoc><dsd:NumDocAsoc>20ES009999Y00004Y2</dsd:NumDocAsoc>
      <dsd:FecPlazoDatadoPar>20210130</dsd:FecPlazoDatadoPar><dsd:CodMerPar>8418</dsd:CodMerPar>
      <dsd:UBIC>
        <dsd:Ubicacion>9998333333</dsd:Ubicacion><dsd:EstadoUbic>DA</dsd:EstadoUbic>
        <dsd:BultosDecUbic>7</dsd:BultosDecUbic><dsd:PesoBrutoDecUbic>7</dsd:PesoBrutoDecUbic>
        <dsd:BultosSaldoUbic>5</dsd:BultosSaldoUbic><dsd:PesoBrutoSaldoUbic>5</dsd:PesoBrutoSaldoUbic>
      </dsd:UBIC>
      <dsd:CONT><dsd:Contenedor>CONT1234567</dsd:Contenedor><dsd:BultosDecCont>25</dsd:BultosDecCont></dsd:CONT>
      <dsd:CONT><dsd:Contenedor>CONT1234568</dsd:Contenedor><dsd:BultosDecCont>5</dsd:BultosDecCont></dsd:CONT>
    </dsd:PAR>
    <dsd:PAR>
      <dsd:Partida>2</dsd:Partida><dsd:EstadoPar>MA</dsd:EstadoPar><dsd:TipoPar>AV</dsd:TipoPar>
      <dsd:BultosDecPar>820</dsd:BultosDecPar><dsd:PesoBrutoDecPar>14200</dsd:PesoBrutoDecPar>
      <dsd:UBIC><dsd:Ubicacion>9998333334</dsd:Ubicacion><dsd:EstadoUbic>AC</dsd:EstadoUbic>
        <dsd:BultosDecUbic>820</dsd:BultosDecUbic><dsd:PesoBrutoDecUbic>14200</dsd:PesoBrutoDecUbic>
        <dsd:BultosSaldoUbic>820</dsd:BultosSaldoUbic><dsd:PesoBrutoSaldoUbic>14200</dsd:PesoBrutoSaldoUbic></dsd:UBIC>
    </dsd:PAR>
  </dsd:DSDTInfo>`);

// Ejemplo 8.11 de la guia (rechazo: partida no encontrada).
const NO_ENCONTRADA = respuesta(`<dsd:CodRespuesta>RE</dsd:CodRespuesta>
  <dsd:Error><dsd:CodError>403</dsd:CodError><dsd:DescError>Partida de DSDT no encontrada</dsd:DescError></dsd:Error>`);

describe('dsdtConsXmlBuilder', () => {
  describe('referenciaDeSumaria', () => {
    test('reconoce la clave (recinto + año + numero) con o sin separadores', () => {
      expect(referenciaDeSumaria('46116000123')).toEqual({ clave: '46116000123' });
      expect(referenciaDeSumaria(' 4611-6-000123 ')).toEqual({ clave: '46116000123' });
    });

    test('reconoce el MRN de 18 caracteres', () => {
      expect(referenciaDeSumaria('26es00461180001234')).toEqual({ mrn: '26ES00461180001234' });
    });

    test('cualquier otra cosa no es una referencia consultable', () => {
      expect(referenciaDeSumaria('S-PARTIDA')).toBeNull();
      expect(referenciaDeSumaria('4611600012')).toBeNull();
      expect(referenciaDeSumaria('')).toBeNull();
      expect(referenciaDeSumaria(undefined)).toBeNull();
    });
  });

  describe('buildDSDTConsXML', () => {
    const fecha = new Date(2026, 10, 10, 19, 30, 5);

    test('consulta por clave + partida, con el NIF sin el prefijo ES', () => {
      const x = buildDSDTConsXML({ sender: 'ESB22477020', clave: '46116000123', partida: '00003', fecha, id: 'LUCI_1' });

      expect(x).toContain('<dsd:Sender>B22477020</dsd:Sender>');
      expect(x).toContain('<dsd:Id>LUCI_1</dsd:Id>');
      expect(x).toContain('<dsd:PreparationDate>20261110193005</dsd:PreparationDate>');
      expect(x).toContain('<dsd:Clave>46116000123</dsd:Clave>');
      expect(x).toContain('<dsd:Partida>3</dsd:Partida>');
      expect(x).not.toContain('<dsd:MRN>');
      expect(x).not.toContain('<dsd:Ubicacion>');
    });

    test('consulta por MRN + partida + ubicacion, en el orden del esquema', () => {
      const x = buildDSDTConsXML({ sender: 'B22477020', mrn: '26ES00461180001234', partida: 12, ubicacion: '4611ADT001', fecha });

      expect(x.indexOf('<dsd:MRN>')).toBeLessThan(x.indexOf('<dsd:Partida>'));
      expect(x.indexOf('<dsd:Partida>')).toBeLessThan(x.indexOf('<dsd:Ubicacion>'));
      expect(x).toContain('<dsd:Ubicacion>4611ADT001</dsd:Ubicacion>');
    });

    test('genera un identificador de mensaje distinto en cada peticion', () => {
      const id = (x) => /<dsd:Id>([^<]+)</.exec(x)[1];
      const a = buildDSDTConsXML({ sender: 'B22477020', clave: '46116000123', partida: 1 });
      const b = buildDSDTConsXML({ sender: 'B22477020', clave: '46116000123', partida: 1 });

      expect(id(a)).not.toBe(id(b));
      expect(id(a).length).toBeLessThanOrEqual(70);
    });

    test('rechaza remitente, partida o referencia invalidos en vez de enviar un mensaje roto', () => {
      expect(() => buildDSDTConsXML({ sender: 'X', clave: '46116000123', partida: 1 })).toThrow(/remitente/);
      expect(() => buildDSDTConsXML({ sender: 'B22477020', clave: '46116000123', partida: 'A1' })).toThrow(/partida/);
      expect(() => buildDSDTConsXML({ sender: 'B22477020', clave: '461160', partida: 1 })).toThrow(/clave o el MRN/);
      expect(() => buildDSDTConsXML({ sender: 'B22477020', partida: 1 })).toThrow(/clave o el MRN/);
    });

    test('el endpoint es el de la guia tecnica', () => {
      expect(ENDPOINT).toBe('/wlpl/ADDS-JDIT/ws/DSDTConsV1SOAP');
    });
  });

  describe('parseDSDTConsResponse', () => {
    test('lee la cabecera de la sumaria y el entorno que responde', () => {
      const r = parseDSDTConsResponse(ACEPTADA);

      expect(r.aceptada).toBe(true);
      expect(r.noEncontrada).toBe(false);
      expect(r.entorno).toBe('PRE.AEAT');
      expect(r.dsdt).toMatchObject({
        mrn: '20ES00999880000384', clave: '99980000038', recinto: '9998', estado: 'DA', activada: true, fechaActivacion: '20201101'
      });
      expect(r.dsdt.partidas).toHaveLength(2);
    });

    test('los datos de la partida no se confunden con los de sus ubicaciones y contenedores', () => {
      const [partida] = parseDSDTConsResponse(ACEPTADA).dsdt.partidas;

      expect(partida).toMatchObject({
        partida: 1, estado: 'DA', estadoDescripcion: 'Datada', esMaster: false, tipo: 'AV',
        bultosDeclarados: 20, pesoBrutoDeclarado: 20.5, bultosSaldo: 30, pesoBrutoSaldo: 30,
        conocimiento: '9915643520199349301', codigoMercancia: '8418'
      });
      expect(partida.ubicaciones).toEqual([{ ubicacion: '9998333333', estado: 'DA', bultosSaldo: 5, pesoBrutoSaldo: 5 }]);
      expect(partida.contenedores).toEqual([
        { contenedor: 'CONT1234567', bultos: 25 },
        { contenedor: 'CONT1234568', bultos: 5 }
      ]);
    });

    test('una partida master se marca como tal y sin saldo informado', () => {
      const master = parseDSDTConsResponse(ACEPTADA).dsdt.partidas[1];

      expect(master).toMatchObject({
        partida: 2, estado: 'MA', estadoDescripcion: 'Máster activo', esMaster: true,
        bultosDeclarados: 820, bultosSaldo: null, conocimiento: null
      });
    });

    test('un rechazo de la centena 400 es «no encontrada», no un fallo', () => {
      const r = parseDSDTConsResponse(NO_ENCONTRADA);

      expect(r.aceptada).toBe(false);
      expect(r.noEncontrada).toBe(true);
      expect(r.dsdt).toBeNull();
      expect(r.errores).toEqual([{ codigo: '403', descripcion: 'Partida de DSDT no encontrada' }]);
    });

    test('un rechazo por el remitente (211) no se confunde con «no encontrada»', () => {
      const r = parseDSDTConsResponse(respuesta(`<dsd:CodRespuesta>RE</dsd:CodRespuesta>
        <dsd:Error><dsd:CodError>211</dsd:CodError><dsd:DescError>El remitente no coincide con certificado digital</dsd:DescError></dsd:Error>`));

      expect(r.aceptada).toBe(false);
      expect(r.noEncontrada).toBe(false);
      expect(r.errores[0].codigo).toBe('211');
    });

    test('un fallo SOAP o una pagina de error lanzan, con el motivo si lo hay', () => {
      const fallo = '<env:Envelope><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>Web Service no habilitado</faultstring></env:Fault></env:Body></env:Envelope>';

      expect(() => parseDSDTConsResponse(fallo)).toThrow('Web Service no habilitado');
      expect(() => parseDSDTConsResponse('<html><body>404</body></html>')).toThrow(/respuesta reconocible/);
      expect(() => parseDSDTConsResponse(undefined)).toThrow(/respuesta reconocible/);
    });

    test('desescapa las entidades XML de los textos', () => {
      const r = parseDSDTConsResponse(respuesta(`<dsd:CodRespuesta>RE</dsd:CodRespuesta>
        <dsd:Error><dsd:CodError>102</dsd:CodError><dsd:DescError>Valor &lt;Clave&gt; incorrecto &amp; rechazado</dsd:DescError></dsd:Error>`));

      expect(r.errores[0].descripcion).toBe('Valor <Clave> incorrecto & rechazado');
    });
  });
});
