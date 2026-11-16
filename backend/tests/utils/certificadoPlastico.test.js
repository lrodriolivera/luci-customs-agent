const { conCertificadoPlastico, getChecklist } = require('../../src/utils/documentChecklists');

describe('conCertificadoPlastico', () => {
  const conReciclado = [{ impuestoPlastico: { kgReciclado: 2.5 } }, { impuestoPlastico: { kgReciclado: 1.5 } }];

  test('añade el certificado con los kg reciclados de todas las partidas, sin modificar la lista recibida', () => {
    const original = [{ documentType: 'commercial_invoice' }];
    const lista = conCertificadoPlastico(original, conReciclado);
    expect(original).toHaveLength(1);
    expect(lista[1]).toMatchObject({ documentType: 'plastic_recycled_certificate', required: true, received: false, notes: '4 kg de plástico reciclado declarados' });
  });

  test('si el cliente ya lo subió sale como recibido', () => {
    const lista = conCertificadoPlastico([], conReciclado, [{ _id: 'd1', type: 'plastic_recycled_certificate' }]);
    expect(lista[0]).toMatchObject({ received: true, documentId: 'd1' });
  });

  test('no lo repite ni lo pide sin plástico reciclado', () => {
    const ya = [{ documentType: 'plastic_recycled_certificate' }];
    expect(conCertificadoPlastico(ya, conReciclado)).toBe(ya);
    expect(conCertificadoPlastico([], [{ impuestoPlastico: { kg: 3 } }])).toEqual([]);
  });

  test('getChecklist lo incluye al crear un expediente con plástico reciclado', () => {
    expect(getChecklist('import', 'maritime', conReciclado).map((c) => c.documentType)).toContain('plastic_recycled_certificate');
  });
});
