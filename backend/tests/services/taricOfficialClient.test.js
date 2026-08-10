/**
 * Tests del parser de condiciones de medida del TARIC oficial.
 *
 * Todos los textos de entrada son literales copiados de la respuesta real de
 * `measures_conditions.jsp`, no inventados: el bug de los 426 aranceles al 50%
 * consistio precisamente en que nadie habia mirado el formato real de esta
 * respuesta, y un mock aproximado no protegeria de la misma confusion.
 */
const { separarCondiciones, resolverArancelGeneral, tiposPorVariante, extraerContingentes, CERTIFICADO_SANCION } =
  require('../../src/services/taricOfficialClient');

describe('separarCondiciones', () => {
  it('distingue el arancel general del recargo por sanciones a Rusia/Bielorrusia', () => {
    // Literal de measures_conditions.jsp?MeasureSid=4071402 (TARIC 1507109000)
    const texto = 'B1 Presentación de un certificado/licencia/documento Y 155 ' +
      'Aplicar el montante de la acción (ver componentes) 50.00 % ' +
      'B2 Presentación de un certificado/licencia/documento ' +
      'Aplicar el montante de la acción (ver componentes) 6.40 % ' +
      'Indicaciones especiales/Documentos presentados/Certificados y autorizaciones ' +
      'Y155 Productos exportados directa o indirectamente desde la Federación de Rusia o Bielorrusia';

    const r = separarCondiciones(texto);

    // El arancel real del aceite de soja es 6,40%, no el 50% que guardaba el catalogo
    expect(r.general).toMatchObject({ valor: 6.4, unidad: '%', esSancion: false });
    expect(r.sancion).toMatchObject({ valor: 50, esSancion: true });
  });

  it('lee las ramas C1/C2 cuando B1/B2 las ocupa la autorizacion de destino final', () => {
    // Literal de measures_conditions.jsp?MeasureSid=4071454 (TARIC 1507101000).
    // Filtrar solo por B\d dejaba este codigo sin arancel: el tipo esta en C2.
    const texto = 'B1 Presentación de un certificado/licencia/documento N 990 ' +
      'Subpartida declarada autorizada B2 Presentación de un certificado/licencia/documento ' +
      'La subpartida declarada no está permitida ' +
      'C1 Presentación de un certificado/licencia/documento Y 155 ' +
      'Aplicar el montante de la acción (ver componentes) 50.00 % ' +
      'C2 Presentación de un certificado/licencia/documento ' +
      'Aplicar el montante de la acción (ver componentes) 3.20 % ' +
      'Indicaciones especiales/Documentos presentados/Certificados y autorizaciones ' +
      'N990 EUS - Autorización de utilización del régimen de destino final ' +
      'Y155 Productos exportados directa o indirectamente desde la Federación de Rusia o Bielorrusia';

    const r = separarCondiciones(texto);

    expect(r.general).toMatchObject({ etiqueta: 'C2', valor: 3.2, unidad: '%' });
    expect(r.sancion).toMatchObject({ etiqueta: 'C1', valor: 50 });
  });

  it('no toma la leyenda final por una rama sancionada', () => {
    // La leyenda contiene "Y155" y va pegada a la ultima rama. Sin recortarla,
    // la rama general se marcaba como sancion y el arancel real se perdia.
    const texto = 'B1 ... Y 155 ... 50.00 % B2 ... 0 % ' +
      'Indicaciones especiales Y155 Productos exportados desde la Federación de Rusia';

    const r = separarCondiciones(texto);

    expect(r.general).not.toBeNull();
    expect(r.general.esSancion).toBe(false);
    expect(r.general.valor).toBe(0);
  });

  it('devuelve general null cuando ninguna rama trae importe', () => {
    const r = separarCondiciones('B1 Presentación de un certificado Subpartida declarada autorizada');

    expect(r.general).toBeNull();
    expect(r.sancion).toBeNull();
    expect(r.ramas).toEqual([]);
  });
});

