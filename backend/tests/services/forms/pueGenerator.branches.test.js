/**
 * pueGenerator.branches: cobertura de ramas pendientes (84.04% → ≥90%).
 *
 * Fichero enfocado en disparar las ramas NO tomadas en las líneas identificadas:
 * 42,49,52,55,58,61,75,80-87,97-101,109,112,158-164,219,229,239,248-251,266,275-293,
 * 306,316,322-371,376,380,385,389-478,485-488,501,513-525,540,546,549,558,569,575,578.
 *
 * ESTRATEGIA:
 * - Campos opcionales presentes/ausentes (address, party, manufacturer, certifications)
 * - Subtipos de COM no cubiertos (COM_EXPLOSIVOS, COM_GAS, COM_GENERAL)
 * - Diferentes modalidades de transporte
 * - Certificaciones sin notified body, sin fecha expiración
 * - Datos complementarios con todos los bloques opcionales
 * - Goods items sin campos opcionales
 * - ROHS sin hazardousComponents, sin registrationNumber
 * - ECO sin certificados, origen con/sin autorizacion
 * - CAL sin productCategory
 * - Transport con cada campo opcional individualmente
 */

const pue = require('../../../src/services/forms/pueGenerator');

describe('pueGenerator.branches: ramas pendientes', () => {
  // Helper para crear solicitud base
  const base = (pueType, overrides = {}) => ({
    pueType,
    reference: 'PUE-TEST-001',
    operator: { name: 'Test Operator SL', nif: 'B12345678', eori: 'ESB12345678' },
    goods: [{ taricCode: '8471300000', description: 'Test goods', quantity: 1, netMass: 10 }],
    ...overrides
  });

  describe('Línea 75: pueSubtype opcional presente/ausente', () => {
    test('genera con pueSubtype presente', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_JUGUETES' }));
      expect(xml).toMatch(/<pue:PUESubtype>COM_JUGUETES<\/pue:PUESubtype>/);
    });

    test('genera sin pueSubtype (rama ausente)', () => {
      const xml = pue.generate(base('ROHS'));
      expect(xml).not.toMatch(/<pue:PUESubtype>/);
    });
  });

  describe('Líneas 80-87: declarationMRN, ensReference, importer, manufacturer, representative opcionales', () => {
    test('con declarationMRN presente', () => {
      const xml = pue.generate(base('CAL', { declarationMRN: '26ES00281234567890' }));
      expect(xml).toMatch(/<pue:DeclarationMRN>26ES00281234567890<\/pue:DeclarationMRN>/);
    });

    test('sin declarationMRN (rama else)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).not.toMatch(/<pue:DeclarationMRN>/);
    });

    test('con ensReference presente', () => {
      const xml = pue.generate(base('CAL', { ensReference: 'ENS-2026-001' }));
      expect(xml).toMatch(/<pue:ENSReference>ENS-2026-001<\/pue:ENSReference>/);
    });

    test('sin ensReference (rama else)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).not.toMatch(/<pue:ENSReference>/);
    });

    test('con importer presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer Co', eori: 'ESB99999999' }
      }));
      expect(xml).toMatch(/Importer Co/);
    });

    test('sin importer (rama else)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).not.toMatch(/<pue:Importer>/);
    });

    test('con manufacturer presente', () => {
      const xml = pue.generate(base('CAL', {
        manufacturer: { name: 'Manufacturer Inc', eori: 'CN12345' }
      }));
      expect(xml).toMatch(/Manufacturer Inc/);
    });

    test('sin manufacturer (rama else)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).not.toMatch(/<pue:Manufacturer>/);
    });

    test('con representative presente', () => {
      const xml = pue.generate(base('CAL', {
        representative: { name: 'Representative SA', eori: 'ESB88888888' }
      }));
      expect(xml).toMatch(/Representative SA/);
    });

    test('sin representative (rama else)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).not.toMatch(/<pue:Representative>/);
    });
  });

  describe('Líneas 97-101: totals opcionales (items, grossMass, netMass, packages, statisticalValue)', () => {
    test('totals.items presente', () => {
      const xml = pue.generate(base('CAL', {
        totals: { items: 5, grossMass: 100, netMass: 90, packages: 10 }
      }));
      expect(xml).toMatch(/<pue:TotalItems>5<\/pue:TotalItems>/);
    });

    test('totals.items ausente - fallback a goods.length', () => {
      const xml = pue.generate(base('CAL', {
        goods: [
          { taricCode: '6109100010', description: 'Item 1', quantity: 1, netMass: 5 },
          { taricCode: '6109100010', description: 'Item 2', quantity: 1, netMass: 5 }
        ]
      }));
      expect(xml).toMatch(/<pue:TotalItems>2<\/pue:TotalItems>/);
    });

    test('totals.statisticalValue presente', () => {
      const xml = pue.generate(base('CAL', {
        totals: { items: 1, grossMass: 10, netMass: 9, packages: 1, statisticalValue: 5000 }
      }));
      expect(xml).toMatch(/<pue:TotalStatisticalValue currency="EUR">5000<\/pue:TotalStatisticalValue>/);
    });

    test('totals.statisticalValue ausente (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        totals: { items: 1, grossMass: 10, netMass: 9, packages: 1 }
      }));
      expect(xml).not.toMatch(/<pue:TotalStatisticalValue/);
    });
  });

  describe('Línea 109: attachedDocuments array vacío vs con contenido', () => {
    test('sin attachedDocuments (rama vacía)', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).toMatch(/<pue:Documents>\s*<\/pue:Documents>/);
    });

    test('con attachedDocuments (rama map)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [
          { type: 'invoice', name: 'Invoice 001', documentNumber: 'INV-001' }
        ]
      }));
      expect(xml).toMatch(/<pue:Type>invoice<\/pue:Type>/);
    });
  });

  describe('Línea 112: priority con valor vs fallback default', () => {
    test('priority presente con valor explícito', () => {
      const xml = pue.generate(base('CAL', { priority: 'urgent' }));
      expect(xml).toMatch(/<pue:Priority>urgent<\/pue:Priority>/);
    });

    test('priority ausente - fallback a normal', () => {
      const xml = pue.generate(base('CAL'));
      expect(xml).toMatch(/<pue:Priority>normal<\/pue:Priority>/);
    });
  });

  describe('Líneas 158-164: generateComplementaryData - documents, certifications, notes opcionales', () => {
    test('data.documents presente', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {
        documents: [{ type: 'certificate', name: 'Cert 1', documentNumber: 'CERT-001' }]
      });
      expect(xml).toMatch(/<pue:AdditionalDocuments>/);
      expect(xml).toMatch(/CERT-001/);
    });

    test('data.documents ausente (rama else)', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {
        certifications: [{ type: 'CE', number: 'CE-001' }]
      });
      expect(xml).not.toMatch(/<pue:AdditionalDocuments>/);
    });

    test('data.certifications presente', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {
        certifications: [{ type: 'CE', number: 'CE-002', issuer: 'Body 1234' }]
      });
      expect(xml).toMatch(/<pue:AdditionalCertifications>/);
      expect(xml).toMatch(/CE-002/);
    });

    test('data.certifications ausente (rama else)', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {
        documents: [{ type: 'invoice' }]
      });
      expect(xml).not.toMatch(/<pue:AdditionalCertifications>/);
    });

    test('data.notes presente', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {
        notes: 'Información adicional requerida'
      });
      expect(xml).toMatch(/<pue:Notes>Información adicional requerida<\/pue:Notes>/);
    });

    test('data.notes ausente (rama else)', () => {
      const xml = pue.generateComplementaryData('PUE-REF-001', {});
      expect(xml).not.toMatch(/<pue:Notes>/);
    });
  });

  describe('Línea 219: manufacturer.registrationNumber en ROHS', () => {
    test('con registrationNumber presente', () => {
      const xml = pue.generate(base('ROHS', {
        manufacturer: { name: 'Fab Inc', registrationNumber: 'PROD-REG-123' }
      }));
      expect(xml).toMatch(/<pue:ProducerRegistrationNumber>PROD-REG-123<\/pue:ProducerRegistrationNumber>/);
    });

    test('sin registrationNumber (rama else)', () => {
      const xml = pue.generate(base('ROHS', {
        manufacturer: { name: 'Fab Inc' }
      }));
      expect(xml).not.toMatch(/<pue:ProducerRegistrationNumber>/);
    });

    test('sin manufacturer en ROHS', () => {
      const xml = pue.generate(base('ROHS'));
      expect(xml).not.toMatch(/<pue:ProducerRegistrationNumber>/);
    });
  });

  describe('Línea 239: COM - goods con certificación CE que tiene notified body', () => {
    test('certificación CE sin notified body en issuer - genera tag vacío', () => {
      const xml = pue.generate(base('COM', {
        pueSubtype: 'COM_JUGUETES',
        goods: [{
          taricCode: '9503000000',
          description: 'Toy',
          certifications: [{ type: 'CE', number: 'CE-001', issuer: 'Generic Body' }]
        }]
      }));
      // BUG POTENCIAL (línea 238-239): Si hay certificación CE pero _getCENotifiedBody
      // retorna vacío, el tag <pue:NotifiedBodyNumber> se genera vacío en lugar de omitirse.
      // Esto puede ser válido según el esquema AEAT, pero es inconsistente con el patrón
      // usado en otros campos opcionales (que omiten el tag cuando el valor está ausente).
      expect(xml).toMatch(/<pue:NotifiedBodyNumber><\/pue:NotifiedBodyNumber>/);
    });

    test('certificación CE con notified body en issuer', () => {
      const xml = pue.generate(base('COM', {
        pueSubtype: 'COM_JUGUETES',
        goods: [{
          taricCode: '9503000000',
          description: 'Toy',
          certifications: [{ type: 'CE', number: 'CE-002', issuer: 'Notified Body 2345' }]
        }]
      }));
      expect(xml).toMatch(/<pue:NotifiedBodyNumber>2345<\/pue:NotifiedBodyNumber>/);
    });

    test('goods sin certificación CE', () => {
      const xml = pue.generate(base('COM', {
        pueSubtype: 'COM_JUGUETES',
        goods: [{
          taricCode: '9503000000',
          description: 'Toy'
        }]
      }));
      expect(xml).not.toMatch(/<pue:NotifiedBodyNumber>/);
    });
  });

  describe('Líneas 248-251: COM - subtipos específicos y sus ramas de seguridad', () => {
    test('COM_JUGUETES - ToysSafetyCompliant', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_JUGUETES' }));
      expect(xml).toMatch(/<pue:ToysSafetyCompliant>true<\/pue:ToysSafetyCompliant>/);
    });

    test('COM_EPI - PPECategoryCompliant', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_EPI' }));
      expect(xml).toMatch(/<pue:PPECategoryCompliant>true<\/pue:PPECategoryCompliant>/);
    });

    test('COM_MATERIAL_ELECTRICO - LVDCompliant', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_MATERIAL_ELECTRICO' }));
      expect(xml).toMatch(/<pue:LVDCompliant>true<\/pue:LVDCompliant>/);
    });

    test('COM_MAQUINARIA - MachineryDirectiveCompliant', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_MAQUINARIA' }));
      expect(xml).toMatch(/<pue:MachineryDirectiveCompliant>true<\/pue:MachineryDirectiveCompliant>/);
    });

    test('COM_EXPLOSIVOS - sin rama específica, solo directiva', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_EXPLOSIVOS' }));
      expect(xml).toMatch(/2014\/28\/EU/);
      expect(xml).not.toMatch(/ToysSafetyCompliant/);
    });

    test('COM_GAS - sin rama específica, solo directiva', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_GAS' }));
      expect(xml).toMatch(/2016\/426\/EU/);
      expect(xml).not.toMatch(/ToysSafetyCompliant/);
    });

    test('COM_GENERAL - sin rama específica, directiva general', () => {
      const xml = pue.generate(base('COM', { pueSubtype: 'COM_GENERAL' }));
      expect(xml).toMatch(/2001\/95\/EC/);
      expect(xml).not.toMatch(/ToysSafetyCompliant/);
    });
  });

  describe('Líneas 275-293: ECO - certificaciones con/sin fechas, autorizacion', () => {
    test('certificación ECO con expiryDate', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{
          taricCode: '0805100000',
          description: 'Oranges',
          countryOfOrigin: 'ES',
          certifications: [{
            type: 'ECO',
            number: 'ECO-001',
            issuer: 'ES-ECO-001',
            issuedAt: '2026-01-01',
            expiresAt: '2027-01-01'
          }]
        }]
      }));
      expect(xml).toMatch(/<pue:ExpiryDate>2027-01-01<\/pue:ExpiryDate>/);
    });

    test('certificación ECO sin expiryDate (rama else línea 280)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{
          taricCode: '0805100000',
          description: 'Oranges',
          countryOfOrigin: 'ES',
          certifications: [{
            type: 'ECO',
            number: 'ECO-002',
            issuer: 'ES-ECO-002',
            issuedAt: '2026-01-01'
          }]
        }]
      }));
      expect(xml).not.toMatch(/<pue:ExpiryDate>/);
    });

    test('ECO con ecoAuthorization presente (línea 293)', () => {
      const xml = pue.generate(base('ECO', {
        ecoAuthorization: 'AUTH-ECO-2026-001',
        goods: [{
          taricCode: '0805100000',
          description: 'Oranges',
          countryOfOrigin: 'CN'
        }]
      }));
      expect(xml).toMatch(/<pue:Number>AUTH-ECO-2026-001<\/pue:Number>/);
    });

    test('ECO sin ecoAuthorization (rama else)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{
          taricCode: '0805100000',
          description: 'Oranges',
          countryOfOrigin: 'CN'
        }]
      }));
      expect(xml).not.toMatch(/<pue:ImportAuthorization>\s*<pue:Number>/);
    });

    test('ECO origen país equivalente UE (línea 569 - AR en lista)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{ taricCode: '0805100000', description: 'Oranges', countryOfOrigin: 'AR' }]
      }));
      expect(xml).toMatch(/<pue:Required>false<\/pue:Required>/);
    });

    test('ECO origen país NO equivalente (línea 569 - CN fuera lista)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{ taricCode: '0805100000', description: 'Oranges', countryOfOrigin: 'CN' }]
      }));
      expect(xml).toMatch(/<pue:Required>true<\/pue:Required>/);
    });

    test('ECO origen país con prefijo EU (línea 569)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{ taricCode: '0805100000', description: 'Oranges', countryOfOrigin: 'EUXX' }]
      }));
      expect(xml).toMatch(/<pue:Required>false<\/pue:Required>/);
    });
  });

  describe('Líneas 322-371: CAL subtipos y _buildAddress campos opcionales', () => {
    test('CAL_TEXTIL - CareInstructions true', () => {
      const xml = pue.generate(base('CAL', { pueSubtype: 'CAL_TEXTIL' }));
      expect(xml).toMatch(/<pue:CareInstructions>true<\/pue:CareInstructions>/);
      expect(xml).toMatch(/<pue:TextileStandard>EN 13402<\/pue:TextileStandard>/);
    });

    test('CAL_CALZADO - CareInstructions true', () => {
      const xml = pue.generate(base('CAL', { pueSubtype: 'CAL_CALZADO' }));
      expect(xml).toMatch(/<pue:CareInstructions>true<\/pue:CareInstructions>/);
      expect(xml).toMatch(/<pue:FootwearStandard>EN ISO 18454<\/pue:FootwearStandard>/);
    });

    test('CAL_CERAMICA - CareInstructions false', () => {
      const xml = pue.generate(base('CAL', { pueSubtype: 'CAL_CERAMICA' }));
      expect(xml).toMatch(/<pue:CareInstructions>false<\/pue:CareInstructions>/);
      expect(xml).toMatch(/<pue:CeramicStandard>EN 14411<\/pue:CeramicStandard>/);
    });

    test('CAL_VIDRIO - CareInstructions false', () => {
      const xml = pue.generate(base('CAL', { pueSubtype: 'CAL_VIDRIO' }));
      expect(xml).toMatch(/<pue:CareInstructions>false<\/pue:CareInstructions>/);
      expect(xml).toMatch(/<pue:GlassStandard>EN 12150<\/pue:GlassStandard>/);
    });

    test('CAL_MUEBLES - CareInstructions false', () => {
      const xml = pue.generate(base('CAL', { pueSubtype: 'CAL_MUEBLES' }));
      expect(xml).toMatch(/<pue:CareInstructions>false<\/pue:CareInstructions>/);
      expect(xml).toMatch(/<pue:FurnitureStandard>EN 527<\/pue:FurnitureStandard>/);
    });

    test('_buildAddress con streetAndNumber presente (línea 367)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { streetAndNumber: 'Calle Test 123' }
        }
      }));
      expect(xml).toMatch(/<pue:Street>Calle Test 123<\/pue:Street>/);
    });

    test('_buildAddress sin streetAndNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { city: 'Madrid' }
        }
      }));
      expect(xml).not.toMatch(/<pue:Street>/);
    });

    test('_buildAddress con city presente (línea 368)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { city: 'Madrid' }
        }
      }));
      expect(xml).toMatch(/<pue:City>Madrid<\/pue:City>/);
    });

    test('_buildAddress con postalCode presente (línea 369)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { postalCode: '28001' }
        }
      }));
      expect(xml).toMatch(/<pue:PostalCode>28001<\/pue:PostalCode>/);
    });

    test('_buildAddress con province presente (línea 370)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { province: 'Madrid' }
        }
      }));
      expect(xml).toMatch(/<pue:Province>Madrid<\/pue:Province>/);
    });

    test('_buildAddress con country presente (línea 371)', () => {
      const xml = pue.generate(base('CAL', {
        operator: {
          name: 'Operator',
          nif: 'B12345678',
          address: { country: 'ES' }
        }
      }));
      expect(xml).toMatch(/<pue:Country>ES<\/pue:Country>/);
    });
  });

  describe('Líneas 376, 380, 385: customsOffice y soivreOffice con name/province opcionales', () => {
    test('customsOffice con name presente (línea 380)', () => {
      const xml = pue.generate(base('CAL', {
        customsOffice: { code: 'ES002801', name: 'Aduana de Madrid' }
      }));
      expect(xml).toMatch(/<pue:Name>Aduana de Madrid<\/pue:Name>/);
    });

    test('customsOffice sin name (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        customsOffice: { code: 'ES002801' }
      }));
      const officeBlock = xml.match(/<pue:CustomsOffice>[\s\S]*?<\/pue:CustomsOffice>/);
      expect(officeBlock).toBeTruthy();
      expect(officeBlock[0]).not.toMatch(/<pue:Name>/);
    });

    test('soivreOffice con name y province (líneas 389-390)', () => {
      const xml = pue.generate(base('CAL', {
        soivreOffice: { code: 'SOIVRE-MAD', name: 'SOIVRE Madrid', province: 'Madrid' }
      }));
      expect(xml).toMatch(/<pue:Name>SOIVRE Madrid<\/pue:Name>/);
      expect(xml).toMatch(/<pue:Province>Madrid<\/pue:Province>/);
    });

    test('soivreOffice sin name (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        soivreOffice: { code: 'SOIVRE-MAD' }
      }));
      const officeBlock = xml.match(/<pue:SOIVREOffice>[\s\S]*?<\/pue:SOIVREOffice>/);
      expect(officeBlock).toBeTruthy();
      expect(officeBlock[0]).not.toMatch(/<pue:Name>/);
    });

    test('soivreOffice sin province (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        soivreOffice: { code: 'SOIVRE-MAD', name: 'SOIVRE Madrid' }
      }));
      const officeBlock = xml.match(/<pue:SOIVREOffice>[\s\S]*?<\/pue:SOIVREOffice>/);
      expect(officeBlock).toBeTruthy();
      expect(officeBlock[0]).not.toMatch(/<pue:Province>/);
    });
  });

  describe('Líneas 399-416: _buildGoodsItem campos opcionales', () => {
    test('goods item con quantity presente (línea 399)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', quantity: 100, unitOfMeasure: 'PCE' }]
      }));
      expect(xml).toMatch(/<pue:Quantity unit="PCE">100<\/pue:Quantity>/);
    });

    test('goods item sin quantity (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', netMass: 10 }]
      }));
      expect(xml).not.toMatch(/<pue:Quantity/);
    });

    test('goods item con grossMass presente (línea 400)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', grossMass: 12 }]
      }));
      expect(xml).toMatch(/<pue:GrossMass>12<\/pue:GrossMass>/);
    });

    test('goods item sin grossMass (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:GrossMass>/);
    });

    test('goods item con netMass presente (línea 401)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', netMass: 10 }]
      }));
      expect(xml).toMatch(/<pue:NetMass>10<\/pue:NetMass>/);
    });

    test('goods item sin netMass (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:NetMass>/);
    });

    test('goods item con statisticalValue presente (línea 402)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', statisticalValue: 1000 }]
      }));
      expect(xml).toMatch(/<pue:StatisticalValue currency="EUR">1000<\/pue:StatisticalValue>/);
    });

    test('goods item sin statisticalValue (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:StatisticalValue/);
    });

    test('goods item con countryOfOrigin presente (línea 403)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', countryOfOrigin: 'CN' }]
      }));
      expect(xml).toMatch(/<pue:CountryOfOrigin>CN<\/pue:CountryOfOrigin>/);
    });

    test('goods item sin countryOfOrigin (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:CountryOfOrigin>/);
    });

    test('goods item con brand presente (línea 404)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', brand: 'TestBrand' }]
      }));
      expect(xml).toMatch(/<pue:Brand>TestBrand<\/pue:Brand>/);
    });

    test('goods item sin brand (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:Brand>/);
    });

    test('goods item con model presente (línea 405)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', model: 'Model-X' }]
      }));
      expect(xml).toMatch(/<pue:Model>Model-X<\/pue:Model>/);
    });

    test('goods item sin model (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:Model>/);
    });

    test('goods item con serialNumber presente (línea 406)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', serialNumber: 'SN12345' }]
      }));
      expect(xml).toMatch(/<pue:SerialNumber>SN12345<\/pue:SerialNumber>/);
    });

    test('goods item sin serialNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:SerialNumber>/);
    });

    test('goods item con batchNumber presente (línea 407)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', batchNumber: 'BATCH-001' }]
      }));
      expect(xml).toMatch(/<pue:BatchNumber>BATCH-001<\/pue:BatchNumber>/);
    });

    test('goods item sin batchNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:BatchNumber>/);
    });

    test('goods item con manufacturer presente (línea 408)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          manufacturer: { name: 'Item Manufacturer', country: 'CN', registrationNumber: 'REG-123' }
        }]
      }));
      expect(xml).toMatch(/<pue:Name>Item Manufacturer<\/pue:Name>/);
    });

    test('goods item sin manufacturer (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      const itemBlock = xml.match(/<pue:GoodsItem>[\s\S]*?<\/pue:GoodsItem>/);
      expect(itemBlock).toBeTruthy();
      expect(itemBlock[0]).not.toMatch(/<pue:Manufacturer>/);
    });

    test('goods item con certifications presente (línea 409)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE', number: 'CE-001' }]
        }]
      }));
      expect(xml).toMatch(/<pue:Certifications>/);
    });

    test('goods item sin certifications (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:Certifications>/);
    });

    test('goods item con numberOfPackages presente (línea 413)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', numberOfPackages: 5 }]
      }));
      expect(xml).toMatch(/<pue:NumberOfPackages>5<\/pue:NumberOfPackages>/);
    });

    test('goods item sin numberOfPackages (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:NumberOfPackages>/);
    });

    test('goods item con kindOfPackages presente (línea 414)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', kindOfPackages: 'BX' }]
      }));
      expect(xml).toMatch(/<pue:KindOfPackages>BX<\/pue:KindOfPackages>/);
    });

    test('goods item sin kindOfPackages (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:KindOfPackages>/);
    });

    test('goods item con marksAndNumbers presente (línea 415)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', marksAndNumbers: 'MARK-001' }]
      }));
      expect(xml).toMatch(/<pue:MarksAndNumbers>MARK-001<\/pue:MarksAndNumbers>/);
    });

    test('goods item sin marksAndNumbers (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:MarksAndNumbers>/);
    });
  });

  describe('Líneas 423-424: _buildManufacturerElement con country y registrationNumber opcionales', () => {
    test('manufacturer con country presente', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          manufacturer: { name: 'Fab', country: 'CN' }
        }]
      }));
      expect(xml).toMatch(/<pue:Country>CN<\/pue:Country>/);
    });

    test('manufacturer sin country (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          manufacturer: { name: 'Fab' }
        }]
      }));
      const mfgBlock = xml.match(/<pue:Manufacturer>[\s\S]*?<\/pue:Manufacturer>/);
      expect(mfgBlock).toBeTruthy();
      expect(mfgBlock[0]).not.toMatch(/<pue:Country>/);
    });

    test('manufacturer con registrationNumber presente', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          manufacturer: { name: 'Fab', registrationNumber: 'REG-999' }
        }]
      }));
      expect(xml).toMatch(/<pue:RegistrationNumber>REG-999<\/pue:RegistrationNumber>/);
    });

    test('manufacturer sin registrationNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          manufacturer: { name: 'Fab' }
        }]
      }));
      const mfgBlock = xml.match(/<pue:Manufacturer>[\s\S]*?<\/pue:Manufacturer>/);
      expect(mfgBlock).toBeTruthy();
      expect(mfgBlock[0]).not.toMatch(/<pue:RegistrationNumber>/);
    });
  });

  describe('Líneas 431-434: _buildCertification campos opcionales', () => {
    test('certification con number presente (línea 431)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE', number: 'CE-123' }]
        }]
      }));
      expect(xml).toMatch(/<pue:Number>CE-123<\/pue:Number>/);
    });

    test('certification sin number (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE' }]
        }]
      }));
      const certBlock = xml.match(/<pue:Certification>[\s\S]*?<\/pue:Certification>/);
      expect(certBlock).toBeTruthy();
      expect(certBlock[0]).not.toMatch(/<pue:Number>/);
    });

    test('certification con issuer presente (línea 432)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE', issuer: 'Certifying Body' }]
        }]
      }));
      expect(xml).toMatch(/<pue:Issuer>Certifying Body<\/pue:Issuer>/);
    });

    test('certification sin issuer (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE' }]
        }]
      }));
      const certBlock = xml.match(/<pue:Certification>[\s\S]*?<\/pue:Certification>/);
      expect(certBlock).toBeTruthy();
      expect(certBlock[0]).not.toMatch(/<pue:Issuer>/);
    });

    test('certification con issuedAt presente (línea 433)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE', issuedAt: '2026-01-01' }]
        }]
      }));
      expect(xml).toMatch(/<pue:IssuedDate>2026-01-01<\/pue:IssuedDate>/);
    });

    test('certification sin issuedAt (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE' }]
        }]
      }));
      const certBlock = xml.match(/<pue:Certification>[\s\S]*?<\/pue:Certification>/);
      expect(certBlock).toBeTruthy();
      expect(certBlock[0]).not.toMatch(/<pue:IssuedDate>/);
    });

    test('certification con expiresAt presente (línea 434)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE', expiresAt: '2027-12-31' }]
        }]
      }));
      expect(xml).toMatch(/<pue:ExpiryDate>2027-12-31<\/pue:ExpiryDate>/);
    });

    test('certification sin expiresAt (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{
          taricCode: '6109100010',
          description: 'T-shirt',
          certifications: [{ type: 'CE' }]
        }]
      }));
      const certBlock = xml.match(/<pue:Certification>[\s\S]*?<\/pue:Certification>/);
      expect(certBlock).toBeTruthy();
      expect(certBlock[0]).not.toMatch(/<pue:ExpiryDate>/);
    });
  });

  describe('Líneas 442-457: _buildTypeSpecificGoodsData por tipo', () => {
    test('ROHS con hazardousComponents presentes (línea 442)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{
          taricCode: '8471300000',
          description: 'PC',
          hazardousComponents: [
            { substance: 'Lead', casNumber: '7439-92-1', concentration: 0.01, unit: '%' }
          ]
        }]
      }));
      expect(xml).toMatch(/<pue:HazardousComponents>/);
      expect(xml).toMatch(/<pue:Substance>Lead<\/pue:Substance>/);
    });

    test('ROHS sin hazardousComponents (rama else - retorna cadena vacía)', () => {
      const xml = pue.generate(base('ROHS'));
      expect(xml).not.toMatch(/<pue:HazardousComponents>/);
    });

    test('ROHS hazardousComponent con casNumber presente (línea 446)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{
          taricCode: '8471300000',
          description: 'PC',
          hazardousComponents: [{ substance: 'Mercury', casNumber: '7439-97-6' }]
        }]
      }));
      expect(xml).toMatch(/<pue:CASNumber>7439-97-6<\/pue:CASNumber>/);
    });

    test('ROHS hazardousComponent sin casNumber (rama else)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{
          taricCode: '8471300000',
          description: 'PC',
          hazardousComponents: [{ substance: 'Mercury' }]
        }]
      }));
      const compBlock = xml.match(/<pue:Component>[\s\S]*?<\/pue:Component>/);
      expect(compBlock).toBeTruthy();
      expect(compBlock[0]).not.toMatch(/<pue:CASNumber>/);
    });

    test('ROHS hazardousComponent con concentration presente (línea 447)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{
          taricCode: '8471300000',
          description: 'PC',
          hazardousComponents: [{ substance: 'Cadmium', concentration: 0.005, unit: 'ppm' }]
        }]
      }));
      expect(xml).toMatch(/<pue:Concentration unit="ppm">0\.005<\/pue:Concentration>/);
    });

    test('ROHS hazardousComponent sin concentration (rama else)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{
          taricCode: '8471300000',
          description: 'PC',
          hazardousComponents: [{ substance: 'Cadmium' }]
        }]
      }));
      const compBlock = xml.match(/<pue:Component>[\s\S]*?<\/pue:Component>/);
      expect(compBlock).toBeTruthy();
      expect(compBlock[0]).not.toMatch(/<pue:Concentration/);
    });

    test('ECO con productCategory presente (línea 452)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{ taricCode: '0805100000', description: 'Oranges', productCategory: 'fruit' }]
      }));
      expect(xml).toMatch(/<pue:OrganicCategory>fruit<\/pue:OrganicCategory>/);
    });

    test('ECO sin productCategory (rama else - retorna vacío)', () => {
      const xml = pue.generate(base('ECO', {
        goods: [{ taricCode: '0805100000', description: 'Oranges' }]
      }));
      expect(xml).not.toMatch(/<pue:OrganicCategory>/);
    });

    test('CAL con subCategory presente (línea 456)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt', subCategory: 'cotton' }]
      }));
      expect(xml).toMatch(/<pue:QualityCategory>cotton<\/pue:QualityCategory>/);
    });

    test('CAL sin subCategory (rama else - retorna vacío)', () => {
      const xml = pue.generate(base('CAL', {
        goods: [{ taricCode: '6109100010', description: 'T-shirt' }]
      }));
      expect(xml).not.toMatch(/<pue:QualityCategory>/);
    });
  });

  describe('Líneas 469-478: _buildTransport campos opcionales', () => {
    test('transport con documentType presente (línea 469)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', documentType: 'BL' }
      }));
      expect(xml).toMatch(/<pue:DocumentType>BL<\/pue:DocumentType>/);
    });

    test('transport sin documentType (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:DocumentType>/);
    });

    test('transport con documentNumber presente (línea 470)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', documentNumber: 'BL-12345' }
      }));
      expect(xml).toMatch(/<pue:DocumentNumber>BL-12345<\/pue:DocumentNumber>/);
    });

    test('transport sin documentNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:DocumentNumber>/);
    });

    test('transport con containerNumber presente (línea 471)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', containerNumber: 'CONT-001' }
      }));
      expect(xml).toMatch(/<pue:ContainerNumber>CONT-001<\/pue:ContainerNumber>/);
    });

    test('transport sin containerNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:ContainerNumber>/);
    });

    test('transport con sealNumber presente (línea 472)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', sealNumber: 'SEAL-001' }
      }));
      expect(xml).toMatch(/<pue:SealNumber>SEAL-001<\/pue:SealNumber>/);
    });

    test('transport sin sealNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:SealNumber>/);
    });

    test('transport con vehicleRegistration presente (línea 473)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'road', vehicleRegistration: 'VEH-123' }
      }));
      expect(xml).toMatch(/<pue:VehicleRegistration>VEH-123<\/pue:VehicleRegistration>/);
    });

    test('transport sin vehicleRegistration (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'road' }
      }));
      expect(xml).not.toMatch(/<pue:VehicleRegistration>/);
    });

    test('transport con vesselName presente (línea 474)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', vesselName: 'MV Atlantico' }
      }));
      expect(xml).toMatch(/<pue:VesselName>MV Atlantico<\/pue:VesselName>/);
    });

    test('transport sin vesselName (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:VesselName>/);
    });

    test('transport con flightNumber presente (línea 475)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'air', flightNumber: 'FL-001' }
      }));
      expect(xml).toMatch(/<pue:FlightNumber>FL-001<\/pue:FlightNumber>/);
    });

    test('transport sin flightNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'air' }
      }));
      expect(xml).not.toMatch(/<pue:FlightNumber>/);
    });

    test('transport con arrivalDate presente (línea 476)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', arrivalDate: '2026-02-01' }
      }));
      expect(xml).toMatch(/<pue:ArrivalDate>2026-02-01T00:00:00.000Z<\/pue:ArrivalDate>/);
    });

    test('transport sin arrivalDate (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:ArrivalDate>/);
    });

    test('transport con expectedArrivalDate presente (línea 477)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', expectedArrivalDate: '2026-02-15' }
      }));
      expect(xml).toMatch(/<pue:ExpectedArrivalDate>2026-02-15T00:00:00.000Z<\/pue:ExpectedArrivalDate>/);
    });

    test('transport sin expectedArrivalDate (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:ExpectedArrivalDate>/);
    });

    test('transport con unloadingPlace presente (línea 478)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime', unloadingPlace: 'Puerto de Barcelona' }
      }));
      expect(xml).toMatch(/<pue:UnloadingPlace>Puerto de Barcelona<\/pue:UnloadingPlace>/);
    });

    test('transport sin unloadingPlace (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        transport: { mode: 'maritime' }
      }));
      expect(xml).not.toMatch(/<pue:UnloadingPlace>/);
    });
  });

  describe('Líneas 485-488: _buildDocument campos opcionales', () => {
    test('document con name presente (línea 485)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice', name: 'Factura Comercial' }]
      }));
      expect(xml).toMatch(/<pue:Name>Factura Comercial<\/pue:Name>/);
    });

    test('document sin name (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice' }]
      }));
      const docBlock = xml.match(/<pue:Document>[\s\S]*?<\/pue:Document>/);
      expect(docBlock).toBeTruthy();
      expect(docBlock[0]).not.toMatch(/<pue:Name>/);
    });

    test('document con documentNumber presente (línea 486)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice', documentNumber: 'INV-001' }]
      }));
      expect(xml).toMatch(/<pue:Number>INV-001<\/pue:Number>/);
    });

    test('document sin documentNumber (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice' }]
      }));
      const docBlock = xml.match(/<pue:Document>[\s\S]*?<\/pue:Document>/);
      expect(docBlock).toBeTruthy();
      expect(docBlock[0]).not.toMatch(/<pue:Number>/);
    });

    test('document con url presente (línea 487)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice', url: 'https://docs.example.com/inv001' }]
      }));
      expect(xml).toMatch(/<pue:URL>https:\/\/docs\.example\.com\/inv001<\/pue:URL>/);
    });

    test('document sin url (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice' }]
      }));
      const docBlock = xml.match(/<pue:Document>[\s\S]*?<\/pue:Document>/);
      expect(docBlock).toBeTruthy();
      expect(docBlock[0]).not.toMatch(/<pue:URL>/);
    });

    test('document con uploadedAt presente (línea 488)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice', uploadedAt: '2026-01-15' }]
      }));
      expect(xml).toMatch(/<pue:UploadDate>2026-01-15T00:00:00.000Z<\/pue:UploadDate>/);
    });

    test('document sin uploadedAt (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        attachedDocuments: [{ type: 'invoice' }]
      }));
      const docBlock = xml.match(/<pue:Document>[\s\S]*?<\/pue:Document>/);
      expect(docBlock).toBeTruthy();
      expect(docBlock[0]).not.toMatch(/<pue:UploadDate>/);
    });
  });

  describe('Línea 501: _escapeXml con undefined/null', () => {
    test('_escapeXml con cadena vacía', () => {
      expect(pue._escapeXml('')).toBe('');
    });

    test('_escapeXml con undefined', () => {
      expect(pue._escapeXml(undefined)).toBe('');
    });

    test('_escapeXml con null', () => {
      expect(pue._escapeXml(null)).toBe('');
    });

    test('_escapeXml con cadena válida', () => {
      expect(pue._escapeXml('Test & Co')).toBe('Test &amp; Co');
    });
  });

  describe('Líneas 513-525: _getROHSCategories - mapeo TARIC a categorías WEEE', () => {
    test('TARIC 8418 - categoria 1 (Large cooling appliances)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '8418500000', description: 'Refrigerator' }]
      }));
      expect(xml).toMatch(/<pue:Category>1<\/pue:Category>/);
    });

    test('TARIC 8450/8451 - categoria 2 (Large household appliances)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '8450110000', description: 'Washing machine' },
          { taricCode: '8451210000', description: 'Dryer' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>2<\/pue:Category>/);
    });

    test('TARIC 8509/8510 - categoria 2 (Small household appliances)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '8509400000', description: 'Food grinder' },
          { taricCode: '8510100000', description: 'Electric shaver' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>2<\/pue:Category>/);
    });

    test('TARIC 8471/8517 - categoria 3 (IT equipment)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '8471300000', description: 'PC' },
          { taricCode: '8517620000', description: 'Router' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>3<\/pue:Category>/);
    });

    test('TARIC 8521/8528 - categoria 4 (Consumer equipment)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '8521900000', description: 'Video recorder' },
          { taricCode: '8528590000', description: 'Monitor' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>4<\/pue:Category>/);
    });

    test('TARIC 9405 - categoria 5 (Lighting)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '9405100000', description: 'LED lamp' }]
      }));
      expect(xml).toMatch(/<pue:Category>5<\/pue:Category>/);
    });

    test('TARIC 8467 - categoria 6 (Electrical tools)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '8467210000', description: 'Drill' }]
      }));
      expect(xml).toMatch(/<pue:Category>6<\/pue:Category>/);
    });

    test('TARIC 9504 - categoria 7 (Toys)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '9504500000', description: 'Console' }]
      }));
      expect(xml).toMatch(/<pue:Category>7<\/pue:Category>/);
    });

    test('TARIC 9018/9019 - categoria 8 (Medical devices)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '9018110000', description: 'ECG' },
          { taricCode: '9019200000', description: 'Oxygen therapy' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>8<\/pue:Category>/);
    });

    test('TARIC 9027/9030 - categoria 9 (Monitoring instruments)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [
          { taricCode: '9027100000', description: 'Gas analyzer' },
          { taricCode: '9030310000', description: 'Multimeter' }
        ]
      }));
      expect(xml).toMatch(/<pue:Category>9<\/pue:Category>/);
    });

    test('TARIC 8476 - categoria 10 (Automatic dispensers)', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '8476210000', description: 'Vending machine' }]
      }));
      expect(xml).toMatch(/<pue:Category>10<\/pue:Category>/);
    });

    test('TARIC no ROHS - sin categorías', () => {
      const xml = pue.generate(base('ROHS', {
        goods: [{ taricCode: '0901210000', description: 'Coffee' }]
      }));
      // No debe generar ninguna categoría
      expect(xml).not.toMatch(/<pue:Category>/);
    });
  });

  describe('Líneas 546-549: _getCENotifiedBody - extracción de número de organismo notificado', () => {
    test('CE con issuer que contiene número de 4 dígitos', () => {
      expect(pue._getCENotifiedBody({
        goods: [{
          certifications: [{ type: 'CE', issuer: 'Notified Body 2345' }]
        }]
      })).toBe('2345');
    });

    test('CE con issuer sin número de 4 dígitos', () => {
      expect(pue._getCENotifiedBody({
        goods: [{
          certifications: [{ type: 'CE', issuer: 'Generic Body' }]
        }]
      })).toBe('');
    });

    test('sin certificación CE', () => {
      expect(pue._getCENotifiedBody({
        goods: [{
          certifications: [{ type: 'OTHER', issuer: 'Body 1234' }]
        }]
      })).toBe('');
    });

    test('goods sin certifications', () => {
      expect(pue._getCENotifiedBody({
        goods: [{}]
      })).toBe('');
    });
  });

  describe('Líneas 558-559: _getEcoControlBody - extracción de organismo de control ECO', () => {
    test('ECO/BIO con issuer presente', () => {
      expect(pue._getEcoControlBody({
        goods: [{
          certifications: [{ type: 'ECO', issuer: 'ES-ECO-020' }]
        }]
      })).toBe('ES-ECO-020');
    });

    test('BIO con issuer presente', () => {
      expect(pue._getEcoControlBody({
        goods: [{
          certifications: [{ type: 'BIO', issuer: 'ES-BIO-001' }]
        }]
      })).toBe('ES-BIO-001');
    });

    test('sin certificación ECO/BIO - fallback a ES-ECO-XXX', () => {
      expect(pue._getEcoControlBody({
        goods: [{}]
      })).toBe('ES-ECO-XXX');
    });
  });

  describe('Líneas 575-578: _getCompositionData - composición de productos CAL', () => {
    test('goods con description y productCategory', () => {
      const result = pue._getCompositionData({
        goods: [
          { description: 'T-shirt', productCategory: '100% cotton' },
          { description: 'Jeans', productCategory: '98% cotton, 2% elastane' }
        ]
      });
      expect(result).toMatch(/T-shirt/);
      expect(result).toMatch(/100% cotton/);
      expect(result).toMatch(/Jeans/);
      expect(result).toMatch(/98% cotton, 2% elastane/);
    });

    test('goods con description sin productCategory', () => {
      const result = pue._getCompositionData({
        goods: [{ description: 'T-shirt' }]
      });
      expect(result).toMatch(/T-shirt/);
      expect(result).not.toMatch(/<pue:Composition>/);
    });

    test('goods sin description', () => {
      const result = pue._getCompositionData({
        goods: [{ productCategory: '100% cotton' }]
      });
      expect(result).toBe('');
    });
  });

  describe('Líneas 339-346: _buildOperator campos opcionales EORI, NIF, contactPerson, phone, email', () => {
    test('operator con eori presente', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', eori: 'ESB12345678' }
      }));
      expect(xml).toMatch(/<pue:EORI>ESB12345678<\/pue:EORI>/);
    });

    test('operator sin eori (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B12345678' }
      }));
      const opBlock = xml.match(/<pue:Operator>[\s\S]*?<\/pue:Operator>/);
      expect(opBlock).toBeTruthy();
      expect(opBlock[0]).not.toMatch(/<pue:EORI>/);
    });

    test('operator con nif presente', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B12345678' }
      }));
      expect(xml).toMatch(/<pue:NIF>B12345678<\/pue:NIF>/);
    });

    test('operator sin nif (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator' }
      }));
      const opBlock = xml.match(/<pue:Operator>[\s\S]*?<\/pue:Operator>/);
      expect(opBlock).toBeTruthy();
      expect(opBlock[0]).not.toMatch(/<pue:NIF>/);
    });

    test('operator con contactPerson presente', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1', contactPerson: 'Ana Garcia' }
      }));
      expect(xml).toMatch(/<pue:ContactPerson>Ana Garcia<\/pue:ContactPerson>/);
    });

    test('operator sin contactPerson (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1' }
      }));
      const opBlock = xml.match(/<pue:Operator>[\s\S]*?<\/pue:Operator>/);
      expect(opBlock).toBeTruthy();
      expect(opBlock[0]).not.toMatch(/<pue:ContactPerson>/);
    });

    test('operator con phone presente', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1', phone: '600000000' }
      }));
      expect(xml).toMatch(/<pue:Phone>600000000<\/pue:Phone>/);
    });

    test('operator sin phone (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1' }
      }));
      const opBlock = xml.match(/<pue:Operator>[\s\S]*?<\/pue:Operator>/);
      expect(opBlock).toBeTruthy();
      expect(opBlock[0]).not.toMatch(/<pue:Phone>/);
    });

    test('operator con email presente', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1', email: 'test@example.com' }
      }));
      expect(xml).toMatch(/<pue:Email>test@example\.com<\/pue:Email>/);
    });

    test('operator sin email (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        operator: { name: 'Operator', nif: 'B1' }
      }));
      const opBlock = xml.match(/<pue:Operator>[\s\S]*?<\/pue:Operator>/);
      expect(opBlock).toBeTruthy();
      expect(opBlock[0]).not.toMatch(/<pue:Email>/);
    });
  });

  describe('Líneas 353-359: _buildParty campos opcionales EORI, NIF, contactPerson, phone, email', () => {
    test('party con eori presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', eori: 'ESB99999999' }
      }));
      expect(xml).toMatch(/<pue:EORI>ESB99999999<\/pue:EORI>/);
    });

    test('party sin eori (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', nif: 'B99999999' }
      }));
      const partyBlock = xml.match(/<pue:Importer>[\s\S]*?<\/pue:Importer>/);
      expect(partyBlock).toBeTruthy();
      expect(partyBlock[0]).not.toMatch(/<pue:EORI>/);
    });

    test('party con nif presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', nif: 'B99999999' }
      }));
      expect(xml).toMatch(/<pue:NIF>B99999999<\/pue:NIF>/);
    });

    test('party sin nif (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer' }
      }));
      const partyBlock = xml.match(/<pue:Importer>[\s\S]*?<\/pue:Importer>/);
      expect(partyBlock).toBeTruthy();
      expect(partyBlock[0]).not.toMatch(/<pue:NIF>/);
    });

    test('party con contactPerson presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', contactPerson: 'Luis Rodriguez' }
      }));
      expect(xml).toMatch(/<pue:ContactPerson>Luis Rodriguez<\/pue:ContactPerson>/);
    });

    test('party sin contactPerson (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer' }
      }));
      const partyBlock = xml.match(/<pue:Importer>[\s\S]*?<\/pue:Importer>/);
      expect(partyBlock).toBeTruthy();
      expect(partyBlock[0]).not.toMatch(/<pue:ContactPerson>/);
    });

    test('party con phone presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', phone: '611111111' }
      }));
      expect(xml).toMatch(/<pue:Phone>611111111<\/pue:Phone>/);
    });

    test('party sin phone (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer' }
      }));
      const partyBlock = xml.match(/<pue:Importer>[\s\S]*?<\/pue:Importer>/);
      expect(partyBlock).toBeTruthy();
      expect(partyBlock[0]).not.toMatch(/<pue:Phone>/);
    });

    test('party con email presente', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer', email: 'importer@example.com' }
      }));
      expect(xml).toMatch(/<pue:Email>importer@example\.com<\/pue:Email>/);
    });

    test('party sin email (rama else)', () => {
      const xml = pue.generate(base('CAL', {
        importer: { name: 'Importer' }
      }));
      const partyBlock = xml.match(/<pue:Importer>[\s\S]*?<\/pue:Importer>/);
      expect(partyBlock).toBeTruthy();
      expect(partyBlock[0]).not.toMatch(/<pue:Email>/);
    });
  });
});
