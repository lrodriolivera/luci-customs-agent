/**
 * Suite de cobertura de ramas del modelo PUERequest.
 *
 * PUERequest es el modelo central del flujo PUE (Ventanilla Unica Aduanera):
 * contiene validaciones complejas por tipo de control (ROHS, COM, ECO, CAL),
 * flujos SOIVRE vs ROHS_RAEE, métodos de instancia (validateForSubmission,
 * updateStatus, recordInspectionResult), virtuals, hooks pre-save y métodos
 * estáticos (getStats, getUpcomingDeadlines).
 *
 * El objetivo es ejercitar TODAS las ramas condicionales del modelo creando
 * documentos REALES en distintos estados y llamando sus métodos con datos
 * variados.
 *
 * NO se mockea el modelo: se usa Mongo en memoria y se persisten documentos
 * reales. NO se usan fake timers (Mongoose cuelga).
 */

const { usarBaseDeDatosEnMemoria } = require('../helpers/memoryDb');
const PUERequest = require('../../src/models/PUERequest');
const mongoose = require('mongoose');

usarBaseDeDatosEnMemoria({ limpiarEntreTests: true });

/**
 * Helper: crea un PUERequest válido mínimo. Overrides permiten variar escenarios.
 */
async function crearPUERequest(overrides = {}) {
  const base = {
    tenantId: new mongoose.Types.ObjectId(),
    pueType: 'ROHS',
    createdBy: new mongoose.Types.ObjectId(),
    operator: {
      name: 'Operador Test',
      eori: 'ES1234567890123',
      nif: 'B12345678',
      role: 'operator'
    },
    goods: [
      {
        sequenceNumber: 1,
        description: 'Portátiles Dell',
        taricCode: '8471300000', // código TARIC real
        quantity: 10,
        unitOfMeasure: 'PCE',
        grossMass: 15,
        netMass: 12,
        statisticalValue: 5000,
        countryOfOrigin: 'CN'
      }
    ],
    customsOffice: {
      code: 'ES000103',
      name: 'Madrid Barajas'
    },
    transport: {
      mode: 'AIR',
      documentType: 'AWB',
      documentNumber: 'AWB123456'
    },
    ...overrides
  };
  return PUERequest.create(base);
}

