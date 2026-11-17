const { rutaDe, descripcionCompleta } = require('../../../src/services/taric/descripcionCompleta');

// Rutas reales del catalogo (legalDescription) del 17/11/2026.
const CEREZAS = 'FRUTAS Y FRUTOS COMESTIBLES; CORTEZAS DE AGRIOS (CÍTRICOS), MELONES O SANDÍAS > Albaricoques (damascos, chabacanos), cerezas, melocotones (duraznos) (incluidos los griñones y nectarinas), ciruelas y endrinas, frescos > Cerezas > Las demás';
const MELOCOTONES = 'FRUTAS Y FRUTOS COMESTIBLES; CORTEZAS DE AGRIOS (CÍTRICOS), MELONES O SANDÍAS > Albaricoques…, frescos > Melocotones (duraznos), incluidos los griñones y nectarinas > Las demás > Las demás';
const JUGUETES = 'JUGUETES, JUEGOS Y ARTÍCULOS PARA RECREO O DEPORTE; SUS PARTES Y ACCESORIOS > Triciclos…; rompecabezas de cualquier clase > Los demás > Los demás > De plástico > Los demás';

describe('descripcionCompleta (Jenifer, UAT 17/11/2026)', () => {
  test('«Las demás» se completa con el nivel que nombra la mercancía', () => {
    expect(descripcionCompleta(CEREZAS)).toBe('Cerezas › Las demás');
    expect(descripcionCompleta(MELOCOTONES)).toBe('Melocotones (duraznos), incluidos los griñones y nectarinas › Las demás › Las demás');
    expect(descripcionCompleta(JUGUETES)).toBe('De plástico › Los demás');
  });

  test('un último nivel que ya nombra la mercancía se queda solo', () => {
    expect(descripcionCompleta('CAP > Partida > Guindas (cerezas ácidas) (Prunus cerasus)')).toBe('Guindas (cerezas ácidas) (Prunus cerasus)');
  });

  test('sin ruta, la descripción del código', () => {
    expect(descripcionCompleta('', 'Las demás')).toBe('Las demás');
  });

  test('la ruta lleva los niveles sin el capítulo', () => {
    expect(rutaDe(CEREZAS)).toEqual(['Albaricoques (damascos, chabacanos), cerezas, melocotones (duraznos) (incluidos los griñones y nectarinas), ciruelas y endrinas, frescos', 'Cerezas', 'Las demás']);
  });
});