describe('resolverArancelGeneral', () => {
  it('prefiere el tipo de las condiciones sobre el de la fila', () => {
    // La fila de una medida condicional muestra el 50% de la sancion. El tipo
    // aplicable a un tercer pais cualquiera solo esta en las condiciones.
    const consulta = {
      ok: true,
      code: '1507109000',
      medidas: [{
        filaLiteral: 'Derecho terceros países (01-07-2024 - ) : 50.00 %',
        measureSid: '4071402',
        enLinea: { valor: 50, unidad: '%' },
        condiciones: {
          texto: 'condiciones',
          general: { etiqueta: 'B2', esSancion: false, valor: 6.4, unidad: '%' },
          sancion: { etiqueta: 'B1', esSancion: true, valor: 50, unidad: '%' },
          ramas: []
        }
      }]
    };

    const r = resolverArancelGeneral(consulta);

    expect(r.arancel).toEqual({ adValorem: 6.4 });
    expect(r.sancion).toEqual({ adValorem: 50, certificado: CERTIFICADO_SANCION });
    expect(r.motivo).toBe('condiciones_de_medida');
  });

  it('lee el derecho especifico de la fila cuando la medida no es condicional', () => {
    // TARIC 2204210600: 32,00 EUR/hl, sin componente ad valorem. El catalogo lo
    // tenia ademas con thirdCountry 50, un porcentaje que la fuente no da.
    const consulta = {
      ok: true,
      code: '2204210600',
      medidas: [{
        filaLiteral: 'Derecho terceros países (01-01-2010 - ) : 32.00 EUR / hl',
        measureSid: null,
        enLinea: { valor: 32, unidad: 'EUR/hl' },
        condiciones: null
      }]
    };

    const r = resolverArancelGeneral(consulta);

    expect(r.arancel).toEqual({ specific: { amount: 32, unit: 'EUR/hl' } });
    expect(r.sancion).toBeNull();
  });

  it('devuelve arancel null en vez de inventarlo cuando la fuente no da tipo', () => {
    // Los codigos padre (acabados en ceros) no son declarables y no tienen
    // medidas propias. Deben quedar intactos, no rellenarse con una estimacion.
    const r = resolverArancelGeneral({
      ok: true,
      code: '1507000000',
      medidas: []
    });

    expect(r.arancel).toBeNull();
    expect(r.motivo).toBe('sin_tipo_explicito');
  });

  it('propaga el motivo cuando la consulta a TARIC fallo', () => {
    const r = resolverArancelGeneral({ ok: false, code: '9999999999', motivo: 'sin_iframe_de_medidas' });

    expect(r.arancel).toBeNull();
    expect(r.motivo).toBe('sin_iframe_de_medidas');
  });

  it('se abstiene cuando los codigos adicionales tienen tipos distintos', () => {
    // Caso real de 2204211100: dos codigos declarables con derechos distintos
    // (13,10 y 15,40 EUR/hl). Quedarse con el primero seria volver a guardar un
    // tipo que no corresponde al codigo, que es el bug de partida.
    const r = resolverArancelGeneral({
      ok: true,
      code: '2204211100',
      medidas: [
        {
          codigoVariante: '2204211110',
          filaLiteral: 'Derecho terceros países (01-01-2010 - ) : 13.10 EUR / hl',
          enLinea: { valor: 13.1, unidad: 'EUR/hl' },
          condiciones: null
        },
        {
          codigoVariante: '2204211190',
          filaLiteral: 'Derecho terceros países (01-01-2010 - ) : 15.40 EUR / hl',
          enLinea: { valor: 15.4, unidad: 'EUR/hl' },
          condiciones: null
        }
      ]
    });

    expect(r.arancel).toBeNull();
    expect(r.motivo).toBe('variantes_con_tipos_distintos');
    expect(r.variantes['2204211110'].arancel).toEqual({ specific: { amount: 13.1, unit: 'EUR/hl' } });
    expect(r.variantes['2204211190'].arancel).toEqual({ specific: { amount: 15.4, unit: 'EUR/hl' } });
  });

  it('marca el arancel que solo aplica en regimen de destino final', () => {
    // Caso real de 1508101000: el 0% no es el derecho general, es el tipo de la
    // medida "Derecho no preferencial en regimen de destino final", que exige la
    // autorizacion EUS (N990). Guardarlo como derecho de terceros paises sin
    // decirlo repetiria el patron del bug de los 426 aranceles.
    const r = resolverArancelGeneral({
      ok: true,
      code: '1508101000',
      medidas: [{
        codigoVariante: '1508101000',
        rotulo: 'Derecho no preferencial en régimen de destino final',
        filaLiteral: 'fila',
        enLinea: null,
        condiciones: {
          texto: 'C1 ... Y 155 ... 50.00 % C2 ... 0 % N990 EUS',
          general: { etiqueta: 'C2', esSancion: false, valor: 0, unidad: '%' },
          sancion: { etiqueta: 'C1', esSancion: true, valor: 50, unidad: '%' }
        }
      }]
    });

    expect(r.arancel).toEqual({ adValorem: 0 });
    expect(r.rotulo).toBe('Derecho no preferencial en régimen de destino final');
    expect(r.soloDestinoFinal).toBe(true);
  });

  it('no marca destino final el derecho de terceros paises normal', () => {
    const r = resolverArancelGeneral({
      ok: true,
      code: '1404900090',
      medidas: [{
        codigoVariante: '1404900090',
        rotulo: 'Derecho terceros países',
        filaLiteral: 'fila',
        enLinea: null,
        condiciones: {
          texto: 'B1 ... Y 155 ... 50.00 % B2 ... 0 %',
          general: { etiqueta: 'B2', esSancion: false, valor: 0, unidad: '%' },
          sancion: { etiqueta: 'B1', esSancion: true, valor: 50, unidad: '%' }
        }
      }]
    });

    expect(r.soloDestinoFinal).toBe(false);
    expect(r.rotulo).toBe('Derecho terceros países');
  });

  it('resuelve normalmente cuando todas las variantes coinciden', () => {
    // Varias variantes con el mismo tipo no son ambiguas: hay un unico derecho.
    const r = resolverArancelGeneral({
      ok: true,
      code: '1512190000',
      medidas: [
        { codigoVariante: '1512191000', enLinea: { valor: 5.1, unidad: '%' }, condiciones: null, filaLiteral: 'f1' },
        { codigoVariante: '1512199000', enLinea: { valor: 5.1, unidad: '%' }, condiciones: null, filaLiteral: 'f2' }
      ]
    });

    expect(r.arancel).toEqual({ adValorem: 5.1 });
  });
});

