/**
 * Guion de medicion de la clasificacion TARIC: logica de acierto, resumen y
 * recorrido del juego con una clasificacion simulada (sin IA ni base de datos).
 */
const path = require('path');
const {
  leerArgumentos, resolverRaizApp, evaluar, resumir, medirJuego, soloLectura
} = require('../../src/scripts/medirClasificacion');
const juego = require('../fixtures/clasificacion/juego-productos.json');

const proveedor = { id: 'P01', grupo: 'proveedor_sin_validar', descripcion: 'Portatil', esperado4: '8471', esperado6: '847130', esperado10: null };
const borde4 = { id: 'P50', grupo: 'caso_borde', descripcion: 'Controlador MIDI', esperado4: '8471', alternativas4: ['8543'], esperado6: null, esperado10: null };
const validado = { id: 'P02', grupo: 'proveedor_sin_validar', descripcion: 'Cable', esperado4: '8544', esperado6: '854442', esperado10: '8544429010' };

describe('juego-productos.json', () => {
  it('tiene entre 40 y 60 productos, todos con fuente y sin codigos de 10 digitos inventados', () => {
    expect(juego.productos.length).toBeGreaterThanOrEqual(40);
    expect(juego.productos.length).toBeLessThanOrEqual(60);
    for (const p of juego.productos) {
      expect(p.fuente).toBeTruthy();
      expect(p.validado).toBe(false);
      expect(p.esperado10).toBeNull();
      expect(p.esperado4).toMatch(/^\d{4}$/);
      if (p.esperado6) expect(p.esperado6.startsWith(p.esperado4)).toBe(true);
    }
  });

  it('no repite descripcion y separa proveedor sin validar de casos de borde', () => {
    const descripciones = juego.productos.map((p) => p.descripcion);
    expect(new Set(descripciones).size).toBe(descripciones.length);
    const grupos = new Set(juego.productos.map((p) => p.grupo));
    expect([...grupos].sort()).toEqual(['caso_borde', 'proveedor_sin_validar']);
  });
});

describe('leerArgumentos', () => {
  it('lee --salida, --juego, --app, --limite e --ids', () => {
    const a = leerArgumentos(['--salida=/tmp/antes.json', '--juego=/tmp/j.json', '--app=/app', '--limite=5', '--ids=P01,P02']);
    expect(a).toEqual({ salida: '/tmp/antes.json', juego: '/tmp/j.json', app: '/app', limite: 5, ids: ['P01', 'P02'] });
  });

  it('sin argumentos deja todo sin definir', () => {
    expect(leerArgumentos([])).toEqual({ salida: undefined, juego: undefined, app: undefined, limite: undefined, ids: undefined });
  });
});

describe('resolverRaizApp', () => {
  it('usa --app si se da', () => {
    expect(resolverRaizApp({ app: '/otra' }, '/tmp', () => true)).toBe('/otra');
  });

  it('dentro del repo usa el backend del propio guion', () => {
    const dir = path.join('/repo', 'backend', 'src', 'scripts');
    const existe = (f) => f === path.join('/repo', 'backend', 'src', 'services', 'aiService.js');
    expect(resolverRaizApp({}, dir, existe)).toBe(path.join('/repo', 'backend'));
  });

  it('copiado a /tmp cae en /app (el contenedor)', () => {
    expect(resolverRaizApp({}, '/tmp', () => false)).toBe('/app');
  });
});

