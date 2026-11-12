const {
  mesDe, mesAnterior, penultimoMiercoles, fechaDeReferencia, parsearBce, tiposDelMes, aEuros
} = require('../../../src/services/divisas/tipoCambioAduanero');

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<Cube>
<Cube time="2026-10-22"><Cube currency="USD" rate="1.1301"/><Cube currency="JPY" rate="178.01"/></Cube>
<Cube time="2026-10-21"><Cube currency="USD" rate="1.1234"/><Cube currency="JPY" rate="177.36"/><Cube currency="GBP" rate="0.83825"/></Cube>
<Cube time="2026-10-20"><Cube currency="USD" rate="1.1200"/><Cube currency="JPY" rate="177.00"/></Cube>
</Cube>
</gesmes:Envelope>`;

describe('tipo de cambio aduanero: fechas', () => {
  test('el penúltimo miércoles de octubre de 2026 es el día 21', () => {
    expect(penultimoMiercoles('2026-10')).toBe('2026-10-21');
  });

  test('en un mes con cinco miércoles toma el cuarto', () => {
    // Septiembre de 2026: miércoles 2, 9, 16, 23 y 30.
    expect(penultimoMiercoles('2026-09')).toBe('2026-09-23');
  });

  test('el tipo de noviembre es el del penúltimo miércoles de octubre', () => {
    expect(fechaDeReferencia('2026-11')).toBe('2026-10-21');
  });

  test('el tipo de enero sale de diciembre del año anterior', () => {
    expect(mesAnterior('2027-01')).toBe('2026-12');
    expect(fechaDeReferencia('2027-01')).toBe('2026-12-23');
  });

  test('el mes se toma en hora de Madrid, no en UTC', () => {
    // 30/Nov a las 23:30 UTC ya es 1/Dic en Madrid.
    expect(mesDe(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
    expect(mesDe(new Date('2026-11-30T22:30:00Z'))).toBe('2026-11');
  });
});

describe('tipo de cambio aduanero: serie del BCE', () => {
  test('lee las fechas y los tipos del XML', () => {
    const serie = parsearBce(XML);
    expect(Object.keys(serie).sort()).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
    expect(serie['2026-10-21']).toEqual({ USD: 1.1234, JPY: 177.36, GBP: 0.83825 });
  });

  test('un XML vacío o ajeno da una serie vacía', () => {
    expect(parsearBce('')).toEqual({});
    expect(parsearBce('<html>error</html>')).toEqual({});
  });

  test('toma el tipo del día de referencia, no el más reciente', () => {
    const delMes = tiposDelMes('2026-11', parsearBce(XML));
    expect(delMes.fechaReferencia).toBe('2026-10-21');
    expect(delMes.fechaPublicacion).toBe('2026-10-21');
    expect(delMes.tipos.USD).toBe(1.1234);
  });

  test('si ese miércoles no hubo publicación rige el último tipo anterior', () => {
    const serie = parsearBce(XML);
    delete serie['2026-10-21'];
    const delMes = tiposDelMes('2026-11', serie);
    expect(delMes.fechaPublicacion).toBe('2026-10-20');
    expect(delMes.tipos.USD).toBe(1.12);
  });

  test('si la serie no alcanza el día de referencia no inventa un tipo', () => {
    expect(tiposDelMes('2026-11', { '2026-10-22': { USD: 1.13 } })).toBeNull();
    expect(tiposDelMes('2026-11', { '2026-09-01': { USD: 1.1 } })).toBeNull();
    expect(tiposDelMes('2026-11', {})).toBeNull();
  });
});

describe('tipo de cambio aduanero: conversión', () => {
  test('divide entre el tipo y redondea a céntimos', () => {
    expect(aEuros(10000, 1.1234)).toBe(8901.55);
    expect(aEuros(500, 1)).toBe(500);
    expect(aEuros(null, 1.1)).toBe(0);
  });

  test('rechaza un tipo que no sea positivo', () => {
    expect(() => aEuros(100, 0)).toThrow();
    expect(() => aEuros(100, undefined)).toThrow();
  });
});
