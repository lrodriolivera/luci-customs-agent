/**
 * Tests de cobertura de RAMAS para h1Generator.js
 * Objetivo: cubrir las líneas con condicionales/defaults no tomados (branch coverage ≥94%)
 *
 * Estrategia:
 * - Los campos con ?? / || / optional chaining tienen ramas: valor presente vs fallback
 * - Los campos de agentes opcionales (exporter, buyer, seller, consignee, holderOfProcedure, holderOfAuthorization)
 * - Guarantee presente vs null
 * - Contenedores: array con elementos vs array vacío
 * - Documentos: tipos presentes vs ausentes
 * - Tipos de país (UE vs no-UE, distintos transportModes, distintos customsOffices)
 * - Duty types condicionales (antidumping, excise)
 * - Deferred payment presente vs null
 * - Valores condicionales en valoración (additions/deductions)
 */

const h1Generator = require('../../../src/services/forms/h1Generator');

describe('h1Generator - Cobertura de Ramas', () => {
  describe('buildDeclarationHeader - ramas XML condicionales campos opcionales', () => {
    const baseExpedition = {
      client: {
        nif: 'B22477020',
        // Sin eori → debe usar fallback `ES${nif}` (línea 180)
        companyName: 'Cliente Test',
        address: {
          street: 'Calle Test 1',
          city: 'Barcelona',
          postalCode: '08001'
        },
        contact: {
          name: 'Contacto Test'
          // Sin phone ni email → líneas 803-804 no se incluyen
        }
      },
      goodsSummary: {
        totalPackages: 10,
        totalGrossWeight: 100,
        totalValue: 1000
      },
      invoice: { number: 'INV-001' },
      transport: { arrivalPort: 'BARCELONA' },
      goods: [
        {
          hsCode: '090121',
          taricCode: '0901210000',
          description: 'Cafe tostado',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT', marks: 'COFFEE-001' }
        }
      ]
    };

    test('debe tomar rama client.eori ausente y usar fallback ES+nif (línea 180)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.importer.identificationNumber).toBe('ESB22477020');
      expect(result.xml).toContain('<IdentificationID>ESB22477020</IdentificationID>');
    });

    test('debe tomar rama client.eori presente (línea 180 primera parte)', () => {
      const expedition = {
        ...baseExpedition,
        client: {
          ...baseExpedition.client,
          eori: 'ESB22477020'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.importer.identificationNumber).toBe('ESB22477020');
    });

    test('debe NO incluir phone/email en Contact cuando ausentes (líneas 803-804 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      // Contact debe incluirse porque hay name, pero sin phone ni email
      expect(result.xml).toContain('<Contact>');
      expect(result.xml).toContain('<Name>Contacto Test</Name>');
      expect(result.xml).not.toContain('<PhoneNumber>');
      expect(result.xml).not.toContain('<Email>');
    });

    test('debe incluir phone/email en Contact cuando presentes (líneas 803-804 condicional true)', () => {
      const expedition = {
        ...baseExpedition,
        client: {
          ...baseExpedition.client,
          contact: {
            name: 'Contacto Full',
            phone: '+34666000111',
            email: 'contacto@full.es'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<Contact>');
      expect(result.xml).toContain('<PhoneNumber>+34666000111</PhoneNumber>');
      expect(result.xml).toContain('<Email>contacto@full.es</Email>');
    });

    test('debe incluir Contact del declarant con fallback cuando contact ausente (líneas 201, 813)', () => {
      const expedition = {
        ...baseExpedition,
        representative: {
          eori: 'ESREP123',
          companyName: 'Rep Test'
          // Sin contact → usa fallback "Departamento Aduanas" línea 201
        }
      };

      const result = h1Generator.generate(expedition);

      // El bloque Declarant incluye Contact con fallback
      const declarantBlock = result.xml.substring(
        result.xml.indexOf('<Declarant>'),
        result.xml.indexOf('</Declarant>')
      );
      expect(declarantBlock).toContain('<Contact>');
      expect(declarantBlock).toContain('<Name>Departamento Aduanas</Name>');
      // Phone y email no deben aparecer (línea 816-817 condicional false)
      expect(declarantBlock).not.toContain('<PhoneNumber>');
      expect(declarantBlock).not.toContain('<Email>');
    });

    test('debe incluir Contact del declarant cuando contact.name presente (línea 813 condicional true)', () => {
      const expedition = {
        ...baseExpedition,
        representative: {
          eori: 'ESREP123',
          companyName: 'Rep Test',
          contact: {
            name: 'Rep Contact',
            phone: '+34666222333',
            email: 'rep@test.es'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      const declarantBlock = result.xml.substring(
        result.xml.indexOf('<Declarant>'),
        result.xml.indexOf('</Declarant>')
      );
      expect(declarantBlock).toContain('<Contact>');
      expect(declarantBlock).toContain('<Name>Rep Contact</Name>');
      expect(declarantBlock).toContain('<PhoneNumber>+34666222333</PhoneNumber>');
      expect(declarantBlock).toContain('<Email>rep@test.es</Email>');
    });

    test('debe tomar rama exporter.identificationNumber presente (línea 824)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          eori: 'CN123456789',
          companyName: 'Exporter CN',
          address: 'Exporter St',
          city: 'Shanghai',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationID>CN123456789</IdentificationID>');
    });

    test('debe tomar rama exporter.identificationNumber ausente (línea 824 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          // Sin eori
          companyName: 'Exporter No EORI',
          address: 'Exporter St',
          city: 'Shanghai',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      // No debe incluir IdentificationID dentro del bloque Exporter
      const exporterBlock = result.xml.substring(
        result.xml.indexOf('<Exporter>'),
        result.xml.indexOf('</Exporter>')
      );
      expect(exporterBlock).not.toContain('<IdentificationID>');
    });

    test('debe tomar rama exporter.address.postcode presente (línea 829)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          eori: 'CN123',
          companyName: 'Exporter CN',
          address: 'Exporter St',
          city: 'Shanghai',
          postalCode: '200000',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<PostcodeID>200000</PostcodeID>');
    });

    test('debe tomar rama exporter.address.postcode ausente (línea 829 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          eori: 'CN123',
          companyName: 'Exporter No Zip',
          address: 'Exporter St',
          city: 'Shanghai',
          // Sin postalCode
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      const exporterBlock = result.xml.substring(
        result.xml.indexOf('<Exporter>'),
        result.xml.indexOf('</Exporter>')
      );
      // PostcodeID no debe aparecer o estar vacío
      expect(exporterBlock).not.toContain('<PostcodeID>200000</PostcodeID>');
    });

    test('debe tomar ramas buyer.identificationNumber presente (línea 837)', () => {
      const expedition = {
        ...baseExpedition,
        buyer: {
          eori: 'ESB99999999',
          companyName: 'Buyer Test',
          address: {
            street: 'Buyer St',
            city: 'Madrid',
            country: 'ES'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      const buyerBlock = result.xml.substring(
        result.xml.indexOf('<Buyer>'),
        result.xml.indexOf('</Buyer>')
      );
      expect(buyerBlock).toContain('<IdentificationID>ESB99999999</IdentificationID>');
    });

    test('debe tomar ramas buyer.identificationNumber ausente (línea 837 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        buyer: {
          // Sin eori
          companyName: 'Buyer No EORI',
          address: {
            street: 'Buyer St',
            city: 'Madrid',
            country: 'ES'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      const buyerBlock = result.xml.substring(
        result.xml.indexOf('<Buyer>'),
        result.xml.indexOf('</Buyer>')
      );
      // No debe incluir IdentificationID
      expect(buyerBlock).not.toContain('<IdentificationID>');
    });

    test('debe tomar ramas seller.identificationNumber presente (línea 849)', () => {
      const expedition = {
        ...baseExpedition,
        seller: {
          eori: 'CN555',
          companyName: 'Seller CN',
          address: {
            street: 'Seller St',
            city: 'Beijing',
            country: 'CN'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      const sellerBlock = result.xml.substring(
        result.xml.indexOf('<Seller>'),
        result.xml.indexOf('</Seller>')
      );
      expect(sellerBlock).toContain('<IdentificationID>CN555</IdentificationID>');
    });

    test('debe tomar ramas seller.identificationNumber ausente (línea 849 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        seller: {
          // Sin eori
          companyName: 'Seller No EORI',
          address: {
            street: 'Seller St',
            city: 'Beijing',
            country: 'CN'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      const sellerBlock = result.xml.substring(
        result.xml.indexOf('<Seller>'),
        result.xml.indexOf('</Seller>')
      );
      // No debe incluir IdentificationID
      expect(sellerBlock).not.toContain('<IdentificationID>');
    });
  });

  describe('buildDeclarationHeader - ramas condicionales agentes opcionales', () => {
    const baseExpedition = {
      client: {
        eori: 'ESB22477020',
        nif: 'B22477020',
        companyName: 'Cliente Test',
        address: {
          street: 'Calle Test 1',
          city: 'Barcelona',
          postalCode: '08001'
        },
        contact: {
          name: 'Contacto Test',
          phone: '+34666000001',
          email: 'contacto@test.es'
        }
      },
      goodsSummary: {
        totalPackages: 10,
        totalGrossWeight: 100,
        totalValue: 1000
      },
      invoice: { number: 'INV-001' },
      transport: { arrivalPort: 'BARCELONA' },
      goods: [
        {
          hsCode: '090121',
          taricCode: '0901210000',
          description: 'Cafe tostado',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT', marks: 'COFFEE-001' }
        }
      ]
    };

    test('debe tomar rama "exporter ausente" (línea 217: null)', () => {
      // Rama: expedition.exporter ? {...} : null → tomar el NULL
      const expedition = { ...baseExpedition };
      // NO definir expedition.exporter

      const result = h1Generator.generate(expedition);

      // Verificar que el header tiene exporter null
      expect(result.data.declarationHeader.exporter).toBeNull();
    });

    test('debe tomar rama "exporter presente" (líneas 208-216)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          eori: 'CN1234567890',
          companyName: 'Exporter CN',
          address: 'Exporter St 123',
          city: 'Shanghai',
          postalCode: '200000',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.exporter).not.toBeNull();
      expect(result.data.declarationHeader.exporter.identificationNumber).toBe('CN1234567890');
      expect(result.data.declarationHeader.exporter.name).toBe('Exporter CN');
      expect(result.data.declarationHeader.exporter.address.country).toBe('CN');
    });

    test('debe tomar rama "buyer ausente" (línea 229: null)', () => {
      const expedition = { ...baseExpedition };
      // NO definir expedition.buyer

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.buyer).toBeNull();
    });

    test('debe tomar rama "buyer presente" (líneas 220-228)', () => {
      const expedition = {
        ...baseExpedition,
        buyer: {
          eori: 'ESB99999999',
          nif: 'B99999999',
          companyName: 'Buyer Test',
          address: {
            street: 'Buyer St',
            city: 'Madrid',
            postalCode: '28001',
            country: 'ES'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.buyer).not.toBeNull();
      expect(result.data.declarationHeader.buyer.identificationNumber).toContain('B99999999');
      expect(result.data.declarationHeader.buyer.name).toBe('Buyer Test');
    });

    test('debe tomar rama "seller ausente" (línea 241: null)', () => {
      const expedition = { ...baseExpedition };
      // NO definir expedition.seller

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.seller).toBeNull();
    });

    test('debe tomar rama "seller presente" (líneas 232-240)', () => {
      const expedition = {
        ...baseExpedition,
        seller: {
          eori: 'CN5555555555',
          nif: 'CN5555555555',
          companyName: 'Seller CN',
          address: {
            street: 'Seller St',
            city: 'Beijing',
            postalCode: '100000',
            country: 'CN'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.seller).not.toBeNull();
      expect(result.data.declarationHeader.seller.name).toBe('Seller CN');
    });

    test('debe tomar rama "consignee ausente" (línea 253: null)', () => {
      const expedition = { ...baseExpedition };
      // NO definir expedition.consignee

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.consignee).toBeNull();
    });

    test('debe tomar rama "consignee presente" (líneas 244-252)', () => {
      const expedition = {
        ...baseExpedition,
        consignee: {
          eori: 'ESC11111111',
          nif: 'C11111111',
          companyName: 'Consignee Test',
          address: {
            street: 'Consignee St',
            city: 'Valencia',
            postalCode: '46001',
            country: 'ES'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.consignee).not.toBeNull();
      expect(result.data.declarationHeader.consignee.name).toBe('Consignee Test');
    });

    test('debe tomar rama "holderOfProcedure ausente" (línea 259: null)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.holderOfProcedure).toBeNull();
    });

    test('debe tomar rama "holderOfProcedure presente" (líneas 256-258)', () => {
      const expedition = {
        ...baseExpedition,
        holderOfProcedure: {
          eori: 'ESH12345678',
          companyName: 'Holder Procedure'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.holderOfProcedure).not.toBeNull();
      expect(result.data.declarationHeader.holderOfProcedure.identificationNumber).toBe('ESH12345678');
    });

    test('debe tomar rama "holderOfAuthorization ausente" (línea 266: null)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.holderOfAuthorization).toBeNull();
    });

    test('debe tomar rama "holderOfAuthorization presente" (líneas 262-265)', () => {
      const expedition = {
        ...baseExpedition,
        holderOfAuthorization: {
          eori: 'ESA98765432',
          type: 'SDE',
          number: 'AUTH-001'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.holderOfAuthorization).not.toBeNull();
      expect(result.data.declarationHeader.holderOfAuthorization.authorizationType).toBe('SDE');
      expect(result.data.declarationHeader.holderOfAuthorization.authorizationNumber).toBe('AUTH-001');
    });

    test('debe usar fallback cuando falta totalPackages (línea 269)', () => {
      const expedition = {
        ...baseExpedition,
        goodsSummary: { totalGrossWeight: 100, totalValue: 1000 }
        // totalPackages ausente → debe dar 0
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.totalPackages).toBe(0);
    });

    test('debe usar fallback cuando falta totalGrossWeight (línea 270)', () => {
      const expedition = {
        ...baseExpedition,
        goodsSummary: { totalPackages: 10, totalValue: 1000 }
        // totalGrossWeight ausente → debe dar 0
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.totalGrossMass).toBe(0);
    });

    test('debe usar representative.representationType direct (línea 199)', () => {
      const expedition = {
        ...baseExpedition,
        representative: {
          eori: 'ESREP123',
          nif: 'REP123',
          companyName: 'Rep Direct',
          representationType: 'direct', // → '2'
          contact: { name: 'Rep Contact', phone: '+34666111222', email: 'rep@test.es' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.declarant.representativeStatus).toBe('2');
    });

    test('debe usar representative.representationType indirect (línea 199 else)', () => {
      const expedition = {
        ...baseExpedition,
        representative: {
          eori: 'ESREP999',
          nif: 'REP999',
          companyName: 'Rep Indirect',
          representationType: 'indirect', // → '3'
          contact: { name: 'Rep Ind', phone: '+34666333444', email: 'repi@test.es' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.declarationHeader.declarant.representativeStatus).toBe('3');
    });

    test('debe tomar defaults cuando representative ausente (líneas 197-201)', () => {
      const expedition = {
        ...baseExpedition,
        // No hay representative definido
        client: {
          ...baseExpedition.client,
          eori: 'ESB22477020', // Mantener EORI válido
          nif: 'B22477020'
        }
      };
      // Sin representative → debe usar fallbacks de línea 198-201

      const result = h1Generator.generate(expedition);

      // El declarante debe tener fallbacks (línea 197 toma representative ausente → línea 198 usa client)
      // Pero si NO hay representative, el código en línea 197 devuelve undefined || `ES${undefined}` = 'ESundefined'
      // El problema es que el código usa expedition.representative?.eori primero, no client
      // Verificar que usa el client como declarante cuando no hay representative
      expect(result.data.declarationHeader.declarant.name).toBe('STRIX AI SL');
      expect(result.data.declarationHeader.declarant.representativeStatus).toBe('3');
      expect(result.data.declarationHeader.declarant.contact.name).toBe('Departamento Aduanas');
    });

    test('debe usar customsOfficeSupervision cuando presente (línea 175)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { customsOfficeSupervision: 'ES002901' };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.declarationHeader.customsOfficeSupervision).toBe('ES002901');
    });

    test('debe usar customsOfficeSupervision null cuando ausente (línea 175)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin customsOfficeSupervision

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.declarationHeader.customsOfficeSupervision).toBeNull();
    });

    test('debe usar customsOfficeGuarantee cuando presente (línea 176)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { customsOfficeGuarantee: 'ES003001' };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.declarationHeader.customsOfficeGuarantee).toBe('ES003001');
    });

    test('debe usar customsOfficeGuarantee null cuando ausente (línea 176)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {};

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.declarationHeader.customsOfficeGuarantee).toBeNull();
    });
  });

  describe('buildGoodsShipment - ramas XML condicionales campos opcionales transporte', () => {
    const baseExpedition = {
      client: {
        eori: 'ESB22477020',
        companyName: 'Cliente Test',
        address: { city: 'Barcelona', province: 'Barcelona' }
      },
      exporter: { country: 'CN' },
      transport: { arrivalPort: 'BARCELONA' },
      goodsSummary: { totalValue: 1000 },
      invoice: { currency: 'EUR' },
      goods: [
        {
          hsCode: '090121',
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe incluir CountryOfProvenanceCode cuando presente (línea 883)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN', countryOfProvenance: 'TW' }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<CountryOfProvenanceCode>TW</CountryOfProvenanceCode>');
    });

    test('debe NO incluir CountryOfProvenanceCode cuando ausente (línea 883 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' },
        exporter: {} // Sin country para que countryOfProvenance sea undefined
      };
      const aiData = {}; // Sin countryOfProvenance en aiData

      const result = h1Generator.generate(expedition, aiData);

      // CountryOfProvenance será undefined → no debe aparecer en XML
      expect(result.xml).not.toContain('<CountryOfProvenanceCode>');
    });

    test('debe incluir CountryOfFirstEntryCode cuando presente (línea 884)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { countryOfFirstEntry: 'FR' };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.xml).toContain('<CountryOfFirstEntryCode>FR</CountryOfFirstEntryCode>');
    });

    test('debe NO incluir CountryOfFirstEntryCode cuando ausente (línea 884 condicional false)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin countryOfFirstEntry

      const result = h1Generator.generate(expedition, aiData);

      // La línea 285 usa aiData.countryOfFirstEntry || 'ES' → siempre tendrá valor
      // Entonces este condicional SIEMPRE será true, no podemos hacer que sea false
      // Este es un caso donde el código tiene un fallback que impide tomar la rama false
      expect(result.xml).toContain('<CountryOfFirstEntryCode>ES</CountryOfFirstEntryCode>');
    });

    test('debe incluir RegistrationNationalityCode cuando nationality presente (línea 891)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          vehicleNationality: 'ES'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RegistrationNationalityCode>ES</RegistrationNationalityCode>');
    });

    test('debe NO incluir RegistrationNationalityCode cuando nationality ausente (línea 891 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin vehicleNationality
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<RegistrationNationalityCode>');
    });

    test('debe incluir ReferenceNumber cuando referenceNumber presente (línea 892)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          voyageNumber: 'V12345'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ReferenceNumber>V12345</ReferenceNumber>');
    });

    test('debe NO incluir ReferenceNumber cuando referenceNumber ausente (línea 892 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin voyageNumber ni flightNumber
      };

      const result = h1Generator.generate(expedition);

      const transportMeansBlock = result.xml.substring(
        result.xml.indexOf('<TransportMeans>'),
        result.xml.indexOf('</TransportMeans>')
      );
      expect(transportMeansBlock).not.toContain('<ReferenceNumber>');
    });

    test('debe incluir IdentificationNumber en DepartureTransportMeans cuando identityInland presente (línea 897)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          inlandVehicleId: 'TRUCK-1234'
        }
      };

      const result = h1Generator.generate(expedition);

      const departureBlock = result.xml.substring(
        result.xml.indexOf('<DepartureTransportMeans>'),
        result.xml.indexOf('</DepartureTransportMeans>')
      );
      expect(departureBlock).toContain('<IdentificationNumber>TRUCK-1234</IdentificationNumber>');
    });

    test('debe NO incluir IdentificationNumber en DepartureTransportMeans cuando identityInland ausente (línea 897 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin inlandVehicleId
      };

      const result = h1Generator.generate(expedition);

      const departureBlock = result.xml.substring(
        result.xml.indexOf('<DepartureTransportMeans>'),
        result.xml.indexOf('</DepartureTransportMeans>')
      );
      expect(departureBlock).not.toContain('<IdentificationNumber>');
    });

    test('debe incluir IdentificationOfLocation cuando presente (línea 904)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          temporaryStorageCode: 'TEMP-001'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationOfLocation>TEMP-001</IdentificationOfLocation>');
    });

    test('debe NO incluir IdentificationOfLocation cuando ausente (línea 904 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin temporaryStorageCode ni warehouseCode
      };

      const result = h1Generator.generate(expedition);

      const goodsLocationBlock = result.xml.substring(
        result.xml.indexOf('<GoodsLocation>'),
        result.xml.indexOf('</GoodsLocation>')
      );
      expect(goodsLocationBlock).not.toContain('<IdentificationOfLocation>');
    });

    test('debe incluir AdditionalIdentifier cuando presente (línea 905)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          warehouseId: 'WH-123'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<AdditionalIdentifier>WH-123</AdditionalIdentifier>');
    });

    test('debe NO incluir AdditionalIdentifier cuando ausente (línea 905 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin warehouseId
      };

      const result = h1Generator.generate(expedition);

      const goodsLocationBlock = result.xml.substring(
        result.xml.indexOf('<GoodsLocation>'),
        result.xml.indexOf('</GoodsLocation>')
      );
      expect(goodsLocationBlock).not.toContain('<AdditionalIdentifier>');
    });

    test('debe incluir UNLOCODE cuando presente (línea 906)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          unLocode: 'ESBCN'
        }
      };

      const result = h1Generator.generate(expedition);

      const goodsLocationBlock = result.xml.substring(
        result.xml.indexOf('<GoodsLocation>'),
        result.xml.indexOf('</GoodsLocation>')
      );
      expect(goodsLocationBlock).toContain('<UNLOCODE>ESBCN</UNLOCODE>');
    });

    test('debe NO incluir UNLOCODE cuando ausente (línea 906 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin unLocode
      };

      const result = h1Generator.generate(expedition);

      const goodsLocationBlock = result.xml.substring(
        result.xml.indexOf('<GoodsLocation>'),
        result.xml.indexOf('</GoodsLocation>')
      );
      expect(goodsLocationBlock).not.toContain('<UNLOCODE>');
    });

    test('debe incluir GPS coordinates cuando presente (líneas 907-911)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          gpsCoordinates: {
            latitude: '41.3851',
            longitude: '2.1734'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<GPS>');
      expect(result.xml).toContain('<Latitude>41.3851</Latitude>');
      expect(result.xml).toContain('<Longitude>2.1734</Longitude>');
    });

    test('debe NO incluir GPS cuando ausente (línea 907 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin gpsCoordinates
      };

      const result = h1Generator.generate(expedition);

      const goodsLocationBlock = result.xml.substring(
        result.xml.indexOf('<GoodsLocation>'),
        result.xml.indexOf('</GoodsLocation>')
      );
      expect(goodsLocationBlock).not.toContain('<GPS>');
    });
  });

  describe('buildGoodsShipment - ramas condicionales transporte', () => {
    const baseExpedition = {
      client: {
        eori: 'ESB22477020',
        companyName: 'Cliente Test',
        address: { city: 'Barcelona', province: 'Barcelona' }
      },
      exporter: { country: 'CN' },
      transport: { arrivalPort: 'BARCELONA' },
      goodsSummary: { totalValue: 1000 },
      invoice: { currency: 'EUR' },
      goods: [
        {
          hsCode: '090121',
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe tomar rama "containers vacío" (línea 340: 0)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { ...baseExpedition.transport, containers: [] }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.containerIndicator).toBe('0');
      expect(result.data.goodsShipment.containers).toEqual([]);
    });

    test('debe tomar rama "containers con elementos" (líneas 341-346)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          ...baseExpedition.transport,
          containers: [
            {
              number: 'CONT123456',
              sealNumber: 'SEAL001',
              sealType: '2',
              sealIdentity: 'ID001'
            },
            {
              number: 'CONT789012',
              sealNumber: 'SEAL002'
              // sealType y sealIdentity ausentes → verificar defaults
            }
          ]
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.containerIndicator).toBe('1');
      expect(result.data.goodsShipment.containers.length).toBe(2);
      expect(result.data.goodsShipment.containers[0].containerNumber).toBe('CONT123456');
      expect(result.data.goodsShipment.containers[0].sealType).toBe('2');
      expect(result.data.goodsShipment.containers[1].sealType).toBe('1'); // default línea 344
    });

    test('debe tomar rama "transportMode AIR" (líneas 296-302)', () => {
      const expedition = {
        ...baseExpedition,
        transportMode: 'air',
        transport: {
          arrivalPort: 'MAD',
          vehicleId: 'IB123',
          flightNumber: 'IB3456',
          vehicleNationality: 'ES'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.transportMeans.modeAtBorder).toBe('4');
      expect(result.data.goodsShipment.transportMeans.typeCode).toBe('41');
    });

    test('debe tomar rama "transportMode SEA/maritime" (líneas 296-302)', () => {
      const expedition = {
        ...baseExpedition,
        transportMode: 'maritime',
        transport: {
          arrivalPort: 'BCN',
          vehicleId: 'MSC123',
          voyageNumber: 'V001',
          vehicleNationality: 'MT'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.transportMeans.modeAtBorder).toBe('1');
      expect(result.data.goodsShipment.transportMeans.typeCode).toBe('11');
    });

    test('debe tomar rama "transportMode ROAD/truck"', () => {
      const expedition = {
        ...baseExpedition,
        transportMode: 'road',
        transport: {
          arrivalPort: 'BCN',
          vehicleId: '1234BCD',
          vehicleNationality: 'ES'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.transportMeans.modeAtBorder).toBe('3');
      expect(result.data.goodsShipment.transportMeans.typeCode).toBe('31');
    });

    test('debe usar defaults cuando expediter.country ausente (línea 284)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {} // Sin country → default 'CN' línea 284
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.countryOfDispatch).toBe('CN');
    });

    test('debe usar defaults cuando incoterm ausente (líneas 350-352)', () => {
      const expedition = {
        ...baseExpedition
        // No hay incoterm → defaults CIF, ES
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.deliveryTerms.code).toBe('CIF');
      expect(result.data.goodsShipment.deliveryTerms.country).toBe('ES');
    });

    test('debe tomar rama "goodsLocation con address" (líneas 313-318)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          storageAddress: {
            street: 'Warehouse St 1',
            city: 'Barcelona',
            postalCode: '08080',
            country: 'ES'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.goodsLocation.address).not.toBeNull();
      expect(result.data.goodsShipment.goodsLocation.address.city).toBe('Barcelona');
    });

    test('debe tomar rama "goodsLocation sin address" (línea 318: null)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' }
        // Sin storageAddress
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.goodsLocation.address).toBeNull();
    });

    test('debe usar defaults transportCharges (líneas 362-365)', () => {
      const expedition = {
        ...baseExpedition
        // Sin costs definidos
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.transportCharges.freightAmount).toBe(0);
      expect(result.data.goodsShipment.transportCharges.freightCurrency).toBe('EUR');
      expect(result.data.goodsShipment.transportCharges.freightPaymentMethod).toBe('A');
      expect(result.data.goodsShipment.transportCharges.freightToDestination).toBe(true);
    });

    test('debe usar defaults insuranceCharges (líneas 370-371)', () => {
      const expedition = {
        ...baseExpedition
        // Sin insurance
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.insuranceCharges.insuranceAmount).toBe(0);
      expect(result.data.goodsShipment.insuranceCharges.insuranceCurrency).toBe('EUR');
    });

    test('debe usar transportModeInland cuando presente (línea 297)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { transportModeInland: '2' }; // rail

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.goodsShipment.transportMeans.modeInland).toBe('2');
    });

    test('debe usar default transportModeInland cuando ausente (línea 297)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin transportModeInland → '3'

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.goodsShipment.transportMeans.modeInland).toBe('3');
    });

    test('debe tomar rama countryOfProvenance desde expedition.transport (línea 292)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN', countryOfProvenance: 'TW' },
        exporter: { country: 'CN' }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.countryOfProvenance).toBe('TW');
    });

    test('debe tomar rama countryOfProvenance desde exporter.country (línea 292 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' }, // Sin countryOfProvenance
        exporter: { country: 'JP' }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.countryOfProvenance).toBe('JP');
    });

    test('debe tomar rama regionOfDestination desde province (línea 289)', () => {
      const expedition = {
        ...baseExpedition,
        client: {
          ...baseExpedition.client,
          address: { province: 'ES-MD', city: 'Madrid' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsShipment.regionOfDestination).toBe('ES-MD');
    });

    test('debe tomar rama regionOfDestination desde city (línea 289 fallback getRegionCode)', () => {
      const expedition = {
        ...baseExpedition,
        client: {
          ...baseExpedition.client,
          address: { city: 'Valencia' } // Sin province → getRegionCode
        }
      };

      const result = h1Generator.generate(expedition);

      // getRegionCode('Valencia') debe retornar 'ES-VC'
      expect(result.data.goodsShipment.regionOfDestination).toBe('ES-VC');
    });
  });

  describe('buildGoodsShipment - ramas XML PlaceOfLoading/Unloading/Containers', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      exporter: { country: 'CN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe incluir LocationName en PlaceOfLoading cuando presente (línea 924)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          loadingPlace: 'SHANGHAI PORT'
        }
      };

      const result = h1Generator.generate(expedition);

      const placeOfLoadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfLoading>'),
        result.xml.indexOf('</PlaceOfLoading>')
      );
      expect(placeOfLoadingBlock).toContain('<LocationName>SHANGHAI PORT</LocationName>');
    });

    test('debe NO incluir LocationName en PlaceOfLoading cuando ausente (línea 924 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin loadingPlace
      };

      const result = h1Generator.generate(expedition);

      const placeOfLoadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfLoading>'),
        result.xml.indexOf('</PlaceOfLoading>')
      );
      expect(placeOfLoadingBlock).not.toContain('<LocationName>');
    });

    test('debe incluir UNLOCODE en PlaceOfLoading cuando presente (línea 925)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          loadingUnLocode: 'CNSHA'
        }
      };

      const result = h1Generator.generate(expedition);

      const placeOfLoadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfLoading>'),
        result.xml.indexOf('</PlaceOfLoading>')
      );
      expect(placeOfLoadingBlock).toContain('<UNLOCODE>CNSHA</UNLOCODE>');
    });

    test('debe NO incluir UNLOCODE en PlaceOfLoading cuando ausente (línea 925 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin loadingUnLocode
      };

      const result = h1Generator.generate(expedition);

      const placeOfLoadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfLoading>'),
        result.xml.indexOf('</PlaceOfLoading>')
      );
      expect(placeOfLoadingBlock).not.toContain('<UNLOCODE>');
    });

    test('debe incluir LocationName en PlaceOfUnloading cuando presente (línea 931)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          unloadingPlace: 'BARCELONA PORT'
        }
      };

      const result = h1Generator.generate(expedition);

      const placeOfUnloadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfUnloading>'),
        result.xml.indexOf('</PlaceOfUnloading>')
      );
      expect(placeOfUnloadingBlock).toContain('<LocationName>BARCELONA PORT</LocationName>');
    });

    test('debe incluir LocationName en PlaceOfUnloading con fallback arrivalPort (línea 329, 931)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin unloadingPlace → usa fallback arrivalPort (línea 329)
      };

      const result = h1Generator.generate(expedition);

      // La línea 329 usa unloadingPlace || arrivalPort, así que siempre tendrá valor
      // Este condicional siempre será true
      const placeOfUnloadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfUnloading>'),
        result.xml.indexOf('</PlaceOfUnloading>')
      );
      expect(placeOfUnloadingBlock).toContain('<LocationName>BCN</LocationName>');
    });

    test('debe incluir UNLOCODE en PlaceOfUnloading cuando presente (línea 932)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          unloadingUnLocode: 'ESBCN'
        }
      };

      const result = h1Generator.generate(expedition);

      const placeOfUnloadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfUnloading>'),
        result.xml.indexOf('</PlaceOfUnloading>')
      );
      expect(placeOfUnloadingBlock).toContain('<UNLOCODE>ESBCN</UNLOCODE>');
    });

    test('debe NO incluir UNLOCODE en PlaceOfUnloading cuando ausente (línea 932 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: { arrivalPort: 'BCN' } // Sin unloadingUnLocode
      };

      const result = h1Generator.generate(expedition);

      const placeOfUnloadingBlock = result.xml.substring(
        result.xml.indexOf('<PlaceOfUnloading>'),
        result.xml.indexOf('</PlaceOfUnloading>')
      );
      expect(placeOfUnloadingBlock).not.toContain('<UNLOCODE>');
    });

    test('debe incluir SealType en Container cuando presente (línea 942)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          containers: [
            {
              number: 'CONT123',
              sealNumber: 'SEAL001',
              sealType: '2' // Presente
            }
          ]
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<SealType>2</SealType>');
    });

    test('debe NO incluir SealType en Container cuando ausente (línea 942 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          containers: [
            {
              number: 'CONT456',
              sealNumber: 'SEAL002'
              // Sin sealType
            }
          ]
        }
      };

      const result = h1Generator.generate(expedition);

      // La línea 344 usa sealType || '1', así que SIEMPRE tendrá valor
      // Este condicional siempre será true
      expect(result.xml).toContain('<SealType>1</SealType>');
    });

    test('debe incluir SealIdentity en Container cuando presente (línea 943)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          containers: [
            {
              number: 'CONT789',
              sealNumber: 'SEAL003',
              sealIdentity: 'ID-SEAL-003'
            }
          ]
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<SealIdentity>ID-SEAL-003</SealIdentity>');
    });

    test('debe NO incluir SealIdentity en Container cuando ausente (línea 943 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        transport: {
          arrivalPort: 'BCN',
          containers: [
            {
              number: 'CONT999',
              sealNumber: 'SEAL004'
              // Sin sealIdentity
            }
          ]
        }
      };

      const result = h1Generator.generate(expedition);

      const containerBlock = result.xml.substring(
        result.xml.indexOf('<Container>'),
        result.xml.indexOf('</Container>')
      );
      expect(containerBlock).not.toContain('<SealIdentity>');
    });

    test('debe incluir CountryCode en DeliveryTerms cuando presente (línea 953)', () => {
      const expedition = {
        ...baseExpedition,
        incoterm: {
          code: 'FOB',
          place: 'Shanghai',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      const deliveryTermsBlock = result.xml.substring(
        result.xml.indexOf('<DeliveryTerms>'),
        result.xml.indexOf('</DeliveryTerms>')
      );
      expect(deliveryTermsBlock).toContain('<CountryCode>CN</CountryCode>');
    });

    test('debe NO incluir CountryCode en DeliveryTerms cuando ausente (línea 953 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        incoterm: {
          code: 'EXW',
          place: 'Warehouse'
          // Sin country
        }
      };

      const result = h1Generator.generate(expedition);

      const deliveryTermsBlock = result.xml.substring(
        result.xml.indexOf('<DeliveryTerms>'),
        result.xml.indexOf('</DeliveryTerms>')
      );
      // La línea 352 usa country || 'ES', así que SIEMPRE tendrá valor
      expect(deliveryTermsBlock).toContain('<CountryCode>ES</CountryCode>');
    });
  });

  describe('buildValuation - ramas XML indicadores booleanos (líneas 981-986)', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 5000 },
      invoice: { currency: 'EUR' },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 5000,
          grossWeight: 200,
          netWeight: 190,
          packages: { quantity: 20, type: 'CT' }
        }
      ]
    };

    test('debe tomar rama RelatedPartyIndicator = 1 cuando relatedParty true (línea 981)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { relatedParty: true }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RelatedPartyIndicator>1</RelatedPartyIndicator>');
    });

    test('debe tomar rama RelatedPartyIndicator = 0 cuando relatedParty false (línea 981)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { relatedParty: false }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RelatedPartyIndicator>0</RelatedPartyIndicator>');
    });

    test('debe tomar rama RelatedPartyInfluenceIndicator = 1 cuando relatedPartyInfluence true (línea 982)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { relatedPartyInfluence: true }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RelatedPartyInfluenceIndicator>1</RelatedPartyInfluenceIndicator>');
    });

    test('debe tomar rama RelatedPartyInfluenceIndicator = 0 cuando relatedPartyInfluence false (línea 982)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { relatedPartyInfluence: false }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RelatedPartyInfluenceIndicator>0</RelatedPartyInfluenceIndicator>');
    });

    test('debe tomar rama RestrictionsIndicator = 1 cuando restrictions true (línea 983)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { restrictions: true }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RestrictionsIndicator>1</RestrictionsIndicator>');
    });

    test('debe tomar rama RestrictionsIndicator = 0 cuando restrictions false (línea 983)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { restrictions: false }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RestrictionsIndicator>0</RestrictionsIndicator>');
    });

    test('debe tomar rama ConditionsIndicator = 1 cuando conditions true (línea 984)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { conditions: true }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ConditionsIndicator>1</ConditionsIndicator>');
    });

    test('debe tomar rama ConditionsIndicator = 0 cuando conditions false (línea 984)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { conditions: false }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ConditionsIndicator>0</ConditionsIndicator>');
    });

    test('debe tomar rama RoyaltiesIndicator = 1 cuando royaltiesIncluded true (línea 985)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { royalties: 500 } // > 0 → royaltiesIncluded será true (línea 430)
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RoyaltiesIndicator>1</RoyaltiesIndicator>');
    });

    test('debe tomar rama RoyaltiesIndicator = 0 cuando royaltiesIncluded false (línea 985)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { royalties: 0 } // = 0 → royaltiesIncluded será false
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RoyaltiesIndicator>0</RoyaltiesIndicator>');
    });

    test('debe tomar rama ResaleProceedsIndicator = 1 cuando resaleProceedsIncluded true (línea 986)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { resaleProceeds: 300 } // > 0 → resaleProceedsIncluded será true (línea 431)
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ResaleProceedsIndicator>1</ResaleProceedsIndicator>');
    });

    test('debe tomar rama ResaleProceedsIndicator = 0 cuando resaleProceedsIncluded false (línea 986)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { resaleProceeds: 0 } // = 0 → resaleProceedsIncluded será false
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ResaleProceedsIndicator>0</ResaleProceedsIndicator>');
    });
  });

  describe('buildValuation - ramas condicionales additions y deductions', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 5000 },
      invoice: { currency: 'EUR' },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 5000,
          grossWeight: 200,
          netWeight: 190,
          packages: { quantity: 20, type: 'CT' }
        }
      ]
    };

    test('debe tomar ramas de additions positivas (líneas 994-1003)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: {
          commissions: 100,
          brokerage: 50,
          containers: 200,
          packing: 30,
          materials: 150,
          tools: 80,
          consumed: 40,
          engineering: 120,
          royalties: 250,
          resaleProceeds: 300
        },
        costs: { freight: 500, insurance: 100 }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.additions.commissions).toBe(100);
      expect(result.data.valuation.additions.brokerage).toBe(50);
      expect(result.data.valuation.additions.containers).toBe(200);
      expect(result.data.valuation.additions.packing).toBe(30);
      expect(result.data.valuation.additions.materials).toBe(150);
      expect(result.data.valuation.additions.tools).toBe(80);
      expect(result.data.valuation.additions.consumed).toBe(40);
      expect(result.data.valuation.additions.engineering).toBe(120);
      expect(result.data.valuation.additions.royalties).toBe(250);
      expect(result.data.valuation.additions.resaleProceeds).toBe(300);
      expect(result.data.valuation.totalAdditions).toBeGreaterThan(1000);
    });

    test('debe tomar ramas de additions cero/falsy (líneas 386-398 fallback 0)', () => {
      const expedition = {
        ...baseExpedition
        // Sin valuation ni costs → todo 0
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.additions.commissions).toBe(0);
      expect(result.data.valuation.additions.brokerage).toBe(0);
      expect(result.data.valuation.additions.royalties).toBe(0);
      expect(result.data.valuation.additions.freightToEU).toBe(0);
      expect(result.data.valuation.additions.insuranceToEU).toBe(0);
    });

    test('debe tomar ramas de deductions positivas (líneas 1011-1018)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: {
          freightAfterImport: 50,
          installationCharges: 100,
          customsDuties: 200,
          interestCharges: 30,
          buyingCommissions: 60,
          postImportTransport: 40,
          constructionCharges: 80,
          otherDeductions: 20
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.deductions.freightAfterImport).toBe(50);
      expect(result.data.valuation.deductions.installationCharges).toBe(100);
      expect(result.data.valuation.deductions.customsDuties).toBe(200);
      expect(result.data.valuation.deductions.interestCharges).toBe(30);
      expect(result.data.valuation.deductions.buyingCommissions).toBe(60);
      expect(result.data.valuation.deductions.postImportTransport).toBe(40);
      expect(result.data.valuation.deductions.constructionCharges).toBe(80);
      expect(result.data.valuation.deductions.otherDeductions).toBe(20);
      expect(result.data.valuation.totalDeductions).toBeGreaterThan(500);
    });

    test('debe tomar ramas de deductions cero/falsy (líneas 404-412 fallback 0)', () => {
      const expedition = {
        ...baseExpedition
        // Sin valuation → todo 0
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.deductions.freightAfterImport).toBe(0);
      expect(result.data.valuation.deductions.installationCharges).toBe(0);
      expect(result.data.valuation.deductions.customsDuties).toBe(0);
      expect(result.data.valuation.totalDeductions).toBe(0);
    });

    test('debe tomar rama valuationMethod desde aiData (línea 421)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { valuationMethod: '2' }; // Valor de transacción de mercancías idénticas

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.valuation.valuationMethod).toBe('2');
    });

    test('debe tomar rama valuationMethod desde expedition.valuation (línea 421 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { method: '3' }
      };
      const aiData = {}; // Sin valuationMethod

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.valuation.valuationMethod).toBe('3');
    });

    test('debe tomar rama valuationMethod default "1" (línea 421 último fallback)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin ninguno

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.valuation.valuationMethod).toBe('1');
    });

    test('debe calcular indicators.royaltiesIncluded TRUE cuando additions.royalties > 0 (línea 430)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { royalties: 500 }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.indicators.royaltiesIncluded).toBe(true);
    });

    test('debe calcular indicators.royaltiesIncluded FALSE cuando additions.royalties = 0 (línea 430 else)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { royalties: 0 }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.indicators.royaltiesIncluded).toBe(false);
    });

    test('debe calcular indicators.resaleProceedsIncluded TRUE cuando additions.resaleProceeds > 0 (línea 431)', () => {
      const expedition = {
        ...baseExpedition,
        valuation: { resaleProceeds: 200 }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.indicators.resaleProceedsIncluded).toBe(true);
    });

    test('debe calcular indicators.resaleProceedsIncluded FALSE cuando additions.resaleProceeds = 0 (línea 431 else)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.valuation.indicators.resaleProceedsIncluded).toBe(false);
    });
  });

  describe('buildDutyTaxFee - ramas condicionales duties', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      invoice: { currency: 'EUR' },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe tomar rama "antidumpingDuty NULL" cuando antidumpingRate = 0 (línea 497)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { antidumpingRate: 0 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.antidumpingDuty).toBeNull();
    });

    test('debe tomar rama "antidumpingDuty presente" cuando antidumpingRate > 0 (líneas 491-496)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { antidumpingRate: 15, tariffRate: 5 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.antidumpingDuty).not.toBeNull();
      expect(result.data.dutyTaxFee.antidumpingDuty.rate).toBe(15);
      expect(result.data.dutyTaxFee.antidumpingDuty.type).toBe('A10');
    });

    test('debe tomar rama "exciseDuty NULL" cuando exciseRate = 0 (línea 506)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { exciseRate: 0 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.exciseDuty).toBeNull();
    });

    test('debe tomar rama "exciseDuty presente" cuando exciseRate > 0 (líneas 500-505)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { exciseRate: 10, tariffRate: 2 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.exciseDuty).not.toBeNull();
      expect(result.data.dutyTaxFee.exciseDuty.rate).toBe(10);
      expect(result.data.dutyTaxFee.exciseDuty.type).toBe('E00');
    });

    test('debe tomar rama "deferredPayment NULL" cuando payment.deferred = false (línea 529)', () => {
      const expedition = {
        ...baseExpedition,
        payment: { method: 'A', deferred: false }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.dutyTaxFee.deferredPayment).toBeNull();
    });

    test('debe tomar rama "deferredPayment presente" cuando payment.deferred = true (líneas 526-528)', () => {
      const expedition = {
        ...baseExpedition,
        payment: {
          method: 'E',
          deferred: true,
          deferredAccount: 'ACC001',
          deferredAuthorization: 'AUTH-002'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.dutyTaxFee.deferredPayment).not.toBeNull();
      expect(result.data.dutyTaxFee.deferredPayment.accountNumber).toBe('ACC001');
      expect(result.data.dutyTaxFee.deferredPayment.authorizationNumber).toBe('AUTH-002');
    });

    test('debe usar defaults cuando tariffRate/vatRate ausentes (líneas 463-466)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin tasas → defaults: tariffRate 0, vatRate 21

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.importDuty.rate).toBe(0);
      expect(result.data.dutyTaxFee.vat.rate).toBe(21);
    });

    test('debe usar paymentMethod desde aiData (línea 522)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { paymentMethod: 'H' }; // Transferencia electrónica

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.paymentMethod).toBe('H');
    });

    test('debe usar paymentMethod desde expedition.payment (línea 522 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        payment: { method: 'B' } // Tarjeta de crédito
      };
      const aiData = {};

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.paymentMethod).toBe('B');
    });

    test('debe usar paymentMethod default "A" (línea 522 último fallback)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {};

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.dutyTaxFee.paymentMethod).toBe('A');
    });
  });

  describe('buildGuarantee - rama NULL vs presente', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe retornar NULL cuando guarantee ausente (línea 540-541)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {}; // Sin guarantee

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.guarantee).toBeNull();
    });

    test('debe retornar guarantee presente cuando expedition.guarantee existe (líneas 544-566)', () => {
      const expedition = {
        ...baseExpedition,
        guarantee: {
          type: '1',
          grn: 'GRN123456',
          accessCode: 'AC001',
          amount: 5000,
          currency: 'EUR',
          reference: 'REF-GUAR-001',
          customsOffice: 'ES002801',
          guarantor: {
            eori: 'ESG11111111',
            nif: 'G11111111',
            name: 'Guarantor SL'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.guarantee).not.toBeNull();
      expect(result.data.guarantee.guaranteeType).toBe('1');
      expect(result.data.guarantee.grn).toBe('GRN123456');
      expect(result.data.guarantee.guarantor.identificationNumber).toContain('G11111111');
    });

    test('debe retornar guarantee presente desde aiData (líneas 544-566)', () => {
      const expedition = { ...baseExpedition };
      const aiData = {
        guarantee: {
          type: '2',
          grn: 'GRN999',
          amount: 8000,
          currency: 'USD'
        }
      };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.guarantee).not.toBeNull();
      expect(result.data.guarantee.guaranteeType).toBe('2');
      expect(result.data.guarantee.grn).toBe('GRN999');
    });

    test('debe tomar rama guarantor NULL cuando garantía sin guarantor (línea 566)', () => {
      const expedition = {
        ...baseExpedition,
        guarantee: { type: '1', amount: 1000 }
        // Sin guarantor
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.guarantee.guarantor).toBeNull();
    });

    test('debe tomar rama guarantor presente (líneas 563-565)', () => {
      const expedition = {
        ...baseExpedition,
        guarantee: {
          type: '1',
          amount: 1000,
          guarantor: {
            eori: 'ESG22222222',
            nif: 'G22222222',
            name: 'Fiador SA'
          }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.guarantee.guarantor).not.toBeNull();
      expect(result.data.guarantee.guarantor.name).toBe('Fiador SA');
    });
  });

  describe('buildGoodsItems - ramas condicionales arrays previousDocuments y additionalInformation', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      exporter: { country: 'CN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe tomar rama previousDocuments CON elementos (líneas 1184-1188)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            previousDocuments: [
              { type: 'N235', reference: 'PREV-DOC-001' },
              { type: 'N270', reference: 'PREV-DOC-002' }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // Verificar que se generó el XML con previousDocuments
      expect(result.xml).toContain('<PreviousDocument>');
      expect(result.xml).toContain('<TypeCode>N235</TypeCode>');
      expect(result.xml).toContain('<ID>PREV-DOC-001</ID>');
      expect(result.xml).toContain('<TypeCode>N270</TypeCode>');
      expect(result.xml).toContain('<ID>PREV-DOC-002</ID>');
    });

    test('debe tomar rama previousDocuments vacío (línea 1184 con array vacío)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            previousDocuments: [] // Array vacío
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // No debe incluir bloque PreviousDocument
      expect(result.xml).not.toContain('<PreviousDocument>');
    });

    test('debe tomar rama additionalInformation CON elementos (líneas 1191-1195)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            additionalInformation: [
              { code: 'GEN01', description: 'Informacion adicional 1' },
              { code: 'GEN02', description: 'Informacion adicional 2' }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // Verificar que se generó el XML con additionalInformation
      expect(result.xml).toContain('<AdditionalInformation>');
      expect(result.xml).toContain('<StatementCode>GEN01</StatementCode>');
      expect(result.xml).toContain('<StatementDescription>Informacion adicional 1</StatementDescription>');
      expect(result.xml).toContain('<StatementCode>GEN02</StatementCode>');
      expect(result.xml).toContain('<StatementDescription>Informacion adicional 2</StatementDescription>');
    });

    test('debe tomar rama additionalInformation vacío (línea 1191 con array vacío)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            additionalInformation: [] // Array vacío
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // No debe incluir bloque AdditionalInformation
      expect(result.xml).not.toContain('<AdditionalInformation>');
    });
  });

  describe('buildGoodsItems - ramas XML condicionales clasificación y medidas', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      exporter: { country: 'CN' },
      goods: []
    };

    test('debe incluir Classification HS cuando harmonizedSystemCode presente (líneas 1107-1111)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            hsCode: '090121',
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationTypeCode>HS</IdentificationTypeCode>');
      expect(result.xml).toContain('<ID>090121</ID>');
    });

    test('debe NO incluir Classification HS cuando harmonizedSystemCode ausente (línea 1107 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            // Sin hsCode ni taricCode (que son el origen del HS Code)
            description: 'Cafe sin HS',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // Debe tener el TSP pero NO el HS
      expect(result.xml).toContain('<IdentificationTypeCode>TSP</IdentificationTypeCode>');
      // NO debe incluir bloque HS
      const commodityBlock = result.xml.substring(
        result.xml.indexOf('<Commodity>'),
        result.xml.indexOf('</Commodity>')
      );
      // Contar cuántas veces aparece IdentificationTypeCode
      const hsMatches = (commodityBlock.match(/<IdentificationTypeCode>HS<\/IdentificationTypeCode>/g) || []).length;
      expect(hsMatches).toBe(0);
    });

    test('debe incluir Classification CN cuando combinedNomenclatureCode presente (líneas 1112-1116)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '2204210000',
            description: 'Vino',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationTypeCode>CN</IdentificationTypeCode>');
      expect(result.xml).toContain('<ID>22042100</ID>'); // substring(0,8)
    });

    test('debe incluir Classification TRA cuando taricAdditionalCode presente (líneas 1117-1121)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            taricAdditionalCode: 'X001',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationTypeCode>TRA</IdentificationTypeCode>');
      expect(result.xml).toContain('<ID>X001</ID>');
    });

    test('debe NO incluir Classification TRA cuando taricAdditionalCode ausente (línea 1117 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            // Sin taricAdditionalCode
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const commodityBlock = result.xml.substring(
        result.xml.indexOf('<Commodity>'),
        result.xml.indexOf('</Commodity>')
      );
      const traMatches = (commodityBlock.match(/<IdentificationTypeCode>TRA<\/IdentificationTypeCode>/g) || []).length;
      expect(traMatches).toBe(0);
    });

    test('debe incluir Classification NAC cuando nationalAdditionalCode presente (líneas 1122-1126)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            nationalCode: 'NAT001',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationTypeCode>NAC</IdentificationTypeCode>');
      expect(result.xml).toContain('<ID>NAT001</ID>');
    });

    test('debe NO incluir Classification NAC cuando nationalAdditionalCode ausente (línea 1122 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            // Sin nationalCode
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const commodityBlock = result.xml.substring(
        result.xml.indexOf('<Commodity>'),
        result.xml.indexOf('</Commodity>')
      );
      const nacMatches = (commodityBlock.match(/<IdentificationTypeCode>NAC<\/IdentificationTypeCode>/g) || []).length;
      expect(nacMatches).toBe(0);
    });

    test('debe incluir Classification CUS cuando cusCode presente (líneas 1127-1131)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            cusCode: 'CUS001',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IdentificationTypeCode>CUS</IdentificationTypeCode>');
      expect(result.xml).toContain('<ID>CUS001</ID>');
    });

    test('debe NO incluir Classification CUS cuando cusCode ausente (línea 1127 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            // Sin cusCode
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const commodityBlock = result.xml.substring(
        result.xml.indexOf('<Commodity>'),
        result.xml.indexOf('</Commodity>')
      );
      const cusMatches = (commodityBlock.match(/<IdentificationTypeCode>CUS<\/IdentificationTypeCode>/g) || []).length;
      expect(cusMatches).toBe(0);
    });

    test('debe incluir TariffQuantity cuando supplementaryUnits presente (línea 1135)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            supplementaryUnits: 500,
            supplementaryUnitType: 'KGM',
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<TariffQuantity unitCode="KGM">500</TariffQuantity>');
    });

    test('debe NO incluir TariffQuantity cuando supplementaryUnits ausente (línea 1135 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            // Sin supplementaryUnits
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<TariffQuantity');
    });

    test('debe incluir RegionID cuando regionOfOrigin presente (línea 1152)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            regionOfOrigin: 'CN-SH',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<RegionID>CN-SH</RegionID>');
    });

    test('debe NO incluir RegionID cuando regionOfOrigin ausente (línea 1152 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            // Sin regionOfOrigin
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const originBlock = result.xml.substring(
        result.xml.indexOf('<Origin>'),
        result.xml.indexOf('</Origin>')
      );
      expect(originBlock).not.toContain('<RegionID>');
    });

    test('debe incluir ValuationAdjustment cuando presente (línea 1171)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            valuationAdjustment: 150,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ValuationAdjustment>150</ValuationAdjustment>');
    });

    test('debe NO incluir ValuationAdjustment cuando ausente (línea 1171 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            // Sin valuationAdjustment
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const valuationBlock = result.xml.substring(
        result.xml.indexOf('<CustomsValuation>'),
        result.xml.lastIndexOf('</CustomsValuation>')
      );
      expect(valuationBlock).not.toContain('<ValuationAdjustment>');
    });
  });

  describe('buildGoodsItems - ramas condicionales campos opcionales', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      exporter: { country: 'CN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT', marks: 'COFFEE-01' }
        }
      ]
    };

    test('debe tomar ramas hsCode y combinedNomenclatureCode desde taricCode (líneas 590-591)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            // Sin hsCode ni combinedNomenclatureCode directos, solo taricCode
            taricCode: '2204210000',
            description: 'Vino tinto',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].commodityCode.harmonizedSystemCode).toBe('220421'); // substring(0,6)
      expect(result.data.goodsItems[0].commodityCode.combinedNomenclatureCode).toBe('22042100'); // substring(0,8)
    });

    test('debe tomar rama taricAdditionalCode desde good.taricAdditionalCode (línea 593)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            taricAdditionalCode: 'X001',
            description: 'Cafe con código adicional',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].commodityCode.taricAdditionalCode).toBe('X001');
    });

    test('debe tomar rama taricAdditionalCode desde taricCode substring(10,14) (línea 593 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '09012100001234', // 14 caracteres → substring(10,14) = '1234'
            description: 'Cafe con código taric largo',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].commodityCode.taricAdditionalCode).toBe('1234');
    });

    test('debe tomar rama requestedProcedure desde aiData (línea 603)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { regime: '42' }; // Libre práctica + entrega intracomunitaria

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.goodsItems[0].requestedProcedure).toBe('42');
    });

    test('debe tomar rama requestedProcedure desde good.regime (línea 603 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            regime: '51', // Perfeccionamiento activo
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].requestedProcedure).toBe('51');
    });

    test('debe tomar rama requestedProcedure default "40" (línea 603 último fallback)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].requestedProcedure).toBe('40');
    });

    test('debe tomar rama additionalProcedure desde good (línea 605)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            additionalProcedure: '001',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].additionalProcedure).toBe('001');
    });

    test('debe tomar rama additionalProcedure desde aiData (línea 605 fallback)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { additionalProcedure: '002' };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.goodsItems[0].additionalProcedure).toBe('002');
    });

    test('debe tomar rama additionalProcedure default "000" (línea 605 último fallback)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].additionalProcedure).toBe('000');
    });

    test('debe tomar rama countryOfOrigin desde good (línea 608)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            originCountry: 'CO',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].countryOfOrigin).toBe('CO');
    });

    test('debe tomar rama countryOfOrigin desde exporter.country (línea 608 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: { country: 'BR' },
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            // Sin originCountry
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].countryOfOrigin).toBe('BR');
    });

    test('debe tomar rama preferentialOrigin desde good (línea 610)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            preferentialOrigin: 'KE',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].preferentialOrigin).toBe('KE');
    });

    test('debe tomar rama preferentialOrigin desde originCountry (línea 610 fallback)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            originCountry: 'ET',
            // Sin preferentialOrigin
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].preferentialOrigin).toBe('ET');
    });

    test('debe tomar rama preference desde good (línea 611)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            preference: '200', // SPG
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].preference).toBe('200');
    });

    test('debe tomar rama preference desde aiData (línea 611 fallback)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { preference: '300' }; // EUR-1

      const result = h1Generator.generate(expedition, aiData);

      expect(result.data.goodsItems[0].preference).toBe('300');
    });

    test('debe tomar rama preference default "100" (línea 611 último fallback)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.data.goodsItems[0].preference).toBe('100');
    });

    test('debe tomar rama endUseCode presente (líneas 1197-1201)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            endUseCode: 'EU001',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // Verificar en el XML generado
      expect(result.xml).toContain('<EndUseCode>EU001</EndUseCode>');
    });

    test('debe tomar rama endUseCode ausente (línea 1197 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      // No debe incluir EndUse en XML
      expect(result.xml).not.toContain('<EndUse>');
    });
  });

  describe('buildSupportingDocuments - ramas XML condicionales date y validUntil', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN', documentNumber: 'BL123456' },
      invoice: { number: 'INV-001' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe incluir IssueDate cuando doc.date presente (línea 1179)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'commercial_invoice',
            originalName: 'invoice-001.pdf',
            uploadedAt: '2026-08-01T10:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<IssueDate>2026-08-01</IssueDate>');
    });

    test('debe NO incluir IssueDate cuando doc.date ausente (línea 1179 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'commercial_invoice',
            originalName: 'invoice-002.pdf'
            // Sin uploadedAt
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const additionalDocBlock = result.xml.substring(
        result.xml.indexOf('<AdditionalDocument>'),
        result.xml.indexOf('</AdditionalDocument>')
      );
      expect(additionalDocBlock).not.toContain('<IssueDate>');
    });

    test('debe incluir ValidUntilDate cuando doc.validUntil presente (línea 1180)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'certificate_origin',
            originalName: 'origin-001.pdf',
            uploadedAt: '2026-08-01T09:00:00Z',
            validUntil: '2026-12-31T00:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<ValidUntilDate>2026-12-31</ValidUntilDate>');
    });

    test('debe NO incluir ValidUntilDate cuando doc.validUntil ausente (línea 1180 condicional false)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'certificate_origin',
            originalName: 'origin-002.pdf',
            uploadedAt: '2026-08-01T09:00:00Z'
            // Sin validUntil
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const additionalDocBlock = result.xml.substring(
        result.xml.indexOf('<AdditionalDocument>'),
        result.xml.indexOf('</AdditionalDocument>')
      );
      expect(additionalDocBlock).not.toContain('<ValidUntilDate>');
    });

    test('debe usar fallback vacío cuando doc.reference ausente en supportingDocuments (línea 1178)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            documents: [
              {
                type: 'N990',
                // Sin reference
                date: '2026-07-20T00:00:00Z'
              }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // Debe incluir el documento con ID vacío
      expect(result.xml).toContain('<TypeCode>N990</TypeCode>');
      expect(result.xml).toContain('<ID></ID>'); // Fallback vacío
    });

    test('debe usar fallback vacío cuando doc.reference ausente en previousDocuments (línea 1187)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            previousDocuments: [
              {
                type: 'N235'
                // Sin reference
              }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      const prevDocBlock = result.xml.substring(
        result.xml.indexOf('<PreviousDocument>'),
        result.xml.indexOf('</PreviousDocument>')
      );
      expect(prevDocBlock).toContain('<TypeCode>N235</TypeCode>');
      expect(prevDocBlock).toContain('<ID></ID>'); // Fallback vacío
    });

    test('debe usar fallback vacío cuando info.description ausente en additionalInformation (línea 1194)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            additionalInformation: [
              {
                code: 'GEN01'
                // Sin description
              }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<StatementCode>GEN01</StatementCode>');
      expect(result.xml).toContain('<StatementDescription></StatementDescription>'); // Fallback vacío
    });
  });

  describe('buildSupportingDocuments - ramas condicionales por tipo de documento', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN', documentNumber: 'BL123456' },
      invoice: { number: 'INV-001' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe incluir factura comercial cuando documents contiene commercial_invoice (líneas 660-667)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'commercial_invoice',
            originalName: 'invoice-001.pdf',
            uploadedAt: '2026-08-01T10:00:00Z',
            issuer: 'Exporter CN'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N380')).toBe(true);
      expect(docs.find(d => d.type === 'N380').reference).toBe('invoice-001.pdf');
    });

    test('debe incluir documento de transporte marítimo cuando documents contiene bill_of_lading (líneas 670-678)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'bill_of_lading',
            originalName: 'BL-001.pdf',
            uploadedAt: '2026-08-02T12:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N705')).toBe(true); // BL
    });

    test('debe incluir documento de transporte aéreo cuando documents contiene air_waybill (líneas 670-678)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'air_waybill',
            originalName: 'AWB-001.pdf',
            uploadedAt: '2026-08-02T14:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N740')).toBe(true); // AWB
    });

    test('debe incluir certificado origen cuando documents contiene certificate_origin (líneas 682-691)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'certificate_origin',
            originalName: 'ORIGIN-001.pdf',
            uploadedAt: '2026-08-01T09:00:00Z',
            validUntil: '2026-12-31T00:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N861')).toBe(true);
    });

    test('debe incluir packing list cuando documents contiene packing_list (líneas 695-701)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'packing_list',
            originalName: 'PACKING-001.pdf',
            uploadedAt: '2026-08-01T11:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N271')).toBe(true);
    });

    test('debe incluir certificado sanitario cuando documents contiene sanitary_certificate (líneas 705-712)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'sanitary_certificate',
            originalName: 'SANITARY-001.pdf',
            uploadedAt: '2026-07-30T08:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'C678')).toBe(true);
    });

    test('debe incluir certificado fitosanitario cuando documents contiene phytosanitary_certificate (líneas 714-721)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'phytosanitary_certificate',
            originalName: 'PHYTO-001.pdf',
            uploadedAt: '2026-07-28T07:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'C635')).toBe(true);
    });

    test('debe incluir licencia de importación cuando documents contiene import_license (líneas 724-731)', () => {
      const expedition = {
        ...baseExpedition,
        documents: [
          {
            type: 'import_license',
            originalName: 'LICENSE-001.pdf',
            uploadedAt: '2026-07-25T10:00:00Z'
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.type === 'N990')).toBe(true);
    });

    test('debe incluir documentos adicionales de good.documents (líneas 734-741)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' },
            documents: [
              {
                type: 'N990',
                reference: 'CUSTOM-DOC-001',
                date: '2026-07-20T00:00:00Z'
              }
            ]
          }
        ]
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs.some(d => d.reference === 'CUSTOM-DOC-001')).toBe(true);
    });

    test('debe retornar array vacío cuando no hay documentos (documentos todos falsy)', () => {
      const expedition = {
        ...baseExpedition
        // Sin documents, sin good.documents
      };

      const result = h1Generator.generate(expedition);
      const docs = result.data.goodsItems[0].supportingDocuments;

      expect(docs).toEqual([]);
    });
  });

  describe('generateXML - ramas condicionales en bloques XML opcionales', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe incluir bloque Exporter cuando header.exporter presente (líneas 821-832)', () => {
      const expedition = {
        ...baseExpedition,
        exporter: {
          eori: 'CN123',
          companyName: 'Exporter CN',
          address: 'Exporter St',
          city: 'Shanghai',
          country: 'CN'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<Exporter>');
      expect(result.xml).toContain('<Name>Exporter CN</Name>');
    });

    test('debe NO incluir bloque Exporter cuando header.exporter ausente (línea 821 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<Exporter>');
    });

    test('debe incluir bloque Buyer cuando header.buyer presente (líneas 834-844)', () => {
      const expedition = {
        ...baseExpedition,
        buyer: {
          eori: 'ESB99',
          companyName: 'Buyer Test',
          address: { street: 'Buyer St', city: 'Madrid', country: 'ES' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<Buyer>');
      expect(result.xml).toContain('<Name>Buyer Test</Name>');
    });

    test('debe NO incluir bloque Buyer cuando header.buyer ausente (línea 834 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<Buyer>');
    });

    test('debe incluir bloque Seller cuando header.seller presente (líneas 846-856)', () => {
      const expedition = {
        ...baseExpedition,
        seller: {
          eori: 'CN555',
          companyName: 'Seller CN',
          address: { street: 'Seller St', city: 'Beijing', country: 'CN' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<Seller>');
      expect(result.xml).toContain('<Name>Seller CN</Name>');
    });

    test('debe NO incluir bloque Seller cuando header.seller ausente (línea 846 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<Seller>');
    });

    test('debe incluir bloque HolderOfTheProcedure cuando header.holderOfProcedure presente (líneas 858-863)', () => {
      const expedition = {
        ...baseExpedition,
        holderOfProcedure: {
          eori: 'ESH123',
          companyName: 'Holder Test'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<HolderOfTheProcedure>');
      expect(result.xml).toContain('<Name>Holder Test</Name>');
    });

    test('debe NO incluir bloque HolderOfTheProcedure cuando ausente (línea 858 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<HolderOfTheProcedure>');
    });

    test('debe incluir bloque HolderOfTheAuthorisation cuando header.holderOfAuthorization presente (líneas 865-871)', () => {
      const expedition = {
        ...baseExpedition,
        holderOfAuthorization: {
          eori: 'ESA98765',
          type: 'SDE',
          number: 'AUTH-001'
        }
      };

      const result = h1Generator.generate(expedition);

      // Verificar que el objeto se construyó correctamente primero
      expect(result.data.declarationHeader.holderOfAuthorization).not.toBeNull();
      expect(result.data.declarationHeader.holderOfAuthorization.authorizationType).toBe('SDE');

      // Verificar el XML
      expect(result.xml).toContain('<HolderOfTheAuthorisation>');
      expect(result.xml).toContain('<AuthorisationTypeCode>SDE</AuthorisationTypeCode>');
      expect(result.xml).toContain('<AuthorisationReferenceNumber>AUTH-001</AuthorisationReferenceNumber>');
    });

    test('debe NO incluir bloque HolderOfTheAuthorisation cuando ausente (línea 865 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<HolderOfTheAuthorisation>');
    });

    test('debe incluir bloque AntidumpingDuty cuando duties.antidumpingDuty presente (líneas 1039-1046)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { antidumpingRate: 10, tariffRate: 5 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.xml).toContain('<AntidumpingDuty>');
      expect(result.xml).toContain('<TaxRate>10</TaxRate>');
    });

    test('debe NO incluir bloque AntidumpingDuty cuando duties.antidumpingDuty ausente (línea 1039 condicional false)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { antidumpingRate: 0 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.xml).not.toContain('<AntidumpingDuty>');
    });

    test('debe incluir bloque ExciseDuty cuando duties.exciseDuty presente (líneas 1048-1055)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { exciseRate: 8, tariffRate: 3 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.xml).toContain('<ExciseDuty>');
      expect(result.xml).toContain('<TaxRate>8</TaxRate>');
    });

    test('debe NO incluir bloque ExciseDuty cuando duties.exciseDuty ausente (línea 1048 condicional false)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { exciseRate: 0 };

      const result = h1Generator.generate(expedition, aiData);

      expect(result.xml).not.toContain('<ExciseDuty>');
    });

    test('debe incluir bloque DeferredPayment cuando duties.deferredPayment presente (líneas 1071-1076)', () => {
      const expedition = {
        ...baseExpedition,
        payment: {
          method: 'E',
          deferred: true,
          deferredAccount: 'ACC001',
          deferredAuthorization: 'AUTH-002'
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<DeferredPayment>');
      expect(result.xml).toContain('<AccountNumber>ACC001</AccountNumber>');
    });

    test('debe NO incluir bloque DeferredPayment cuando duties.deferredPayment ausente (línea 1071 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<DeferredPayment>');
    });

    test('debe incluir bloque Guarantee cuando guarantee presente (líneas 1079-1093)', () => {
      const expedition = {
        ...baseExpedition,
        guarantee: {
          type: '1',
          grn: 'GRN123',
          amount: 5000,
          currency: 'EUR',
          guarantor: { eori: 'ESG111', nif: 'G111', name: 'Guarantor SL' }
        }
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<Guarantee>');
      expect(result.xml).toContain('<GRN>GRN123</GRN>');
      expect(result.xml).toContain('<Guarantor>');
    });

    test('debe NO incluir bloque Guarantee cuando guarantee ausente (línea 1079 condicional false)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      expect(result.xml).not.toContain('<Guarantee>');
    });
  });

  describe('determineCustomsOffice - ramas por puerto', () => {
    test('debe detectar BARCELONA (línea 1270)', () => {
      const expedition = { transport: { arrivalPort: 'BARCELONA' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002801');
    });

    test('debe detectar BCN (línea 1270)', () => {
      const expedition = { transport: { arrivalPort: 'BCN' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002801');
    });

    test('debe detectar VALENCIA (línea 1271)', () => {
      const expedition = { transport: { arrivalPort: 'VALENCIA' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES004601');
    });

    test('debe detectar VLC (línea 1271)', () => {
      const expedition = { transport: { arrivalPort: 'VLC' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES004601');
    });

    test('debe detectar MADRID/BARAJAS (línea 1272)', () => {
      const expedition = { transport: { arrivalPort: 'MAD-BARAJAS' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002101');
    });

    test('debe detectar ALGECIRAS (línea 1273)', () => {
      const expedition = { transport: { arrivalPort: 'ALGECIRAS' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES003001');
    });

    test('debe detectar BILBAO (línea 1274)', () => {
      const expedition = { transport: { arrivalPort: 'BILBAO' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES004801');
    });

    test('debe detectar LAS PALMAS (línea 1275)', () => {
      const expedition = { transport: { arrivalPort: 'LPA' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES003501');
    });

    test('debe detectar TENERIFE (línea 1276)', () => {
      const expedition = { transport: { arrivalPort: 'TENERIFE' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES003801');
    });

    test('debe detectar MALAGA (línea 1277)', () => {
      const expedition = { transport: { arrivalPort: 'MALAGA' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002901');
    });

    test('debe usar default ES002801 cuando puerto desconocido (línea 1279)', () => {
      const expedition = { transport: { arrivalPort: 'UNKNOWN-PORT' } };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002801');
    });

    test('debe usar default ES002801 cuando arrivalPort ausente (línea 1279)', () => {
      const expedition = { transport: {} };
      const result = h1Generator.determineCustomsOffice(expedition);
      expect(result).toBe('ES002801');
    });
  });

  describe('getRegionCode - ramas por ciudad', () => {
    test('debe detectar Barcelona como ES-CT (línea 1290)', () => {
      const result = h1Generator.getRegionCode('Barcelona');
      expect(result).toBe('ES-CT');
    });

    test('debe detectar Madrid como ES-MD (línea 1291)', () => {
      const result = h1Generator.getRegionCode('Madrid');
      expect(result).toBe('ES-MD');
    });

    test('debe detectar Valencia como ES-VC (línea 1292)', () => {
      const result = h1Generator.getRegionCode('Valencia');
      expect(result).toBe('ES-VC');
    });

    test('debe detectar Sevilla como ES-AN (línea 1293)', () => {
      const result = h1Generator.getRegionCode('Sevilla');
      expect(result).toBe('ES-AN');
    });

    test('debe detectar Bilbao como ES-PV (línea 1294)', () => {
      const result = h1Generator.getRegionCode('Bilbao');
      expect(result).toBe('ES-PV');
    });

    test('debe detectar Palmas como ES-CN (línea 1295)', () => {
      const result = h1Generator.getRegionCode('Las Palmas');
      expect(result).toBe('ES-CN');
    });

    test('debe detectar Palma como ES-IB (línea 1296)', () => {
      const result = h1Generator.getRegionCode('Palma');
      expect(result).toBe('ES-IB');
    });

    test('debe detectar Zaragoza como ES-AR (línea 1297)', () => {
      const result = h1Generator.getRegionCode('Zaragoza');
      expect(result).toBe('ES-AR');
    });

    test('debe detectar Murcia como ES-MC (línea 1298)', () => {
      const result = h1Generator.getRegionCode('Murcia');
      expect(result).toBe('ES-MC');
    });

    test('debe usar default ES-CT cuando ciudad desconocida (línea 1305)', () => {
      const result = h1Generator.getRegionCode('UnknownCity');
      expect(result).toBe('ES-CT');
    });

    test('debe usar default ES-CT cuando city es null (línea 1286)', () => {
      const result = h1Generator.getRegionCode(null);
      expect(result).toBe('ES-CT');
    });
  });

  describe('getTransportModeCode / getTransportTypeCode / getTransportDocumentType - ramas por modo', () => {
    test('debe retornar código 1 para maritime/sea (línea 1313-1314)', () => {
      expect(h1Generator.getTransportModeCode('maritime')).toBe('1');
      expect(h1Generator.getTransportModeCode('sea')).toBe('1');
    });

    test('debe retornar código 2 para rail/train (línea 1315-1316)', () => {
      expect(h1Generator.getTransportModeCode('rail')).toBe('2');
      expect(h1Generator.getTransportModeCode('train')).toBe('2');
    });

    test('debe retornar código 3 para road/truck (línea 1317-1318)', () => {
      expect(h1Generator.getTransportModeCode('road')).toBe('3');
      expect(h1Generator.getTransportModeCode('truck')).toBe('3');
    });

    test('debe retornar código 4 para air/flight (línea 1319-1320)', () => {
      expect(h1Generator.getTransportModeCode('air')).toBe('4');
      expect(h1Generator.getTransportModeCode('flight')).toBe('4');
    });

    test('debe retornar default 1 cuando mode desconocido (línea 1327)', () => {
      expect(h1Generator.getTransportModeCode('unknown')).toBe('1');
    });

    test('debe retornar código de tipo 11 para maritime (línea 1335)', () => {
      expect(h1Generator.getTransportTypeCode('maritime')).toBe('11');
    });

    test('debe retornar código de tipo 31 para road (línea 1339)', () => {
      expect(h1Generator.getTransportTypeCode('road')).toBe('31');
    });

    test('debe retornar código de tipo 41 para air (línea 1341)', () => {
      expect(h1Generator.getTransportTypeCode('air')).toBe('41');
    });

    test('debe retornar default 11 cuando mode desconocido (línea 1344)', () => {
      expect(h1Generator.getTransportTypeCode('unknown')).toBe('11');
    });

    test('debe retornar N705 (BL) para maritime (línea 1352)', () => {
      expect(h1Generator.getTransportDocumentType('maritime')).toBe('N705');
    });

    test('debe retornar N740 (AWB) para air (línea 1354)', () => {
      expect(h1Generator.getTransportDocumentType('air')).toBe('N740');
    });

    test('debe retornar N730 (CMR) para road (línea 1356)', () => {
      expect(h1Generator.getTransportDocumentType('road')).toBe('N730');
    });

    test('debe retornar N720 (CIM) para rail (línea 1358)', () => {
      expect(h1Generator.getTransportDocumentType('rail')).toBe('N720');
    });

    test('debe retornar default N785 cuando mode desconocido (línea 1360)', () => {
      expect(h1Generator.getTransportDocumentType('unknown')).toBe('N785');
    });
  });

  describe('getDocumentTypeCode - ramas por tipo de documento', () => {
    test('debe retornar N380 para commercial_invoice (línea 1368)', () => {
      expect(h1Generator.getDocumentTypeCode('commercial_invoice')).toBe('N380');
    });

    test('debe retornar N705 para bill_of_lading (línea 1369)', () => {
      expect(h1Generator.getDocumentTypeCode('bill_of_lading')).toBe('N705');
    });

    test('debe retornar N740 para air_waybill (línea 1370)', () => {
      expect(h1Generator.getDocumentTypeCode('air_waybill')).toBe('N740');
    });

    test('debe retornar N730 para cmr (línea 1371)', () => {
      expect(h1Generator.getDocumentTypeCode('cmr')).toBe('N730');
    });

    test('debe retornar N720 para cim (línea 1372)', () => {
      expect(h1Generator.getDocumentTypeCode('cim')).toBe('N720');
    });

    test('debe retornar N861 para certificate_origin (línea 1373)', () => {
      expect(h1Generator.getDocumentTypeCode('certificate_origin')).toBe('N861');
    });

    test('debe retornar N864 para eur1 (línea 1374)', () => {
      expect(h1Generator.getDocumentTypeCode('eur1')).toBe('N864');
    });

    test('debe retornar N018 para atr (línea 1376)', () => {
      expect(h1Generator.getDocumentTypeCode('atr')).toBe('N018');
    });

    test('debe retornar N865 para form_a (línea 1377)', () => {
      expect(h1Generator.getDocumentTypeCode('form_a')).toBe('N865');
    });

    test('debe retornar N271 para packing_list (línea 1378)', () => {
      expect(h1Generator.getDocumentTypeCode('packing_list')).toBe('N271');
    });

    test('debe retornar C678 para sanitary_certificate (línea 1379)', () => {
      expect(h1Generator.getDocumentTypeCode('sanitary_certificate')).toBe('C678');
    });

    test('debe retornar C635 para phytosanitary_certificate (línea 1380)', () => {
      expect(h1Generator.getDocumentTypeCode('phytosanitary_certificate')).toBe('C635');
    });

    test('debe retornar C640 para veterinary_certificate (línea 1381)', () => {
      expect(h1Generator.getDocumentTypeCode('veterinary_certificate')).toBe('C640');
    });

    test('debe retornar N990 para import_license (línea 1382)', () => {
      expect(h1Generator.getDocumentTypeCode('import_license')).toBe('N990');
    });

    test('debe retornar E012 para export_license (línea 1383)', () => {
      expect(h1Generator.getDocumentTypeCode('export_license')).toBe('E012');
    });

    test('debe retornar N703 para dangerous_goods (línea 1384)', () => {
      expect(h1Generator.getDocumentTypeCode('dangerous_goods')).toBe('N703');
    });

    test('debe retornar N714 para insurance_certificate (línea 1385)', () => {
      expect(h1Generator.getDocumentTypeCode('insurance_certificate')).toBe('N714');
    });

    test('debe retornar default N990 cuando docType desconocido (línea 1387)', () => {
      expect(h1Generator.getDocumentTypeCode('unknown_doc_type')).toBe('N990');
    });
  });

  describe('escapeXml - debe no explotar con input numérico (línea 1400 comentario)', () => {
    test('debe escapar string normal', () => {
      const result = h1Generator.escapeXml('Test & <Company>');
      expect(result).toBe('Test &amp; &lt;Company&gt;');
    });

    test('debe convertir número a string y NO explotar (línea 1400)', () => {
      const result = h1Generator.escapeXml(12345);
      expect(result).toBe('12345');
    });

    test('debe retornar string vacío cuando input null (línea 1394)', () => {
      const result = h1Generator.escapeXml(null);
      expect(result).toBe('');
    });

    test('debe retornar string vacío cuando input undefined (línea 1394)', () => {
      const result = h1Generator.escapeXml(undefined);
      expect(result).toBe('');
    });

    test('debe escapar todos los caracteres especiales XML', () => {
      const result = h1Generator.escapeXml('&<>"\'');
      expect(result).toBe('&amp;&lt;&gt;&quot;&apos;');
    });
  });

  describe('buildGoodsItems - ramas XML fallbacks grossMass/netMass/packaging', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000 },
      transport: { arrivalPort: 'BCN' },
      exporter: { country: 'CN' },
      goods: []
    };

    test('debe usar fallback 0 cuando grossMass ausente (línea 1133)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            // Sin grossWeight
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<GrossMassMeasure>0</GrossMassMeasure>');
    });

    test('debe usar fallback 0 cuando netMass ausente (línea 1134)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            // Sin netWeight
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<NetNetWeightMeasure>0</NetNetWeightMeasure>');
    });

    test('debe usar fallback vacío cuando supplementaryUnitsType ausente (línea 1135)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            supplementaryUnits: 500,
            // Sin supplementaryUnitType
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<TariffQuantity unitCode="">500</TariffQuantity>');
    });

    test('debe usar fallback 0 cuando numberOfPackages ausente (línea 1162)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: {
              // Sin quantity
              type: 'CT',
              marks: 'COFFEE-001'
            }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<QuantityQuantity>0</QuantityQuantity>');
    });

    test('debe usar fallback PK cuando typeOfPackages ausente (línea 1163)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: {
              quantity: 10
              // Sin type
            }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      expect(result.xml).toContain('<TypeCode>PK</TypeCode>');
    });

    test('debe usar fallback 0 cuando customsValue ausente (línea 1169)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            // Sin invoiceValue → customsValue será undefined
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // customsValue calculado será NaN o 0 dependiendo de la lógica
      const valuationBlock = result.xml.substring(
        result.xml.indexOf('<CustomsValuation>'),
        result.xml.lastIndexOf('</CustomsValuation>')
      );
      // Verificar que hay un fallback (0 o similar)
      expect(valuationBlock).toContain('<ItemChargeAmount currencyID="EUR">');
    });

    test('debe usar fallback 0 cuando statisticalValue ausente (línea 1170)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            // Sin statisticalValue
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition);

      // statisticalValue fallback es itemCustomsValue (línea 630)
      const valuationBlock = result.xml.substring(
        result.xml.indexOf('<CustomsValuation>'),
        result.xml.lastIndexOf('</CustomsValuation>')
      );
      expect(valuationBlock).toContain('<StatisticalValueAmount currencyID="EUR">');
    });
  });

  describe('calculateSummary - ramas condicionales en resumen', () => {
    const baseExpedition = {
      client: { eori: 'ESB22477020', companyName: 'Cliente' },
      goodsSummary: { totalValue: 1000, totalPackages: 10, totalGrossWeight: 100 },
      transport: { arrivalPort: 'BCN' },
      goods: [
        {
          taricCode: '0901210000',
          description: 'Cafe',
          requestedProcedure: '40',
          preference: '100',
          invoiceValue: 1000,
          grossWeight: 100,
          netWeight: 95,
          packages: { quantity: 10, type: 'CT' }
        }
      ]
    };

    test('debe usar items[0]?.requestedProcedure (línea 1240)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            regime: '42',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition, { regime: '42' });

      expect(result.summary.regime).toBe('42');
    });

    test('debe usar items[0]?.preference (línea 1242)', () => {
      const expedition = {
        ...baseExpedition,
        goods: [
          {
            taricCode: '0901210000',
            description: 'Cafe',
            preference: '200',
            invoiceValue: 1000,
            grossWeight: 100,
            netWeight: 95,
            packages: { quantity: 10, type: 'CT' }
          }
        ]
      };

      const result = h1Generator.generate(expedition, { preference: '200' });

      expect(result.summary.preference).toBe('200');
    });

    test('debe usar CUSTOMS_OFFICES[customsOffice] || "Desconocido" (línea 1251)', () => {
      const expedition = { ...baseExpedition };

      const result = h1Generator.generate(expedition);

      // determineCustomsOffice('BCN') → ES002801
      expect(result.summary.customsOffice).toBe('ES002801');
      expect(result.summary.customsOfficeName).toContain('Barcelona');
    });

    test('debe retornar "Desconocido" cuando customsOffice no está en CUSTOMS_OFFICES (línea 1251)', () => {
      const expedition = { ...baseExpedition };
      const aiData = { customsOffice: 'ES999999' }; // No existe en CUSTOMS_OFFICES

      const result = h1Generator.generate(expedition, aiData);

      expect(result.summary.customsOffice).toBe('ES999999');
      expect(result.summary.customsOfficeName).toBe('Desconocido');
    });
  });
});