describe('tiposPorVariante', () => {
  it('asocia cada tipo a su codigo adicional sin mezclarlos', () => {
    // Caso real de 1515190000: el aceite en regimen de destino final va al 5,1%
    // y el resto al 9,6%. Son codigos declarables distintos, no alternativas del
    // mismo: mezclarlos daria un arancel que no corresponde a ninguno.
    const mapa = tiposPorVariante({
      medidas: [
        {
          codigoVariante: '1515191000',
          rotulo: 'Derecho no preferencial en régimen de destino final',
          enLinea: null,
          condiciones: {
            texto: 'C2 ... 5.10 %',
            general: { etiqueta: 'C2', esSancion: false, valor: 5.1, unidad: '%' },
            sancion: { etiqueta: 'C1', esSancion: true, valor: 50, unidad: '%' }
          }
        },
        {
          codigoVariante: '1515199000',
          rotulo: 'Derecho terceros países',
          enLinea: null,
          condiciones: {
            texto: 'B2 ... 9.60 %',
            general: { etiqueta: 'B2', esSancion: false, valor: 9.6, unidad: '%' },
            sancion: { etiqueta: 'B1', esSancion: true, valor: 50, unidad: '%' }
          }
        }
      ]
    });

    expect(mapa.get('1515191000').arancel).toEqual({ adValorem: 5.1 });
    // El 5,1% del ...1000 exige la autorizacion de destino final; el 9,6% no.
    expect(mapa.get('1515191000').soloDestinoFinal).toBe(true);
    expect(mapa.get('1515199000').soloDestinoFinal).toBe(false);
    expect(mapa.get('1515199000').arancel).toEqual({ adValorem: 9.6 });
    expect(mapa.get('1515199000').sancion).toEqual({ adValorem: 50, certificado: CERTIFICADO_SANCION });
  });

  it('ignora las medidas sin codigo adicional identificado', () => {
    const mapa = tiposPorVariante({
      medidas: [{ codigoVariante: null, enLinea: { valor: 9.6, unidad: '%' }, condiciones: null }]
    });

    expect(mapa.size).toBe(0);
  });
});

describe('extraerContingentes', () => {
  // Literal aplanado de measures_details.jsp para TARIC 0302410000 (Area=CN).
  const detalle = 'Contingente arancelario no preferencial |(16-06-2026 - 14-02-2027)| |: | | |0 %| ' +
    '| (Número de orden: |090006|) | | | | |1| |R0000321| |R0032/00| | | | | | | | |Excepto| ' +
    '|Reino Unido (GB)| | | | |ERGA OMNES (ERGA OMNES 1011)|';

  it('lee el numero de orden, el tipo in-quota y el periodo de la medida', () => {
    // El tipo dentro del contingente NO lo publica la pagina de QUOTA: solo esta
    // aqui. quotaService lo tenia cableado (`inQuota: 0.00`) para contingentes
    // que ni existen, y de ahi salia el "ahorro estimado" que se mostraba.
    const c = extraerContingentes(detalle);

    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      orderNumber: '090006',
      startDate: '2026-06-16',
      endDate: '2027-02-14',
      preferential: false
    });
    expect(c[0].inQuotaDuty).toEqual({ adValorem: 0 });
  });

  it('distingue el contingente preferencial del no preferencial', () => {
    const pref = detalle.replace('Contingente arancelario no preferencial', 'Contingente arancelario preferencial');

    expect(extraerContingentes(pref)[0].preferential).toBe(true);
  });

  it('lee un tipo in-quota especifico y no solo porcentajes', () => {
    const especifico = detalle.replace('|0 %|', '|12.50 EUR / hl|');

    expect(extraerContingentes(especifico)[0].inQuotaDuty)
      .toEqual({ specific: { amount: 12.5, unit: 'EUR/hl' } });
  });

  it('no devuelve nada cuando el codigo no tiene medida de contingente', () => {
    expect(extraerContingentes('Derecho terceros países |(01-07-2024 - )| |: | | |15.00 %|')).toEqual([]);
  });
});
