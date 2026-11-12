const servicio = require('../../../src/services/divisas/tiposCambioOficiales');

const SERIE = {
  '2026-10-21': { USD: 1.1234, JPY: 177.36 },
  '2026-10-22': { USD: 1.13, JPY: 178 }
};
const FECHA = new Date('2026-11-12T10:00:00Z');

function modeloFalso(guardados = []) {
  const docs = [...guardados];
  return {
    docs,
    findOne: jest.fn(({ mes }) => ({ lean: async () => docs.find((d) => d.mes === mes) || null })),
    updateOne: jest.fn(async (filtro, cambio) => { docs.push(cambio.$setOnInsert); })
  };
}

describe('tipos de cambio oficiales', () => {
  beforeEach(() => servicio.olvidarMemoria());

  test('descarga del BCE, guarda el mes y devuelve el tipo de la divisa', async () => {
    const modelo = modeloFalso();
    const descargar = jest.fn(async () => SERIE);
    const tipo = await servicio.tipoOficial('usd', { fecha: FECHA, modelo, descargar });
    expect(tipo).toEqual({
      divisa: 'USD', tipo: 1.1234, mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', fuente: 'BCE'
    });
    expect(modelo.docs).toHaveLength(1);
    expect(modelo.docs[0].mes).toBe('2026-11');
  });

  test('con el mes ya guardado no vuelve a llamar al BCE', async () => {
    const modelo = modeloFalso([{ mes: '2026-11', fechaReferencia: '2026-10-21', fechaPublicacion: '2026-10-21', tipos: { USD: 1.1234 } }]);
    const descargar = jest.fn();
    const tipo = await servicio.tipoOficial('USD', { fecha: FECHA, modelo, descargar });
    expect(tipo.tipo).toBe(1.1234);
    expect(descargar).not.toHaveBeenCalled();
  });

  test('el euro vale 1 sin consultar nada', async () => {
    const modelo = modeloFalso();
    const descargar = jest.fn();
    expect((await servicio.tipoOficial('EUR', { fecha: FECHA, modelo, descargar })).tipo).toBe(1);
    expect((await servicio.tipoOficial(undefined, { fecha: FECHA, modelo, descargar })).divisa).toBe('EUR');
    expect(descargar).not.toHaveBeenCalled();
  });

  test('una divisa que el BCE no cotiza devuelve null', async () => {
    const tipo = await servicio.tipoOficial('ARS', { fecha: FECHA, modelo: modeloFalso(), descargar: async () => SERIE });
    expect(tipo).toBeNull();
  });

  test('si la serie de 90 días no alcanza, prueba con la histórica', async () => {
    const descargar = jest.fn()
      .mockResolvedValueOnce({ '2026-10-30': { USD: 1.2 } })
      .mockResolvedValueOnce(SERIE);
    const tipo = await servicio.tipoOficial('USD', { fecha: FECHA, modelo: modeloFalso(), descargar });
    expect(tipo.tipo).toBe(1.1234);
    expect(descargar).toHaveBeenNthCalledWith(2, servicio.URL_HISTORICO);
  });

  test('si el BCE no trae el periodo, falla en vez de inventar un tipo', async () => {
    await expect(servicio.tipoOficial('USD', { fecha: FECHA, modelo: modeloFalso(), descargar: async () => ({}) }))
      .rejects.toThrow('2026-11');
  });

  test('lista las divisas del mes con el euro la primera', async () => {
    const lista = await servicio.divisasOficiales({ fecha: FECHA, modelo: modeloFalso(), descargar: async () => SERIE });
    expect(lista.mes).toBe('2026-11');
    expect(lista.divisas.map((d) => d.codigo)).toEqual(['EUR', 'JPY', 'USD']);
  });
});
