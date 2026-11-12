/**
 * Regimenes de sanciones de la UE a los que pertenece una medida del TARIC,
 * reconocidos por su base legal. Solo figuran los reglamentos identificados
 * con certeza; una medida de otra base legal no se marca como sancion.
 */
const REGIMENES = {
  'Regulation 0833/14': { pais: 'Rusia', norma: 'Reglamento (UE) n.º 833/2014' },
  'Regulation 0765/06': { pais: 'Bielorrusia', norma: 'Reglamento (CE) n.º 765/2006' },
  'Regulation 1509/17': { pais: 'Corea del Norte', norma: 'Reglamento (UE) 2017/1509' },
  'Regulation 0267/12': { pais: 'Irán', norma: 'Reglamento (UE) n.º 267/2012' },
  'Regulation 0036/12': { pais: 'Siria', norma: 'Reglamento (UE) n.º 36/2012' },
  'Regulation 0044/16': { pais: 'Libia', norma: 'Reglamento (UE) 2016/44' },
  'Regulation 1210/03': { pais: 'Irak', norma: 'Reglamento (CE) n.º 1210/2003' },
  'Regulation 0692/14': { pais: 'Crimea y Sebastopol', norma: 'Reglamento (UE) n.º 692/2014' },
  'Regulation 0263/22': { pais: 'Zonas de Ucrania no controladas por su Gobierno', norma: 'Reglamento (UE) 2022/263' }
};

/** Regimen de sanciones de una base legal del TARIC («Regulation 0833/14»), o null. */
function regimenDeSanciones(baseLegal) {
  const clave = String(baseLegal || '').replace(/\s+/g, ' ').trim();
  return REGIMENES[clave] ? { ...REGIMENES[clave] } : null;
}

module.exports = { regimenDeSanciones, REGIMENES };
