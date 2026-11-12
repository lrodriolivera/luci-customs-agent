/**
 * Publicaciones diarias del TARIC contra un Mongo real (en memoria): registro
 * sin tocar el catálogo, y aplicación limitada a los cambios de derecho en
 * vigor sobre códigos declarables.
 */
const { usarBaseDeDatosEnMemoria } = require('../../../helpers/memoryDb');
const TaricCode = require('../../../../src/models/TaricCode');
const TaricDailyPublication = require('../../../../src/models/TaricDailyPublication');
const diario = require('../../../../src/services/taric/diario/sincronizacionDiaria');

usarBaseDeDatosEnMemoria();

const modelos = { TaricCode, TaricDailyPublication };
const HOY = new Date('2026-11-12T10:00:00Z');
const codigo = (code, extra = {}) => ({
  code, breakdown: { chapter: code.slice(0, 2), heading: code.slice(0, 4), subheading: code.slice(0, 6) }, description: { es: 'Los demás', en: 'Other' },
  level: 10, isLeaf: true, isActive: true, duties: { thirdCountry: 6.5 }, ...extra
});
const cambio = (clase, code, extra = {}) => ({ clase, code, tipo: clase === 'derecho' ? '103' : undefined, origen: '1011', accion: 'cambio', desde: '20261101', hasta: '', detalle: '', ...extra });

describe('clasificación de un cambio diario frente al catálogo', () => {
  const { clasificar } = diario;

  test('un derecho igual al del catálogo ya está; uno distinto queda pendiente', () => {
    const doc = codigo('8507600090');
    expect(clasificar(cambio('derecho', '8507600090', { detalle: '6.500 %' }), doc).estado).toBe('en_catalogo');
    expect(clasificar(cambio('derecho', '8507600090', { detalle: '2.700 %' }), doc).estado).toBe('pendiente');
  });

  test('un derecho que LUCI no sabe liquidar, o fijado en un nivel superior, no se aplica desde aquí', () => {
    expect(clasificar(cambio('derecho', '8507600090', { detalle: 'EA MAX 24.200 % + ADSZ' }), codigo('8507600090')).estado).toBe('no_calculable');
    expect(clasificar(cambio('derecho', '8507600000', { detalle: '2.700 %' }), codigo('8507600000', { isLeaf: false })).estado).toBe('informativo');
    expect(clasificar(cambio('derecho', '9999999999', { detalle: '2.700 %' }), undefined).estado).toBe('informativo');
    expect(clasificar(cambio('derecho', '8507600090', { accion: 'baja', detalle: '2.700 %' }), codigo('8507600090')).estado).toBe('informativo');
  });

  test('altas, bajas y descripciones de códigos quedan pendientes hasta la sincronización mensual', () => {
    expect(clasificar(cambio('codigo', '3924100040', { accion: 'alta' }), undefined)).toMatchObject({ estado: 'pendiente' });
    expect(clasificar(cambio('codigo', '3924100040', { accion: 'alta' }), codigo('3924100040')).estado).toBe('en_catalogo');
    expect(clasificar(cambio('codigo', '3924100090', { accion: 'baja' }), codigo('3924100090')).estado).toBe('pendiente');
    expect(clasificar(cambio('codigo', '3924100090', { accion: 'baja' }), codigo('3924100090', { isActive: false })).estado).toBe('en_catalogo');
    expect(clasificar(cambio('codigo', '8507600090', { detalle: 'LOS DEMÁS' }), codigo('8507600090')).estado).toBe('en_catalogo');
    expect(clasificar(cambio('codigo', '8507600090', { detalle: 'Los demás acumuladores' }), codigo('8507600090')).estado).toBe('pendiente');
  });

  test('las medidas de control son informativas', () => {
    expect(clasificar(cambio('control', '8471300000', { tipo: '762' }), codigo('8471300000')).estado).toBe('informativo');
  });
});

