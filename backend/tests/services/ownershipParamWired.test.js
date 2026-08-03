/**
 * Las funciones que comprueban propiedad RECIBEN el userId que comprueban.
 *
 * REGRESION INTRODUCIDA POR EL PROPIO BARRIDO DE PROPIEDAD (d63a068). Aquel
 * commit inserto llamadas a los helpers _loadOwned*(id, userId) en decenas de
 * funciones, pero en ocho de ellas NO anadio userId a la firma:
 *
 *     async delete(id) {                        // <- sin userId
 *       const deadline = await _loadOwnedDeadline(id, userId);
 *
 * userId no existe en ese ambito, asi que la funcion lanza
 * `ReferenceError: userId is not defined` NADA MAS ENTRAR. Ocho funciones
 * quedaron inutilizadas. Verificado contra produccion:
 *
 *     DELETE /api/deadlines/6a576988706474063cfb5c35
 *       -> {"success":false,"error":"userId is not defined"}
 *
 * Falla cerrado -- no hay fuga, y de hecho nada se borra -- pero son ocho
 * funciones rotas, y el mensaje del ReferenceError se filtraba al cliente
 * porque no encaja ningun patron de sanitizeErrors.
 *
 * La leccion, que es la que fija este test: una comprobacion de propiedad
 * insertada mecanicamente puede referirse a una variable que no existe. Los
 * tests de propiedad de entonces mockeaban el helper, de modo que nunca
 * ejecutaron la linea real.
 */

const fs = require('fs');
const path = require('path');

const SERVICES_DIR = path.join(__dirname, '../../src/services');

/**
 * Funciones que invocan un helper de propiedad con `userId` sin tenerlo
 * en su propia firma. Devuelve descripciones legibles.
 */
function llamadasSinParametro(contenido) {
  const lineas = contenido.split('\n');
  const rotas = [];

  lineas.forEach((linea, i) => {
    if (!/_loadOwned\w*\([^)]*\buserId\b/.test(linea)) return;

    // Firma de la funcion contenedora: la ultima declaracion antes de esta linea.
    let firma = null;
    for (let k = i; k >= 0 && k > i - 60; k--) {
      const m = lineas[k].match(/^\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/);
      if (m && !/\b(if|for|while|switch|catch)\b/.test(m[1])) { firma = m; break; }
    }
    if (!firma) return;

    const [, nombre, parametros] = firma;
    if (!/\buserId\b/.test(parametros)) {
      rotas.push(`${nombre}(${parametros.trim()}) usa userId en L${i + 1} sin recibirlo`);
    }
  });

  return rotas;
}

const FICHEROS = fs.readdirSync(SERVICES_DIR).filter(f => f.endsWith('.js'));

describe('los helpers de propiedad reciben el userId que comprueban', () => {
  test.each(FICHEROS)('%s no usa userId fuera de su ambito', (fichero) => {
    const contenido = fs.readFileSync(path.join(SERVICES_DIR, fichero), 'utf8');

    expect(llamadasSinParametro(contenido)).toEqual([]);
  });
});

describe('las ocho funciones afectadas se invocan sin lanzar ReferenceError', () => {
  // Comprobacion de comportamiento, no de texto: el test de arriba mira el
  // codigo fuente, este ejecuta. Un ReferenceError salta al entrar en la
  // funcion, antes de tocar Mongo, asi que no hace falta base de datos.
  const CASOS = [
    ['deadlineService', 'delete', ['6a5769e0b11d798e7e783602', 'u1']],
    ['inspectorCommunicationService', 'addArgument', ['6a5769e0b11d798e7e783602', {}, 'u1']],
    ['inspectionService', 'addParticipant', ['6a5769e0b11d798e7e783602', {}, 'u1']],
    ['inspectionService', 'addEvidence', ['6a5769e0b11d798e7e783602', {}, 'u1']],
    ['inspectionService', 'addInspectedItem', ['6a5769e0b11d798e7e783602', {}, 'u1']],
    ['inspectionService', 'addSample', ['6a5769e0b11d798e7e783602', {}, 'u1']],
    ['inspectionService', 'updateSampleResult', ['6a5769e0b11d798e7e783602', 's1', {}, 'u1']],
    ['inspectionService', 'addResultingAction', ['6a5769e0b11d798e7e783602', {}, 'u1']]
  ];

  test.each(CASOS)('%s.%s', async (modulo, funcion, args) => {
    const servicio = require(path.join(SERVICES_DIR, modulo));

    // Puede fallar por falta de conexion a Mongo: eso es esperable aqui.
    // Lo que no puede es fallar por una variable que no existe.
    await expect(servicio[funcion](...args)).rejects.not.toBeInstanceOf(ReferenceError);
  });
});
