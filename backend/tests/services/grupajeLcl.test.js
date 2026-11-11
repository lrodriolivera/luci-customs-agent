/**
 * Regla del grupaje maritimo (LCL) antes del H1.
 *
 * UAT 10/Nov/2026: «cuando la naviera de de alta la declaracion sumaria por el
 * contenedor completo siendo un LCL no debe bajo ningun concepto proceder con
 * el H1 con esa declaracion sumaria».
 *
 * UAT 11/Nov/2026: «no exijas que coincidan los bultos y los kilos, ya que
 * puede venir parcial o haber una discrepancia en origen; es mejor que lo
 * pueda modificar y validar el agente». La diferencia avisa, no bloquea.
 */
const { bloqueoPorGrupaje, avisoPorDiferencia, exigirSumariaDeGrupaje, esGrupaje, CODIGO_ERROR } = require('../../src/services/forms/grupajeLcl');
const { ErrorValidacion } = require('../../src/services/forms/identificadorAduanero');

const expediente = (transport, resumen = { totalPackages: 12, totalGrossWeight: 1050.5 }) => ({
  expeditionId: 'EXP-2026-LCL',
  goodsSummary: resumen,
  transport
});

const sumariaPropia = { number: '46112600012345', item: '3', packages: 12, grossWeight: 1050.5 };

describe('grupajeLcl', () => {
  describe('cuando no aplica', () => {
    test('un expediente sin tipo de carga no se bloquea', () => {
      expect(bloqueoPorGrupaje(expediente({}))).toBeNull();
      expect(bloqueoPorGrupaje(expediente(undefined))).toBeNull();
      expect(bloqueoPorGrupaje(null)).toBeNull();
    });

    test('un contenedor completo (FCL) no se bloquea aunque no tenga sumaria', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'FCL' }))).toBeNull();
      expect(esGrupaje(expediente({ loadType: 'FCL' }))).toBe(false);
    });
  });

  describe('grupaje sin la sumaria de la desconsolidacion', () => {
    test('sin sumaria registrada bloquea y explica que hay que esperar al vaciado', () => {
      const motivo = bloqueoPorGrupaje(expediente({ loadType: 'LCL' }));

      expect(motivo).toContain('EXP-2026-LCL');
      expect(motivo).toContain('falta la declaracion sumaria de la desconsolidacion');
      expect(motivo).toContain('contenedor completo no sirve');
    });

    test('un numero en blanco cuenta como sumaria ausente', () => {
      expect(bloqueoPorGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: { number: '   ' } })))
        .toContain('falta la declaracion sumaria');
    });

    test('con numero pero sin bultos o sin peso no bloquea ni avisa: no hay nada que comparar', () => {
      const sinBultos = expediente({ loadType: 'LCL', summaryDeclaration: { number: 'S1', grossWeight: 1050.5 } });
      const sinPeso = expediente({ loadType: 'LCL', summaryDeclaration: { number: 'S1', packages: 12 } });

      expect(bloqueoPorGrupaje(sinBultos)).toBeNull();
      expect(bloqueoPorGrupaje(sinPeso)).toBeNull();
      expect(avisoPorDiferencia(sinBultos)).toBeNull();
      expect(avisoPorDiferencia(sinPeso)).toBeNull();
    });
  });

  describe('grupaje con sumaria registrada: la diferencia de bultos o kilos avisa, no bloquea', () => {
    const con = (cambios, resumen) => expediente({ loadType: 'LCL', summaryDeclaration: { ...sumariaPropia, ...cambios } }, resumen);

    test('bultos y kilos distintos no bloquean; el aviso lleva las dos cifras y deja la decision al agente', () => {
      const exp = con({ number: 'S-OTRA', packages: 820, grossWeight: 14200 });
      const aviso = avisoPorDiferencia(exp);

      expect(bloqueoPorGrupaje(exp)).toBeNull();
      expect(aviso).toContain('la declaracion sumaria S-OTRA figura con 820 bultos y 14200 kg');
      expect(aviso).toContain('el expediente declara 12 bultos y 1050.5 kg');
      expect(aviso).toContain('No impide generar ni presentar el H1');
    });

    test('mismos kilos pero distintos bultos (envio parcial) tambien avisa sin bloquear', () => {
      const exp = con({ packages: 13 });

      expect(bloqueoPorGrupaje(exp)).toBeNull();
      expect(avisoPorDiferencia(exp)).toContain('13 bultos');
    });

    test('con los mismos bultos y kilos no hay aviso', () => {
      expect(bloqueoPorGrupaje(con({}))).toBeNull();
      expect(avisoPorDiferencia(con({}))).toBeNull();
    });

    test('la diferencia de redondeo del peso (hasta 1 kg o el 1 %) no merece aviso', () => {
      expect(avisoPorDiferencia(con({ grossWeight: 1051 }))).toBeNull();
      expect(avisoPorDiferencia(con({ grossWeight: 1060 }))).toBeNull();        // 9,5 kg sobre 1.050,5 kg: dentro del 1 %
      expect(avisoPorDiferencia(con({ grossWeight: 1062 }))).toContain('1062 kg');
      expect(avisoPorDiferencia(con({ grossWeight: 1039 }))).toContain('1039 kg');
    });

    test('en partidas pequenas el margen sin aviso es de 1 kg, no del 1 %', () => {
      const pequeno = (grossWeight) => avisoPorDiferencia(expediente(
        { loadType: 'LCL', summaryDeclaration: { number: 'S1', packages: 2, grossWeight } },
        { totalPackages: 2, totalGrossWeight: 10 }
      ));

      expect(pequeno(10.9)).toBeNull();
      expect(pequeno(11.5)).toContain('11.5 kg');
    });

    test('los valores llegan como texto desde un formulario y se comparan como numeros', () => {
      expect(avisoPorDiferencia(con({ packages: '12', grossWeight: '1050.5' }))).toBeNull();
    });

    test('un expediente sin totales calculados avisa contra 0 bultos y 0 kg, sin bloquear', () => {
      const exp = con({}, null);

      expect(bloqueoPorGrupaje(exp)).toBeNull();
      expect(avisoPorDiferencia(exp)).toContain('0 bultos y 0 kg');
    });

    test('fuera del grupaje o sin sumaria no hay aviso', () => {
      expect(avisoPorDiferencia(expediente({ loadType: 'FCL', summaryDeclaration: { ...sumariaPropia, packages: 99 } }))).toBeNull();
      expect(avisoPorDiferencia(expediente({ loadType: 'LCL' }))).toBeNull();
      expect(avisoPorDiferencia(null)).toBeNull();
    });
  });

  describe('exigirSumariaDeGrupaje', () => {
    test('lanza un ErrorValidacion 422 con codigo propio', () => {
      expect.assertions(4);
      try {
        exigirSumariaDeGrupaje(expediente({ loadType: 'LCL' }));
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorValidacion);
        expect(error.status).toBe(422);
        expect(error.code).toBe(CODIGO_ERROR);
        expect(error.message).toContain('grupaje maritimo (LCL)');
      }
    });

    test('no lanza si la sumaria es la de la partida o si no es grupaje', () => {
      expect(() => exigirSumariaDeGrupaje(expediente({ loadType: 'LCL', summaryDeclaration: sumariaPropia }))).not.toThrow();
      expect(() => exigirSumariaDeGrupaje(expediente({}))).not.toThrow();
    });
  });
});

