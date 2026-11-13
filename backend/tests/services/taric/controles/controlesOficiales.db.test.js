/**
 * Carga y consulta de las medidas de control del TARIC contra un Mongo real
 * (en memoria): la consulta depende de índices y operadores de Mongo, así que
 * no se simula el modelo.
 */
const { usarBaseDeDatosEnMemoria } = require('../../../helpers/memoryDb');
const TaricControlMeasure = require('../../../../src/models/TaricControlMeasure');
const TaricReference = require('../../../../src/models/TaricReference');
const { sincronizarControles, MINIMO_DE_MEDIDAS } = require('../../../../src/services/taric/controles/sincronizacionControles');
const { controlesPara } = require('../../../../src/services/taric/controles/controlesOficiales');
const medidasControl = require('../../../../src/services/taric/controles/medidasControl');

usarBaseDeDatosEnMemoria();

const modelos = { TaricControlMeasure, TaricReference };
const AHORA = new Date('2026-11-12T10:00:00Z');

const medida = (codigo, origen, tipo, certificados = [], extra = {}) => ({
  codigo, prefijo: medidasControl.prefijoDe(codigo), codigoAdicional: '', origen, origenNombre: origen, tipo,
  tipoNombre: extra.tipoNombre || 'Veterinary control', baseLegal: extra.baseLegal || 'Regulation 0632/21', desde: '20200101', hasta: '',
  condiciones: certificados.length ? [{ grupo: 'B', certificados, exenciones: [], impideSinCertificado: true }] : [],
  excluidos: extra.excluidos || []
});

const AREAS = { 1008: ['BR', 'CN', 'CH'], 1011: ['BR', 'CN', 'CH'] };
const CERTIFICADOS = { N853: 'Documento Sanitario Común de Entrada (DSCE-P)', C644: 'Certificado de control de productos ecológicos' };
const RELLENO = Array.from({ length: MINIMO_DE_MEDIDAS }, (_, i) => medida(`99${String(i).padStart(6, '0')}00`, 'ZZ', '707'));

/** Descarga y lectura de ficheros sustituidas por un conjunto ya preparado. */
function fuente(mes, medidas, { relleno = RELLENO } = {}) {
  return {
    descargar: jest.fn(async ({ yaCargado }) => (yaCargado(mes) ? { mes, omitido: true } : { mes })),
    preparar: jest.fn(() => ({ medidas: [...medidas, ...relleno], areas: AREAS, certificados: CERTIFICADOS }))
  };
}

describe('medidas de control: carga y consulta', () => {
  test('carga el mes y responde con las medidas y sus certificados en español', async () => {
    const datos = fuente('2026-11', [
      medida('0201000000', '1008', '410', ['N853']),
      medida('0200000000', '1011', '750', ['C644'], { tipoNombre: 'Import control of organic products', baseLegal: 'Regulation 2306/21', excluidos: ['CH'] }),
      medida('0201100000', 'BR', '277', [], { tipoNombre: 'Import prohibition', baseLegal: 'Regulation 0001/26' })
    ]);

    const resultado = await sincronizarControles({ ...modelos, ...datos, ahora: AHORA });
    expect(resultado).toMatchObject({ mes: '2026-11', certificados: 2 });

    const brasil = await controlesPara('0201100000', 'br', modelos);
    expect(brasil.fuente.mes).toBe('2026-11');
    // La prohibición va la primera.
    expect(brasil.medidas.map((m) => [m.tipo, m.prohibicion])).toEqual([['277', true], ['410', false], ['750', false]]);
    expect(brasil.medidas[1]).toMatchObject({ nombre: 'Control veterinario', baseLegal: 'Regulation 0632/21' });
    // El origen de la medida sale con su nombre oficial en español.
    expect(brasil.medidas[1].ambito).toEqual({ codigo: '0201000000', origen: '1008', origenNombre: 'Todos los terceros países' });
    expect(brasil.medidas[0].ambito.origenNombre).toBe('Brasil');
    expect(brasil.medidas[1].condiciones[0].certificados).toEqual([{ codigo: 'N853', descripcion: 'Documento Sanitario Común de Entrada (DSCE-P)' }]);

    // Suiza está excluida del control de ecológicos; China no tiene la prohibición.
    expect((await controlesPara('0201100000', 'CH', modelos)).medidas.map((m) => m.tipo)).toEqual(['410']);
    expect((await controlesPara('0201100000', 'CN', modelos)).medidas.map((m) => m.tipo)).toEqual(['410', '750']);
    // Otra partida no arrastra el control veterinario de la 0201.
    expect((await controlesPara('8471300000', 'CN', modelos)).medidas).toEqual([]);
  });

  test('si el mes ya está cargado no vuelve a cargar; con forzar sí', async () => {
    const datos = fuente('2026-11', [medida('0201000000', '1008', '410', ['N853'])]);
    await sincronizarControles({ ...modelos, ...datos, ahora: AHORA });
    const total = await TaricControlMeasure.countDocuments();

    expect(await sincronizarControles({ ...modelos, ...datos, ahora: AHORA })).toEqual({ omitido: true, mes: '2026-11' });
    expect(datos.preparar).toHaveBeenCalledTimes(1);
    const forzado = await sincronizarControles({ ...modelos, ...datos, ahora: new Date('2026-11-13T10:00:00Z'), forzar: true });
    expect(forzado.omitido).toBeUndefined();
    // Sustituye el conjunto: no se acumulan las medidas de la carga anterior.
    expect(await TaricControlMeasure.countDocuments()).toBe(total);
  });

  test('un fichero con muy pocas medidas no sustituye lo cargado', async () => {
    await sincronizarControles({ ...modelos, ...fuente('2026-11', [medida('0201000000', '1008', '410', ['N853'])]), ahora: AHORA });
    const antes = await TaricControlMeasure.countDocuments();

    const incompleto = fuente('2026-12', [medida('0201000000', '1008', '410', ['N853'])], { relleno: [] });
    await expect(sincronizarControles({ ...modelos, ...incompleto, ahora: AHORA })).rejects.toThrow('no se sustituye');
    expect(await TaricControlMeasure.countDocuments()).toBe(antes);
  });

  test('sin datos cargados la consulta responde vacía y sin fuente', async () => {
    const vacio = await controlesPara('0201100000', 'BR', modelos);
    expect(vacio).toEqual({ codigo: '0201100000', origen: 'BR', fuente: null, medidas: [], dobleUso: [], fuenteDobleUso: null });
  });
});