describe('aplicar los cambios de derecho pendientes', () => {
  const publicar = (nombre, cambios) => TaricDailyPublication.create({ nombre, fecha: '2026-11-10 19:14', procesadoEn: HOY, resumen: {}, cambios });

  test('actualiza el derecho de un código declarable cuando el cambio ya está en vigor, y deja constancia', async () => {
    await TaricCode.create(codigo('8507600090'));
    await publicar('TARIC_20261110_1914', [cambio('derecho', '8507600090', { detalle: '2.700 %', estado: 'pendiente' })]);

    const r = await diario.aplicarPendientes({ ...modelos, ahora: HOY });

    expect(r).toMatchObject({ aplicados: 1, codigos: ['8507600090'] });
    const doc = await TaricCode.findOne({ code: '8507600090' }).lean();
    expect(doc.duties.thirdCountry).toBe(2.7);
    expect(doc.duties.origen).toMatchObject({ fuente: 'taric_oficial' });
    expect(doc.duties.origen.evidencia).toContain('2.700 %');
    expect(doc.duties.origen.evidencia).toContain('Antes: 6.5 %');
    expect(doc.duties.origen.evidencia).toContain('TARIC_20261110_1914');
    const [publicacion] = await TaricDailyPublication.find().lean();
    expect(publicacion.cambios[0].estado).toBe('aplicado');
    // Repetir no cambia nada.
    expect(await diario.aplicarPendientes({ ...modelos, ahora: HOY })).toEqual({ aplicados: 0, yaEnCatalogo: 0 });
  });

  test('un cambio que aún no ha entrado en vigor no se aplica', async () => {
    await TaricCode.create(codigo('8507600090'));
    await publicar('TARIC_20261110_1914', [cambio('derecho', '8507600090', { detalle: '2.700 %', desde: '20261201', estado: 'pendiente' })]);

    expect(await diario.aplicarPendientes({ ...modelos, ahora: HOY })).toEqual({ aplicados: 0, yaEnCatalogo: 0 });
    expect((await TaricCode.findOne({ code: '8507600090' }).lean()).duties.thirdCountry).toBe(6.5);
  });

  test('si el catálogo ya lo recoge (lo trajo la carga mensual) solo se marca', async () => {
    await TaricCode.create(codigo('8507600090', { duties: { thirdCountry: 2.7 } }));
    await publicar('TARIC_20261110_1914', [cambio('derecho', '8507600090', { detalle: '2.700 %', estado: 'pendiente' })]);

    expect(await diario.aplicarPendientes({ ...modelos, ahora: HOY })).toEqual({ aplicados: 0, yaEnCatalogo: 1 });
    expect((await TaricDailyPublication.findOne().lean()).cambios[0].estado).toBe('en_catalogo');
  });

  test('si un código cambia en dos publicaciones manda la más reciente', async () => {
    await TaricCode.create(codigo('8507600090'));
    await publicar('TARIC_20261109_1914', [cambio('derecho', '8507600090', { detalle: '4.000 %', estado: 'pendiente' })]);
    await publicar('TARIC_20261110_1914', [cambio('derecho', '8507600090', { detalle: '2.700 %', estado: 'pendiente' })]);

    await diario.aplicarPendientes({ ...modelos, ahora: HOY });

    expect((await TaricCode.findOne({ code: '8507600090' }).lean()).duties.thirdCountry).toBe(2.7);
    expect(await TaricDailyPublication.countDocuments({ 'cambios.estado': 'pendiente' })).toBe(0);
  });

  test('demasiados cambios de una vez se retienen para revisarlos', async () => {
    const muchos = Array.from({ length: diario.MAXIMO_A_APLICAR + 1 }, (_, i) => `85076${String(i).padStart(5, '0')}`);
    await TaricCode.insertMany(muchos.map((c) => codigo(c)));
    await publicar('TARIC_20261110_1914', muchos.map((c) => cambio('derecho', c, { detalle: '2.700 %', estado: 'pendiente' })));

    const r = await diario.aplicarPendientes({ ...modelos, ahora: HOY });

    expect(r.aplicados).toBe(0);
    expect(r.retenido).toContain('revísalos');
    expect(await TaricCode.countDocuments({ 'duties.thirdCountry': 2.7 })).toBe(0);
    expect((await diario.aplicarPendientes({ ...modelos, ahora: HOY, forzar: true })).aplicados).toBe(diario.MAXIMO_A_APLICAR + 1);
  });
});