/**
 * Contraste con la AEAT (servicio DSDTCons): aqui mandan los datos de la AEAT,
 * no lo que teclea el agente.
 */
describe('grupajeLcl — consulta de la sumaria en la AEAT', () => {
  const { verificarSumariaConAeat } = require('../../src/services/forms/grupajeLcl');

  const lcl = (sumaria, resumen = { totalPackages: 12, totalGrossWeight: 1050.5 }) => ({
    expeditionId: 'EXP-2026-LCL',
    goodsSummary: resumen,
    transport: { loadType: 'LCL', summaryDeclaration: sumaria }
  });
  const sumaria = { number: '46116000123', item: '3', packages: 12, grossWeight: 1050.5 };

  const respuesta = (partida = {}, cabecera = {}) => ({
    aceptada: true, noEncontrada: false, entorno: 'ES.AEAT', errores: [],
    dsdt: {
      mrn: '26ES00461180001234', clave: '46116000123', activada: true, ...cabecera,
      partidas: [{
        partida: 3, estado: 'AC', estadoDescripcion: 'Activa', esMaster: false,
        bultosDeclarados: 12, pesoBrutoDeclarado: 1050.5, bultosSaldo: 12, pesoBrutoSaldo: 1050.5,
        conocimiento: 'BL-1', ubicaciones: [{ ubicacion: '4611ADT001' }], contenedores: [], ...partida
      }]
    }
  });
  const consultar = (r) => jest.fn().mockResolvedValue(r);

  test('consulta por clave y partida, y deja seguir si la AEAT confirma la partida', async () => {
    const fn = consultar(respuesta());

    const r = await verificarSumariaConAeat(lcl(sumaria), { consultar: fn });

    expect(fn).toHaveBeenCalledWith({ clave: '46116000123', partida: '3' });
    expect(r.bloqueo).toBeNull();
    expect(r.aviso).toBeNull();
    expect(r.consulta).toMatchObject({
      verified: true, environment: 'ES.AEAT', clave: '46116000123', itemStatus: 'AC', isMaster: false,
      packages: 12, grossWeight: 1050.5, packagesBalance: 12, billOfLading: 'BL-1', location: '4611ADT001'
    });
  });

  test('una partida master bloquea aunque el agente haya tecleado nuestros bultos y kilos', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), {
      consultar: consultar(respuesta({ estado: 'MD', estadoDescripcion: 'Máster desconsolidado', esMaster: true, bultosDeclarados: 820, pesoBrutoDeclarado: 14200, bultosSaldo: null }))
    });

    expect(r.bloqueo).toContain('es una partida master (Máster desconsolidado)');
    expect(r.bloqueo).toContain('Hace falta la partida de la desconsolidacion');
    expect(r.consulta.isMaster).toBe(true);
  });

  test('bultos y kilos de la AEAT distintos de los del expediente: avisa con las dos cifras y deja seguir', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), {
      consultar: consultar(respuesta({ bultosDeclarados: 40, pesoBrutoDeclarado: 3500, bultosSaldo: 40 }))
    });

    expect(r.bloqueo).toBeNull();
    expect(r.aviso).toContain('en la AEAT la partida 3 de la declaracion sumaria 46116000123 figura con 40 bultos y 3500 kg');
    expect(r.aviso).toContain('el expediente declara 12 bultos y 1050.5 kg');
    expect(r.aviso).toContain('No impide generar ni presentar el H1');
    expect(r.consulta).toMatchObject({ verified: true, packages: 40, grossWeight: 3500 });
  });

  test('los bultos y kilos que se comparan son los de la AEAT, no los tecleados', async () => {
    const r = await verificarSumariaConAeat(lcl({ ...sumaria, packages: 99, grossWeight: 5 }), { consultar: consultar(respuesta()) });

    expect(r.bloqueo).toBeNull();
    expect(r.aviso).toBeNull();
  });

  test('una partida master sigue bloqueando aunque ademas difieran los bultos', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), {
      consultar: consultar(respuesta({ estado: 'MD', estadoDescripcion: 'Máster datado', esMaster: true, bultosDeclarados: 156, pesoBrutoDeclarado: 1170, bultosSaldo: 155 }))
    });

    expect(r.bloqueo).toContain('es una partida master (Máster datado)');
    expect(r.aviso).toBeNull();
  });

  test('sumaria no activada: el medio de transporte no ha llegado', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(respuesta({}, { activada: false })) });
    expect(r.bloqueo).toContain('todavia no esta activada en la AEAT');
  });

  test('partida retenida o saldada no admite el H1', async () => {
    const retenida = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(respuesta({ estado: 'RE', estadoDescripcion: 'Retenida' })) });
    const saldada = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(respuesta({ estado: 'SA', estadoDescripcion: 'Saldada' })) });

    expect(retenida.bloqueo).toContain('esta retenida en la AEAT');
    expect(saldada.bloqueo).toContain('esta saldada en la AEAT');
  });

  test('saldo de bultos insuficiente', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(respuesta({ bultosSaldo: 5 })) });
    expect(r.bloqueo).toContain('solo tiene 5 bultos de saldo en la AEAT y el expediente declara 12');
  });

  test('la AEAT no encuentra la partida: bloquea con su mensaje', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), {
      consultar: consultar({ aceptada: false, noEncontrada: true, entorno: 'PRE.AEAT', errores: [{ codigo: '403', descripcion: 'Partida de DSDT no encontrada' }], dsdt: null })
    });

    expect(r.bloqueo).toContain('la AEAT no encuentra la partida 3 de la declaracion sumaria 46116000123');
    expect(r.consulta).toMatchObject({ verified: true, environment: 'PRE.AEAT', error: 'Partida de DSDT no encontrada' });
  });

  test('en el entorno de pruebas avisa de que alli no existen las sumarias reales; en produccion no', async () => {
    const noEncontrada = (entorno) => ({ aceptada: false, noEncontrada: true, entorno, errores: [{ codigo: '403', descripcion: 'Partida de DSDT no encontrada.' }], dsdt: null });

    const pre = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(noEncontrada('PRE.AEAT')) });
    const real = await verificarSumariaConAeat(lcl(sumaria), { consultar: consultar(noEncontrada('ES.AEAT')) });

    expect(pre.bloqueo).toContain('entorno de pruebas de la AEAT');
    expect(pre.bloqueo).toContain('usa una sumaria de prueba');
    expect(real.bloqueo).not.toContain('entorno de pruebas');
  });

  test('si la AEAT no responde se contrasta a mano y se avisa de que no se pudo verificar', async () => {
    const caida = { consultar: jest.fn().mockRejectedValue(new Error('ECONNRESET')) };

    const cuadra = await verificarSumariaConAeat(lcl(sumaria), caida);
    const noCuadra = await verificarSumariaConAeat(lcl({ ...sumaria, packages: 820, grossWeight: 14200 }), caida);

    expect(cuadra.bloqueo).toBeNull();
    expect(cuadra.aviso).toContain('No se pudo comprobar la declaracion sumaria 46116000123 en la AEAT (ECONNRESET)');
    expect(cuadra.aviso).not.toContain('no coinciden');
    expect(cuadra.consulta).toMatchObject({ verified: false, error: 'ECONNRESET' });
    expect(noCuadra.bloqueo).toBeNull();
    expect(noCuadra.aviso).toContain('ECONNRESET');
    expect(noCuadra.aviso).toContain('figura con 820 bultos y 14200 kg');
  });

  test('un rechazo que no es «no encontrada» (p. ej. el remitente) se trata como no verificable', async () => {
    const r = await verificarSumariaConAeat(lcl(sumaria), {
      consultar: consultar({ aceptada: false, noEncontrada: false, entorno: 'PRE.AEAT', errores: [{ codigo: '211', descripcion: 'El remitente no coincide con certificado digital' }], dsdt: null })
    });

    expect(r.bloqueo).toBeNull();
    expect(r.aviso).toContain('211 El remitente no coincide con certificado digital');
    expect(r.consulta.verified).toBe(false);
  });

  test('una referencia que no es clave ni MRN bloquea el grupaje sin llamar a la AEAT', async () => {
    const fn = jest.fn();

    const r = await verificarSumariaConAeat(lcl({ ...sumaria, number: 'S-PARTIDA' }), { consultar: fn });
    const sinPartida = await verificarSumariaConAeat(lcl({ ...sumaria, item: '' }), { consultar: fn });

    expect(r.bloqueo).toContain('debe ser la clave');
    expect(sinPartida.bloqueo).toContain('con su numero de partida');
    expect(fn).not.toHaveBeenCalled();
  });

  test('grupaje sin sumaria: bloquea sin consultar', async () => {
    const fn = jest.fn();
    const r = await verificarSumariaConAeat(lcl(undefined), { consultar: fn });

    expect(r.bloqueo).toContain('falta la declaracion sumaria de la desconsolidacion');
    expect(fn).not.toHaveBeenCalled();
  });

  test('fuera del grupaje la consulta informa pero nunca bloquea', async () => {
    const fcl = { ...lcl(sumaria), transport: { loadType: 'FCL', summaryDeclaration: sumaria } };

    const master = await verificarSumariaConAeat(fcl, { consultar: consultar(respuesta({ estado: 'MA', estadoDescripcion: 'Máster activo', esMaster: true })) });
    const noEsta = await verificarSumariaConAeat(fcl, { consultar: consultar({ aceptada: false, noEncontrada: true, entorno: 'PRE.AEAT', errores: [{ codigo: '403', descripcion: 'x' }], dsdt: null }) });

    expect(master.bloqueo).toBeNull();
    expect(master.consulta.isMaster).toBe(true);
    expect(noEsta.bloqueo).toBeNull();
    expect(noEsta.aviso).toContain('La AEAT no encuentra la partida 3');
  });

  test('sin grupaje y sin sumaria no hay nada que comprobar', async () => {
    const fn = jest.fn();
    const r = await verificarSumariaConAeat({ transport: {} }, { consultar: fn });

    expect(r).toEqual({ bloqueo: null, aviso: null, consulta: null });
    expect(fn).not.toHaveBeenCalled();
  });
});