describe('Modelo PUERequest - Ramas', () => {

  describe('pre-save hook: generación de referencia', () => {
    it('genera referencia automática si no existe (L714)', async () => {
      // Arrange + Act: sin reference
      const doc = await crearPUERequest();

      // Assert: formato PUE-{tipo}-{año}-{nnnnnn}
      expect(doc.reference).toMatch(/^PUE-ROHS-\d{4}-\d{6}$/);
    });

    it('no sobrescribe la referencia si ya existe (rama else L714)', async () => {
      // Arrange + Act
      const doc = await crearPUERequest({ reference: 'PUE-MANUAL-2026-000001' });

      // Assert
      expect(doc.reference).toBe('PUE-MANUAL-2026-000001');
    });
  });

  describe('pre-save hook: cálculo de totales (L723-731)', () => {
    it('calcula totales cuando goods existe y tiene elementos (L723-731)', async () => {
      // Arrange + Act
      const doc = await crearPUERequest({
        goods: [
          {
            sequenceNumber: 1,
            description: 'Item 1',
            taricCode: '0901210000',
            grossMass: 10,
            netMass: 8,
            numberOfPackages: 5,
            statisticalValue: 100
          },
          {
            sequenceNumber: 2,
            description: 'Item 2',
            taricCode: '2204210000',
            grossMass: 20,
            netMass: 18,
            numberOfPackages: 3,
            statisticalValue: 200
          }
        ]
      });

      // Assert
      expect(doc.totals.grossMass).toBe(30);
      expect(doc.totals.netMass).toBe(26);
      expect(doc.totals.packages).toBe(8);
      expect(doc.totals.statisticalValue).toBe(300);
      expect(doc.totals.items).toBe(2);
    });

    it('maneja goods con campos opcionales ausentes (L725-728)', async () => {
      // Arrange + Act: algunos campos undefined
      const doc = await crearPUERequest({
        goods: [
          {
            sequenceNumber: 1,
            description: 'Item sin masas',
            taricCode: '0901210000'
            // grossMass, netMass, numberOfPackages, statisticalValue ausentes
          }
        ]
      });

      // Assert: reduce con (campo || 0)
      expect(doc.totals.grossMass).toBe(0);
      expect(doc.totals.netMass).toBe(0);
      expect(doc.totals.packages).toBe(0);
      expect(doc.totals.statisticalValue).toBe(0);
    });

    it('no calcula totales si goods está vacío (rama else L723)', async () => {
      // Arrange: goods debe validar length > 0, pero forzamos bypass
      const doc = new PUERequest({
        tenantId: new mongoose.Types.ObjectId(),
        pueType: 'COM',
        createdBy: new mongoose.Types.ObjectId(),
        operator: { name: 'Op', eori: 'ES1234567890123', role: 'operator' },
        customsOffice: { code: 'ES000103' }
        // sin goods
      });

      // Act: forzamos save (el validador del schema rechazaría, pero podemos testear el hook)
      let error;
      try {
        await doc.save();
      } catch (e) {
        error = e;
      }

      // Assert: falló el validador, NO el hook
      expect(error).toBeDefined();
      expect(error.errors.goods).toBeDefined();
    });
  });

  describe('pre-save hook: cálculo de totalFees (L734-738)', () => {
    it('suma tasas excluyendo las exentas (L734-738)', async () => {
      // Arrange + Act
      const doc = await crearPUERequest({
        fees: [
          { concept: 'Inspección', amount: 50, status: 'pending' },
          { concept: 'Certificado', amount: 30, status: 'paid' },
          { concept: 'Exenta', amount: 100, status: 'exempt' }
        ]
      });

      // Assert: 50 + 30 = 80 (excluye exempt)
      expect(doc.totalFees).toBe(80);
    });

    it('totalFees es 0 si fees está vacío (rama else L734)', async () => {
      // Arrange + Act
      const doc = await crearPUERequest({ fees: [] });

      // Assert
      expect(doc.totalFees).toBe(0);
    });

    it('totalFees es 0 si todas las tasas están exentas (L736)', async () => {
      // Arrange + Act
      const doc = await crearPUERequest({
        fees: [
          { concept: 'Tasa 1', amount: 100, status: 'exempt' },
          { concept: 'Tasa 2', amount: 200, status: 'exempt' }
        ]
      });

      // Assert
      expect(doc.totalFees).toBe(0);
    });
  });

  describe('pre-save hook: historial de estado (L741-746)', () => {
    it('registra cambio de estado cuando status se modifica (L741-746)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'draft' });
      expect(doc.statusHistory).toHaveLength(1);

      // Act: modificar estado
      doc.status = 'submitted';
      await doc.save();

      // Assert
      expect(doc.statusHistory).toHaveLength(2);
      expect(doc.statusHistory[1].status).toBe('submitted');
    });

    it('no registra si status no cambió (rama else L741)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'draft' });
      const historialInicial = doc.statusHistory.length;

      // Act: modificar otro campo
      doc.priority = 'urgent';
      await doc.save();

      // Assert: historial no crece
      expect(doc.statusHistory).toHaveLength(historialInicial);
    });
  });

  describe('validateForSubmission: operator (L756-770)', () => {
    it('error si operator.name ausente (L756-762)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.operator.name = '';

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_OPERATOR_REQUIRED')).toBe(true);
    });

    it('error si ni eori ni nif del operador (L764-770)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.operator.eori = undefined;
      doc.operator.nif = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_OPERATOR_ID_REQUIRED')).toBe(true);
    });

    it('válido si operator tiene eori pero no nif (rama or L764)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.operator.nif = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert: no genera error PUE_OPERATOR_ID_REQUIRED
      const operatorIdError = result.errors.find(e => e.code === 'PUE_OPERATOR_ID_REQUIRED');
      expect(operatorIdError).toBeUndefined();
    });

    it('válido si operator tiene nif pero no eori (rama or L764)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.operator.eori = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const operatorIdError = result.errors.find(e => e.code === 'PUE_OPERATOR_ID_REQUIRED');
      expect(operatorIdError).toBeUndefined();
    });
  });

  describe('validateForSubmission: goods (L773-820)', () => {
    it('error si goods vacío (L773-778)', async () => {
      // Arrange
      const doc = new PUERequest({
        tenantId: new mongoose.Types.ObjectId(),
        pueType: 'ROHS',
        createdBy: new mongoose.Types.ObjectId(),
        operator: { name: 'Op', eori: 'ES1234567890123', role: 'operator' },
        customsOffice: { code: 'ES000103' },
        goods: []
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_GOODS_REQUIRED')).toBe(true);
    });

    it('error si item sin taricCode (L783-789)', async () => {
      // Arrange: crear sin persistir para bypasear el validador de Mongoose
      const doc = await crearPUERequest();
      doc.goods[0].taricCode = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_TARIC_REQUIRED')).toBe(true);
    });

    it('error si item sin description (L791-797)', async () => {
      // Arrange: crear sin persistir para bypasear el validador de Mongoose
      const doc = await crearPUERequest();
      doc.goods[0].description = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_DESCRIPTION_REQUIRED')).toBe(true);
    });

    it('error ROHS si item sin manufacturer.name (L800-807)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        pueType: 'ROHS',
        goods: [
          {
            sequenceNumber: 1,
            description: 'ROHS sin fabricante',
            taricCode: '8471300000'
            // manufacturer.name ausente
          }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_MANUFACTURER_REQUIRED')).toBe(true);
    });

    it('no exige manufacturer para pueType distinto de ROHS (rama else L800)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        pueType: 'COM',
        goods: [
          {
            sequenceNumber: 1,
            description: 'COM sin fabricante',
            taricCode: '9503007000'
            // manufacturer ausente
          }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert: no debe tener error PUE_MANUFACTURER_REQUIRED
      const mfgError = result.errors.find(e => e.code === 'PUE_MANUFACTURER_REQUIRED');
      expect(mfgError).toBeUndefined();
    });

    it('error ECO si item sin certificación ecológica (L810-819)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        pueType: 'ECO',
        goods: [
          {
            sequenceNumber: 1,
            description: 'ECO sin certificación',
            taricCode: '0901210000',
            certifications: [] // sin ECO/BIO
          }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_ECO_CERT_REQUIRED')).toBe(true);
    });

    it('válido ECO si item tiene certificación ECO (L811)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        pueType: 'ECO',
        goods: [
          {
            sequenceNumber: 1,
            description: 'Café ecológico',
            taricCode: '0901210000',
            certifications: [
              { type: 'ECO', issuer: 'CCPAE', status: 'valid' }
            ]
          }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const ecoError = result.errors.find(e => e.code === 'PUE_ECO_CERT_REQUIRED');
      expect(ecoError).toBeUndefined();
    });

    it('válido ECO si item tiene certificación BIO (L811)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        pueType: 'ECO',
        goods: [
          {
            sequenceNumber: 1,
            description: 'Vino biológico',
            taricCode: '2204210000',
            certifications: [
              { type: 'BIO', issuer: 'Eurocert', status: 'valid' }
            ]
          }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const ecoError = result.errors.find(e => e.code === 'PUE_ECO_CERT_REQUIRED');
      expect(ecoError).toBeUndefined();
    });
  });

  describe('validateForSubmission: aduana/oficina (L823-829)', () => {
    it('error si ni customsOffice.code ni soivreOffice.code (L823-829)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.customsOffice = undefined;
      doc.soivreOffice = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_OFFICE_REQUIRED')).toBe(true);
    });

    it('válido si tiene soivreOffice pero no customsOffice (L823)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.customsOffice = undefined;
      doc.soivreOffice = { code: 'SV001', name: 'SOIVRE Madrid' };

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const officeError = result.errors.find(e => e.code === 'PUE_OFFICE_REQUIRED');
      expect(officeError).toBeUndefined();
    });
  });

  describe('validateForSubmission: transporte (L832-838)', () => {
    it('error si sin MRN y sin transport.mode (L832-838)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.declarationMRN = undefined;
      doc.transport = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_TRANSPORT_REQUIRED')).toBe(true);
    });

    it('no exige transporte si tiene declarationMRN (L832)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.declarationMRN = '26ES00010300A0123456';
      doc.transport = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const transportError = result.errors.find(e => e.code === 'PUE_TRANSPORT_REQUIRED');
      expect(transportError).toBeUndefined();
    });
  });

  describe('validateForSubmission: SOIVRE Overhaul (L843-889)', () => {
    it('error si flowType y sin codCice.code (L843-849)', async () => {
      // Arrange
      const doc = await crearPUERequest({ flowType: 'SOIVRE' });
      doc.codCice = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_CODCICE_REQUIRED')).toBe(true);
    });

    it('error si flowType y sin codPi.code (L851-857)', async () => {
      // Arrange
      const doc = await crearPUERequest({ flowType: 'ROHS_RAEE' });
      doc.codPi = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_CODPI_REQUIRED')).toBe(true);
    });

    it('error si flowType y sin contactEmail (L860-866)', async () => {
      // Arrange
      const doc = await crearPUERequest({ flowType: 'SOIVRE' });
      doc.contactEmail = undefined;

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_EMAIL_REQUIRED')).toBe(true);
    });

    it('error SOIVRE si sin documentos adjuntos (L869-878)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        flowType: 'SOIVRE',
        codCice: { code: 'C01', name: 'Centro Madrid' },
        codPi: { code: 'P01', name: 'PI Madrid' },
        contactEmail: 'test@test.com',
        attachedDocuments: []
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_SOIVRE_DOCS_REQUIRED')).toBe(true);
    });

    it('válido SOIVRE si tiene attachedDocuments (L871)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        flowType: 'SOIVRE',
        codCice: { code: 'C01', name: 'Centro Madrid' },
        codPi: { code: 'P01', name: 'PI Madrid' },
        contactEmail: 'test@test.com',
        attachedDocuments: [
          { type: 'INVOICE', name: 'Factura.pdf', url: 'http://example.com/factura.pdf' }
        ]
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const docsError = result.errors.find(e => e.code === 'PUE_SOIVRE_DOCS_REQUIRED');
      expect(docsError).toBeUndefined();
    });

    it('error ROHS_RAEE si sin certificados rohs/raee (L880-888)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        flowType: 'ROHS_RAEE',
        codCice: { code: 'C01', name: 'Centro Madrid' },
        codPi: { code: 'P01', name: 'PI Madrid' },
        contactEmail: 'test@test.com',
        certificates: {} // sin rohs ni raee
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PUE_ROHS_CERT_REQUIRED')).toBe(true);
    });

    it('válido ROHS_RAEE si tiene certificates.rohs (L882)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        flowType: 'ROHS_RAEE',
        codCice: { code: 'C01', name: 'Centro Madrid' },
        codPi: { code: 'P01', name: 'PI Madrid' },
        contactEmail: 'test@test.com',
        certificates: { rohs: 'NORMAL' }
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const certError = result.errors.find(e => e.code === 'PUE_ROHS_CERT_REQUIRED');
      expect(certError).toBeUndefined();
    });

    it('válido ROHS_RAEE si tiene certificates.raee (L882)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        flowType: 'ROHS_RAEE',
        codCice: { code: 'C01', name: 'Centro Madrid' },
        codPi: { code: 'P01', name: 'PI Madrid' },
        contactEmail: 'test@test.com',
        certificates: { raee: 'NORMAL' }
      });

      // Act
      const result = doc.validateForSubmission();

      // Assert
      const certError = result.errors.find(e => e.code === 'PUE_ROHS_CERT_REQUIRED');
      expect(certError).toBeUndefined();
    });
  });

  describe('método updateStatus (L898-909)', () => {
    it('actualiza status y registra en historial', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const doc = await crearPUERequest({ status: 'draft' });
      const historialInicial = doc.statusHistory.length;

      // Act
      doc.updateStatus('submitted', userId, 'Enviado a AEAT', 'AEAT001', 'SOIVRE001');

      // Assert
      expect(doc.status).toBe('submitted');
      expect(doc.statusHistory).toHaveLength(historialInicial + 1);
      expect(doc.statusHistory[historialInicial].status).toBe('submitted');
      expect(doc.statusHistory[historialInicial].user).toEqual(userId);
      expect(doc.statusHistory[historialInicial].reason).toBe('Enviado a AEAT');
      expect(doc.statusHistory[historialInicial].aeatCode).toBe('AEAT001');
      expect(doc.statusHistory[historialInicial].soivreCode).toBe('SOIVRE001');
    });
  });

  describe('método addNote (L912-920)', () => {
    it('agrega nota con valores correctos', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const doc = await crearPUERequest();
      const notasIniciales = doc.notes.length;

      // Act
      doc.addNote('Nota de prueba', userId, true);

      // Assert
      expect(doc.notes).toHaveLength(notasIniciales + 1);
      expect(doc.notes[notasIniciales].text).toBe('Nota de prueba');
      expect(doc.notes[notasIniciales].createdBy).toEqual(userId);
      expect(doc.notes[notasIniciales].isInternal).toBe(true);
    });

    it('aplica isInternal=false por defecto (L912)', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const doc = await crearPUERequest();

      // Act: sin pasar isInternal
      doc.addNote('Nota pública', userId);

      // Assert
      expect(doc.notes[doc.notes.length - 1].isInternal).toBe(false);
    });
  });

  describe('método addDocument (L923-930)', () => {
    it('agrega documento con uploadedAt y uploadedBy', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const doc = await crearPUERequest();
      const docsIniciales = doc.attachedDocuments.length;

      // Act
      doc.addDocument({
        type: 'CERTIFICATE_CE',
        name: 'CE-12345.pdf',
        url: 'https://example.com/ce.pdf'
      }, userId);

      // Assert
      expect(doc.attachedDocuments).toHaveLength(docsIniciales + 1);
      expect(doc.attachedDocuments[docsIniciales].uploadedBy).toEqual(userId);
      expect(doc.attachedDocuments[docsIniciales].uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe('método markDocumentProvided (L933-942)', () => {
    it('marca documento requerido como provisto (L935-940)', async () => {
      // Arrange
      const docId = new mongoose.Types.ObjectId();
      const doc = await crearPUERequest({
        requiredDocuments: [
          { code: 'DOC001', name: 'Factura', required: true, provided: false }
        ]
      });

      // Act
      doc.markDocumentProvided('DOC001', docId, 'https://example.com/factura.pdf');

      // Assert
      expect(doc.requiredDocuments[0].provided).toBe(true);
      expect(doc.requiredDocuments[0].providedAt).toBeInstanceOf(Date);
      expect(doc.requiredDocuments[0].documentId).toEqual(docId);
      expect(doc.requiredDocuments[0].documentUrl).toBe('https://example.com/factura.pdf');
    });

    it('no modifica nada si el código no existe (L935 falso)', async () => {
      // Arrange
      const doc = await crearPUERequest({
        requiredDocuments: [
          { code: 'DOC001', name: 'Factura', required: true, provided: false }
        ]
      });

      // Act
      doc.markDocumentProvided('DOC999', new mongoose.Types.ObjectId(), 'url');

      // Assert: DOC001 no cambió
      expect(doc.requiredDocuments[0].provided).toBe(false);
    });
  });

  describe('método recordInspectionResult (L945-964)', () => {
    it('inicializa inspection si no existe (L946-948)', async () => {
      // Arrange
      const doc = await crearPUERequest();
      doc.inspection = undefined;

      // Act
      doc.recordInspectionResult('favorable', 'Inspección OK');

      // Assert
      expect(doc.inspection).toBeDefined();
      expect(doc.inspection.result).toBe('favorable');
    });

    it('resultado favorable actualiza status a approved (L955-956)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'in_inspection' });

      // Act
      doc.recordInspectionResult('favorable', 'Todo OK');

      // Assert
      expect(doc.status).toBe('approved');
    });

    it('resultado favorable_with_conditions actualiza status a approved_conditions (L957-958)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'in_inspection' });

      // Act
      doc.recordInspectionResult('favorable_with_conditions', 'Condiciones cumplidas');

      // Assert
      expect(doc.status).toBe('approved_conditions');
    });

    it('resultado unfavorable actualiza status a rejected (L959-960)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'in_inspection' });

      // Act
      doc.recordInspectionResult('unfavorable', 'No cumple');

      // Assert
      expect(doc.status).toBe('rejected');
    });

    it('resultado pending no cambia status (ninguna rama L955-960 tomada)', async () => {
      // Arrange
      const doc = await crearPUERequest({ status: 'pending_inspection' });

      // Act
      doc.recordInspectionResult('pending', 'Aún en revisión');

      // Assert: status no cambió
      expect(doc.status).toBe('pending_inspection');
    });

    it('agrega findings cuando se proveen (L952)', async () => {
      // Arrange
      const doc = await crearPUERequest();

      // Act
      doc.recordInspectionResult('favorable', 'OK', [
        { category: 'Etiquetado', description: 'Falta traducción', severity: 'minor' }
      ]);

      // Assert
      expect(doc.inspection.findings).toHaveLength(1);
      expect(doc.inspection.findings[0].category).toBe('Etiquetado');
    });
  });

  describe('método estático getStats (L967-1046)', () => {
    it('filtra por startDate y endDate (L970-973)', async () => {
      // Arrange
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);

      await crearPUERequest({ createdAt: ayer });

      // Act
      const stats = await PUERequest.getStats({
        startDate: manana.toISOString()
      });

      // Assert: filtro excluye el documento de ayer
      expect(stats.totals.total).toBe(0);
    });

    it('filtra solo por endDate (L973)', async () => {
      // Arrange
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const hoy = new Date();

      await crearPUERequest({ createdAt: hoy });

      // Act: solo endDate, sin startDate
      const stats = await PUERequest.getStats({
        endDate: ayer.toISOString()
      });

      // Assert: filtro excluye el documento de hoy
      expect(stats.totals.total).toBe(0);
    });

    it('filtra por pueType (L976)', async () => {
      // Arrange
      await crearPUERequest({ pueType: 'ROHS' });
      await crearPUERequest({ pueType: 'COM' });

      // Act
      const stats = await PUERequest.getStats({ pueType: 'ROHS' });

      // Assert
      expect(stats.totals.total).toBe(1);
    });

    it('filtra por createdBy (L977)', async () => {
      // Arrange
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();
      await crearPUERequest({ createdBy: user1 });
      await crearPUERequest({ createdBy: user2 });

      // Act
      const stats = await PUERequest.getStats({ createdBy: user1.toString() });

      // Assert
      expect(stats.totals.total).toBe(1);
    });

    it('agrega por status (L979-987)', async () => {
      // Arrange
      await crearPUERequest({ status: 'draft' });
      await crearPUERequest({ status: 'approved' });

      // Act
      const stats = await PUERequest.getStats();

      // Assert
      expect(stats.byStatus).toBeInstanceOf(Array);
      expect(stats.byStatus.length).toBeGreaterThan(0);
    });

    it('agrega por tipo con conteos condicionales (L989-1007)', async () => {
      // Arrange
      await crearPUERequest({ pueType: 'ROHS', status: 'approved' });
      await crearPUERequest({ pueType: 'ROHS', status: 'rejected' });
      await crearPUERequest({ pueType: 'ROHS', status: 'submitted' });

      // Act
      const stats = await PUERequest.getStats();

      // Assert
      const rohs = stats.byType.find(t => t._id === 'ROHS');
      expect(rohs.approved).toBe(1);
      expect(rohs.rejected).toBe(1);
      expect(rohs.pending).toBe(1);
    });

    it('cuenta pendingInspections (L1022-1025)', async () => {
      // Arrange
      await crearPUERequest({ status: 'pending_inspection' });
      await crearPUERequest({ status: 'inspection_scheduled' });
      await crearPUERequest({ status: 'approved' });

      // Act
      const stats = await PUERequest.getStats();

      // Assert
      expect(stats.pendingInspections).toBe(2);
    });

    it('cuenta overdueDeadlines (L1027-1031)', async () => {
      // Arrange
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      await crearPUERequest({ status: 'submitted', deadline: ayer });
      await crearPUERequest({ status: 'approved', deadline: ayer }); // no cuenta: aprobado

      // Act
      const stats = await PUERequest.getStats();

      // Assert
      expect(stats.overdueDeadlines).toBe(1);
    });
  });

  describe('método estático findByExpedition (L1049-1051)', () => {
    it('devuelve documentos por expeditionId ordenados por fecha (L1049-1051)', async () => {
      // Arrange
      const expId = new mongoose.Types.ObjectId();
      await crearPUERequest({ expedition: expId, pueType: 'ROHS' });
      await crearPUERequest({ expedition: expId, pueType: 'COM' });
      await crearPUERequest({ expedition: new mongoose.Types.ObjectId() });

      // Act
      const docs = await PUERequest.findByExpedition(expId);

      // Assert
      expect(docs).toHaveLength(2);
      expect(docs.every(d => d.expedition.equals(expId))).toBe(true);
    });
  });

  describe('método estático findByDeclaration (L1054-1056)', () => {
    it('devuelve documentos por declarationMRN (L1054-1056)', async () => {
      // Arrange
      const mrn = '26ES00010300A0123456';
      await crearPUERequest({ declarationMRN: mrn });
      await crearPUERequest({ declarationMRN: 'otro-mrn' });

      // Act
      const docs = await PUERequest.findByDeclaration(mrn);

      // Assert
      expect(docs).toHaveLength(1);
      expect(docs[0].declarationMRN).toBe(mrn);
    });
  });

  describe('método estático getUpcomingDeadlines (L1059-1070)', () => {
    it('devuelve deadlines futuros dentro del rango (L1059-1069)', async () => {
      // Arrange
      const en3Dias = new Date();
      en3Dias.setDate(en3Dias.getDate() + 3);
      const en10Dias = new Date();
      en10Dias.setDate(en10Dias.getDate() + 10);

      await crearPUERequest({ status: 'submitted', deadline: en3Dias });
      await crearPUERequest({ status: 'submitted', deadline: en10Dias }); // fuera del rango
      await crearPUERequest({ status: 'approved', deadline: en3Dias }); // excluido por status

      // Act: buscar en próximos 7 días
      const docs = await PUERequest.getUpcomingDeadlines(7);

      // Assert
      expect(docs).toHaveLength(1);
      expect(docs[0].deadline.getTime()).toBeCloseTo(en3Dias.getTime(), -2);
    });

    it('excluye estados finales del deadline (L1064)', async () => {
      // Arrange
      const en3Dias = new Date();
      en3Dias.setDate(en3Dias.getDate() + 3);

      await crearPUERequest({ status: 'submitted', deadline: en3Dias }); // incluido (no está en exclusión)
      await crearPUERequest({ status: 'approved', deadline: en3Dias }); // excluido
      await crearPUERequest({ status: 'rejected', deadline: en3Dias }); // excluido
      await crearPUERequest({ status: 'cancelled', deadline: en3Dias }); // excluido
      await crearPUERequest({ status: 'expired', deadline: en3Dias }); // excluido
      await crearPUERequest({ status: 'draft', deadline: en3Dias }); // excluido (draft también está en la exclusión)

      // Act
      const docs = await PUERequest.getUpcomingDeadlines(7);

      // Assert: solo submitted
      expect(docs).toHaveLength(1);
      expect(docs[0].status).toBe('submitted');
    });

    it('respeta el rango de fecha (gte/lte) (L1065-1067)', async () => {
      // Arrange
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      const en8Dias = new Date();
      en8Dias.setDate(en8Dias.getDate() + 8);

      await crearPUERequest({ status: 'submitted', deadline: ayer }); // pasado
      await crearPUERequest({ status: 'submitted', deadline: en8Dias }); // > 7

      // Act
      const docs = await PUERequest.getUpcomingDeadlines(7);

      // Assert: ambos fuera de rango
      expect(docs).toHaveLength(0);
    });
  });
});
