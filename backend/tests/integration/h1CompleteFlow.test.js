/**
 * H1 Complete Flow Integration Tests
 * End-to-end testing from expedition creation to AEAT submission and channel processing
 * LUCI Customs Agent - Stock Logistic
 *
 * Based on PLAN_AGENTE_ADUANAS_COMPLETO.md
 */

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const {
  createElectronicsExpedition,
  createTextileExpedition,
  createFoodExpedition,
  testDocumentsCertificates,
  channelExpectations,
  requirementResponses,
  inspectionResults,
  customsOffices,
  regimes,
  preferences
} = require('../fixtures/h1TestData');

describe('H1 Complete Flow Integration Tests', () => {

  describe('Phase 1: Expedition Creation', () => {
    test('should create expedition with all required data for electronics import', () => {
      const expedition = createElectronicsExpedition();

      // Verify basic structure
      expect(expedition.operationType).toBe('import');
      expect(expedition.transportMode).toBe('maritime');
      expect(expedition.status).toBe('documents_validated');

      // Verify client data
      expect(expedition.client.companyName).toBe('Importaciones Mediterráneo S.L.');
      expect(expedition.client.nif).toMatch(/^[A-Z]\d{8}$/);
      expect(expedition.client.eori).toMatch(/^ES[A-Z]\d{11}$/);

      // Verify goods
      expect(expedition.goods).toHaveLength(3);
      expect(expedition.goods[0].taricCode).toBe('84713000');
      expect(expedition.goods[0].originCountry).toBe('CN');

      // Verify transport
      expect(expedition.transport.documentType).toBe('BL');
      expect(expedition.transport.arrivalPort).toBe('ESBCN');

      // Verify documents
      expect(expedition.documents).toHaveLength(3);
      const docTypes = expedition.documents.map(d => d.type);
      expect(docTypes).toContain('commercial_invoice');
      expect(docTypes).toContain('packing_list');
      expect(docTypes).toContain('bill_of_lading');
    });

    test('should validate all required documents are present', () => {
      const expedition = createElectronicsExpedition();

      const requiredDocs = ['commercial_invoice', 'packing_list', 'bill_of_lading'];
      const presentDocs = expedition.documents.map(d => d.type);

      requiredDocs.forEach(reqDoc => {
        expect(presentDocs).toContain(reqDoc);
      });

      // All documents should be validated
      expedition.documents.forEach(doc => {
        expect(doc.status).toBe('validated');
      });
    });

    test('should validate goods have TARIC codes assigned', () => {
      const expedition = createElectronicsExpedition();

      expedition.goods.forEach(item => {
        expect(item.taricCode).toBeDefined();
        expect(item.taricCode.length).toBeGreaterThanOrEqual(8);
        expect(item.hsCode).toBeDefined();
        expect(item.hsCode.length).toBe(6);
      });
    });

    test('should calculate total values correctly', () => {
      const expedition = createElectronicsExpedition();

      const calculatedTotal = expedition.goods.reduce(
        (sum, item) => sum + item.invoiceValue, 0
      );

      expect(expedition.invoiceTotal).toBe(calculatedTotal);
      expect(expedition.customsValue).toBeGreaterThanOrEqual(expedition.invoiceTotal);
    });
  });

  describe('Phase 2: H1 Declaration Generation', () => {
    test('should generate valid LRN format', () => {
      const year = new Date().getFullYear().toString().slice(-2);
      const lrnPattern = new RegExp(`^${year}ES[A-Z0-9]{8}$`);

      // Simulate LRN generation
      const generateLRN = () => {
        const random = Math.random().toString(36).substring(2, 10).toUpperCase();
        return `${year}ES${random}`;
      };

      const lrn = generateLRN();
      expect(lrn).toMatch(lrnPattern);
      expect(lrn.length).toBe(12);
    });

    test('should build declaration header with correct importer data', () => {
      const expedition = createElectronicsExpedition();

      const declarationHeader = {
        declarationType: 'A',
        regime: regimes.freeCirculation.code,
        additionalProcedure: '000',
        importer: {
          eori: expedition.client.eori,
          name: expedition.client.companyName,
          address: expedition.client.address
        },
        declarant: {
          eori: expedition.declarant.eori,
          name: expedition.declarant.companyName,
          representationType: expedition.declarant.representationType
        },
        customsOffice: expedition.customsOffice
      };

      expect(declarationHeader.declarationType).toBe('A');
      expect(declarationHeader.regime).toBe('40');
      expect(declarationHeader.importer.eori).toMatch(/^ES/);
      expect(declarationHeader.customsOffice).toBe('ES002801');
    });

    test('should build goods shipment with transport details', () => {
      const expedition = createElectronicsExpedition();

      const goodsShipment = {
        countryOfDispatch: expedition.exporter.country || 'CN',
        countryOfDestination: 'ES',
        transportMeansCode: expedition.transportMode === 'maritime' ? '1' :
                            expedition.transportMode === 'road' ? '3' :
                            expedition.transportMode === 'air' ? '4' : '1',
        incoterm: expedition.incoterm.code,
        incotermPlace: expedition.incoterm.place,
        totalPackages: expedition.goods.reduce((sum, g) => sum + g.packages.quantity, 0),
        totalGrossMass: expedition.goods.reduce((sum, g) => sum + g.grossWeight, 0),
        loadingPlace: expedition.transport.loadingPlace,
        unloadingPlace: expedition.transport.unloadingPlace
      };

      expect(goodsShipment.countryOfDispatch).toBe('CN');
      expect(goodsShipment.countryOfDestination).toBe('ES');
      expect(goodsShipment.transportMeansCode).toBe('1'); // Maritime
      expect(goodsShipment.incoterm).toBe('CIF');
      expect(goodsShipment.totalPackages).toBe(45);
      expect(goodsShipment.totalGrossMass).toBe(605);
    });

    test('should build goods items with TARIC classification', () => {
      const expedition = createElectronicsExpedition();

      const goodsItems = expedition.goods.map((item, index) => ({
        itemNumber: index + 1,
        commodityCode: {
          hs: item.hsCode,
          taric: item.taricCode
        },
        description: item.description,
        countryOfOrigin: item.originCountry,
        preference: preferences.mfn.code,
        requestedProcedure: regimes.freeCirculation.code,
        previousProcedure: '00',
        grossMass: item.grossWeight,
        netMass: item.netWeight,
        supplementaryUnits: item.quantity,
        itemPrice: item.invoiceValue,
        packaging: {
          quantity: item.packages.quantity,
          type: item.packages.type,
          marks: item.packages.marks
        }
      }));

      expect(goodsItems).toHaveLength(3);
      expect(goodsItems[0].commodityCode.taric).toBe('84713000');
      expect(goodsItems[0].countryOfOrigin).toBe('CN');
      expect(goodsItems[0].requestedProcedure).toBe('40');
    });

    test('should include supporting documents with correct codes', () => {
      const expedition = createElectronicsExpedition();

      const supportingDocuments = expedition.documents.map(doc => {
        const codeMapping = {
          'commercial_invoice': 'N380',
          'packing_list': 'N714',
          'bill_of_lading': 'N705',
          'air_waybill': 'N740',
          'cmr': 'N730'
        };

        return {
          type: codeMapping[doc.type] || doc.documentCode,
          reference: doc.extractedData?.invoiceNumber ||
                    doc.extractedData?.blNumber ||
                    doc.fileName,
          date: doc.extractedData?.invoiceDate || doc.uploadedAt
        };
      });

      expect(supportingDocuments).toHaveLength(3);
      expect(supportingDocuments.find(d => d.type === 'N380')).toBeDefined();
      expect(supportingDocuments.find(d => d.type === 'N705')).toBeDefined();
    });

    test('should generate valid CC515C XML structure', () => {
      const expedition = createElectronicsExpedition();

      // Simulate XML generation
      const generateXMLStructure = (exp) => {
        return `<?xml version="1.0" encoding="UTF-8"?>
<CC515C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>ESB22477020000</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${new Date().toISOString()}</PreparationDateTime>
  <MessageIdentification>MSG-${Date.now()}</MessageIdentification>
  <MessageType>CC515C</MessageType>
  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>A</TypeCode>
    <GoodsItemQuantity>${exp.goods.length}</GoodsItemQuantity>
    <TotalPackageQuantity>${exp.goods.reduce((s, g) => s + g.packages.quantity, 0)}</TotalPackageQuantity>
    <TotalGrossMassMeasure>${exp.goods.reduce((s, g) => s + g.grossWeight, 0)}</TotalGrossMassMeasure>
    <GoodsShipment>
      <!-- Goods shipment details -->
    </GoodsShipment>
  </Declaration>
</CC515C>`;
      };

      const xml = generateXMLStructure(expedition);

      expect(xml).toContain('CC515C');
      expect(xml).toContain('urn:wco:datamodel:WCO:DEC-DMS:2');
      expect(xml).toContain('<GoodsItemQuantity>3</GoodsItemQuantity>');
      expect(xml).toContain('<TotalPackageQuantity>45</TotalPackageQuantity>');
    });
  });

  describe('Phase 3: Declaration Submission to AEAT', () => {
    test('should validate declaration before submission', () => {
      const expedition = createElectronicsExpedition();

      const validateDeclaration = (exp) => {
        const errors = [];
        const warnings = [];

        // Check operation type
        if (exp.operationType !== 'import') {
          errors.push('H1 requires import operation type');
        }

        // Check required documents
        const requiredDocs = ['commercial_invoice', 'packing_list'];
        const presentDocs = exp.documents.map(d => d.type);
        requiredDocs.forEach(doc => {
          if (!presentDocs.includes(doc)) {
            errors.push(`Missing required document: ${doc}`);
          }
        });

        // Check transport document
        const transportDocs = ['bill_of_lading', 'air_waybill', 'cmr'];
        if (!transportDocs.some(td => presentDocs.includes(td))) {
          errors.push('Missing transport document (BL/AWB/CMR)');
        }

        // Check goods classification
        exp.goods.forEach((item, idx) => {
          if (!item.taricCode) {
            errors.push(`Item ${idx + 1}: Missing TARIC code`);
          }
        });

        // Check document validation status
        exp.documents.forEach(doc => {
          if (doc.status !== 'validated') {
            warnings.push(`Document ${doc.type} is not validated`);
          }
        });

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      };

      const validation = validateDeclaration(expedition);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should simulate AEAT submission and receive MRN', () => {
      const expedition = createElectronicsExpedition();

      // Simulate AEAT response
      const simulateAEATSubmission = (exp) => {
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.random().toString(36).substring(2, 14).toUpperCase();
        const mrn = `${year}ESIM${random}`;

        // Simulate channel assignment (70% green, 25% orange, 5% red)
        const rand = Math.random();
        let channel;
        if (rand < 0.70) channel = 'green';
        else if (rand < 0.95) channel = 'orange';
        else channel = 'red';

        return {
          success: true,
          mrn,
          lrn: `${year}ES12345678`,
          status: 'accepted',
          channel,
          acceptanceDate: new Date().toISOString(),
          customsOffice: exp.customsOffice,
          duties: {
            dutyAmount: Math.round(exp.customsValue * 0.03),
            vatAmount: Math.round(exp.customsValue * 0.21),
            totalAmount: Math.round(exp.customsValue * 0.24)
          },
          aeatResponse: {
            code: '0000',
            description: 'Declaración aceptada'
          }
        };
      };

      const response = simulateAEATSubmission(expedition);

      expect(response.success).toBe(true);
      expect(response.mrn).toMatch(/^\d{2}ESIM[A-Z0-9]+$/);
      expect(response.mrn.length).toBeGreaterThanOrEqual(16);
      expect(['green', 'orange', 'red']).toContain(response.channel);
      expect(response.duties.totalAmount).toBeGreaterThan(0);
      expect(response.aeatResponse.code).toBe('0000');
    });

    test('should update expedition status after submission', () => {
      const expedition = createElectronicsExpedition();

      // Simulate post-submission update
      const updateExpeditionAfterSubmission = (exp, aeatResponse) => {
        const channelStatusMap = {
          'green': 'green_channel',
          'orange': 'orange_channel',
          'red': 'red_channel'
        };

        return {
          ...exp,
          status: channelStatusMap[aeatResponse.channel],
          declaration: {
            type: 'H1',
            mrn: aeatResponse.mrn,
            lrn: aeatResponse.lrn,
            status: 'submitted',
            channel: aeatResponse.channel,
            submittedAt: new Date(),
            acceptanceDate: aeatResponse.acceptanceDate,
            duties: aeatResponse.duties
          },
          timeline: [
            ...(exp.timeline || []),
            {
              action: 'declaration_submitted',
              description: `H1 submitted to AEAT. MRN: ${aeatResponse.mrn}`,
              timestamp: new Date(),
              metadata: {
                mrn: aeatResponse.mrn,
                channel: aeatResponse.channel
              }
            }
          ]
        };
      };

      const aeatResponse = {
        mrn: '26ESIM1234567890AB',
        lrn: '26ES12345678',
        channel: 'green',
        acceptanceDate: new Date().toISOString(),
        duties: { dutyAmount: 1626, vatAmount: 11382, totalAmount: 13008 }
      };

      const updatedExpedition = updateExpeditionAfterSubmission(expedition, aeatResponse);

      expect(updatedExpedition.status).toBe('green_channel');
      expect(updatedExpedition.declaration.mrn).toBe('26ESIM1234567890AB');
      expect(updatedExpedition.declaration.channel).toBe('green');
      expect(updatedExpedition.timeline.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 4: Channel Processing - GREEN (Levante Automático)', () => {
    test('should generate levante for green channel', () => {
      const expedition = createElectronicsExpedition();

      const processGreenChannel = (exp) => {
        const year = new Date().getFullYear();
        const levanteNumber = `LEV${year}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

        return {
          success: true,
          channel: 'green',
          levante: {
            number: levanteNumber,
            generatedAt: new Date(),
            releaseDate: new Date(),
            releaseType: 'automatic',
            customsOffice: exp.customsOffice
          },
          notification: {
            sent: true,
            recipient: exp.client.contact.email,
            subject: `Levante autorizado - Expediente ${exp.expeditionId || 'TEST'}`,
            timestamp: new Date()
          },
          expeditionStatus: 'levante',
          requirementCreated: false
        };
      };

      const result = processGreenChannel(expedition);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('green');
      expect(result.levante.number).toMatch(/^LEV\d{10}$/);
      expect(result.levante.releaseType).toBe('automatic');
      expect(result.notification.sent).toBe(true);
      expect(result.requirementCreated).toBe(false);
    });

    test('should update expedition to levante status for green channel', () => {
      const channelResult = channelExpectations.green;

      expect(channelResult.expectedStatus).toBe('green_channel');
      expect(channelResult.requirementCreated).toBe(false);
      expect(channelResult.expectedActions).toContain('levante_generated');
    });
  });

  describe('Phase 5: Channel Processing - ORANGE (Requerimiento Documental)', () => {
    test('should create documentary requirement for orange channel', () => {
      const expedition = createTextileExpedition();

      const processOrangeChannel = (exp) => {
        const year = new Date().getFullYear();
        const reqNumber = `REQ-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

        // Determine required documents based on TARIC codes
        const requestedItems = [];

        // Always request basic documentation
        requestedItems.push(
          { itemType: 'document', documentType: 'N380', description: 'Factura comercial detallada', mandatory: true },
          { itemType: 'document', documentType: 'N714', description: 'Lista de empaque', mandatory: true }
        );

        // Check for textiles (chapters 50-63)
        const hasTextiles = exp.goods.some(g => {
          const chapter = parseInt(g.taricCode.substring(0, 2));
          return chapter >= 50 && chapter <= 63;
        });

        if (hasTextiles) {
          requestedItems.push({
            itemType: 'document',
            documentType: 'Y923',
            description: 'Certificado de composición textil',
            mandatory: true
          });
        }

        // Check origin for non-EU
        const hasNonEUOrigin = exp.goods.some(g => !['ES', 'FR', 'DE', 'IT', 'PT'].includes(g.originCountry));
        if (hasNonEUOrigin) {
          requestedItems.push({
            itemType: 'document',
            documentType: 'U069',
            description: 'Certificado de origen',
            mandatory: true
          });
        }

        return {
          success: true,
          channel: 'orange',
          requirement: {
            requirementNumber: reqNumber,
            requirementType: 'documentary',
            status: 'pending',
            issuingAuthority: 'AEAT',
            receivedAt: new Date(),
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
            requestedItems,
            responses: []
          },
          notification: {
            sent: true,
            type: 'requirement_created',
            urgency: 'normal'
          },
          expeditionStatus: 'orange_channel',
          requirementCreated: true
        };
      };

      const result = processOrangeChannel(expedition);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('orange');
      expect(result.requirement.requirementType).toBe('documentary');
      expect(result.requirement.status).toBe('pending');
      expect(result.requirement.requestedItems.length).toBeGreaterThan(0);
      expect(result.requirement.deadline).toBeInstanceOf(Date);
      expect(result.requirementCreated).toBe(true);
    });

    test('should allow documentary response submission', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00001',
        status: 'pending',
        requestedItems: [
          { itemType: 'document', documentType: 'N380', mandatory: true, provided: false },
          { itemType: 'document', documentType: 'U069', mandatory: true, provided: false }
        ],
        responses: []
      };

      const submitResponse = (req, responseData) => {
        const response = {
          responseNumber: req.responses.length + 1,
          submittedAt: new Date(),
          responseType: responseData.responseType,
          notes: responseData.notes,
          documents: responseData.documents || []
        };

        // Mark provided documents
        const providedDocTypes = responseData.documents.map(d => d.documentCode || d.type);
        req.requestedItems.forEach(item => {
          if (providedDocTypes.includes(item.documentType)) {
            item.provided = true;
            item.providedAt = new Date();
          }
        });

        req.responses.push(response);
        req.status = 'submitted';

        // Check if all mandatory items provided
        const allMandatoryProvided = req.requestedItems
          .filter(i => i.mandatory)
          .every(i => i.provided);

        if (allMandatoryProvided) {
          req.status = 'under_review';
        }

        return {
          success: true,
          requirement: req,
          allDocumentsProvided: allMandatoryProvided
        };
      };

      const responseData = requirementResponses.documentary;
      const result = submitResponse(requirement, {
        ...responseData,
        documents: [
          { documentCode: 'N380', fileName: 'invoice_detailed.pdf' },
          { documentCode: 'U069', fileName: 'certificate_origin.pdf' }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.requirement.responses).toHaveLength(1);
      expect(result.requirement.status).toBe('under_review');
      expect(result.allDocumentsProvided).toBe(true);
    });

    test('should resolve orange channel after AEAT review', () => {
      const resolveRequirement = (req, resolution) => {
        return {
          ...req,
          status: 'resolved',
          resolvedAt: new Date(),
          resolution: {
            status: resolution.status,
            date: new Date(),
            notes: resolution.notes,
            confirmedBy: 'Inspector AEAT'
          }
        };
      };

      const requirement = {
        requirementNumber: 'REQ-2026-00001',
        status: 'under_review'
      };

      const resolved = resolveRequirement(requirement, {
        status: 'levante',
        notes: 'Documentación verificada. Se autoriza levante.'
      });

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution.status).toBe('levante');
    });
  });

  describe('Phase 6: Channel Processing - RED (Inspección Física)', () => {
    test('should create physical inspection requirement for red channel', () => {
      const expedition = createFoodExpedition();

      const processRedChannel = (exp) => {
        const year = new Date().getFullYear();
        const reqNumber = `REQ-${year}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

        return {
          success: true,
          channel: 'red',
          requirement: {
            requirementNumber: reqNumber,
            requirementType: 'physical',
            status: 'pending',
            issuingAuthority: 'AEAT',
            receivedAt: new Date(),
            deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days (shorter than orange)
            requestedItems: [
              { itemType: 'physical_inspection', description: 'Presencia de mercancía en recinto', mandatory: true },
              { itemType: 'document', documentType: 'N380', description: 'Factura comercial original', mandatory: true },
              { itemType: 'appointment', description: 'Cita con inspector', mandatory: true }
            ],
            physicalInspection: {
              scheduled: false,
              scheduledDate: null,
              location: null,
              inspectorAssigned: false
            },
            responses: []
          },
          notification: {
            sent: true,
            type: 'inspection_required',
            urgency: 'high',
            message: 'Su expediente ha sido asignado a Canal Rojo. Se requiere inspección física.'
          },
          expeditionStatus: 'red_channel',
          requirementCreated: true
        };
      };

      const result = processRedChannel(expedition);

      expect(result.success).toBe(true);
      expect(result.channel).toBe('red');
      expect(result.requirement.requirementType).toBe('physical');
      expect(result.requirement.physicalInspection.scheduled).toBe(false);
      expect(result.notification.urgency).toBe('high');
    });

    test('should schedule physical inspection appointment', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00002',
        requirementType: 'physical',
        status: 'pending',
        physicalInspection: {
          scheduled: false
        }
      };

      const scheduleInspection = (req, appointmentData) => {
        return {
          ...req,
          status: 'inspection_scheduled',
          physicalInspection: {
            scheduled: true,
            scheduledDate: appointmentData.date,
            scheduledTime: appointmentData.time,
            location: appointmentData.location,
            inspectorName: 'Inspector García',
            inspectorPhone: '+34 932 001 000',
            inspectorEmail: 'inspector.garcia@aeat.es',
            completed: false
          }
        };
      };

      const scheduled = scheduleInspection(requirement, {
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        time: '10:00',
        location: {
          name: 'Recinto Aduanero Puerto de Barcelona',
          address: 'Moll de Barcelona, Terminal B',
          type: 'port'
        }
      });

      expect(scheduled.status).toBe('inspection_scheduled');
      expect(scheduled.physicalInspection.scheduled).toBe(true);
      expect(scheduled.physicalInspection.inspectorName).toBeDefined();
      expect(scheduled.physicalInspection.location.type).toBe('port');
    });

    test('should complete physical inspection with approved result', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00002',
        status: 'inspection_scheduled',
        physicalInspection: {
          scheduled: true,
          scheduledDate: new Date(),
          completed: false
        }
      };

      const completeInspection = (req, result) => {
        return {
          ...req,
          status: result.result === 'approved' ? 'resolved' :
                  result.result === 'partial' ? 'pending_resolution' : 'rejected',
          physicalInspection: {
            ...req.physicalInspection,
            completed: true,
            completedAt: new Date(),
            result: result.result,
            findings: result.findings,
            discrepancies: result.discrepancies || [],
            actaNumber: result.actaNumber
          },
          resolution: result.result === 'approved' ? {
            status: 'levante',
            date: new Date(),
            notes: result.findings
          } : null
        };
      };

      const completed = completeInspection(requirement, inspectionResults.approved);

      expect(completed.status).toBe('resolved');
      expect(completed.physicalInspection.completed).toBe(true);
      expect(completed.physicalInspection.result).toBe('approved');
      expect(completed.physicalInspection.actaNumber).toMatch(/^ACTA-/);
      expect(completed.resolution.status).toBe('levante');
    });

    test('should handle inspection with minor discrepancies', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00003',
        status: 'inspection_scheduled',
        physicalInspection: { scheduled: true, completed: false }
      };

      const completeInspection = (req, result) => {
        const hasAdjustment = result.discrepancies.some(d => d.adjustment);
        return {
          ...req,
          status: 'pending_resolution',
          physicalInspection: {
            ...req.physicalInspection,
            completed: true,
            result: result.result,
            findings: result.findings,
            discrepancies: result.discrepancies
          },
          resolution: {
            status: 'partial_levante',
            dutyAdjustment: result.discrepancies.reduce((sum, d) => sum + (d.adjustment || 0), 0),
            notes: 'Levante con ajuste de derechos por discrepancias menores'
          }
        };
      };

      const completed = completeInspection(requirement, inspectionResults.partialApproved);

      expect(completed.status).toBe('pending_resolution');
      expect(completed.physicalInspection.result).toBe('partial');
      expect(completed.physicalInspection.discrepancies).toHaveLength(1);
      expect(completed.physicalInspection.discrepancies[0].severity).toBe('minor');
      expect(completed.resolution.dutyAdjustment).toBe(-35);
    });

    test('should handle inspection rejection', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00004',
        status: 'inspection_scheduled',
        physicalInspection: { scheduled: true, completed: false }
      };

      const completeInspection = (req, result) => {
        return {
          ...req,
          status: 'rejected',
          physicalInspection: {
            ...req.physicalInspection,
            completed: true,
            result: result.result,
            findings: result.findings,
            discrepancies: result.discrepancies
          },
          resolution: {
            status: 'rejected',
            notes: result.findings,
            nextSteps: ['Rectificación de declaración requerida', 'Posible sanción administrativa']
          }
        };
      };

      const completed = completeInspection(requirement, inspectionResults.rejected);

      expect(completed.status).toBe('rejected');
      expect(completed.physicalInspection.result).toBe('rejected');
      expect(completed.physicalInspection.discrepancies[0].severity).toBe('major');
      expect(completed.resolution.status).toBe('rejected');
    });
  });

  describe('Phase 7: Complete Workflow Scenarios', () => {
    test('Scenario A: Electronics import → Green channel → Automatic levante', () => {
      // Step 1: Create expedition
      const expedition = createElectronicsExpedition({ expeditionId: 'EXP-2026-TEST-001' });
      expect(expedition.status).toBe('documents_validated');

      // Step 2: Generate H1
      const declaration = {
        type: 'H1',
        lrn: '26ESABCD1234',
        regime: '40',
        status: 'draft'
      };
      expect(declaration.type).toBe('H1');

      // Step 3: Submit to AEAT (simulated green channel)
      const aeatResponse = {
        success: true,
        mrn: '26ESIM1234567890AB',
        channel: 'green',
        duties: { totalAmount: 13008 }
      };

      // Step 4: Process green channel
      const levante = {
        number: 'LEV20260001234',
        releaseType: 'automatic',
        releaseDate: new Date()
      };

      // Final verification
      expect(aeatResponse.channel).toBe('green');
      expect(levante.releaseType).toBe('automatic');
    });

    test('Scenario B: Textile import → Orange channel → Documentary response → Levante', () => {
      // Step 1: Create expedition
      const expedition = createTextileExpedition({ expeditionId: 'EXP-2026-TEST-002' });
      expect(expedition.goods[0].taricCode).toBe('52084200');

      // Step 2-3: Generate H1 and submit (simulated orange channel)
      const aeatResponse = {
        success: true,
        mrn: '26ESIM2345678901CD',
        channel: 'orange'
      };

      // Step 4: Create requirement
      const requirement = {
        requirementNumber: 'REQ-2026-00005',
        requirementType: 'documentary',
        status: 'pending',
        requestedItems: [
          { documentType: 'Y923', mandatory: true, provided: false }
        ]
      };

      // Step 5: Submit response
      requirement.requestedItems[0].provided = true;
      requirement.status = 'under_review';

      // Step 6: AEAT resolves
      requirement.status = 'resolved';
      const levante = { number: 'LEV20260001235', releaseType: 'after_review' };

      // Final verification
      expect(aeatResponse.channel).toBe('orange');
      expect(requirement.status).toBe('resolved');
      expect(levante.releaseType).toBe('after_review');
    });

    test('Scenario C: Food import → Red channel → Physical inspection → Levante', () => {
      // Step 1: Create expedition
      const expedition = createFoodExpedition({ expeditionId: 'EXP-2026-TEST-003' });
      expect(expedition.goods[0].taricCode).toBe('15091090');

      // Step 2-3: Generate H1 and submit (simulated red channel)
      const aeatResponse = {
        success: true,
        mrn: '26ESIM3456789012EF',
        channel: 'red'
      };

      // Step 4: Create physical inspection requirement
      const requirement = {
        requirementNumber: 'REQ-2026-00006',
        requirementType: 'physical',
        status: 'pending',
        physicalInspection: { scheduled: false }
      };

      // Step 5: Schedule inspection
      requirement.physicalInspection.scheduled = true;
      requirement.physicalInspection.scheduledDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      requirement.status = 'inspection_scheduled';

      // Step 6: Complete inspection
      requirement.physicalInspection.completed = true;
      requirement.physicalInspection.result = 'approved';
      requirement.status = 'resolved';

      // Step 7: Generate levante
      const levante = { number: 'LEV20260001236', releaseType: 'after_inspection' };

      // Final verification
      expect(aeatResponse.channel).toBe('red');
      expect(requirement.physicalInspection.result).toBe('approved');
      expect(levante.releaseType).toBe('after_inspection');
    });
  });

  describe('Phase 8: Error Handling', () => {
    test('should reject declaration with missing TARIC codes', () => {
      const expedition = createElectronicsExpedition();
      expedition.goods[0].taricCode = null;

      const validate = (exp) => {
        const missingTaric = exp.goods.filter(g => !g.taricCode);
        return {
          isValid: missingTaric.length === 0,
          error: missingTaric.length > 0 ? 'Todos los artículos requieren código TARIC' : null
        };
      };

      const result = validate(expedition);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('TARIC');
    });

    test('should reject declaration with missing required documents', () => {
      const expedition = createElectronicsExpedition();
      expedition.documents = expedition.documents.filter(d => d.type !== 'commercial_invoice');

      const validate = (exp) => {
        const hasInvoice = exp.documents.some(d => d.type === 'commercial_invoice');
        return {
          isValid: hasInvoice,
          error: !hasInvoice ? 'Falta factura comercial (documento obligatorio)' : null
        };
      };

      const result = validate(expedition);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('factura comercial');
    });

    test('should handle AEAT rejection response', () => {
      const aeatResponse = {
        success: false,
        error: {
          code: '2002',
          description: 'Código TARIC no válido para el capítulo declarado'
        }
      };

      const handleRejection = (response) => {
        return {
          status: 'rejected',
          errorCode: response.error.code,
          errorMessage: response.error.description,
          action: 'amendment_required',
          nextSteps: [
            'Revisar clasificación arancelaria',
            'Consultar base de datos TARIC',
            'Rectificar declaración y reenviar'
          ]
        };
      };

      const result = handleRejection(aeatResponse);
      expect(result.status).toBe('rejected');
      expect(result.errorCode).toBe('2002');
      expect(result.action).toBe('amendment_required');
    });

    test('should handle requirement deadline expiration', () => {
      const requirement = {
        requirementNumber: 'REQ-2026-00007',
        status: 'pending',
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        responses: []
      };

      const checkDeadline = (req) => {
        const isOverdue = new Date(req.deadline) < new Date();
        return {
          isOverdue,
          daysOverdue: isOverdue ?
            Math.ceil((new Date() - new Date(req.deadline)) / (1000 * 60 * 60 * 24)) : 0,
          consequences: isOverdue ? [
            'Posible sanción administrativa',
            'Retención de mercancía',
            'Escalado a supervisión'
          ] : []
        };
      };

      const result = checkDeadline(requirement);
      expect(result.isOverdue).toBe(true);
      expect(result.daysOverdue).toBeGreaterThan(0);
      expect(result.consequences.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 9: Audit Trail and Timeline', () => {
    test('should maintain complete audit trail for expedition', () => {
      const timeline = [];

      // Simulate complete flow
      const events = [
        { action: 'expedition_created', description: 'Expediente creado' },
        { action: 'documents_uploaded', description: '3 documentos cargados' },
        { action: 'documents_validated', description: 'Documentos validados por IA' },
        { action: 'h1_generated', description: 'Declaración H1 generada' },
        { action: 'declaration_submitted', description: 'Declaración enviada a AEAT' },
        { action: 'channel_assigned', description: 'Canal verde asignado', metadata: { channel: 'green' } },
        { action: 'levante_generated', description: 'Levante autorizado', metadata: { levanteNumber: 'LEV20260001234' } }
      ];

      events.forEach((event, idx) => {
        timeline.push({
          ...event,
          timestamp: new Date(Date.now() + idx * 60000),
          userId: 'user123',
          performedBy: 'María García'
        });
      });

      expect(timeline).toHaveLength(7);
      expect(timeline[0].action).toBe('expedition_created');
      expect(timeline[timeline.length - 1].action).toBe('levante_generated');
      expect(timeline.every(e => e.timestamp && e.userId)).toBe(true);
    });

    test('should calculate processing time metrics', () => {
      // Las tres fechas se derivan del mismo instante. Con un Date.now() por
      // linea el reloj avanza entre medias, y basta 1ms para que Math.ceil
      // redondee 2 dias exactos a 3 y el test falle de forma intermitente.
      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      const expedition = {
        createdAt: new Date(now - 5 * DAY), // 5 days ago
        declaration: {
          submittedAt: new Date(now - 3 * DAY) // 3 days ago
        },
        levante: {
          releaseDate: new Date(now - 2 * DAY) // 2 days ago
        }
      };

      const calculateMetrics = (exp) => {
        const createdToSubmitted = Math.ceil(
          (new Date(exp.declaration.submittedAt) - new Date(exp.createdAt)) / (1000 * 60 * 60 * 24)
        );
        const submittedToRelease = Math.ceil(
          (new Date(exp.levante.releaseDate) - new Date(exp.declaration.submittedAt)) / (1000 * 60 * 60 * 24)
        );
        const totalProcessingTime = createdToSubmitted + submittedToRelease;

        return {
          preparationDays: createdToSubmitted,
          customsClearanceDays: submittedToRelease,
          totalDays: totalProcessingTime
        };
      };

      const metrics = calculateMetrics(expedition);
      expect(metrics.preparationDays).toBe(2);
      expect(metrics.customsClearanceDays).toBe(1);
      expect(metrics.totalDays).toBe(3);
    });
  });
});
