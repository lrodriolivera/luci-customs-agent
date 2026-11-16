/**
 * Arancel Integrado de la AEAT: interpretacion de las paginas reales de la sede
 * (descargadas el 16/11/2026 para 6302210089 con origen China) y flujo de las
 * tres peticiones sin salir a red.
 */
const fs = require('fs');
const path = require('path');

jest.mock('../../../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const {
  consultarArancelIntegrado,
  ArancelIntegradoError,
  decodificar,
  extraerEnlaceFicha,
  extraerCamposFicha,
  extraerMedidas,
  AREA_ERGA_OMNES
} = require('../../../src/services/aeat/arancelIntegrado');

const FIXTURES = path.join(__dirname, '../../fixtures/aeat-arancel');
const leer = (nombre) => decodificar(fs.readFileSync(path.join(FIXTURES, nombre)));

const BUSQUEDA = leer('busqueda-6302210089.html');
const FICHA = leer('ficha-6302210089.html');
const MEDIDAS = leer('medidas-6302210089-CN.html');

const cacheVacia = () => {
  const datos = new Map();
  return {
    get: jest.fn(async (k) => datos.get(k) ?? null),
    set: jest.fn(async (k, v) => { datos.set(k, v); })
  };
};

describe('decodificar', () => {
  test('la sede responde en ISO-8859-1: las tildes se leen bien', () => {
    expect(MEDIDAS).toContain('Impuesto del Valor Añadido');
    expect(MEDIDAS).not.toContain('�');
  });

  test('si los bytes son UTF-8 validos se respetan', () => {
    expect(decodificar(Buffer.from('Añadido', 'utf8'))).toBe('Añadido');
  });
});

describe('extraerEnlaceFicha', () => {
  test('encuentra la ficha del codigo exacto entre los resultados', () => {
    const enlace = extraerEnlaceFicha(BUSQUEDA, '6302210089');
    expect(enlace.url).toContain('ACCION=DetalleInt');
    expect(enlace.url).toContain('SIDNMC=69625');
    expect(enlace.url).not.toContain('&amp;');
  });

  test('un codigo que no figura en los resultados no tiene ficha', () => {
    expect(extraerEnlaceFicha(BUSQUEDA, '6302219000')).toBeNull();
  });
});

describe('extraerCamposFicha', () => {
  test('lee los identificadores ocultos y la descripcion', () => {
    expect(extraerCamposFicha(FICHA)).toEqual({
      SIDNMC: '00069625',
      SIDGUI: '00069243',
      SIDDSC: '00081771',
      fecha: '20261116000000000000',
      descripcion: 'Las demás'
    });
  });

  test('si la pagina cambia de formato falla de forma explicita', () => {
    expect(() => extraerCamposFicha('<html></html>')).toThrow(ArancelIntegradoError);
  });
});

describe('extraerMedidas', () => {
  const medidas = extraerMedidas(MEDIDAS);
  const medida = (codigo) => medidas.find((m) => m.codigo === codigo);

  test('lee todas las medidas de la tabla, en orden', () => {
    expect(medidas.map((m) => m.codigo)).toEqual(['103-APPL', '107-LVC', '117-SUSSH', '800-Union', 'COM-COMER', 'IVA-IVA']);
  });

  test('arancel a terceros paises y su reglamento', () => {
    expect(medida('103-APPL')).toMatchObject({
      tipo: 'ue',
      areaGeografica: 'TODOS ERGA OMNES',
      reglamento: '4R9617340',
      descripcion: 'Derecho terceros países',
      derecho: '12,000%',
      documentos: []
    });
  });

  test('IVA nacional', () => {
    expect(medida('IVA-IVA')).toMatchObject({ tipo: 'iva', descripcion: 'Impuesto del Valor Añadido', derecho: '21,000%' });
  });

  test('control nacional de seguridad de los productos con sus exclusiones', () => {
    const com = medida('COM-COMER');
    expect(com.tipo).toBe('nacional');
    expect(com.descripcion).toContain('REAL DECRETO 330/2008');
    expect(com.exclusiones).toBe('Noruega (NO), Islandia (IS), Liechtenstein (LI), Turquía (TR)');
    expect(com.derecho).toBeUndefined();
  });

  test('documentos que exige cada medida', () => {
    expect(medida('107-LVC')).toMatchObject({ derecho: '3,000 EUR' });
    expect(medida('107-LVC').documentos.map((d) => d.codigo)).toEqual(['C127', 'C128', 'C129', 'Y081']);
    expect(medida('117-SUSSH').documentos[0]).toEqual({
      codigo: 'C990',
      descripcion: 'Autorización de destino final buques y plataformas (columna 8c del Anexo A del Reglamento Delegado (UE) 2015/2446)'
    });
  });

  test('sin tabla de medidas falla de forma explicita', () => {
    expect(() => extraerMedidas('<html>error</html>')).toThrow(ArancelIntegradoError);
  });
});

