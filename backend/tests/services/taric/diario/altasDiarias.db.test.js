/**
 * Altas de codigos que traen las publicaciones diarias del TARIC, contra un
 * Mongo real (en memoria). Los datos son los de TARIC_20261106_1917 y
 * TARIC_20261110_1914 (capitulo 39); el fichero de derechos de CIRCABC se
 * sustituye por un mapa con la misma forma que `leerDerechosTercerosPaises`.
 */
const { usarBaseDeDatosEnMemoria } = require('../../../helpers/memoryDb');
const TaricCode = require('../../../../src/models/TaricCode');
const TaricDailyPublication = require('../../../../src/models/TaricDailyPublication');
const altas = require('../../../../src/services/taric/diario/altasDiarias');
const { MAXIMO_A_APLICAR } = require('../../../../src/services/taric/diario/sincronizacionDiaria');

usarBaseDeDatosEnMemoria();

const HOY = new Date('2026-11-13T05:00:00Z');
const PUB_1106 = 'TARIC_20261106_1917';
const PUB_1110 = 'TARIC_20261110_1914';

// Derecho de terceros paises vigente segun el fichero mensual: el 6,5 % del
// capitulo 39 esta fijado en 3908100000 y en la partida 3924.
const derechosOficiales = async () => ({
  mes: '2026-11',
  derechos: new Map([
    ['3908100000', [{ codigoAdicional: '', texto: '6.500 %' }]],
    ['3924000000', [{ codigoAdicional: '', texto: '6.500 %' }]],
    ['3926000000', [{ codigoAdicional: '', texto: '6.500 %' }, { codigoAdicional: '2600', texto: '0.000 %' }]]
  ])
});

const existente = (code, extra = {}) => ({
  code, breakdown: { chapter: code.slice(0, 2), heading: code.slice(0, 4) }, description: { es: 'Poliamidas', en: 'Polyamides' },
  level: 10, isLeaf: true, isActive: true, duties: { thirdCountry: 6.5, origen: { fuente: 'taric_oficial' } }, ...extra
});
const alta = (code, extra = {}) => ({
  clase: 'codigo', code, accion: 'alta', desde: '20261106', hasta: '', detalle: 'Las demás', detalleEn: 'Other', nivel: 10, estado: 'pendiente',
  motivo: 'Código nuevo', ...extra
});
const publicar = (nombre, cambios) => TaricDailyPublication.create({ nombre, fecha: '2026-11-06 19:17', procesadoEn: HOY, resumen: {}, cambios });
const estadoDe = async (nombre, code) => (await TaricDailyPublication.findOne({ nombre }).lean()).cambios.find((c) => c.code === code);
const modelos = { TaricCode, TaricDailyPublication, derechos: derechosOficiales };

beforeEach(async () => {
  // 3908100000 (nivel 6) era declarable hasta que el 06/11 se dividio en 10 y 90.
  await TaricCode.create(existente('3908100000', {
    level: 6, description: { es: 'Poliamidas -6, -11, -12', en: 'Polyamide-6, -11, -12' },
    legalDescription: 'Plástico y sus manufacturas > Poliamidas en formas primarias > Poliamidas -6, -11, -12'
  }));
  await TaricCode.create(existente('3924100000', { level: 6, isLeaf: false, legalDescription: 'Plástico y sus manufacturas > Vajilla y demás artículos para el servicio de mesa o de cocina' }));
});