describe('sanciones y doble uso', () => {
  const { sincronizarDobleUso, MINIMO_DE_CODIGOS_DOBLE_USO } = require('../../../../src/services/taric/controles/sincronizacionControles');
  const tablaGrande = (extra) => ({
    ...Object.fromEntries(Array.from({ length: MINIMO_DE_CODIGOS_DOBLE_USO }, (_, i) => [`97${String(i).padStart(6, '0')}`, [{ categoria: '9Z999', nota: 'DU999' }]])),
    ...extra
  });
  const origenTabla = (id, tabla) => ({
    descargar: jest.fn(async ({ yaCargado }) => (yaCargado(id) ? { id, nombre: `tabla ${id}`, omitido: true } : { id, nombre: `tabla ${id}`, contenido: 'x' })),
    leer: jest.fn(() => tabla)
  });

  test('una medida de un reglamento de sanciones se marca y va delante', async () => {
    await sincronizarControles({ ...modelos, ...fuente('2026-11', [
      medida('8471000000', 'RU', '762', ['L142'], { tipoNombre: 'Import control', baseLegal: 'Regulation 0833/14' }),
      medida('8471300000', 'RU', '482', [], { tipoNombre: 'Declaration of subheading', baseLegal: 'Regulation 0927/12' })
    ]), ahora: AHORA });

    const r = await controlesPara('8471300000', 'RU', modelos);

    expect(r.medidas.map((m) => [m.tipo, m.sancion?.pais || null])).toEqual([['762', 'Rusia'], ['482', null]]);
    expect(r.medidas[0].sancion.norma).toBe('Reglamento (UE) n.º 833/2014');
  });

  test('carga la tabla de doble uso y la consulta devuelve las categorías del código y de sus niveles superiores', async () => {
    const tabla = tablaGrande({ 840110: [{ categoria: '0A001a', nota: 'DU583' }], 84011000: [{ categoria: '0B001', nota: 'DU001' }] });
    const cargado = await sincronizarDobleUso({ TaricReference, ...origenTabla('t1', tabla), ahora: AHORA });
    expect(cargado.codigos).toBe(MINIMO_DE_CODIGOS_DOBLE_USO + 2);

    const reactor = await controlesPara('8401100010', 'CN', modelos);
    expect(reactor.dobleUso.map((d) => [d.categoria, d.nota, d.articulo])).toEqual([['0A001a', 'DU583', '0A001'], ['0B001', 'DU001', '0B001']]);
    // Encabezado oficial en español del artículo del anexo I, con su fuente.
    expect(reactor.dobleUso[0].descripcion).toMatch(/^"Reactores nucleares" y equipos y componentes/);
    expect(reactor.dobleUso[1].descripcion).toMatch(/^Plantas para la separación de isótopos/);
    expect(reactor.fuenteDobleUso).toMatchObject({ fecha: '2026-09-21', enlace: 'https://publications.europa.eu/resource/celex/02021R0821-20260921' });
    const sinDobleUso = await controlesPara('6302100000', 'CN', modelos);
    expect(sinDobleUso.dobleUso).toEqual([]);
    expect(sinDobleUso.fuenteDobleUso).toBeNull();
  });

  test('la misma tabla no se vuelve a cargar; una tabla incompleta no sustituye la cargada', async () => {
    const origen = origenTabla('t1', tablaGrande({ 840110: [{ categoria: '0A001a', nota: 'DU583' }] }));
    await sincronizarDobleUso({ TaricReference, ...origen, ahora: AHORA });
    expect(await sincronizarDobleUso({ TaricReference, ...origen, ahora: AHORA })).toEqual({ omitido: true, tabla: 'tabla t1' });
    expect(origen.leer).toHaveBeenCalledTimes(1);

    await expect(sincronizarDobleUso({ TaricReference, ...origenTabla('t2', { 840110: [{ categoria: '0A001a', nota: 'DU583' }] }), ahora: AHORA }))
      .rejects.toThrow('no se sustituye');
    expect((await controlesPara('8401100000', 'CN', modelos)).dobleUso).toHaveLength(1);
  });
});
