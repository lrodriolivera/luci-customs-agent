/**
 * Guia de uso de LUCI para el asistente.
 *
 * El asistente respondia "no tengo informacion de la plataforma" a preguntas de
 * uso como "como paso un enlace al cliente para que suba la factura". La guia
 * describe lo que la aplicacion hace de verdad, para inyectarla en el contexto
 * del chat.
 */
const { GUIA_LUCI, seccionesGuia, categoriasAyuda } = require('../../../src/services/ayuda/guiaLuci');

describe('guia de LUCI', () => {
  test('se carga como texto no vacio y acotado (cabe en el contexto del chat)', () => {
    expect(typeof GUIA_LUCI).toBe('string');
    expect(GUIA_LUCI.length).toBeGreaterThan(2000);
    // Se envia en cada pregunta: por encima de ~40 000 caracteres encarece
    // cada consulta sin necesidad.
    expect(GUIA_LUCI.length).toBeLessThan(40000);
  });

  test('cada seccion tiene id, titulo, resumen y texto', () => {
    const secciones = seccionesGuia();
    expect(secciones.length).toBeGreaterThanOrEqual(10);
    secciones.forEach(s => {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.titulo.length).toBeGreaterThan(0);
      expect(s.resumen.length).toBeGreaterThan(0);
      expect(s.texto.length).toBeGreaterThan(s.resumen.length);
    });
    const ids = secciones.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('cubre los temas que piden las agentes', () => {
    const titulos = seccionesGuia().map(s => s.titulo).join(' | ');
    [
      /Crear un expediente/,
      /Documentos/,
      /Portal del cliente/,
      /TARIC/,
      /paraduaneros/i,
      /Datos para presentar el H1/,
      /presentar el H1/,
      /Sumaria/,
      /Divisas/,
      /Ajustes/,
      /H7/,
      /AES|Exportación/,
      /Analítica/
    ].forEach(re => expect(titulos).toMatch(re));
  });

  test('la seccion del portal del cliente explica como obtener y compartir el enlace', () => {
    const portal = seccionesGuia().find(s => s.id === 'portal-cliente');
    expect(portal).toBeDefined();
    expect(portal.texto).toMatch(/\/portal\//);
    expect(portal.texto).toMatch(/enlace/i);
    expect(portal.texto).toMatch(/factura/i);
  });

  test('categoriasAyuda devuelve { id: { name, description } } a partir de las secciones', () => {
    const cats = categoriasAyuda();
    const secciones = seccionesGuia();
    expect(Object.keys(cats)).toEqual(secciones.map(s => s.id));
    expect(cats['portal-cliente'].name).toBe(secciones.find(s => s.id === 'portal-cliente').titulo);
  });
});