describe('alta de un código nuevo que ya está en vigor', () => {
  test('entra en el catálogo con su descripción oficial en español, su nivel, declarable y el derecho heredado', async () => {
    await publicar(PUB_1106, [alta('3908100090')]);

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r).toMatchObject({ altas: 1, codigos: ['3908100090'], padres: ['3908100000'] });
    const doc = await TaricCode.findOne({ code: '3908100090' }).lean();
    expect(doc).toMatchObject({
      level: 10, isLeaf: true, isActive: true,
      description: { es: 'Las demás', en: 'Other' },
      breakdown: { chapter: '39', heading: '3908', subheading: '390810', cnCode: '39081000', taricCode: '3908100090' },
      legalDescription: 'Plástico y sus manufacturas > Poliamidas en formas primarias > Poliamidas -6, -11, -12 > Las demás',
      altaDiaria: { publicacion: PUB_1106 }
    });
    expect(doc.validFrom.toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(doc.duties.thirdCountry).toBe(6.5);
    expect(doc.duties.origen).toMatchObject({ fuente: 'taric_oficial', rotulo: 'Third country duty' });
    expect(doc.duties.origen.evidencia).toContain('«6.500 %» (heredado de 3908100000)');
    expect(doc.duties.origen.evidencia).toContain(PUB_1106);
    expect(doc.duties.origen.evidencia).toContain('06/11/2026');
    expect(doc.notes.join(' ')).toContain(PUB_1106);
    // El codigo del que cuelga deja de ser declarable.
    expect((await TaricCode.findOne({ code: '3908100000' }).lean()).isLeaf).toBe(false);
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ estado: 'aplicado' });
  });

  test('si el derecho viene en la propia publicación diaria, manda sobre el del fichero mensual', async () => {
    await publicar(PUB_1106, [
      alta('3908100090'),
      { clase: 'derecho', code: '3908100090', tipo: '103', origen: '1011', accion: 'alta', desde: '20261106', hasta: '', detalle: '4.000 %', estado: 'informativo' }
    ]);

    await altas.aplicarAltas({ ...modelos, ahora: HOY });

    const doc = await TaricCode.findOne({ code: '3908100090' }).lean();
    expect(doc.duties.thirdCountry).toBe(4);
    expect(doc.duties.origen).toMatchObject({ fuente: 'taric_oficial', metodo: 'publicacion_diaria' });
  });

  test('un derecho oficial que LUCI no sabe liquidar entra como no calculable, con el texto oficial', async () => {
    await publicar(PUB_1110, [alta('3926909740', { desde: '20261110' })]);

    await altas.aplicarAltas({ ...modelos, ahora: HOY });

    const doc = await TaricCode.findOne({ code: '3926909740' }).lean();
    expect(doc.duties.thirdCountry).toBeNull();
    expect(doc.duties.origen.fuente).toBe('no_calculable');
    expect(doc.duties.origen.evidencia).toContain('«6.500 % | 0.000 %»');
  });

  test('repetir la pasada no duplica ni cambia nada', async () => {
    await publicar(PUB_1106, [alta('3908100090')]);
    await altas.aplicarAltas({ ...modelos, ahora: HOY });

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r).toMatchObject({ altas: 0 });
    expect(await TaricCode.countDocuments({ code: '3908100090' })).toBe(1);
  });
});

describe('altas que no se aplican', () => {
  test('una que aún no está en vigor se queda pendiente, con la fecha en el motivo', async () => {
    await publicar(PUB_1110, [alta('3924100040', { desde: '20261118', detalle: 'De poli(tereftalato de etileno) con contenido reciclado apto para el contacto con alimentos' })]);

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r.altas).toBe(0);
    expect(await TaricCode.countDocuments({ code: '3924100040' })).toBe(0);
    expect(await estadoDe(PUB_1110, '3924100040')).toMatchObject({ estado: 'pendiente', motivo: expect.stringContaining('18/11/2026') });
    // El dia que entra en vigor se da de alta.
    const r2 = await altas.aplicarAltas({ ...modelos, ahora: new Date('2026-11-18T05:00:00Z') });
    expect(r2.codigos).toEqual(['3924100040']);
    const doc = await TaricCode.findOne({ code: '3924100040' }).lean();
    expect(doc.duties.origen.evidencia).toContain('heredado de 3924000000');
    expect(doc.legalDescription).toBe('Plástico y sus manufacturas > Vajilla y demás artículos para el servicio de mesa o de cocina > De poli(tereftalato de etileno) con contenido reciclado apto para el contacto con alimentos');
  });

  test('una que ya está en el catálogo solo se marca', async () => {
    await TaricCode.create(existente('3908100090'));
    await publicar(PUB_1106, [alta('3908100090')]);

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r).toMatchObject({ altas: 0, yaEnCatalogo: 1 });
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ estado: 'en_catalogo' });
    expect((await TaricCode.findOne({ code: '3908100000' }).lean()).isLeaf).toBe(true);
  });

  test('sin descripción en español, o con el texto inglés en su lugar, no se da de alta', async () => {
    await publicar(PUB_1106, [
      alta('3908100010', { detalle: '', detalleEn: 'Polyamide-6 (PA 6)' }),
      alta('3908100020', { detalle: 'In the form of flakes', detalleEn: 'In the form of flakes' })
    ]);

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r.altas).toBe(0);
    expect(await TaricCode.countDocuments({ code: { $in: ['3908100010', '3908100020'] } })).toBe(0);
    expect(await estadoDe(PUB_1106, '3908100010')).toMatchObject({ estado: 'pendiente', motivo: expect.stringContaining('español') });
    expect(await estadoDe(PUB_1106, '3908100020')).toMatchObject({ estado: 'pendiente', motivo: expect.stringContaining('inglés') });
  });

  test('un código que no es de nivel 10 se deja a la sincronización mensual, que sabe si se declara', async () => {
    await publicar(PUB_1106, [alta('3907611000', { nivel: 8, detalle: 'En copos' })]);

    expect((await altas.aplicarAltas({ ...modelos, ahora: HOY })).altas).toBe(0);
    expect(await estadoDe(PUB_1106, '3907611000')).toMatchObject({ estado: 'pendiente', motivo: expect.stringContaining('nivel 8') });
  });

  test('una de vigencia limitada que ya terminó no se da de alta', async () => {
    await publicar(PUB_1110, [alta('3907610060', { desde: '20261018', hasta: '20261031' })]);

    expect((await altas.aplicarAltas({ ...modelos, ahora: HOY })).altas).toBe(0);
    expect(await estadoDe(PUB_1110, '3907610060')).toMatchObject({ estado: 'informativo' });
  });

  test('una registrada antes de guardar el nivel espera a que se vuelva a leer su publicación', async () => {
    await publicar(PUB_1106, [alta('3908100090', { nivel: undefined, detalleEn: undefined })]);

    expect((await altas.aplicarAltas({ ...modelos, ahora: HOY })).altas).toBe(0);
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ estado: 'pendiente' });
  });

  test('si el fichero de derechos no se puede descargar no se da de alta nada', async () => {
    await publicar(PUB_1106, [alta('3908100090')]);

    const r = await altas.aplicarAltas({ ...modelos, derechos: async () => { throw new Error('CIRCABC caido'); }, ahora: HOY });

    expect(r).toMatchObject({ altas: 0, retenido: expect.stringContaining('CIRCABC caido') });
    expect(await TaricCode.countDocuments({ code: '3908100090' })).toBe(0);
  });

  test('demasiadas altas de una vez se retienen para revisarlas', async () => {
    const muchas = Array.from({ length: MAXIMO_A_APLICAR + 1 }, (_, i) => `39081000${String(i + 10).padStart(2, '0')}`);
    await publicar(PUB_1106, muchas.map((c) => alta(c)));

    const r = await altas.aplicarAltas({ ...modelos, ahora: HOY });

    expect(r.altas).toBe(0);
    expect(r.retenido).toContain('revísalas');
    expect(await TaricCode.countDocuments({ code: { $in: muchas } })).toBe(0);
    expect((await TaricCode.findOne({ code: '3908100000' }).lean()).isLeaf).toBe(true);
    expect((await altas.aplicarAltas({ ...modelos, ahora: HOY, forzar: true })).altas).toBe(MAXIMO_A_APLICAR + 1);
  });
});

