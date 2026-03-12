#!/usr/bin/env node
/**
 * Seed NL demo expeditions for testing Netherlands customs support
 *
 * Creates 5 NL test expeditions with Dutch addresses and DECO/DMS-ready data:
 * - 2 DECO H7 (low-value, <=150 EUR)
 * - 2 DMS H1 (standard import)
 * - 1 DMS AES (export from NL)
 *
 * Run: node scripts/seed-nl-demo.js
 */

require('dotenv').config()
const mongoose = require('mongoose')

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/luci-customs'
const TENANT_ID = '699085f4a0b6fb09cdba07b1'

async function seedNLDemo() {
  try {
    await mongoose.connect(MONGO_URI)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    const expeditions = db.collection('expeditions')

    const now = new Date()
    const baseExpeditions = [
      // DECO H7 #1 - PostNL package from China
      {
        expeditionId: `EXP-NL-${now.getFullYear()}-DECO01`,
        tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        operationType: 'IMPORT',
        country: 'NL',
        customsOffice: 'NL000399',
        declarationType: 'H7',
        status: 'PROCESSING',
        client: {
          companyName: 'PostNL BV',
          nif: '',
          eori: 'NL823456789',
          address: 'Prinses Beatrixlaan 23',
          city: 'Den Haag',
          postalCode: '2595 AK',
          country: 'NL',
          contactPerson: 'Jan de Vries',
          email: 'customs@postnl.nl',
          phone: '+31 88 8686868'
        },
        exporter: {
          companyName: 'Shenzhen Electronics Co Ltd',
          address: '88 Nanshan Rd',
          city: 'Shenzhen',
          country: 'CN'
        },
        goods: [{
          description: 'USB-C charging cable 2m braided nylon',
          taricCode: '854442',
          originCountry: 'CN',
          quantity: 50,
          quantityUnit: 'PCS',
          netWeight: 2.5,
          grossWeight: 3.0,
          invoiceValue: 75,
          currency: 'EUR'
        }],
        transportMode: 'AIR',
        incoterm: 'DAP',
        incotermPlace: 'Amsterdam Schiphol',
        iossNumber: 'IMNL000000456',
        totalInvoiceValue: 75,
        createdAt: now,
        updatedAt: now
      },
      // DECO H7 #2 - Coolblue consumer package
      {
        expeditionId: `EXP-NL-${now.getFullYear()}-DECO02`,
        tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        operationType: 'IMPORT',
        country: 'NL',
        customsOffice: 'NL000399',
        declarationType: 'H7',
        status: 'PROCESSING',
        client: {
          companyName: 'Coolblue NV',
          nif: '',
          eori: 'NL854321678',
          address: 'Weena 664',
          city: 'Rotterdam',
          postalCode: '3012 CN',
          country: 'NL',
          contactPerson: 'Pieter Zwart',
          email: 'customs@coolblue.nl',
          phone: '+31 10 7993456'
        },
        exporter: {
          companyName: 'Yiwu Trading Corp',
          address: '15 International Trade Blvd',
          city: 'Yiwu',
          country: 'CN'
        },
        goods: [{
          description: 'Silicone phone case for Samsung Galaxy S24',
          taricCode: '392690',
          originCountry: 'CN',
          quantity: 100,
          quantityUnit: 'PCS',
          netWeight: 5.0,
          grossWeight: 6.5,
          invoiceValue: 120,
          currency: 'EUR'
        }],
        transportMode: 'AIR',
        incoterm: 'DAP',
        incotermPlace: 'Rotterdam',
        iossNumber: 'IMNL000000789',
        totalInvoiceValue: 120,
        createdAt: now,
        updatedAt: now
      },
      // DMS H1 #1 - Standard import via Rotterdam port
      {
        expeditionId: `EXP-NL-${now.getFullYear()}-DMS01`,
        tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        operationType: 'IMPORT',
        country: 'NL',
        customsOffice: 'NL000297',
        declarationType: 'H1',
        status: 'PROCESSING',
        client: {
          companyName: 'Bol.com BV',
          nif: '',
          eori: 'NL812345678',
          address: 'Papendorpseweg 100',
          city: 'Utrecht',
          postalCode: '3528 BJ',
          country: 'NL',
          contactPerson: 'Sophie van der Berg',
          email: 'logistics@bol.com',
          phone: '+31 30 3107890'
        },
        exporter: {
          companyName: 'Guangzhou Industrial Supply Co',
          address: '200 Tianhe North Rd',
          city: 'Guangzhou',
          country: 'CN'
        },
        goods: [
          {
            description: 'LED desk lamp with USB port adjustable brightness',
            taricCode: '9405423900',
            originCountry: 'CN',
            quantity: 500,
            quantityUnit: 'PCS',
            netWeight: 750,
            grossWeight: 900,
            invoiceValue: 8500,
            currency: 'EUR'
          },
          {
            description: 'Wireless Bluetooth speaker waterproof IPX7',
            taricCode: '8518220000',
            originCountry: 'CN',
            quantity: 300,
            quantityUnit: 'PCS',
            netWeight: 450,
            grossWeight: 550,
            invoiceValue: 12000,
            currency: 'EUR'
          }
        ],
        transportMode: 'SEA',
        incoterm: 'CIF',
        incotermPlace: 'Rotterdam',
        totalInvoiceValue: 20500,
        createdAt: now,
        updatedAt: now
      },
      // DMS H1 #2 - Import via Eindhoven
      {
        expeditionId: `EXP-NL-${now.getFullYear()}-DMS02`,
        tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        operationType: 'IMPORT',
        country: 'NL',
        customsOffice: 'NL000440',
        declarationType: 'H1',
        status: 'DOCS_RECEIVED',
        client: {
          companyName: 'Philips Electronics NV',
          nif: '',
          eori: 'NL867543210',
          address: 'High Tech Campus 5',
          city: 'Eindhoven',
          postalCode: '5656 AE',
          country: 'NL',
          contactPerson: 'Mark Jansen',
          email: 'supply-chain@philips.com',
          phone: '+31 40 2792000'
        },
        exporter: {
          companyName: 'Taiwan Semiconductor Parts Ltd',
          address: '88 Hsinchu Science Park',
          city: 'Hsinchu',
          country: 'TW'
        },
        goods: [{
          description: 'Integrated circuit chips ASIC 7nm',
          taricCode: '8542310000',
          originCountry: 'TW',
          quantity: 10000,
          quantityUnit: 'PCS',
          netWeight: 25,
          grossWeight: 40,
          invoiceValue: 185000,
          currency: 'EUR'
        }],
        transportMode: 'AIR',
        incoterm: 'FCA',
        incotermPlace: 'Eindhoven Airport',
        totalInvoiceValue: 185000,
        createdAt: now,
        updatedAt: now
      },
      // DMS AES - Export from NL
      {
        expeditionId: `EXP-NL-${now.getFullYear()}-AES01`,
        tenantId: new mongoose.Types.ObjectId(TENANT_ID),
        operationType: 'EXPORT',
        country: 'NL',
        customsOffice: 'NL000297',
        declarationType: 'AES',
        status: 'PROCESSING',
        client: {
          companyName: 'ASML Holding NV',
          nif: '',
          eori: 'NL899887766',
          address: 'De Run 6501',
          city: 'Veldhoven',
          postalCode: '5504 DR',
          country: 'NL',
          contactPerson: 'Lisa Bakker',
          email: 'export-control@asml.com',
          phone: '+31 40 2682000'
        },
        consignee: {
          companyName: 'Samsung Electronics Co Ltd',
          address: '129 Samsung-ro',
          city: 'Suwon',
          country: 'KR'
        },
        goods: [{
          description: 'Lithography machine spare parts and optical components',
          taricCode: '9013200000',
          originCountry: 'NL',
          quantity: 5,
          quantityUnit: 'PCS',
          netWeight: 2500,
          grossWeight: 3200,
          invoiceValue: 450000,
          currency: 'EUR'
        }],
        transportMode: 'SEA',
        incoterm: 'FOB',
        incotermPlace: 'Rotterdam',
        totalInvoiceValue: 450000,
        createdAt: now,
        updatedAt: now
      }
    ]

    // Insert expeditions
    const result = await expeditions.insertMany(baseExpeditions)
    console.log(`\nInserted ${result.insertedCount} NL demo expeditions:`)

    baseExpeditions.forEach((exp, i) => {
      const type = exp.declarationType
      const value = exp.totalInvoiceValue.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
      console.log(`  ${i + 1}. ${exp.expeditionId} - ${type} - ${exp.client.companyName} - ${value}`)
    })

    console.log('\nSummary:')
    console.log('  - 2 DECO H7 (low-value): PostNL BV, Coolblue NV')
    console.log('  - 2 DMS H1 (import): Bol.com BV, Philips Electronics NV')
    console.log('  - 1 DMS AES (export): ASML Holding NV')
    console.log(`\nAll expeditions use tenantId: ${TENANT_ID}`)

  } catch (error) {
    console.error('Error seeding NL demo data:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  }
}

seedNLDemo()
