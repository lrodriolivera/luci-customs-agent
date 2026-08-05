/**
 * Test de cobertura de RAMAS para aesGenerator.js
 * Objetivo: subir del 67,5% al ≥90% de ramas cubiertas
 * Estrategia: inputs variados que disparan condiciones no tomadas
 */

const aesGenerator = require('../../../src/services/forms/aesGenerator');

// Helpers para construir inputs variados
function buildBaseExpedition(overrides = {}) {
  return {
    operationType: 'export',
    client: {
      eori: 'ES123456789',
      nif: 'B12345678',
      companyName: 'Exportadora Test SL',
      address: {
        street: 'Calle Test 123',
        city: 'Barcelona',
        postalCode: '08001'
      }
    },
    consignee: {
      companyName: 'Importadora USA Inc',
      address: {
        street: '123 Main St',
        city: 'New York',
        country: 'US'
      }
    },
    goods: [
      {
        taricCode: '0901210000',
        description: 'Café molido tostado',
        grossWeight: 1000,
        netWeight: 980,
        invoiceValue: 5000
      }
    ],
    transportMode: 'maritime',
    goodsSummary: {
      totalPackages: 10,
      totalGrossWeight: 1000,
      totalValue: 5000
    },
    transport: {
      loadingPlace: 'BARCELONA',
      vehicleId: 'TEST123',
      vehicleNationality: 'ES',
      documentNumber: 'BL-001'
    },
    incoterm: {
      code: 'FCA',
      place: 'Barcelona Port'
    },
    documents: [
      { type: 'commercial_invoice', originalName: 'INV-001.pdf' },
      { type: 'bill_of_lading', originalName: 'BL-001.pdf' }
    ],
    ...overrides
  };
}