describe('registro y estado', () => {
  test('registra solo las publicaciones que no había visto, de la más antigua a la más nueva, sin tocar el catálogo', async () => {
    await TaricCode.create(codigo('8507600090'));
    await TaricDailyPublication.create({ nombre: 'TARIC_20261106_1917', procesadoEn: HOY, resumen: {}, cambios: [] });
    const listar = jest.fn(async () => ['TARIC_20261110_1914', 'TARIC_20261109_1914', 'TARIC_20261106_1917'].map((nombre) => ({ nombre, fecha: '2026-11-10 19:14' })));
    const descargar = jest.fn(async (p) => ({ nombre: p.nombre }));
    const leerCambios = jest.fn(async (ficheros) => ({
      cambios: [cambio('derecho', '8507600090', { detalle: '2.700 %', estado: 'pendiente' })],
      resumen: { codigos: 0, derechos: 1, controles: 0, otrasMedidas: 4000, pendientes: 1, de: ficheros.nombre }
    }));

    const r = await diario.registrarPublicacionesNuevas({ ...modelos, listar, descargar, leerCambios, ahora: HOY });

    expect(r.nuevas.map((n) => n.nombre)).toEqual(['TARIC_20261109_1914', 'TARIC_20261110_1914']);
    expect(await TaricDailyPublication.countDocuments()).toBe(3);
    expect((await TaricCode.findOne({ code: '8507600090' }).lean()).duties.thirdCountry).toBe(6.5);
    // Una segunda pasada no vuelve a descargar nada.
    expect((await diario.registrarPublicacionesNuevas({ ...modelos, listar, descargar, leerCambios, ahora: HOY })).nuevas).toEqual([]);
    expect(descargar).toHaveBeenCalledTimes(2);
  });

  test('en una pasada no lee más publicaciones que el máximo, empezando por las más recientes', async () => {
    const nombres = Array.from({ length: 5 }, (_, i) => `TARIC_2026110${i + 1}_1914`).reverse();
    const r = await diario.registrarPublicacionesNuevas({
      ...modelos, listar: async () => nombres.map((nombre) => ({ nombre, fecha: 'x' })), descargar: async () => ({}),
      leerCambios: async () => ({ cambios: [], resumen: {} }), ahora: HOY, maximo: 2
    });

    expect(r.nuevas.map((n) => n.nombre)).toEqual(['TARIC_20261104_1914', 'TARIC_20261105_1914']);
  });

  test('el estado dice cuál fue la última publicación leída y qué sigue pendiente', async () => {
    await TaricDailyPublication.create({ nombre: 'TARIC_20261109_1914', procesadoEn: HOY, resumen: { pendientes: 0 }, cambios: [cambio('control', '8471300000', { estado: 'informativo' })] });
    await TaricDailyPublication.create({ nombre: 'TARIC_20261110_1914', procesadoEn: HOY, resumen: { pendientes: 1 }, cambios: [cambio('codigo', '3924100040', { accion: 'alta', estado: 'pendiente', motivo: 'Código nuevo' })] });

    const estado = await diario.estadoDiario({ TaricDailyPublication });

    expect(estado.ultima.nombre).toBe('TARIC_20261110_1914');
    expect(estado.totalPendientes).toBe(1);
    expect(estado.pendientes[0]).toMatchObject({ publicacion: 'TARIC_20261110_1914', clase: 'codigo', code: '3924100040' });
  });

  test('sin publicaciones leídas el estado está vacío', async () => {
    expect(await diario.estadoDiario({ TaricDailyPublication })).toEqual({ ultima: null, totalPendientes: 0, pendientes: [] });
  });
});
