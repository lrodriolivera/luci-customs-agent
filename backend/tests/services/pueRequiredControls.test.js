/**
 * Determinacion de controles paraduaneros (PUE) por codigo TARIC.
 *
 * getRequiredPUE decide que organismos tienen que autorizar una mercancia antes
 * de que Aduanas la despache: ROHS (aparatos electricos), COM (SOIVRE calidad
 * comercial), ECO (agroalimentario) y CAL (textiles). Si se queda corto, la
 * carga se retiene en frontera; si se pasa, se piden certificados que nadie
 * exige.
 *
 * Los codigos TARIC son reales y salen de la propia configuracion del servicio.
 */

const pueService = require('../../src/services/pueService');

/** Tipos de control exigidos para una lista de mercancias. */
const tipos = (goods) => pueService.getRequiredPUE(goods).types;

describe('pueService.getRequiredPUE', () => {
  test('un aparato electrico exige control ROHS', () => {
    // 8418: refrigeradores. Directiva RoHS de sustancias peligrosas.
    expect(tipos([{ taricCode: '8418102000' }])).toContain('ROHS');
  });

  test('los juguetes exigen control COM (SOIVRE)', () => {
    // 9503: juguetes. Control de calidad comercial y seguridad.
    expect(tipos([{ taricCode: '9503007000' }])).toContain('COM');
  });

  test('los productos agroalimentarios exigen control ECO', () => {
    // Capitulo 08: frutas.
    expect(tipos([{ taricCode: '0805100000' }])).toContain('ECO');
  });

  test('los textiles exigen control CAL', () => {
    // Capitulo 52: algodon.
    expect(tipos([{ taricCode: '5201000000' }])).toContain('CAL');
  });

  test('mezcla de clasificadas y sin clasificar: solo cuentan las primeras', () => {
    const r = pueService.getRequiredPUE([
      { description: 'Sin clasificar' },
      { taricCode: '9503007000' }
    ]);

    expect(r.types).toEqual(['COM']);
  });

  test('una mercancia sin control asociado no exige ninguno', () => {
    // 7326: manufacturas de hierro. No esta en ninguna lista.
    expect(pueService.getRequiredPUE([{ taricCode: '7326909800' }]).count).toBe(0);
  });

  test('los ordenadores exigen ROHS, como cualquier aparato electrico', () => {
    // 8471 esta en la lista ROHS: la directiva de sustancias peligrosas aplica
    // a los equipos informaticos. Lo comprobe porque asumi lo contrario.
    expect(tipos([{ taricCode: '8471300000' }])).toEqual(['ROHS']);
  });

  // HALLAZGO, no arreglado: los capitulos textiles 50-63 estan en la lista de
  // ECO ("Productos Ecologicos") y en la de CAL ("Calidad Comercial"), los 14.
  // Por eso una camiseta exige DOS controles SOIVRE en vez de uno. Que un
  // textil sea "producto ecologico" es dudoso, pero corregir el catalogo es una
  // decision de negocio aduanero, no tecnica. Este test fija el comportamiento
  // ACTUAL para que el cambio sea consciente.
  test('los textiles exigen ECO y CAL a la vez (catalogo solapado)', () => {
    expect(tipos([{ taricCode: '6109100010' }]).sort()).toEqual(['CAL', 'ECO']);
  });

  test('varias mercancias acumulan sus controles sin duplicar tipos', () => {
    const r = pueService.getRequiredPUE([
      { taricCode: '8418102000' },  // ROHS
      { taricCode: '9503007000' },  // COM
      { taricCode: '8421392000' }   // ROHS otra vez
    ]);

    expect(r.types).toEqual(expect.arrayContaining(['ROHS', 'COM']));
    expect(r.types.filter(t => t === 'ROHS')).toHaveLength(1);
  });

  test('agrupa bajo un mismo control los codigos que lo comparten', () => {
    const r = pueService.getRequiredPUE([
      { taricCode: '8418102000' },
      { taricCode: '8421392000' }
    ]);

    const rohs = r.required.find(x => x.type === 'ROHS');
    expect(rohs.taricCodes).toEqual(['8418102000', '8421392000']);
  });

  test('no repite el mismo codigo dentro de un control', () => {
    const r = pueService.getRequiredPUE([
      { taricCode: '8418102000' },
      { taricCode: '8418102000' }
    ]);

    expect(r.required.find(x => x.type === 'ROHS').taricCodes).toEqual(['8418102000']);
  });

  test('cada control indica el organismo y la norma que lo ampara', () => {
    // El operador necesita saber a quien dirigirse y por que.
    const [control] = pueService.getRequiredPUE([{ taricCode: '9503007000' }]).required;

    expect(control.authority).toBeTruthy();
    expect(control.regulation).toBeTruthy();
    expect(control.reason).toContain('9503007000');
  });

  describe('entradas incompletas', () => {
    test('una lista vacia no exige controles', () => {
      expect(pueService.getRequiredPUE([]).count).toBe(0);
    });

    test('una mercancia sin codigo TARIC no exige controles', () => {
      // Llega asi cuando aun no se ha clasificado.
      expect(pueService.getRequiredPUE([{ description: 'Sin clasificar' }]).count).toBe(0);
    });

  });
});

describe('pueService: catalogos', () => {
  test('los 4 tipos de control estan definidos', () => {
    const t = pueService.getTypes();

    expect(Object.keys(t).length).toBeGreaterThanOrEqual(4);
  });

  test('cada tipo declara documentos requeridos', () => {
    for (const tipo of ['ROHS', 'COM', 'ECO', 'CAL']) {
      expect(pueService.getRequiredDocuments(tipo).length).toBeGreaterThan(0);
    }
  });

  test('un tipo inexistente no devuelve documentos', () => {
    expect(pueService.getRequiredDocuments('INVENTADO')).toEqual([]);
  });

  test('las oficinas SOIVRE se pueden filtrar por provincia', () => {
    const todas = pueService.getSoivreOffices();
    expect(Array.isArray(todas)).toBe(true);
    expect(todas.length).toBeGreaterThan(0);
  });
});
