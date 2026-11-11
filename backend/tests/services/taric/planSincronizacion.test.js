/**
 * Comparacion del catalogo TARIC de LUCI con la nomenclatura oficial.
 * Medicion real del 11/Nov/2026: faltaban 529 codigos, sobraban 102 y 52
 * tenian mal la marca de declarable.
 */
const { planificar, desglose, palabrasClave, MINIMO_CODIGOS_OFICIALES } = require('../../../src/services/taric/planSincronizacion');

// Nomenclatura oficial de relleno, suficiente para superar el minimo de seguridad.
const relleno = () => {
  const m = new Map();
  for (let i = 0; i < MINIMO_CODIGOS_OFICIALES; i++) m.set(`99${String(i).padStart(8, '0')}`, { nivel: 10, validoDesde: null });
  return m;
};
const catalogoDeRelleno = (oficial) => [...oficial.keys()].map((code) => ({ code, level: 10, isLeaf: true, isActive: true }));
const escenario = () => {
  const oficial = relleno();
  const declarables = new Set(oficial.keys());
  return { oficial, declarables, catalogo: catalogoDeRelleno(oficial) };
};

describe('planificar', () => {
  test('catalogo identico a la oficial: nada que hacer', () => {
    const { oficial, declarables, catalogo } = escenario();

    const plan = planificar(oficial, declarables, catalogo);

    expect(plan).toMatchObject({ altas: [], bajas: [], reactivar: [], declarable: [], nivel: [], sinCambios: MINIMO_CODIGOS_OFICIALES });
  });

  test('alta: codigo oficial que el catalogo no tiene, con su nivel, marca y fecha', () => {
    const { oficial, declarables, catalogo } = escenario();
    const desde = new Date('2026-07-01T12:00:00Z');
    oficial.set('0207412010', { nivel: 10, validoDesde: desde });
    oficial.set('0207412000', { nivel: 8, validoDesde: null });
    declarables.add('0207412010');

    const plan = planificar(oficial, declarables, catalogo);

    expect(plan.altas).toEqual([
      { code: '0207412000', level: 8, isLeaf: false, validFrom: null },
      { code: '0207412010', level: 10, isLeaf: true, validFrom: desde }
    ]);
    expect(plan.bajas).toEqual([]);
  });

  test('baja: codigo activo que ya no esta vigente; uno ya inactivo no se repite', () => {
    const { oficial, declarables, catalogo } = escenario();
    catalogo.push({ code: '2811220040', level: 10, isLeaf: true, isActive: true });
    catalogo.push({ code: '2811220080', level: 10, isLeaf: true, isActive: false });

    const plan = planificar(oficial, declarables, catalogo);

    expect(plan.bajas).toEqual([{ code: '2811220040', level: 10 }]);
  });

  test('reactivar: codigo de baja que vuelve a estar en la oficial', () => {
    const { oficial, declarables, catalogo } = escenario();
    catalogo[0].isActive = false;

    const plan = planificar(oficial, declarables, catalogo);

    expect(plan.reactivar).toEqual([{ code: catalogo[0].code }]);
    expect(plan.sinCambios).toBe(MINIMO_CODIGOS_OFICIALES - 1);
  });

  test('corrige la marca de declarable y el nivel en los dos sentidos', () => {
    const { oficial, declarables, catalogo } = escenario();
    declarables.delete(catalogo[0].code);              // LUCI lo tiene como declarable y no lo es
    catalogo[1].isLeaf = false;                        // LUCI no lo marca y si lo es
    catalogo[2].level = 8;                             // nivel distinto

    const plan = planificar(oficial, declarables, catalogo);

    expect(plan.declarable).toEqual([{ code: catalogo[0].code, isLeaf: false }, { code: catalogo[1].code, isLeaf: true }]);
    expect(plan.nivel).toEqual([{ code: catalogo[2].code, level: 10, antes: 8 }]);
  });

  test('una nomenclatura oficial incompleta no se sincroniza', () => {
    const corta = new Map([['0100000000', { nivel: 2 }]]);
    expect(() => planificar(corta, new Set(), [])).toThrow('parece incompleta');
    expect(() => planificar(undefined, new Set(), [])).toThrow('parece incompleta');
  });

  test('si daria de baja mas del 5 % del catalogo se detiene', () => {
    const { oficial, declarables, catalogo } = escenario();
    for (let i = 0; i < 1000; i++) catalogo.push({ code: `98${String(i).padStart(8, '0')}`, level: 10, isLeaf: true, isActive: true });

    expect(() => planificar(oficial, declarables, catalogo)).toThrow('daria de baja 1000 de 16000 codigos');
  });

  test('con el catalogo vacio todo son altas', () => {
    const { oficial, declarables } = escenario();
    expect(planificar(oficial, declarables, []).altas).toHaveLength(MINIMO_CODIGOS_OFICIALES);
  });
});

describe('desglose y palabras clave', () => {
  test('desglosa el codigo como lo guarda el catalogo', () => {
    expect(desglose('8544429010')).toEqual({ chapter: '85', heading: '8544', subheading: '854442', cnCode: '85444290', taricCode: '8544429010' });
  });

  test('palabras de busqueda sin HTML, sin palabras vacias y sin repetir', () => {
    expect(palabrasClave('Cable de transmisión de datos<br>- para cable, con conectores')).toEqual(['cable', 'transmisión', 'datos', 'conectores']);
    expect(palabrasClave('Los demás')).toEqual(['demás']);
    expect(palabrasClave(undefined)).toEqual([]);
  });
});