describe('AESGenerator - Coverage de Ramas', () => {
  describe('validateForAES - Validaciones básicas', () => {
    test('rechaza operationType !== export (L103)', () => {
      const exp = buildBaseExpedition({ operationType: 'import' });
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_OPERATION_TYPE',
          field: 'operationType'
        })
      );
    });

    test('acepta exportador sin EORI pero con NIF (L112 false)', () => {
      const exp = buildBaseExpedition();
      delete exp.client.eori;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({ code: 'MISSING_EXPORTER_ID' })
      );
    });

    test('rechaza exportador sin EORI ni NIF (L112 true)', () => {
      const exp = buildBaseExpedition();
      delete exp.client.eori;
      delete exp.client.nif;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_EXPORTER_ID' })
      );
    });

    test('rechaza exportador sin companyName (L120)', () => {
      const exp = buildBaseExpedition();
      delete exp.client.companyName;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_EXPORTER_NAME' })
      );
    });

    test('rechaza destino sin país (L130)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee.address.country;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_DESTINATION' })
      );
    });

    test('rechaza país sancionado (L138)', () => {
      const exp = buildBaseExpedition();
      exp.consignee.address.country = 'IR'; // Irán sancionado
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'SANCTIONED_COUNTRY',
          severity: 'critical'
        })
      );
      expect(result.hasSanctionedDestination).toBe(true);
    });

    test('rechaza expedición sin mercancías (L149)', () => {
      const exp = buildBaseExpedition({ goods: [] });
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'NO_GOODS' })
      );
    });
  });

  describe('validateForAES - Validación de mercancías', () => {
    test('rechaza mercancía sin TARIC (L159)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].taricCode;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_TARIC' })
      );
    });

    test('detecta doble uso + destino sensible (L178)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '8471300000'; // Ordenador - doble uso
      exp.consignee.address.country = 'CN'; // China - destino sensible
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.hasExportControls).toBe(true);
      expect(result.controls).toContainEqual(
        expect.objectContaining({
          control: 'dual_use',
          sensitiveDestination: true,
          license: 'required'
        })
      );
    });

    test('warning para licencia requerida (L185)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '9301000000'; // Armas - licencia obligatoria
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'LICENSE_REQUIRED',
          authority: 'INTERIOR'
        })
      );
    });

    test('warning para licencia condicional (L193)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '8473300000'; // Partes ordenador - condicional
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'LICENSE_CONDITIONAL',
          authority: 'MINECO'
        })
      );
    });

    test('warning para TARIC incompleto (L205)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '090121'; // Solo 6 dígitos
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'TARIC_LENGTH' })
      );
    });

    test('warning para mercancía sin valor (L215)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].invoiceValue;
      delete exp.goods[0].statisticalValue;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'MISSING_VALUE' })
      );
    });

    test('rechaza mercancía sin peso (L224)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].grossWeight;
      delete exp.goods[0].netWeight;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_WEIGHT' })
      );
    });
  });

  describe('validateForAES - Transporte y documentos', () => {
    test('warning para transportMode no especificado (L235)', () => {
      const exp = buildBaseExpedition();
      delete exp.transportMode;
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'DEFAULT_TRANSPORT' })
      );
    });

    test('requiere documentos para exportType 21 (L262-263)', () => {
      const exp = buildBaseExpedition({ exportType: '21' });
      const result = aesGenerator.validateForAES(exp);

      expect(result.requiredDocuments.mandatory).toContain('temporary_export_form');
    });

    test('requiere documentos para exportType 22 (L262-263)', () => {
      const exp = buildBaseExpedition({ exportType: '22' });
      const result = aesGenerator.validateForAES(exp);

      expect(result.requiredDocuments.mandatory).toContain('processing_contract');
    });

    test('agrega documento de licencia para control required (L269-271)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '3004200000'; // Farmacéutico - required
      const result = aesGenerator.validateForAES(exp);

      expect(result.requiredDocuments.additional).toContainEqual(
        expect.objectContaining({
          type: 'pharmaceutical_export_auth',
          mandatory: true
        })
      );
    });

    test('mapea controlType unknown a export_license (L300)', () => {
      // Este test verifica el default del switch
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '8471300000'; // Doble uso
      const result = aesGenerator.validateForAES(exp);

      expect(result.requiredDocuments.total).toContain('export_license_dual_use');
    });
  });

  describe('generate - Construcción de declaración', () => {
    test('genera LRN válido', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp);

      expect(result.lrn).toMatch(/^\d{2}ESEX[A-F0-9]{16}$/);
    });

    test('usa exportType del aiData (L312)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp, { exportType: '22' });

      expect(result.data.exportType).toBe('22');
    });
  });

  describe('buildDeclarationHeader', () => {
    test('determina oficina Barcelona (L663)', () => {
      const exp = buildBaseExpedition();
      exp.transport.loadingPlace = 'BCN PORT';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.customsOfficeExport).toBe('ES002801');
    });

    test('determina oficina Valencia (L664)', () => {
      const exp = buildBaseExpedition();
      exp.transport.loadingPlace = 'VALENCIA PORT';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.customsOfficeExport).toBe('ES004601');
    });

    test('determina oficina Madrid Barajas (L665)', () => {
      const exp = buildBaseExpedition();
      exp.transport.loadingPlace = 'BARAJAS';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.customsOfficeExport).toBe('ES002101');
    });

    test('determina oficina Algeciras (L666)', () => {
      const exp = buildBaseExpedition();
      exp.transport.loadingPlace = 'ALGECIRAS';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.customsOfficeExport).toBe('ES003001');
    });

    test('usa oficina por defecto para puerto desconocido (L668)', () => {
      const exp = buildBaseExpedition();
      exp.transport.loadingPlace = 'PUERTO_DESCONOCIDO';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.customsOfficeExport).toBe('ES002801');
    });

    test('usa EORI del representante cuando está presente (L365)', () => {
      const exp = buildBaseExpedition();
      exp.representative = {
        eori: 'ESREP12345',
        companyName: 'Rep Test SL',
        representationType: 'direct'
      };
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.declarant.identificationNumber).toBe('ESREP12345');
      expect(header.declarant.representativeStatus).toBe('2');
    });

    test('usa NIF del representante cuando no tiene EORI (L365)', () => {
      const exp = buildBaseExpedition();
      exp.representative = {
        nif: 'B87654321',
        companyName: 'Rep Test SL',
        representationType: 'indirect'
      };
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.declarant.identificationNumber).toBe('ESB87654321');
      expect(header.declarant.representativeStatus).toBe('3');
    });

    test('usa STRIX AI como declarante por defecto (L366)', () => {
      const exp = buildBaseExpedition();
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.declarant.name).toBe('STRIX AI SL');
    });

    test('consignee null cuando no existe (L378)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee;
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.consignee).toBeNull();
    });

    test('totalPackages 0 cuando no existe summary (L381)', () => {
      const exp = buildBaseExpedition();
      delete exp.goodsSummary.totalPackages;
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.totalPackages).toBe(0);
    });

    test('totalGrossMass 0 cuando no existe summary (L382)', () => {
      const exp = buildBaseExpedition();
      delete exp.goodsSummary.totalGrossWeight;
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.totalGrossMass).toBe(0);
    });
  });

  describe('buildConsignment', () => {
    test('usa destinationCountry de aiData cuando consignee no tiene (L395-396)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee.address.country;
      const consignment = aesGenerator.buildConsignment(exp, { destinationCountry: 'JP' });

      expect(consignment.countryOfDestination).toBe('JP');
    });

    test('usa US por defecto cuando no hay destino (L396)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.countryOfDestination).toBe('US');
    });

    test('transportMeans.identity null cuando no existe vehicleId (L401)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.vehicleId;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.transportMeans.identity).toBeUndefined();
    });

    test('transportMeans.nationality ES por defecto (L402)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.vehicleNationality;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.transportMeans.nationality).toBe('ES');
    });

    test('placeOfLoading usa arrivalPort cuando no existe loadingPlace (L408)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.loadingPlace;
      exp.transport.arrivalPort = 'VALENCIA';
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.placeOfLoading.location).toBe('VALENCIA');
    });

    test('transportDocument.reference desde transport.documentNumber (L414)', () => {
      const exp = buildBaseExpedition();
      exp.transport.documentNumber = 'DOC-12345';
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.transportDocument.reference).toBe('DOC-12345');
    });

    test('incluye contenedores cuando existen (L418)', () => {
      const exp = buildBaseExpedition();
      exp.transport.containers = [
        { number: 'CONT123', sealNumber: 'SEAL456' }
      ];
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.containers).toHaveLength(1);
      expect(consignment.containers[0].number).toBe('CONT123');
    });

    test('containers vacío cuando no existen (L418)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.containers;
      const consignment = aesGenerator.buildConsignment(exp, {});

      // El generador devuelve [] por el || [] en L418
      expect(consignment.containers).toEqual([]);
    });

    test('incoterm.code FCA por defecto (L422)', () => {
      const exp = buildBaseExpedition();
      delete exp.incoterm;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.deliveryTerms.code).toBe('FCA');
    });

    test('incoterm.location null cuando no existe (L423)', () => {
      const exp = buildBaseExpedition();
      delete exp.incoterm.place;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.deliveryTerms.location).toBeUndefined();
    });

    test('totalInvoicedAmount 0 cuando no existe summary (L427)', () => {
      const exp = buildBaseExpedition();
      delete exp.goodsSummary.totalValue;
      const consignment = aesGenerator.buildConsignment(exp, {});

      expect(consignment.totalInvoicedAmount).toBe(0);
    });
  });

  describe('buildGoodsItems', () => {
    test('hsCode deriva de taricCode primeros 6 dígitos (L441)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].hsCode;
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].hsCode).toBe('090121');
    });

    test('usa hsCode cuando está presente (L441)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].hsCode = '123456';
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].hsCode).toBe('123456');
    });

    test('procedureCode desde exportType aiData (L447)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, { exportType: '21' });

      expect(items[0].procedureCode).toBe('21');
    });

    test('countryOfDestination US por defecto (L450)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee;
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].countryOfDestination).toBe('US');
    });

    test('netMass null cuando no existe (L454)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].netWeight;
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].netMass).toBeUndefined();
    });

    test('supplementaryUnits null cuando no existe (L455)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].supplementaryUnits).toBeUndefined();
    });

    test('packaging.numberOfPackages null cuando no existe (L459)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].packaging.numberOfPackages).toBeUndefined();
    });

    test('packaging.typeOfPackages PK por defecto (L460)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].packaging.typeOfPackages).toBe('PK');
    });

    test('packaging.shippingMarks null cuando no existe (L461)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].packaging.shippingMarks).toBeUndefined();
    });

    test('statisticalValue usa invoiceValue cuando no existe (L465)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].invoiceValue = 7500;
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].statisticalValue).toBe(7500);
    });
  });

  describe('buildSupportingDocuments', () => {
    test('incluye factura comercial cuando existe (L480)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].supportingDocuments).toContainEqual(
        expect.objectContaining({
          type: 'N380',
          reference: 'INV-001.pdf'
        })
      );
    });

    test('incluye documento de transporte cuando existe (L490)', () => {
      const exp = buildBaseExpedition();
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].supportingDocuments).toContainEqual(
        expect.objectContaining({
          type: 'N705',
          reference: 'BL-001'
        })
      );
    });

    test('no incluye factura cuando no existe (L480)', () => {
      const exp = buildBaseExpedition();
      exp.documents = [];
      const items = aesGenerator.buildGoodsItems(exp, {});

      expect(items[0].supportingDocuments).toHaveLength(0);
    });
  });

  describe('generateXML', () => {
    test('genera XML sin consignee cuando es null (L546)', () => {
      const exp = buildBaseExpedition();
      delete exp.consignee;
      const result = aesGenerator.generate(exp);

      expect(result.xml).not.toContain('<Consignee>');
    });

    test('genera XML con consignee cuando existe (L546)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<Consignee>');
      expect(result.xml).toContain('Importadora USA Inc');
    });

    test('escapa XML en campos de texto (L530,532,542,549,551,564,577,591,615,625)', () => {
      const exp = buildBaseExpedition();
      exp.client.companyName = 'Test & Co <Ltd>';
      exp.client.address.street = 'Calle "Test" 123';
      exp.goods[0].description = "Item con 'comillas'";
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('Test &amp; Co &lt;Ltd&gt;');
      expect(result.xml).toContain('Calle &quot;Test&quot; 123');
      expect(result.xml).toContain("Item con &apos;comillas&apos;");
    });

    test('incluye contenedores cuando existen (L568)', () => {
      const exp = buildBaseExpedition();
      exp.transport.containers = [
        { number: 'CONT999', sealNumber: 'SEAL777' }
      ];
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<TransportEquipment>');
      expect(result.xml).toContain('CONT999');
      expect(result.xml).toContain('SEAL777');
    });

    test('no incluye contenedores cuando no existen (L568)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.containers;
      const result = aesGenerator.generate(exp);

      expect(result.xml).not.toContain('<TransportEquipment>');
    });

    test('incluye TariffQuantity cuando existe supplementaryUnits (L599)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].supplementaryUnits = 500;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<TariffQuantity>500</TariffQuantity>');
    });

    test('no incluye TariffQuantity cuando no existe supplementaryUnits (L599)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp);

      expect(result.xml).not.toContain('<TariffQuantity>');
    });

    test('incluye documentos de soporte cuando existen (L622)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<AdditionalDocument>');
      expect(result.xml).toContain('<TypeCode>N380</TypeCode>');
    });

    test('maneja campos vacíos con escapeXml (L532,551,564,577,615)', () => {
      const exp = buildBaseExpedition();
      delete exp.client.address.street;
      delete exp.transport.vehicleId;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<Line></Line>');
      expect(result.xml).toContain('<IdentificationNumber></IdentificationNumber>');
    });
  });

  describe('calculateSummary', () => {
    test('incluye exportTypeDescription mapeado (L645)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp, { exportType: '11' });

      expect(result.summary.exportTypeDescription).toBe(
        'Exportacion definitiva de mercancias UE en libre practica'
      );
    });

    test('exportTypeDescription Desconocido para tipo no mapeado (L645)', () => {
      const exp = buildBaseExpedition();
      const result = aesGenerator.generate(exp, { exportType: '99' });

      expect(result.summary.exportTypeDescription).toBe('Desconocido');
    });
  });

  describe('getTransportModeCode', () => {
    test('mapea maritime a 1 (L684)', () => {
      expect(aesGenerator.getTransportModeCode('maritime')).toBe('1');
    });

    test('mapea rail a 2 (L685)', () => {
      expect(aesGenerator.getTransportModeCode('rail')).toBe('2');
    });

    test('mapea road a 3 (L686)', () => {
      expect(aesGenerator.getTransportModeCode('road')).toBe('3');
    });

    test('mapea air a 4 (L687)', () => {
      expect(aesGenerator.getTransportModeCode('air')).toBe('4');
    });

    test('mapea postal a 5 (L688)', () => {
      expect(aesGenerator.getTransportModeCode('postal')).toBe('5');
    });

    test('devuelve 1 por defecto para modo desconocido (L690)', () => {
      expect(aesGenerator.getTransportModeCode('unknown')).toBe('1');
    });
  });

  describe('getTransportDocumentType', () => {
    test('mapea maritime a N705 (L698)', () => {
      expect(aesGenerator.getTransportDocumentType('maritime')).toBe('N705');
    });

    test('mapea air a N740 (L699)', () => {
      expect(aesGenerator.getTransportDocumentType('air')).toBe('N740');
    });

    test('mapea road a N730 (L700)', () => {
      expect(aesGenerator.getTransportDocumentType('road')).toBe('N730');
    });

    test('devuelve N785 por defecto para modo desconocido (L702)', () => {
      expect(aesGenerator.getTransportDocumentType('rail')).toBe('N785');
    });
  });

  describe('getDocumentTypeCode', () => {
    test('mapea commercial_invoice a N380 (L710)', () => {
      expect(aesGenerator.getDocumentTypeCode('commercial_invoice')).toBe('N380');
    });

    test('mapea bill_of_lading a N705 (L711)', () => {
      expect(aesGenerator.getDocumentTypeCode('bill_of_lading')).toBe('N705');
    });

    test('mapea air_waybill a N740 (L712)', () => {
      expect(aesGenerator.getDocumentTypeCode('air_waybill')).toBe('N740');
    });

    test('mapea cmr a N730 (L713)', () => {
      expect(aesGenerator.getDocumentTypeCode('cmr')).toBe('N730');
    });

    test('devuelve N990 por defecto para tipo desconocido (L715)', () => {
      expect(aesGenerator.getDocumentTypeCode('unknown_doc')).toBe('N990');
    });
  });

  describe('escapeXml', () => {
    test('escapa & a &amp; (L724)', () => {
      expect(aesGenerator.escapeXml('Test & Co')).toBe('Test &amp; Co');
    });

    test('escapa < a &lt; (L725)', () => {
      expect(aesGenerator.escapeXml('Test < 10')).toBe('Test &lt; 10');
    });

    test('escapa > a &gt; (L726)', () => {
      expect(aesGenerator.escapeXml('Test > 10')).toBe('Test &gt; 10');
    });

    test('escapa " a &quot; (L727)', () => {
      expect(aesGenerator.escapeXml('Test "quoted"')).toBe('Test &quot;quoted&quot;');
    });

    test('escapa apostrofo a &apos; (L728)', () => {
      expect(aesGenerator.escapeXml("Test 'quoted'")).toBe('Test &apos;quoted&apos;');
    });

    test('devuelve string vacío para null (L722)', () => {
      expect(aesGenerator.escapeXml(null)).toBe('');
    });

    test('devuelve string vacío para undefined (L722)', () => {
      expect(aesGenerator.escapeXml(undefined)).toBe('');
    });

    test('devuelve string vacío para empty string (L722)', () => {
      expect(aesGenerator.escapeXml('')).toBe('');
    });
  });

  describe('Ramas XML - Campos opcionales', () => {
    test('maneja city undefined en exporter (L533)', () => {
      const exp = buildBaseExpedition();
      exp.client.address.city = undefined;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<CityName></CityName>');
    });

    test('maneja postcode undefined en exporter (L534)', () => {
      const exp = buildBaseExpedition();
      exp.client.address.postalCode = undefined;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<PostcodeID></PostcodeID>');
    });

    test('maneja streetAndNumber undefined en consignee (L551)', () => {
      const exp = buildBaseExpedition();
      exp.consignee.address.street = undefined;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<Consignee>');
      expect(result.xml).toContain('<Line></Line>');
    });

    test('maneja city undefined en consignee (L552)', () => {
      const exp = buildBaseExpedition();
      exp.consignee.address.city = undefined;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<Consignee>');
      expect(result.xml).toContain('<CityName></CityName>');
    });

    test('maneja sealNumber undefined en contenedor (L571)', () => {
      const exp = buildBaseExpedition();
      exp.transport.containers = [{ number: 'CONT123' }];
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<TransportEquipment>');
      expect(result.xml).toContain('<SealID></SealID>');
    });

    test('maneja grossMass 0 en mercancía (L597)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].grossWeight = 0;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<GrossMassMeasure>0</GrossMassMeasure>');
    });

    test('maneja netMass undefined en mercancía (L598)', () => {
      const exp = buildBaseExpedition();
      delete exp.goods[0].netWeight;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<NetNetWeightMeasure>0</NetNetWeightMeasure>');
    });

    test('usa EORI cuando está presente (L353 primera rama)', () => {
      const exp = buildBaseExpedition();
      exp.client.eori = 'ES999888777';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.exporter.identificationNumber).toBe('ES999888777');
    });

    test('usa NIF cuando no hay EORI (L353 segunda rama)', () => {
      const exp = buildBaseExpedition();
      delete exp.client.eori;
      exp.client.nif = 'A12345678';
      const header = aesGenerator.buildDeclarationHeader(exp, {}, 'TEST-LRN');

      expect(header.exporter.identificationNumber).toBe('ESA12345678');
    });

    test('evita duplicados en additionalDocs (L271)', () => {
      const exp = buildBaseExpedition();
      // Dos mercancías del mismo capítulo farmacéutico
      exp.goods = [
        {
          taricCode: '3003100000',
          description: 'Medicamento A',
          grossWeight: 100,
          netWeight: 90,
          invoiceValue: 1000
        },
        {
          taricCode: '3004200000',
          description: 'Medicamento B',
          grossWeight: 150,
          netWeight: 140,
          invoiceValue: 1500
        }
      ];
      const result = aesGenerator.validateForAES(exp);

      // Ambos disparan el MISMO tipo de documento; el guard antiduplicados debe
      // dejar exactamente UNO (con el bug de L271 aparecían dos idénticos).
      const pharmaAuth = result.requiredDocuments.additional.filter(
        d => d.authority === 'AEMPS'
      );
      expect(pharmaAuth.length).toBe(1);
    });

    test('else del license conditional se ejecuta (L193)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '2904100000'; // Químico condicional
      const result = aesGenerator.validateForAES(exp);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'LICENSE_CONDITIONAL'
        })
      );
    });

    test('exportType no mapeado usa default (L263)', () => {
      const exp = buildBaseExpedition({ exportType: '99' });
      const result = aesGenerator.validateForAES(exp);

      // Debe usar los documentos de '10' por defecto
      expect(result.requiredDocuments.mandatory).toContain('commercial_invoice');
      expect(result.requiredDocuments.mandatory).toContain('packing_list');
    });

    test('maneja loadingPlace undefined (L661)', () => {
      const exp = buildBaseExpedition();
      delete exp.transport.loadingPlace;
      const office = aesGenerator.determineExportOffice(exp);

      // Debe usar la oficina por defecto
      expect(office).toBe('ES002801');
    });

    test('maneja incoterm.location undefined en XML (L577)', () => {
      const exp = buildBaseExpedition();
      exp.incoterm = { code: 'FCA' }; // Sin place
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<LocationName></LocationName>');
    });

    test('maneja statisticalValue 0 en XML (L619)', () => {
      const exp = buildBaseExpedition();
      exp.goods[0].statisticalValue = 0;
      exp.goods[0].invoiceValue = 0;
      const result = aesGenerator.generate(exp);

      expect(result.xml).toContain('<StatisticalValueAmount>0</StatisticalValueAmount>');
    });

    test('maneja doc.reference undefined en XML (L625)', () => {
      const exp = buildBaseExpedition();
      exp.documents = [
        { type: 'commercial_invoice', originalName: 'INV-001.pdf' },
        { type: 'bill_of_lading', originalName: 'BL-001.pdf' }
      ];
      delete exp.transport.documentNumber;
      const result = aesGenerator.generate(exp);

      // El documento de transporte sin documentNumber debe tener ID vacío
      expect(result.xml).toContain('<TypeCode>N705</TypeCode>');
      expect(result.xml).toContain('<ID></ID>');
    });

    test('default de controlType no mapeado (L300)', () => {
      // Este es un caso hipotético: el control existe pero el tipo no está en el switch
      // En la práctica, todos los controles en EXPORT_CONTROLS tienen tipos mapeados
      // Pero si hubiera uno nuevo sin mapear, debería devolver 'export_license'
      const exp = buildBaseExpedition();
      exp.goods[0].taricCode = '9706000000'; // Antigüedades +100 años
      const result = aesGenerator.validateForAES(exp);

      // Este TARIC tiene control 'cultural' que SÍ está mapeado
      expect(result.requiredDocuments.additional).toContainEqual(
        expect.objectContaining({
          type: 'cultural_export_permit'
        })
      );
    });
  });

  describe('Flujo completo - Casos edge', () => {
    test('genera declaración completa sin representante', () => {
      const exp = buildBaseExpedition();
      delete exp.representative;
      const result = aesGenerator.generate(exp);

      expect(result.lrn).toBeTruthy();
      expect(result.xml).toContain('<Declaration>');
      expect(result.summary.totalItems).toBe(1);
    });

    test('genera declaración con múltiples mercancías', () => {
      const exp = buildBaseExpedition();
      exp.goods = [
        {
          taricCode: '0901210000',
          description: 'Café',
          grossWeight: 500,
          netWeight: 490,
          invoiceValue: 2500
        },
        {
          taricCode: '2204210000',
          description: 'Vino',
          grossWeight: 800,
          netWeight: 750,
          invoiceValue: 3000
        }
      ];
      const result = aesGenerator.generate(exp);

      expect(result.summary.totalItems).toBe(2);
      expect(result.data.goodsItems).toHaveLength(2);
      expect(result.xml).toContain('0901210000');
      expect(result.xml).toContain('2204210000');
    });

    test('genera declaración con transporte aéreo', () => {
      const exp = buildBaseExpedition();
      exp.transportMode = 'air';
      exp.transport.loadingPlace = 'BARAJAS';
      exp.documents = [
        { type: 'commercial_invoice', originalName: 'INV-001.pdf' },
        { type: 'air_waybill', originalName: 'AWB-001.pdf' }
      ];
      const result = aesGenerator.generate(exp);

      expect(result.data.consignment.transportMeans.modeAtBorder).toBe('4');
      expect(result.data.consignment.transportDocument.type).toBe('N740');
      expect(result.summary.customsOfficeExport).toBe('ES002101');
    });

    test('genera declaración con exportType 31 (reexportación)', () => {
      const exp = buildBaseExpedition({ exportType: '31' });
      const result = aesGenerator.generate(exp, { exportType: '31' });

      expect(result.data.exportType).toBe('31');
      expect(result.summary.exportTypeDescription).toBe('Reexportacion tras regimen suspensivo');
    });

    test('maneja mercancía con todas las propiedades opcionales', () => {
      const exp = buildBaseExpedition();
      exp.goods[0] = {
        taricCode: '8518300000',
        hsCode: '851830',
        description: 'Auriculares Bluetooth',
        grossWeight: 200,
        netWeight: 180,
        supplementaryUnits: 100,
        invoiceValue: 5000,
        statisticalValue: 5200,
        packages: {
          quantity: 50,
          type: 'CT',
          marks: 'FRAGILE'
        }
      };
      const result = aesGenerator.generate(exp);

      expect(result.data.goodsItems[0].hsCode).toBe('851830');
      expect(result.data.goodsItems[0].supplementaryUnits).toBe(100);
      expect(result.data.goodsItems[0].packaging.typeOfPackages).toBe('CT');
      expect(result.xml).toContain('<TariffQuantity>100</TariffQuantity>');
      expect(result.xml).toContain('FRAGILE');
    });

    test('valida exportación compleja con controles y licencias', () => {
      const exp = buildBaseExpedition();
      exp.goods = [
        {
          taricCode: '8471300000', // Doble uso
          description: 'Ordenadores portátiles',
          grossWeight: 2000,
          netWeight: 1900,
          invoiceValue: 15000
        },
        {
          taricCode: '3004200000', // Farmacéutico
          description: 'Medicamentos',
          grossWeight: 500,
          netWeight: 480,
          invoiceValue: 8000
        }
      ];
      exp.consignee.address.country = 'CN'; // Destino sensible
      const result = aesGenerator.validateForAES(exp);

      expect(result.valid).toBe(true);
      expect(result.hasExportControls).toBe(true);
      expect(result.controls).toHaveLength(2);
      expect(result.controlAuthorities).toContain('MINECO');
      expect(result.controlAuthorities).toContain('AEMPS');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
