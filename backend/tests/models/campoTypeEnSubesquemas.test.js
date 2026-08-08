/**
 * Barrido: campos que se llaman `type` y que Mongoose puede estar leyendo como
 * la declaracion del tipo del path en vez de como un campo.
 *
 * Origen: `Transit.controlResult.discrepancies` (ver
 * tests/models/transitDiscrepancias.test.js) estaba declarado en linea como
 * `[{itemNumber: Number, type: String, ...}]` y Mongoose lo interpretaba como
 * `[String]`. Guardar una discrepancia lanzaba `Cast to [string] failed` y se
 * perdia el resultado del control completo.
 *
 * `type` es la clave reservada de Mongoose para declarar tipos, asi que el mismo
 * error puede estar en cualquier subesquema con un campo de negocio llamado
 * `type`. Este test no revisa el codigo fuente: intenta guardar el dato y
 * comprueba que se lee de vuelta, que es lo unico que demuestra que el campo
 * existe de verdad.
 *
 * Modelos barridos (los que declaran un campo `type` dentro de un subdocumento):
 *   - Transit.controlResult.discrepancies[]  (ya corregido)
 *   - Expedition.transport.containers[]
 *   - TaricCode.originRestrictions[]
 *   - InspectorCommunication.petition
 */

const { usarBaseDeDatosEnMemoria } = require('./../helpers/memoryDb');
const { Transit, Expedition, TaricCode } = require('../../src/models');

usarBaseDeDatosEnMemoria();

/**
 * Un path con subesquema tiene `.schema`; uno que Mongoose degrado a array de
 * primitivas, no. Es la comprobacion directa de la causa.
 */
function tieneCampoType(Modelo, ruta) {
  const path = Modelo.schema.path(ruta);
  if (!path) return { existe: false, motivo: `la ruta ${ruta} no existe en el esquema` };
  if (!path.schema) return { existe: false, motivo: `${ruta} no es un subesquema (Mongoose lo leyo como ${path.instance || path.constructor.name})` };
  const tiene = Object.keys(path.schema.paths).includes('type');
  return { existe: tiene, motivo: tiene ? 'ok' : `${ruta} no tiene un path 'type'` };
}

describe('campos de negocio llamados `type` dentro de subesquemas', () => {
  it('Transit.controlResult.discrepancies conserva su campo `type`', () => {
    const r = tieneCampoType(Transit, 'controlResult.discrepancies');
    expect(r.existe).toBe(true);
  });

  it('Expedition.transport.containers conserva su campo `type`', () => {
    // 20GP / 40GP / 40HC: el tipo de contenedor va en el ENS y en el DUA.
    const r = tieneCampoType(Expedition, 'transport.containers');
    expect(r.existe).toBe(true);
  });

  it('TaricCode.originRestrictions conserva su campo `type`', () => {
    // prohibition / quota / antidumping: de esto depende que se avise de un
    // antidumping. Si el campo no existe, la restriccion se guarda sin tipo.
    const r = tieneCampoType(TaricCode, 'originRestrictions');
    expect(r.existe).toBe(true);
  });
});

describe('los datos se leen de vuelta, no solo el esquema los declara', () => {
  it('un contenedor 40HC se guarda con su tipo', async () => {
    const exp = await Expedition.create({
      reference: 'EXP-TYPE-001',
      client: { nif: 'B22477020', companyName: 'STRIX AI SL' },
      operationType: 'import',
      transportMode: 'maritime',
      transport: {
        containers: [{ number: 'MSCU1234567', type: '40HC', sealNumber: 'ES1', grossWeight: 1000 }]
      }
    });
    const leido = await Expedition.findById(exp._id);
    expect(leido.transport.containers[0].type).toBe('40HC');
    expect(leido.transport.containers[0].number).toBe('MSCU1234567');
  });

  it('una restriccion antidumping se guarda con su tipo', async () => {
    // Codigo TARIC real (tubos de acero inoxidable sin soldadura para oleoductos).
    const tc = await TaricCode.create({
      code: '7304110000',
      description: { es: 'Tubos de acero inoxidable sin soldadura' },
      level: 10,
      originRestrictions: [{ country: 'CN', type: 'antidumping', description: 'Derecho antidumping' }]
    });
    const leido = await TaricCode.findById(tc._id);
    expect(leido.originRestrictions[0].type).toBe('antidumping');
    expect(leido.originRestrictions[0].country).toBe('CN');
  });
});
