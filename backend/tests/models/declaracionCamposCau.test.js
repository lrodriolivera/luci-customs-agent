/**
 * La declaración del expediente es un subdocumento estricto: lo que el esquema
 * no declara se descarta al guardar sin avisar. Los datos del H1 CAU que
 * escribe el controlador tienen que sobrevivir (la predeclaración se perdía y
 * la tarjeta no ofrecía «Activar»; 13/11/2026).
 */
const Expedition = require('../../src/models/Expedition');

describe('campos del H1 CAU en la declaración', () => {
  test('la predeclaración (modo, número de registro y fechas) se conserva', () => {
    const exp = new Expedition({ declaration: { type: 'H1', mrn: '26ES009999I00270R1' } });
    exp.declaration.predeclaracion = { modo: 'Operador', numeroRegistro: '26ES009999I00270R1', registradaEn: new Date('2026-11-13T07:56:10Z') };

    const guardado = exp.toObject();

    expect(guardado.declaration.predeclaracion).toEqual({ modo: 'Operador', numeroRegistro: '26ES009999I00270R1', registradaEn: new Date('2026-11-13T07:56:10Z') });
  });

  test('el mensaje enviado y la respuesta de la AEAT se conservan', () => {
    const exp = new Expedition({ declaration: { type: 'H1' } });
    exp.declaration.cauEnvio = { requestXML: '<x/>', respondido: true, predeclaracion: 'Operador' };
    exp.declaration.aeatResponse = { servicio: 'CC415AV1', responseCode: '63' };

    const guardado = exp.toObject();

    expect(guardado.declaration.cauEnvio).toEqual({ requestXML: '<x/>', respondido: true, predeclaracion: 'Operador' });
    expect(guardado.declaration.aeatResponse).toEqual({ servicio: 'CC415AV1', responseCode: '63' });
  });
});