describe('simulación', () => {
  test('prepararAltas dice qué entraría sin escribir nada en el catálogo', async () => {
    await publicar(PUB_1106, [alta('3908100090')]);

    const plan = await altas.prepararAltas({ ...modelos, ahora: HOY });

    expect(plan.aplicar.map((a) => a.documento.code)).toEqual(['3908100090']);
    expect(plan.padres).toEqual(['3908100000']);
    expect(await TaricCode.countDocuments({ code: '3908100090' })).toBe(0);
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ estado: 'pendiente' });
  });
});

describe('releer publicaciones registradas antes de guardar el nivel', () => {
  test('vuelve a leer la publicación, conserva lo ya aplicado y completa las altas', async () => {
    await publicar(PUB_1106, [
      alta('3908100090', { nivel: undefined, detalleEn: undefined }),
      { clase: 'derecho', code: '3908100000', tipo: '103', origen: '1011', accion: 'cambio', desde: '20261106', hasta: '', detalle: '6.500 %', estado: 'aplicado', aplicadoEn: HOY }
    ]);
    const descargar = jest.fn(async () => ({ ficheros: true }));
    const leerCambios = jest.fn(async () => ({
      cambios: [
        alta('3908100090', { motivo: undefined }),
        { clase: 'derecho', code: '3908100000', tipo: '103', origen: '1011', accion: 'cambio', desde: '20261106', hasta: '', detalle: '6.500 %', estado: 'en_catalogo' }
      ],
      resumen: { codigos: 1, derechos: 1, controles: 0, otrasMedidas: 0, pendientes: 1 }
    }));

    const r = await altas.releerPublicacionesIncompletas({ TaricCode, TaricDailyPublication, descargar, leerCambios });

    expect(r.releidas).toEqual([PUB_1106]);
    expect(descargar).toHaveBeenCalledWith({ nombre: PUB_1106, fecha: '2026-11-06 19:17' });
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ nivel: 10, detalleEn: 'Other', estado: 'pendiente' });
    expect(await estadoDe(PUB_1106, '3908100000')).toMatchObject({ estado: 'aplicado' });
    // Ya no hay nada incompleto: una segunda pasada no descarga.
    expect((await altas.releerPublicacionesIncompletas({ TaricCode, TaricDailyPublication, descargar, leerCambios })).releidas).toEqual([]);
    expect(descargar).toHaveBeenCalledTimes(1);
  });

  test('si la descarga falla, la publicación se queda como estaba', async () => {
    await publicar(PUB_1106, [alta('3908100090', { nivel: undefined })]);

    const r = await altas.releerPublicacionesIncompletas({
      TaricCode, TaricDailyPublication, descargar: async () => { throw new Error('portal caído'); }, leerCambios: jest.fn()
    });

    expect(r).toEqual({ releidas: [], fallidas: [{ nombre: PUB_1106, error: 'portal caído' }] });
    expect(await estadoDe(PUB_1106, '3908100090')).toMatchObject({ estado: 'pendiente' });
  });
});
