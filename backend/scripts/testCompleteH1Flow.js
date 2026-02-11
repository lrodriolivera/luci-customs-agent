/**
 * Test completo del flujo H1: Crear expediente → Generar H1 → Enviar a AEAT
 * Ejecutar: node scripts/testCompleteH1Flow.js
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Expedition } = require('../src/models');
const aeatRealService = require('../src/services/aeat/aeatRealService');
const certificateService = require('../src/services/aeat/certificateService');

// Datos de prueba realistas
const TEST_DATA = {
  // Diferentes tipos de mercancías para probar
  scenarios: [
    {
      name: 'Electrónica de consumo',
      client: {
        companyName: 'TechImport Barcelona S.L.',
        nif: 'B12345678',
        eori: 'ESB12345678000',
        address: {
          street: 'Carrer de la Tecnologia 123',
          city: 'Barcelona',
          postalCode: '08001',
          country: 'ES'
        },
        contact: {
          name: 'Carlos Martínez',
          email: 'carlos@techimport.es',
          phone: '+34 933 001 234'
        }
      },
      exporter: {
        companyName: 'Shenzhen Electronics Co., Ltd.',
        address: '1688 Technology Park, Nanshan District',
        city: 'Shenzhen',
        country: 'CN'
      },
      goods: [
        {
          description: 'Smartphones Android 6.5" 128GB 5G',
          taricCode: '85171400',
          hsCode: '851714',
          originCountry: 'CN',
          quantity: 500,
          unit: 'PCE',
          grossWeight: 450,
          netWeight: 400,
          invoiceValue: 75000,
          currency: 'EUR',
          packages: { quantity: 50, type: 'CTN', marks: 'SZEL-2026-001' }
        },
        {
          description: 'Auriculares inalámbricos Bluetooth TWS',
          taricCode: '85183000',
          hsCode: '851830',
          originCountry: 'CN',
          quantity: 2000,
          unit: 'PCE',
          grossWeight: 200,
          netWeight: 180,
          invoiceValue: 20000,
          currency: 'EUR',
          packages: { quantity: 40, type: 'CTN', marks: 'SZEL-2026-002' }
        }
      ],
      transport: {
        mode: 'air',
        carrier: 'Emirates SkyCargo',
        vehicleId: 'EK9721',
        documentType: 'AWB',
        documentNumber: '176-12345678',
        arrivalPort: 'ESBCN',
        departurePort: 'CNSZX'
      },
      incoterm: { code: 'CIP', place: 'Barcelona Airport' },
      customsValue: 97500
    },
    {
      name: 'Textiles y confección',
      client: {
        companyName: 'Moda Europa Distribuciones S.A.',
        nif: 'A87654321',
        eori: 'ESA87654321000',
        address: {
          street: 'Avenida de la Moda 456',
          city: 'Madrid',
          postalCode: '28001',
          country: 'ES'
        },
        contact: {
          name: 'María López',
          email: 'maria@modaeuropa.es',
          phone: '+34 915 001 234'
        }
      },
      exporter: {
        companyName: 'Dhaka Garments Industries Ltd.',
        address: 'Plot 15, BSCIC Industrial Estate',
        city: 'Dhaka',
        country: 'BD'
      },
      goods: [
        {
          description: 'Camisetas algodón 100% hombre manga corta',
          taricCode: '61091000',
          hsCode: '610910',
          originCountry: 'BD',
          quantity: 10000,
          unit: 'PCE',
          grossWeight: 2500,
          netWeight: 2200,
          invoiceValue: 25000,
          currency: 'EUR',
          packages: { quantity: 100, type: 'CTN', marks: 'DGI-TEX-001' }
        },
        {
          description: 'Pantalones vaqueros denim hombre',
          taricCode: '62034235',
          hsCode: '620342',
          originCountry: 'BD',
          quantity: 5000,
          unit: 'PCE',
          grossWeight: 3000,
          netWeight: 2800,
          invoiceValue: 45000,
          currency: 'EUR',
          packages: { quantity: 200, type: 'CTN', marks: 'DGI-TEX-002' }
        }
      ],
      transport: {
        mode: 'maritime',
        carrier: 'Maersk Line',
        vehicleId: 'MAERSK EDINBURGH',
        documentType: 'BL',
        documentNumber: 'MAEU123456789',
        arrivalPort: 'ESVLC',
        departurePort: 'BDCGP',
        containers: ['MSKU1234567', 'MSKU7654321']
      },
      incoterm: { code: 'FOB', place: 'Chittagong' },
      customsValue: 72000
    },
    {
      name: 'Maquinaria industrial',
      client: {
        companyName: 'Industrias Mecánicas del Norte S.L.',
        nif: 'B11223344',
        eori: 'ESB11223344000',
        address: {
          street: 'Polígono Industrial Norte, Nave 7',
          city: 'Bilbao',
          postalCode: '48001',
          country: 'ES'
        },
        contact: {
          name: 'Juan García',
          email: 'juan@imnorte.es',
          phone: '+34 944 001 234'
        }
      },
      exporter: {
        companyName: 'Mitsubishi Heavy Industries Ltd.',
        address: '2-16-5 Konan, Minato-ku',
        city: 'Tokyo',
        country: 'JP'
      },
      goods: [
        {
          description: 'Centro de mecanizado CNC vertical 5 ejes',
          taricCode: '84571000',
          hsCode: '845710',
          originCountry: 'JP',
          quantity: 1,
          unit: 'PCE',
          grossWeight: 8500,
          netWeight: 7800,
          invoiceValue: 185000,
          currency: 'EUR',
          packages: { quantity: 1, type: 'CS', marks: 'MHI-CNC-001' }
        }
      ],
      transport: {
        mode: 'maritime',
        carrier: 'NYK Line',
        vehicleId: 'NYK OLYMPUS',
        documentType: 'BL',
        documentNumber: 'NYKS123456789',
        arrivalPort: 'ESBIO',
        departurePort: 'JPYOK',
        containers: ['NYKU9876543']
      },
      incoterm: { code: 'CFR', place: 'Bilbao Port' },
      customsValue: 195000
    }
  ]
};

// Generar LRN único
function generateLRN() {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `${year}ES${random}`;
}

// Generar XML H1 en formato AEAT (ImportacionCompletaV1Ent.xsd)
const { buildH1ImportXML } = require('../src/services/aeat/h1XmlBuilder');

function generateH1XML(expedition) {
  const lrn = generateLRN();
  const modeMap = { maritime: '1', rail: '2', road: '3', air: '4' };
  const totalValue = expedition.goods.reduce((s, g) => s + g.invoiceValue, 0);

  const xml = buildH1ImportXML({
    referenciaComercial: lrn,
    exportadorNIF: '',
    exportadorNombre: expedition.exporter.companyName,
    exportadorDireccion: expedition.exporter.address,
    exportadorPoblacion: expedition.exporter.city,
    exportadorCP: '',
    exportadorPais: expedition.exporter.country,
    importadorNIF: expedition.client.nif,
    importadorNombre: expedition.client.companyName,
    importadorDireccion: expedition.client.address.street,
    importadorPoblacion: expedition.client.address.city,
    importadorCP: expedition.client.address.postalCode,
    emailDespacho: expedition.client.contact.email,
    paisExpedicion: expedition.exporter.country,
    incoterm: expedition.incoterm.code,
    incotermZona: expedition.incoterm.place,
    importeFactura: totalValue,
    modoTransporteFrontera: modeMap[expedition.transport.mode] || '1',
    contenedores: expedition.transport.containers ? '1' : '0',
    partidas: expedition.goods.map(g => ({
      descripcion: g.description,
      taricCode: g.taricCode,
      paisOrigen: g.originCountry,
      pesobruto: g.grossWeight,
      pesoneto: g.netWeight,
      bultos: g.packages.quantity,
      tipoBulto: g.packages.type,
      marcas: g.packages.marks,
      valorFactura: g.invoiceValue,
      preferencia: '100',
      regimen: '40',
      arancelTipo: 0,
      arancelImporte: 0,
      ivaTipo: 21,
      ivaImporte: 0
    }))
  });

  // Extract just the body (without SOAP envelope) for signing
  const bodyMatch = xml.match(/<ImportacionCompletaV1Ent[\s\S]*<\/ImportacionCompletaV1Ent>/);
  return { lrn, xml: bodyMatch ? bodyMatch[0] : xml };
}

// OLD generateH1XML kept for reference
function generateH1XML_OLD(expedition) {
  const lrn = generateLRN();
  const timestamp = new Date().toISOString();

  const transportModeCode = {
    'maritime': '1',
    'rail': '2',
    'road': '3',
    'air': '4'
  }[expedition.transport.mode] || '1';

  const goodsItems = expedition.goods.map((item, index) => `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${index + 1}</SequenceNumeric>
        <Commodity>
          <Description>${item.description}</Description>
          <Classification>
            <ID>${item.taricCode}</ID>
            <IdentificationTypeCode>TSP</IdentificationTypeCode>
          </Classification>
          <GoodsMeasure>
            <GrossMassMeasure>${item.grossWeight}</GrossMassMeasure>
            <NetNetWeightMeasure>${item.netWeight}</NetNetWeightMeasure>
            <TariffQuantity>${item.quantity}</TariffQuantity>
          </GoodsMeasure>
        </Commodity>
        <GovernmentProcedure>
          <CurrentCode>40</CurrentCode>
          <PreviousCode>00</PreviousCode>
        </GovernmentProcedure>
        <AdditionalProcedure>
          <CurrentCode>000</CurrentCode>
        </AdditionalProcedure>
        <Origin>
          <CountryCode>${item.originCountry}</CountryCode>
        </Origin>
        <Preference>
          <TypeCode>100</TypeCode>
        </Preference>
        <Packaging>
          <QuantityQuantity>${item.packages.quantity}</QuantityQuantity>
          <TypeCode>${item.packages.type}</TypeCode>
          <MarksNumbers>${item.packages.marks}</MarksNumbers>
        </Packaging>
        <CustomsValuation>
          <ItemChargeAmount>${item.invoiceValue}</ItemChargeAmount>
          <StatisticalValueAmount>${item.invoiceValue}</StatisticalValueAmount>
        </CustomsValuation>
        <AdditionalDocument>
          <TypeCode>N380</TypeCode>
          <ID>INV-${expedition.transport.documentNumber}</ID>
        </AdditionalDocument>
        <AdditionalDocument>
          <TypeCode>${expedition.transport.documentType === 'BL' ? 'N705' : 'N740'}</TypeCode>
          <ID>${expedition.transport.documentNumber}</ID>
        </AdditionalDocument>
      </GovernmentAgencyGoodsItem>`).join('\n');

  const totalGrossWeight = expedition.goods.reduce((sum, g) => sum + g.grossWeight, 0);
  const totalPackages = expedition.goods.reduce((sum, g) => sum + g.packages.quantity, 0);
  const totalValue = expedition.goods.reduce((sum, g) => sum + g.invoiceValue, 0);

  return {
    lrn,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CC515C xmlns="urn:wco:datamodel:WCO:DEC-DMS:2">
  <MessageSender>LUCI-CUSTOMS</MessageSender>
  <MessageRecipient>ES.AEAT</MessageRecipient>
  <PreparationDateTime>${timestamp}</PreparationDateTime>
  <MessageIdentification>${lrn}</MessageIdentification>
  <MessageType>CC515C</MessageType>

  <Declaration>
    <FunctionCode>9</FunctionCode>
    <TypeCode>A</TypeCode>
    <GoodsItemQuantity>${expedition.goods.length}</GoodsItemQuantity>
    <TotalPackageQuantity>${totalPackages}</TotalPackageQuantity>
    <TotalGrossMassMeasure>${totalGrossWeight}</TotalGrossMassMeasure>

    <DeclarationOfficeID>ES002801</DeclarationOfficeID>
    <LRN>${lrn}</LRN>

    <Importer>
      <IdentificationID>${expedition.client.eori}</IdentificationID>
      <Name>${expedition.client.companyName}</Name>
      <Address>
        <Line>${expedition.client.address.street}</Line>
        <CityName>${expedition.client.address.city}</CityName>
        <PostcodeID>${expedition.client.address.postalCode}</PostcodeID>
        <CountryCode>${expedition.client.address.country}</CountryCode>
      </Address>
    </Importer>

    <Declarant>
      <IdentificationID>ESB22477020000</IdentificationID>
      <Name>Stock Logistic S.L.</Name>
      <StatusCode>2</StatusCode>
    </Declarant>

    <Exporter>
      <Name>${expedition.exporter.companyName}</Name>
      <Address>
        <Line>${expedition.exporter.address}</Line>
        <CityName>${expedition.exporter.city}</CityName>
        <CountryCode>${expedition.exporter.country}</CountryCode>
      </Address>
    </Exporter>

    <GoodsShipment>
      <Consignment>
        <ContainerIndicator>${expedition.transport.containers ? '1' : '0'}</ContainerIndicator>
        <GrossWeight>${totalGrossWeight}</GrossWeight>

        <TransportMeans>
          <ModeCode>${transportModeCode}</ModeCode>
          <IdentificationNumber>${expedition.transport.vehicleId}</IdentificationNumber>
        </TransportMeans>

        <DepartureTransportMeans>
          <ModeCode>${transportModeCode}</ModeCode>
        </DepartureTransportMeans>

        <CountryOfDispatchCode>${expedition.exporter.country}</CountryOfDispatchCode>
        <CountryOfDestinationCode>ES</CountryOfDestinationCode>

        ${expedition.transport.containers ? `<TransportEquipment>
          ${expedition.transport.containers.map(c => `<EquipmentIdentificationNumber>${c}</EquipmentIdentificationNumber>`).join('\n          ')}
        </TransportEquipment>` : '<TransportEquipment/>'}
      </Consignment>

      <DeliveryTerms>
        <ConditionCode>${expedition.incoterm.code}</ConditionCode>
        <LocationName>${expedition.incoterm.place}</LocationName>
      </DeliveryTerms>

      <TradeTerms>
        <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        <TotalInvoiceAmount>${totalValue}</TotalInvoiceAmount>
        <ExchangeRate>1</ExchangeRate>
      </TradeTerms>

      ${goodsItems}

    </GoodsShipment>
  </Declaration>
</CC515C>`
  };
}

async function runTest() {
  console.log('═'.repeat(70));
  console.log('  TEST COMPLETO: FLUJO H1 CON DATOS DE PRUEBA');
  console.log('═'.repeat(70));
  console.log(`  Modo: ${process.env.AEAT_SIMULATE === 'true' ? 'SIMULACIÓN' : 'REAL'}`);
  console.log(`  Entorno: ${process.env.AEAT_ENVIRONMENT}`);
  console.log('═'.repeat(70));

  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('\n✓ Conectado a MongoDB\n');

    // Cargar certificado
    const certPath = path.resolve(__dirname, '..', process.env.AEAT_CERTIFICATE_PATH);
    const certBuffer = fs.readFileSync(certPath);
    const certResult = await certificateService.importCertificate(
      certBuffer,
      process.env.AEAT_CERTIFICATE_PASSWORD,
      { alias: 'fnmt-test' }
    );

    if (!certResult.success) {
      throw new Error('Error cargando certificado: ' + certResult.error);
    }
    console.log('✓ Certificado cargado:', certResult.info.subject);

    const results = [];

    // Procesar cada escenario
    for (let i = 0; i < TEST_DATA.scenarios.length; i++) {
      const scenario = TEST_DATA.scenarios[i];

      console.log('\n' + '─'.repeat(70));
      console.log(`ESCENARIO ${i + 1}: ${scenario.name.toUpperCase()}`);
      console.log('─'.repeat(70));

      // 1. Crear expediente
      console.log('\n1. Creando expediente...');
      const expeditionData = {
        operationType: 'import',
        transportMode: scenario.transport.mode,
        status: 'documents_validated',
        client: scenario.client,
        exporter: scenario.exporter,
        goods: scenario.goods.map((g, idx) => ({ ...g, itemNumber: idx + 1 })),
        transport: {
          carrier: scenario.transport.carrier,
          vehicleId: scenario.transport.vehicleId,
          documentType: scenario.transport.documentType,
          documentNumber: scenario.transport.documentNumber,
          arrivalPort: scenario.transport.arrivalPort,
          departurePort: scenario.transport.departurePort,
          containers: scenario.transport.containers
        },
        incoterm: scenario.incoterm,
        invoiceTotal: scenario.goods.reduce((sum, g) => sum + g.invoiceValue, 0),
        customsValue: scenario.customsValue,
        documents: [
          {
            type: 'commercial_invoice',
            fileName: `invoice_${scenario.transport.documentNumber}.pdf`,
            status: 'validated',
            uploadedAt: new Date()
          },
          {
            type: scenario.transport.documentType === 'BL' ? 'bill_of_lading' : 'air_waybill',
            fileName: `${scenario.transport.documentType.toLowerCase()}_${scenario.transport.documentNumber}.pdf`,
            status: 'validated',
            uploadedAt: new Date()
          }
        ],
        timeline: [{
          action: 'expedition_created',
          description: `Expediente de prueba: ${scenario.name}`,
          performedBy: 'Sistema - Test automático',
          timestamp: new Date()
        }]
      };

      const expedition = new Expedition(expeditionData);
      await expedition.save();
      console.log(`   ✓ Expediente: ${expedition.expeditionId}`);

      // 2. Generar H1
      console.log('\n2. Generando declaración H1...');
      const { lrn, xml } = generateH1XML(scenario);

      expedition.declaration = {
        type: 'H1',
        declarationType: 'A',
        lrn: lrn,
        regime: '40',
        customsOffice: 'ES002801',
        declarationDate: new Date(),
        status: 'pending',
        xmlContent: xml
      };
      await expedition.save();
      console.log(`   ✓ LRN: ${lrn}`);
      console.log(`   ✓ XML: ${xml.length} caracteres`);

      // 3. Enviar a AEAT
      console.log('\n3. Enviando a AEAT...');
      const submitResult = await aeatRealService.submitH1Declaration(
        xml,
        certResult.certificateId,
        process.env.AEAT_CERTIFICATE_PASSWORD,
        { expeditionId: expedition.expeditionId }
      );

      // 4. Procesar resultado
      console.log('\n4. Resultado:');
      if (submitResult.success) {
        console.log(`   ✓ MRN: ${submitResult.mrn}`);
        console.log(`   ✓ Canal: ${submitResult.channel?.toUpperCase()}`);
        console.log(`   ✓ Código: ${submitResult.responseCode}`);
        console.log(`   ✓ Mensaje: ${submitResult.responseMessage}`);

        // Actualizar expediente
        expedition.declaration.mrn = submitResult.mrn;
        expedition.declaration.channel = submitResult.channel;
        expedition.declaration.status = 'submitted';
        expedition.declaration.submittedAt = new Date();
        expedition.declaration.aeatResponse = submitResult;

        const channelStatusMap = {
          'green': 'green_channel',
          'orange': 'orange_channel',
          'red': 'red_channel'
        };
        expedition.status = channelStatusMap[submitResult.channel] || 'declaration_submitted';

        // Si es verde, generar levante
        if (submitResult.channel === 'green') {
          const levanteNumber = `LEV${new Date().getFullYear()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          expedition.levante = {
            number: levanteNumber,
            date: new Date(),
            type: 'automatic',
            status: 'authorized'
          };
          expedition.status = 'levante';
          console.log(`   ✓ Levante: ${levanteNumber}`);
        }

        expedition.timeline.push({
          action: 'declaration_submitted',
          description: `H1 enviado a AEAT. MRN: ${submitResult.mrn}. Canal: ${submitResult.channel}`,
          performedBy: 'Sistema - Test automático',
          timestamp: new Date(),
          metadata: { mrn: submitResult.mrn, channel: submitResult.channel, simulated: submitResult.simulated }
        });

        await expedition.save();

      } else {
        console.log(`   ✗ Error: ${submitResult.error}`);
        if (submitResult.luciAnalysis) {
          console.log(`   ✗ Análisis: ${submitResult.luciAnalysis.summary || JSON.stringify(submitResult.luciAnalysis)}`);
        }
      }

      results.push({
        scenario: scenario.name,
        expeditionId: expedition.expeditionId,
        lrn: lrn,
        success: submitResult.success,
        mrn: submitResult.mrn,
        channel: submitResult.channel,
        simulated: submitResult.simulated
      });
    }

    // Resumen final
    console.log('\n' + '═'.repeat(70));
    console.log('  RESUMEN DE RESULTADOS');
    console.log('═'.repeat(70));
    console.log('\n| Escenario | Expediente | MRN | Canal | Estado |');
    console.log('|-----------|------------|-----|-------|--------|');

    for (const r of results) {
      const status = r.success ? '✓ OK' : '✗ ERROR';
      const channel = r.channel ? r.channel.toUpperCase() : 'N/A';
      console.log(`| ${r.scenario.substring(0, 20).padEnd(20)} | ${r.expeditionId} | ${(r.mrn || 'N/A').substring(0, 18)} | ${channel.padEnd(6)} | ${status} |`);
    }

    const successful = results.filter(r => r.success).length;
    console.log(`\nTotal: ${successful}/${results.length} exitosos`);
    console.log(`Modo: ${results[0]?.simulated ? 'SIMULACIÓN' : 'REAL'}`);

    return results;

  } catch (error) {
    console.error('\n✗ ERROR FATAL:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Desconectado de MongoDB');
  }
}

// Ejecutar
runTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
