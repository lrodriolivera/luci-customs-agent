/**
 * `controlResult.discrepancies` no podia guardar ninguna discrepancia.
 *
 * El subesquema es:
 *
 *     discrepancies: [{
 *       itemNumber: Number,
 *       type: String,  // shortage, excess, description, taric
 *       declared: String,
 *       found: String,
 *       action: String
 *     }]
 *
 * La trampa de Mongoose: dentro de la definicion de un elemento de array, la
 * clave `type` es reservada — Mongoose lee `{itemNumber, type: String, ...}`
 * como "un array de String con opciones", no como un subdocumento con un campo
 * llamado `type`. El resultado es `[String]`, y guardar el objeto revienta con
 *
 *     Cast to [string] failed for value "[ { itemNumber: 1, type: 'shortage',
 *     ... } ]" at path "controlResult.discrepancies.0"
 *
 * Consecuencia real: `recordControlResult` hace
 * `discrepancies: data.discrepancies || []` y despues `transit.save()`. Cualquier
 * control que detectase una falta, un exceso o una descripcion erronea fallaba
 * al guardar con un CastError, es decir: **el resultado del control se perdia
 * entero**, no solo la discrepancia. Y el error no menciona `type` ni el
 * subesquema, asi que no apunta a la causa.
 *
 * Se arregla con `typeKey: '_tipoCampo'` en el subesquema, que le dice a Mongoose
 * que en este bloque `type` es un campo normal.
 */

const mongoose = require('mongoose');
const { usarBaseDeDatosEnMemoria } = require('./../helpers/memoryDb');
const { Transit } = require('../../src/models');

usarBaseDeDatosEnMemoria();

const OWNER = () => new mongoose.Types.ObjectId();

const base = (owner) => ({
  owner,
  reference: 'REF-DISCR-001',
  lrn: 'LRNDISCR0001',
  transitType: 'T1',
  status: 'arrived',
  departureOffice: { code: 'ES002801' },
  destinationOffice: { code: 'ES002901' },
  transport: { mode: '3' },
  principal: { eori: 'ESB22477020', name: 'STRIX AI SL' },
  guarantee: { type: '1' },
  goodsItems: [{ itemNumber: 1, description: 'Tuberias', taricCode: '73041100', grossWeight: 450 }]
});

describe('Transit.controlResult.discrepancies guarda subdocumentos, no cadenas', () => {
  it('una falta detectada en el control se guarda entera', async () => {
    const owner = OWNER();
    const t = await Transit.create({
      ...base(owner),
      controlResult: {
        performed: true,
        type: 'A3',
        discrepancies: [{
          itemNumber: 1, type: 'shortage', declared: '450', found: '400', action: 'Acta levantada'
        }]
      }
    });

    const leido = await Transit.findById(t._id);
    expect(leido.controlResult.discrepancies).toHaveLength(1);
    expect(leido.controlResult.discrepancies[0].itemNumber).toBe(1);
    expect(leido.controlResult.discrepancies[0].type).toBe('shortage');
    expect(leido.controlResult.discrepancies[0].declared).toBe('450');
    expect(leido.controlResult.discrepancies[0].found).toBe('400');
    expect(leido.controlResult.discrepancies[0].action).toBe('Acta levantada');
  });

  it('el campo se llama `type` y no se confunde con el tipo del array', async () => {
    // Aserto directo sobre la causa: si Mongoose lee `type: String` como opcion
    // del array, `paths` no tiene `controlResult.discrepancies.type`.
    const rutas = Object.keys(Transit.schema.paths);
    const arrayDiscrepancias = Transit.schema.path('controlResult.discrepancies');
    expect(arrayDiscrepancias.schema).toBeDefined();
    expect(Object.keys(arrayDiscrepancias.schema.paths)).toContain('type');
    expect(rutas).toContain('controlResult.discrepancies');
  });

  it('varias discrepancias en el mismo control se guardan todas', async () => {
    const owner = OWNER();
    const t = await Transit.create({
      ...base(owner),
      controlResult: {
        performed: true,
        type: 'A4',
        discrepancies: [
          { itemNumber: 1, type: 'shortage', declared: '450', found: '400' },
          { itemNumber: 2, type: 'taric', declared: '73041100', found: '73041900' }
        ]
      }
    });

    const leido = await Transit.findById(t._id);
    expect(leido.controlResult.discrepancies.map((d) => d.type)).toEqual(['shortage', 'taric']);
  });

  it('un control sin discrepancias sigue guardando una lista vacia', async () => {
    const owner = OWNER();
    const t = await Transit.create({
      ...base(owner),
      controlResult: { performed: true, type: 'A1', discrepancies: [] }
    });
    const leido = await Transit.findById(t._id);
    expect(leido.controlResult.discrepancies).toEqual([]);
  });
});