describe('evaluar', () => {
  it('acierta a 4 y 6 digitos y no mide 8/10 sin esperado10', () => {
    expect(evaluar(proveedor, '8471300000')).toEqual({ 4: true, 6: true, 8: null, 10: null });
  });

  it('falla a 6 pero acierta a 4', () => {
    expect(evaluar(proveedor, '8471410000')).toEqual({ 4: true, 6: false, 8: null, 10: null });
  });

  it('en un caso de borde de 4 digitos admite la alternativa citada', () => {
    expect(evaluar(borde4, '8543700000')).toEqual({ 4: true, 6: null, 8: null, 10: null });
    expect(evaluar(borde4, '9207100000')).toEqual({ 4: false, 6: null, 8: null, 10: null });
  });

  it('con esperado10 mide tambien 8 y 10 digitos', () => {
    expect(evaluar(validado, '8544429090')).toEqual({ 4: true, 6: true, 8: true, 10: false });
    expect(evaluar(validado, '8544 42 90 10')).toEqual({ 4: true, 6: true, 8: true, 10: true });
  });

  it('sin propuesta cuenta como fallo en los niveles medibles', () => {
    expect(evaluar(proveedor, null)).toEqual({ 4: false, 6: false, 8: null, 10: null });
  });
});

describe('medirJuego y resumir', () => {
  const reloj = (() => { let t = 0; return () => { t += 100; return t; }; })();

  it('recorre el juego, guarda esperado, propuesto, candidatos y tiempo, y resume por grupo', async () => {
    const clasificar = jest.fn(async ({ description }) => {
      if (description === 'Controlador MIDI') throw new Error('Error en servicio de IA');
      return {
        sugerencias: [{ code: '8471300000', confidence: 90, verified: true }, { code: '8471410000', confidence: 40, verified: true }],
        candidatos: ['8471300000', '8471410000']
      };
    });

    const resultados = await medirJuego({ productos: [proveedor, borde4], clasificar, reloj });

    expect(clasificar).toHaveBeenCalledWith({ description: 'Portatil', additionalInfo: {}, expeditionContext: null });
    expect(resultados[0]).toMatchObject({
      id: 'P01', grupo: 'proveedor_sin_validar', propuesto: '8471300000', verificado: true,
      esperado: { 4: '8471', 6: '847130', 10: null },
      candidatos: ['8471300000', '8471410000'],
      esperadoEnCandidatos: { 4: true, 6: true, 10: null },
      aciertos: { 4: true, 6: true, 8: null, 10: null },
      ms: 100
    });
    expect(resultados[0].sugerencias).toHaveLength(2);
    expect(resultados[1]).toMatchObject({ id: 'P50', propuesto: null, error: 'Error en servicio de IA' });

    const r = resumir(resultados);
    expect(r.total).toBe(2);
    expect(r.errores).toBe(1);
    expect(r.porGrupo.proveedor_sin_validar.aciertos['6']).toEqual({ medibles: 1, aciertos: 1, porcentaje: 100 });
    expect(r.porGrupo.caso_borde.aciertos['4']).toEqual({ medibles: 1, aciertos: 0, porcentaje: 0 });
    expect(r.porGrupo.caso_borde.aciertos['6']).toEqual({ medibles: 0, aciertos: 0, porcentaje: null });
    expect(r.global.aciertos['4']).toEqual({ medibles: 2, aciertos: 1, porcentaje: 50 });
    // Con error no se sabe que candidatos hubo: no cuenta para la busqueda.
    expect(r.global.esperadoEnCandidatos['4']).toEqual({ medibles: 1, aciertos: 1, porcentaje: 100 });
  });

  it('respeta --ids y --limite', async () => {
    const clasificar = jest.fn(async () => ({ sugerencias: [], candidatos: [] }));
    await medirJuego({ productos: [proveedor, borde4, validado], clasificar, ids: ['P02', 'P50'], limite: 1, reloj });
    expect(clasificar).toHaveBeenCalledTimes(1);
    expect(clasificar.mock.calls[0][0].description).toBe('Controlador MIDI');
  });
});

describe('soloLectura', () => {
  it('registra ganchos que impiden escribir en la base de datos', () => {
    const ganchos = [];
    const esquema = { pre: (op, fn) => ganchos.push([op, fn]) };
    soloLectura(esquema);
    const operaciones = ganchos.map(([op]) => op).flat();
    expect(operaciones).toEqual(expect.arrayContaining(['save', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'insertMany']));
    expect(() => ganchos[0][1]()).toThrow(/solo lectura/);
  });
});
