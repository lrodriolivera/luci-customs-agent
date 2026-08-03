/**
 * Guardia permanente del aislamiento por propiedad.
 *
 * Durante el barrido de Agosto/2026 aparecieron cinco veces accesos por id sin
 * comprobar de quien era el documento, y cada vez se descubrieron por
 * casualidad al trabajar en otra cosa, no revisando mejor:
 *
 *   1. Buscar solo findById            -> se escapo updateUser con
 *                                         findByIdAndUpdate (escalada de
 *                                         privilegios entre tenants)
 *   2. Recorrer solo src/controllers   -> 68 casos en services
 *   3. Exigir userId en la firma       -> transitService (recibe el id de otro
 *                                         modo) y channelService (recibe user,
 *                                         no userId)
 *   4. Mirar solo accesos por id       -> oeaService.list devolvia TODAS las
 *                                         certificaciones del sistema
 *   5. Recorrer solo controllers y     -> 9 rutas con logica inline permitian
 *      services                           descargar el PDF de la declaracion
 *                                         de otro cliente y leer su chat
 *
 * Este test recorre controllers y services buscando el patron, para que el
 * sexto no dependa de que alguien tropiece con el. Su equivalente para rutas
 * esta en tests/routes/inlineRouteGuards.test.js.
 *
 * SI ESTE TEST FALLA: no lo silencies anadiendo tu caso a EXENCIONES sin mas.
 * Comprueba primero si el acceso es realmente alcanzable desde una ruta con un
 * id que venga del cliente. Si lo es, es un agujero: ponle el guard.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../src');

/** Metodos que resuelven un documento por su id. */
const ACCESO_POR_ID = /\.(findById|findByIdAndUpdate|findByIdAndDelete|findByIdAndRemove)\(/;

/** El id procede del cliente (params, body, o una variable id/xxxId). */
const ID_DEL_CLIENTE = /\((req\.params|req\.body|body\.|data\.|\bid\b|\w+Id\b)/;

/** Señales de que la propiedad se comprueba en esa funcion. */
const COMPRUEBA_PROPIEDAD =
  /ensureSameTenant|_loadOwned|createdBy|owner|tenantId|organizationId|req\.user\._id/;

/**
 * Accesos permitidos, con el motivo por el que no necesitan guard.
 * Formato: 'fichero:funcion'. Revisados uno a uno el 3/Ago/2026.
 */
const EXENCIONES = {
  // El id sale de un documento que ya paso su propio guard.
  'services/specialRegimeService.js:addGoods':
    'la garantia viene de regime.guarantee.guaranteeId y el regime ya paso _loadOwnedRegime',
  'services/specialRegimeService.js:partialExit':
    'la garantia viene de regime.guarantee.guaranteeId y el regime ya paso _loadOwnedRegime',

  // Llamadas internas: el llamador valida antes.
  'services/channelService.js:processChannelAssignment':
    'declarationController y channelController hacen ensureSameTenant antes de llamar',
  'services/paraduaneroService.js:createControlsForExpedition':
    'paraduaneroController hace ensureSameTenant antes de llamar',
  'services/channelService.js:reevaluateYellowChannel':
    'channelController hace ensureSameTenant sobre el expediente antes de llamar',

  // No alcanzables con un id del cliente.
  'services/paymentService.js:updateExpeditionAfterPayment':
    'recorre los expeditionIds de un pago ya validado; ninguna ruta la expone',
  'services/pueService.js:validateRequest':
    'helper interno, ninguna ruta la expone directamente',
  'services/workflow/workflowService.js:executeWorkflow':
    'el workflow ya se cargo acotado por organizationId en el llamador',
  'services/oeaService.js:calculateGuaranteeReduction':
    'solo lee el porcentaje de reduccion de la certificacion, no expone sus datos',
  'services/oeaService.js:getById':
    'lectura cruda usada por otros services que si comprueban; el controller filtra'
};

/** Recorre un fichero y devuelve los accesos sin comprobacion de propiedad. */
function analizar(rutaFichero, etiqueta) {
  const lineas = fs.readFileSync(rutaFichero, 'utf8').split('\n');
  const hallazgos = [];
  let inicioFuncion = 0;
  let nombreFuncion = '(top-level)';

  lineas.forEach((linea, i) => {
    const decl = linea.match(/^(?:exports\.(\w+)|const (\w+) =|\s*async (\w+)\s*\()/);
    if (decl) {
      inicioFuncion = i;
      nombreFuncion = decl[1] || decl[2] || decl[3];
    }

    if (!ACCESO_POR_ID.test(linea) || !ID_DEL_CLIENTE.test(linea)) return;

    // Ventana: desde el inicio de la funcion (el guard suele ir antes) hasta
    // unas lineas despues.
    const ventana = lineas.slice(inicioFuncion, i + 12).join('\n');
    if (COMPRUEBA_PROPIEDAD.test(ventana)) return;

    const clave = `${etiqueta}:${nombreFuncion}`;
    if (EXENCIONES[clave]) return;

    hallazgos.push(`${clave} (L${i + 1}): ${linea.trim().slice(0, 60)}`);
  });

  return hallazgos;
}

/** Todos los .js de un directorio, recursivo. */
function ficheros(dir, prefijo) {
  const salida = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficheros(p, `${prefijo}/${entrada.name}`));
    else if (entrada.name.endsWith('.js')) salida.push([p, `${prefijo}/${entrada.name}`]);
  }
  return salida;
}

describe('aislamiento por propiedad: guardia permanente', () => {
  test('ningun controller resuelve por id sin comprobar la propiedad', () => {
    const hallazgos = ficheros(path.join(SRC, 'controllers'), 'controllers')
      .flatMap(([p, etiqueta]) => analizar(p, etiqueta));

    expect(hallazgos).toEqual([]);
  });

  test('ningun service resuelve por id sin comprobar la propiedad', () => {
    const hallazgos = ficheros(path.join(SRC, 'services'), 'services')
      .flatMap(([p, etiqueta]) => analizar(p, etiqueta));

    expect(hallazgos).toEqual([]);
  });

  test('las exenciones siguen apuntando a codigo que existe', () => {
    // Una exencion huerfana enmascara el caso nuevo que ocupe su sitio cuando
    // se renombra o se borra una funcion.
    const huerfanas = [];

    for (const clave of Object.keys(EXENCIONES)) {
      const [rel, funcion] = clave.split(':');
      const ruta = path.join(SRC, rel);

      if (!fs.existsSync(ruta)) {
        huerfanas.push(`${clave} -> el fichero ya no existe`);
        continue;
      }
      if (!fs.readFileSync(ruta, 'utf8').includes(funcion)) {
        huerfanas.push(`${clave} -> la funcion ya no existe`);
      }
    }

    expect(huerfanas).toEqual([]);
  });

  test('cada exencion explica por que no necesita guard', () => {
    // Sin motivo escrito, la lista se convierte en un cajon donde silenciar
    // hallazgos incomodos.
    const sinMotivo = Object.entries(EXENCIONES)
      .filter(([, motivo]) => !motivo || motivo.trim().length < 20)
      .map(([clave]) => clave);

    expect(sinMotivo).toEqual([]);
  });
});
