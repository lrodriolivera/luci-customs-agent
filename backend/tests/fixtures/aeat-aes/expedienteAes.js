/**
 * Expediente de exportacion de pruebas para el AES (CC515C), con los datos de
 * la preproducción de la AEAT: exportador cliente ES89890010F, STRIX
 * (ESB22477020) como agente, aduana ES002801, TARIC 6302100000, destino US.
 */
const TENANT_AGENTE = Object.freeze({
  companyName: 'STRIX AI SL',
  businessInfo: { type: 'customs_agent', eori: 'ESB22477020' },
  primaryContact: { name: 'Despacho STRIX', phone: '+34976000000', email: 'despacho@strixai.ai' }
});

/** Expediente completo; `cambios` sustituye ramas enteras de primer nivel. */
function expedienteAes(cambios = {}) {
  return {
    expeditionId: 'EXP-AES-1',
    operationType: 'export',
    transportMode: 'road',
    client: {
      companyName: 'Exportador Pruebas SL', nif: '89890010F', eori: 'ES89890010F',
      address: { street: 'Calle Mayor 1', city: 'Madrid', postalCode: '28001', country: 'ES' }
    },
    consignee: { companyName: 'US Corp', address: { street: '1 Main St', city: 'New York', postalCode: '10001', country: 'US' } },
    representative: { representationType: 'direct' },
    declaration: { type: 'AES', lrn: 'LUCIAESTEST0001', customsOffice: 'ES002801', officeOfExit: 'ES002801' },
    incoterm: { code: 'FOB', place: 'Madrid' },
    invoiceNumber: 'FAC-AES-0001',
    transport: { vehicleId: '1234ABC', vehicleNationality: 'ES', documentType: 'CMR', documentNumber: 'CMR-AES-0001' },
    goods: [{
      itemNumber: 1, description: 'Ropa de cama de punto de algodon', taricCode: '6302100000', originCountry: 'ES',
      quantity: 2, grossWeight: 25, netWeight: 20, invoiceValue: 1000, packages: { quantity: 2, type: 'PK' }
    }],
    ...cambios
  };
}

module.exports = { TENANT_AGENTE, expedienteAes };