describe('consultarArancelIntegrado', () => {
  const fecha = new Date(2026, 10, 16);

  test('hace las tres peticiones y devuelve las medidas del origen indicado', async () => {
    const http = jest.fn()
      .mockResolvedValueOnce(BUSQUEDA)
      .mockResolvedValueOnce(FICHA)
      .mockResolvedValueOnce(MEDIDAS);

    const r = await consultarArancelIntegrado({ codigo: '6302.21.00.89', origen: 'cn', fecha, http, cache: cacheVacia() });

    expect(r).toMatchObject({ existe: true, codigo: '6302210089', areaGeografica: 'CN', fechaConsulta: '16-11-2026', descripcion: 'Las demás' });
    expect(r.medidas).toHaveLength(6);
    expect(http).toHaveBeenCalledTimes(3);
    expect(http.mock.calls[0][0].datos).toMatchObject({ FCdnmc: '6302210089', FFecha: '16-11-2026' });
    expect(http.mock.calls[1][0]).toMatchObject({ metodo: 'get' });
    expect(http.mock.calls[2][0].datos).toMatchObject({ SIDNMC: '00069625', SIDGUI: '00069243', SIDDSC: '00081771', ageo: 'CN', nomen: '6302210089' });
  });

  test('sin origen consulta erga omnes', async () => {
    const http = jest.fn().mockResolvedValueOnce(BUSQUEDA).mockResolvedValueOnce(FICHA).mockResolvedValueOnce(MEDIDAS);
    const r = await consultarArancelIntegrado({ codigo: '6302210089', fecha, http, cache: cacheVacia() });
    expect(r.areaGeografica).toBe(AREA_ERGA_OMNES);
    expect(http.mock.calls[2][0].datos.ageo).toBe(AREA_ERGA_OMNES);
  });

  test('un codigo que la AEAT no tiene se informa como inexistente, sin pedir la ficha', async () => {
    const http = jest.fn().mockResolvedValueOnce(BUSQUEDA);
    const r = await consultarArancelIntegrado({ codigo: '6302219000', fecha, http, cache: cacheVacia() });
    expect(r).toMatchObject({ existe: false, medidas: [] });
    expect(http).toHaveBeenCalledTimes(1);
  });

  test('la segunda consulta del mismo dia sale de la cache', async () => {
    const cache = cacheVacia();
    const http = jest.fn().mockResolvedValueOnce(BUSQUEDA).mockResolvedValueOnce(FICHA).mockResolvedValueOnce(MEDIDAS);
    await consultarArancelIntegrado({ codigo: '6302210089', origen: 'CN', fecha, http, cache });
    const segunda = await consultarArancelIntegrado({ codigo: '6302210089', origen: 'CN', fecha, http, cache });
    expect(http).toHaveBeenCalledTimes(3);
    expect(segunda.medidas).toHaveLength(6);
  });

  test('rechaza codigos que no tienen 10 digitos sin llamar a la AEAT', async () => {
    const http = jest.fn();
    await expect(consultarArancelIntegrado({ codigo: '630221', http, cache: cacheVacia() })).rejects.toMatchObject({ codigo: 'VALIDACION' });
    expect(http).not.toHaveBeenCalled();
  });

  test('un fallo de red o de la sede se propaga, no se inventan medidas', async () => {
    const http = jest.fn().mockRejectedValue(new ArancelIntegradoError('La AEAT respondio HTTP 302', 'HTTP'));
    await expect(consultarArancelIntegrado({ codigo: '6302210089', fecha, http, cache: cacheVacia() })).rejects.toMatchObject({ codigo: 'HTTP' });
  });
});
