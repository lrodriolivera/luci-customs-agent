/**
 * H7 Declaration Service
 * Servicio para gestion de declaraciones H7 (e-commerce bajo valor)
 *
 * Funcionalidades:
 * - Creacion y validacion de declaraciones H7
 * - Procesamiento masivo de envios
 * - Validacion IOSS
 * - Integracion con transportistas
 * - Deteccion de fraude de valor
 */
const { H7Declaration, Expedition } = require('../models');
const aeatSubmitService = require('./aeat/aeatSubmitService');
const logger = require('../config/logger');

// Limites y configuracion H7
const H7_CONFIG = {
  maxIntrinsicValue: 150,        // EUR
  b2bLimit: 22,                  // EUR para B2B
  vatRate: 21,                   // % IVA Espana
  reducedVatRate: 10,            // % IVA reducido
  superReducedVatRate: 4,        // % IVA superreducido
  handlingFees: {
    CORREOS: 3.00,
    DHL: 0,
    UPS: 0,
    FEDEX: 0,
    TNT: 0,
    GLS: 2.50,
    SEUR: 2.50,
    MRW: 2.50,
    AMAZON: 0,
    OTHER: 2.00
  }
};

// Codigos TARIC con IVA reducido/superreducido
const REDUCED_VAT_CODES = {
  // 10% IVA
  reduced: [
    '0201', '0202', '0203', '0204', '0207',  // Carnes
    '0301', '0302', '0303', '0304',          // Pescados
    '0401', '0402', '0403', '0404', '0405', '0406',  // Lacteos
    '0701', '0702', '0703', '0704', '0705',  // Verduras
    '0801', '0802', '0803', '0804', '0805',  // Frutas
    '1001', '1002', '1003', '1004', '1005',  // Cereales
    '1901', '1902', '1904', '1905',          // Preparaciones alimenticias
    '2201',                                   // Agua
    '9401', '9403'                            // Mobiliario (algunas partidas)
  ],
  // 4% IVA
  superReduced: [
    '0401',                                   // Leche
    '1001', '1101',                           // Pan y harina
    '0407',                                   // Huevos
    '0701', '0702', '0703',                   // Verduras basicas
    '0805',                                   // Citricos
    '4901', '4902', '4903', '4904'            // Libros, periodicos
  ]
};

// Plataformas IOSS registradas (simplificado)
const KNOWN_IOSS_PLATFORMS = {
  'IM2760000001': { name: 'Amazon EU', country: 'LU' },
  'IM2760000002': { name: 'eBay', country: 'IE' },
  'IM3560000001': { name: 'AliExpress', country: 'IE' },
  'IM3560000002': { name: 'Wish', country: 'NL' },
  'IM3560000003': { name: 'Shein', country: 'IE' },
  'IM3560000004': { name: 'Temu', country: 'IE' }
};

class H7Service {

  /**
   * Crear declaracion H7 desde datos del envio
   */
  async createDeclaration(data, userId) {
    try {
      // Validar elegibilidad H7
      const eligibility = this.checkH7Eligibility(data);
      if (!eligibility.eligible) {
        return {
          success: false,
          errors: eligibility.errors,
          suggestion: eligibility.suggestion
        };
      }

      // Calcular valores
      const calculatedData = this.calculateValues(data);

      // Crear declaracion
      const declaration = new H7Declaration({
        ...calculatedData,
        createdBy: userId,
        status: 'draft'
      });

      // Calcular derechos
      declaration.calculateDuties();

      // Validar H7
      const validation = declaration.validateH7Eligibility();
      if (!validation.eligible) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      await declaration.save();

      logger.info(`H7 declaration created: ${declaration.reference}`);

      return {
        success: true,
        data: declaration
      };

    } catch (error) {
      logger.error('Error creating H7 declaration:', error);
      throw error;
    }
  }

  /**
   * Verificar elegibilidad para H7
   */
  checkH7Eligibility(data) {
    const errors = [];
    let suggestion = null;

    // Calcular valor intrinseco
    let intrinsicValue = 0;
    if (data.items && Array.isArray(data.items)) {
      intrinsicValue = data.items.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    } else if (data.totals?.intrinsicValue) {
      intrinsicValue = data.totals.intrinsicValue;
    }

    // Verificar limite de valor
    if (intrinsicValue > H7_CONFIG.maxIntrinsicValue) {
      errors.push({
        code: 'VALUE_EXCEEDED',
        message: `Valor ${intrinsicValue} EUR excede limite H7 de ${H7_CONFIG.maxIntrinsicValue} EUR`,
        field: 'intrinsicValue'
      });
      suggestion = 'Use declaracion H1 (DUA completo) para envios > 150 EUR';
    }

    // Verificar B2B
    if (data.operationType === 'B2B_LOW_VALUE' && intrinsicValue > H7_CONFIG.b2bLimit) {
      errors.push({
        code: 'B2B_LIMIT_EXCEEDED',
        message: `Envios B2B solo pueden usar H7 si valor <= ${H7_CONFIG.b2bLimit} EUR`,
        field: 'operationType'
      });
    }

    // Verificar productos prohibidos
    if (data.items) {
      for (const item of data.items) {
        const restricted = this.checkRestrictedGoods(item.taricCode);
        if (restricted.restricted) {
          errors.push({
            code: 'RESTRICTED_GOODS',
            message: `${item.description}: ${restricted.reason}`,
            field: 'items'
          });
        }
      }
    }

    // Verificar pais de origen (sanciones)
    const sanctionedCountries = ['KP', 'IR', 'SY', 'CU', 'RU', 'BY'];
    if (data.sender?.address?.country && sanctionedCountries.includes(data.sender.address.country)) {
      errors.push({
        code: 'SANCTIONED_COUNTRY',
        message: `Pais de origen ${data.sender.address.country} bajo sanciones`,
        field: 'sender.country'
      });
    }

    return {
      eligible: errors.length === 0,
      errors,
      suggestion,
      calculatedValue: intrinsicValue
    };
  }

  /**
   * Verificar si mercancia esta restringida para H7
   */
  checkRestrictedGoods(taricCode) {
    if (!taricCode) return { restricted: false };

    const code = taricCode.substring(0, 4);

    const restrictions = {
      '2402': { reason: 'Tabaco - requiere DUA completo y sellos fiscales', type: 'TOBACCO' },
      '2403': { reason: 'Tabaco - requiere DUA completo y sellos fiscales', type: 'TOBACCO' },
      '2203': { reason: 'Cerveza - requiere DUA completo e IIEE', type: 'ALCOHOL' },
      '2204': { reason: 'Vino - requiere DUA completo e IIEE', type: 'ALCOHOL' },
      '2205': { reason: 'Vermut - requiere DUA completo e IIEE', type: 'ALCOHOL' },
      '2206': { reason: 'Bebidas fermentadas - requiere DUA completo', type: 'ALCOHOL' },
      '2207': { reason: 'Alcohol etilico - requiere DUA completo', type: 'ALCOHOL' },
      '2208': { reason: 'Bebidas espirituosas - requiere DUA completo e IIEE', type: 'ALCOHOL' },
      '3004': { reason: 'Medicamentos - requiere autorizacion AEMPS', type: 'PHARMA' },
      '9301': { reason: 'Armas - prohibida importacion H7', type: 'WEAPONS' },
      '9302': { reason: 'Armas - prohibida importacion H7', type: 'WEAPONS' },
      '9303': { reason: 'Armas - prohibida importacion H7', type: 'WEAPONS' },
      '9304': { reason: 'Armas - prohibida importacion H7', type: 'WEAPONS' },
      '3601': { reason: 'Explosivos - prohibida importacion H7', type: 'EXPLOSIVES' },
      '3602': { reason: 'Explosivos - prohibida importacion H7', type: 'EXPLOSIVES' },
      '3603': { reason: 'Pirotecnia - requiere autorizacion especial', type: 'EXPLOSIVES' },
    };

    if (restrictions[code]) {
      return {
        restricted: true,
        ...restrictions[code]
      };
    }

    return { restricted: false };
  }

  /**
   * Calcular valores y derechos
   */
  calculateValues(data) {
    const items = data.items || [];

    // Calcular totales de items
    let intrinsicValue = 0;
    let netWeight = 0;

    for (const item of items) {
      item.totalValue = item.totalValue || (item.quantity * item.unitValue);
      intrinsicValue += item.totalValue;
      netWeight += item.netWeight || 0;
    }

    const shippingCost = data.totals?.shippingCost || 0;
    const insuranceCost = data.totals?.insuranceCost || 0;
    const customsValue = intrinsicValue + shippingCost + insuranceCost;
    const grossWeight = data.totals?.grossWeight || netWeight * 1.1;

    // Determinar tasa IVA
    let vatRate = H7_CONFIG.vatRate;
    if (items.length > 0) {
      const dominantCode = items[0].taricCode?.substring(0, 4);
      if (REDUCED_VAT_CODES.superReduced.includes(dominantCode)) {
        vatRate = H7_CONFIG.superReducedVatRate;
      } else if (REDUCED_VAT_CODES.reduced.includes(dominantCode)) {
        vatRate = H7_CONFIG.reducedVatRate;
      }
    }

    // Tasa de gestion
    const carrierCode = data.carrier?.code || 'OTHER';
    const handlingFee = H7_CONFIG.handlingFees[carrierCode] || H7_CONFIG.handlingFees.OTHER;

    // Verificar si IVA prepagado via IOSS
    const vatPrepaid = !!data.iossNumber && /^IM\d{10}$/.test(data.iossNumber);

    return {
      ...data,
      items,
      vatPrepaid,
      totals: {
        intrinsicValue: Math.round(intrinsicValue * 100) / 100,
        shippingCost,
        insuranceCost,
        customsValue: Math.round(customsValue * 100) / 100,
        originalCurrency: data.totals?.originalCurrency || 'EUR',
        exchangeRate: data.totals?.exchangeRate || 1,
        grossWeight: Math.round(grossWeight * 1000) / 1000,
        netWeight: Math.round(netWeight * 1000) / 1000,
        packages: data.totals?.packages || 1
      },
      duties: {
        tariff: { rate: 0, amount: 0 },  // H7 generalmente exento de arancel
        vat: {
          rate: vatRate,
          amount: 0,
          prepaid: vatPrepaid
        },
        handlingFee,
        totalDue: 0
      }
    };
  }

  /**
   * Validar numero IOSS
   */
  async validateIOSS(iossNumber) {
    if (!iossNumber) {
      return { valid: false, error: 'Numero IOSS no proporcionado' };
    }

    // Validar formato
    if (!/^IM\d{10}$/.test(iossNumber)) {
      return {
        valid: false,
        error: 'Formato invalido. Debe ser IM + 10 digitos'
      };
    }

    // Verificar en lista conocida (en produccion se consultaria VIES)
    const known = KNOWN_IOSS_PLATFORMS[iossNumber];
    if (known) {
      return {
        valid: true,
        platform: known.name,
        country: known.country,
        source: 'known_platforms'
      };
    }

    // En demo, aceptamos cualquier formato valido
    logger.info(`IOSS ${iossNumber} no en lista conocida, asumiendo valido en demo`);
    return {
      valid: true,
      platform: 'Unknown Platform',
      country: 'EU',
      source: 'format_validation',
      warning: 'IOSS no verificado en VIES (modo demo)'
    };
  }

  /**
   * Procesar lote de declaraciones H7
   */
  async processBatch(declarations, userId, options = {}) {
    const batchId = `BATCH-${Date.now()}`;
    const results = {
      batchId,
      total: declarations.length,
      successful: 0,
      failed: 0,
      declarations: []
    };

    for (let i = 0; i < declarations.length; i++) {
      try {
        const data = {
          ...declarations[i],
          batch: {
            id: batchId,
            sequence: i + 1,
            totalInBatch: declarations.length
          }
        };

        const result = await this.createDeclaration(data, userId);

        if (result.success) {
          results.successful++;
          results.declarations.push({
            sequence: i + 1,
            trackingNumber: data.trackingNumber,
            reference: result.data.reference,
            status: 'created'
          });
        } else {
          results.failed++;
          results.declarations.push({
            sequence: i + 1,
            trackingNumber: data.trackingNumber,
            status: 'failed',
            errors: result.errors
          });
        }

      } catch (error) {
        results.failed++;
        results.declarations.push({
          sequence: i + 1,
          trackingNumber: declarations[i].trackingNumber,
          status: 'error',
          error: error.message
        });
      }
    }

    logger.info(`Batch ${batchId} processed: ${results.successful}/${results.total} successful`);
    return results;
  }

  /**
   * Enviar declaracion a AEAT
   */
  async submitToAEAT(declarationId, userId) {
    const declaration = await H7Declaration.findById(declarationId);
    if (!declaration) {
      throw new Error('Declaracion no encontrada');
    }

    if (declaration.status !== 'draft' && declaration.status !== 'pending') {
      throw new Error(`No se puede enviar declaracion en estado ${declaration.status}`);
    }

    // Validar antes de enviar
    const validation = declaration.validateH7Eligibility();
    if (!validation.eligible) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Calcular derechos finales
    declaration.calculateDuties();

    // Enviar a AEAT real via aeatSubmitService
    const aeatResult = await aeatSubmitService.submitH7(declaration);

    if (!aeatResult.success) {
      return {
        success: false,
        error: aeatResult.error || 'Error en respuesta AEAT'
      };
    }

    declaration.status = 'submitted';
    declaration.mrn = aeatResult.mrn;
    declaration.submittedAt = new Date();
    declaration.statusHistory.push({
      status: 'submitted',
      timestamp: new Date(),
      user: userId
    });

    declaration.aeatResponse = {
      code: aeatResult.code,
      message: aeatResult.estado || 'Declaracion H7 enviada',
      timestamp: new Date(),
      csv: aeatResult.csv
    };

    // En H7, el levante suele ser automatico si canal verde
    if (aeatResult.channel === 'green' || declaration.totals.customsValue <= 22 || declaration.vatPrepaid) {
      declaration.status = 'released';
      declaration.releasedAt = new Date();
      declaration.statusHistory.push({
        status: 'released',
        timestamp: new Date(),
        reason: 'Levante automatico H7'
      });
    }

    await declaration.save();

    logger.info(`H7 ${declaration.reference} submitted: MRN ${aeatResult.mrn}`);

    return {
      success: true,
      data: {
        reference: declaration.reference,
        mrn: aeatResult.mrn,
        channel: aeatResult.channel,
        status: declaration.status,
        dutiesPayable: declaration.duties.totalDue
      }
    };
  }

  /**
   * Generar MRN para H7
   */
  generateMRN() {
    const year = new Date().getFullYear().toString().substring(2);
    const random = Math.random().toString().substring(2, 16);
    return `${year}ES${random}H7`;
  }

  /**
   * Detectar posible fraude de valor
   */
  async detectValueFraud(declaration) {
    const flags = [];

    // Verificar valor sospechosamente bajo
    for (const item of declaration.items) {
      const code = item.taricCode?.substring(0, 4);

      // Valores minimos esperados por categoria (EUR)
      const minValues = {
        '8471': 50,   // Ordenadores
        '8517': 30,   // Telefonos
        '8528': 40,   // Monitores/TV
        '8519': 20,   // Reproductores
        '9102': 15,   // Relojes
        '9101': 50,   // Relojes de lujo
        '4202': 10,   // Bolsos
        '6402': 8,    // Calzado
        '6403': 15,   // Calzado cuero
        '6110': 5,    // Jerseis
        '6109': 3,    // Camisetas
      };

      if (minValues[code] && item.unitValue < minValues[code]) {
        flags.push({
          type: 'LOW_VALUE',
          severity: 'medium',
          item: item.description,
          declared: item.unitValue,
          expected: minValues[code],
          message: `Valor declarado ${item.unitValue} EUR muy bajo para ${code}`
        });
      }
    }

    // Verificar remitente frecuente con valores bajos
    const senderHistory = await H7Declaration.countDocuments({
      'sender.name': declaration.sender.name,
      'totals.intrinsicValue': { $gt: 140 },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    if (senderHistory > 5) {
      flags.push({
        type: 'FREQUENT_SENDER',
        severity: 'high',
        message: `Remitente ${declaration.sender.name} tiene ${senderHistory} envios cerca del limite en 30 dias`
      });
    }

    // Verificar splitting (multiples envios al mismo destinatario)
    const recipientHistory = await H7Declaration.countDocuments({
      'recipient.taxId': declaration.recipient.taxId,
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)  // Ultimo dia
      }
    });

    if (recipientHistory > 2) {
      flags.push({
        type: 'SPLITTING',
        severity: 'high',
        message: `Destinatario ${declaration.recipient.taxId} tiene ${recipientHistory} envios en 24h - posible splitting`
      });
    }

    return {
      flagged: flags.length > 0,
      flags,
      riskScore: this.calculateRiskScore(flags)
    };
  }

  /**
   * Calcular puntuacion de riesgo
   */
  calculateRiskScore(flags) {
    const severityScores = {
      low: 10,
      medium: 30,
      high: 50,
      critical: 100
    };

    const score = flags.reduce((total, flag) => {
      return total + (severityScores[flag.severity] || 10);
    }, 0);

    return Math.min(100, score);
  }

  /**
   * Obtener estadisticas
   */
  async getStats(filters = {}) {
    return H7Declaration.getStats(filters);
  }

  /**
   * Crear desde expediente existente
   */
  async createFromExpedition(expeditionId, userId) {
    const expedition = await Expedition.findById(expeditionId);
    if (!expedition) {
      throw new Error('Expediente no encontrado');
    }

    // Verificar elegibilidad
    const totalValue = expedition.goods?.reduce((sum, g) => sum + (g.value || 0), 0) || 0;
    if (totalValue > 150) {
      return {
        success: false,
        error: `Valor ${totalValue} EUR excede limite H7 de 150 EUR. Use DUA completo.`
      };
    }

    // Mapear datos del expediente a H7
    const h7Data = {
      expedition: expeditionId,
      trackingNumber: expedition.reference || `EXP-${expedition._id}`,
      operationType: 'B2C',
      carrier: {
        code: this.mapCarrier(expedition.transport?.carrier),
        name: expedition.transport?.carrier
      },
      sender: {
        name: expedition.exporter?.name || 'Unknown Sender',
        address: {
          country: expedition.origin?.country || 'CN'
        }
      },
      recipient: {
        name: expedition.importer?.name || 'Unknown Recipient',
        taxId: expedition.importer?.taxId || 'X0000000X',
        address: {
          street: expedition.importer?.address || 'Unknown',
          city: 'Madrid',
          postalCode: '28001',
          country: 'ES'
        }
      },
      items: (expedition.goods || []).map(g => ({
        description: g.description || 'Mercancia',
        taricCode: g.taricCode || '9999000000',
        quantity: g.quantity || 1,
        unitValue: g.value || 0,
        totalValue: g.value || 0,
        netWeight: g.weight || 0.1,
        countryOfOrigin: expedition.origin?.country || 'CN'
      })),
      totals: {
        intrinsicValue: totalValue,
        grossWeight: expedition.totals?.grossWeight || 1,
        netWeight: expedition.totals?.netWeight || 0.9,
        packages: expedition.totals?.packages || 1
      }
    };

    return this.createDeclaration(h7Data, userId);
  }

  /**
   * Mapear nombre de transportista a codigo
   */
  mapCarrier(carrierName) {
    if (!carrierName) return 'OTHER';

    const name = carrierName.toUpperCase();
    if (name.includes('CORREOS')) return 'CORREOS';
    if (name.includes('DHL')) return 'DHL';
    if (name.includes('UPS')) return 'UPS';
    if (name.includes('FEDEX')) return 'FEDEX';
    if (name.includes('TNT')) return 'TNT';
    if (name.includes('GLS')) return 'GLS';
    if (name.includes('SEUR')) return 'SEUR';
    if (name.includes('MRW')) return 'MRW';
    if (name.includes('AMAZON')) return 'AMAZON';
    return 'OTHER';
  }

  /**
   * Importar desde CSV/Excel (estructura simplificada)
   */
  parseCSVBatch(csvData) {
    const lines = csvData.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error('CSV vacio o sin datos');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const declarations = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      // Mapear a estructura H7
      declarations.push({
        trackingNumber: row.tracking || row.awb || `IMPORT-${i}`,
        operationType: 'B2C',
        iossNumber: row.ioss || null,
        carrier: {
          code: this.mapCarrier(row.carrier || row.transportista),
          name: row.carrier || row.transportista
        },
        sender: {
          name: row.sender_name || row.remitente || 'Unknown',
          address: {
            country: row.sender_country || row.pais_origen || 'CN'
          }
        },
        recipient: {
          name: row.recipient_name || row.destinatario || 'Unknown',
          taxId: row.recipient_nif || row.nif || 'X0000000X',
          address: {
            street: row.recipient_address || row.direccion || 'Unknown',
            city: row.recipient_city || row.ciudad || 'Madrid',
            postalCode: row.recipient_postal || row.cp || '28001',
            country: 'ES'
          }
        },
        items: [{
          description: row.description || row.descripcion || 'Mercancia',
          taricCode: row.taric || row.codigo || '9999000000',
          quantity: parseInt(row.quantity || row.cantidad) || 1,
          unitValue: parseFloat(row.unit_value || row.valor_unitario) || 0,
          totalValue: parseFloat(row.total_value || row.valor) || 0,
          netWeight: parseFloat(row.weight || row.peso) || 0.1,
          countryOfOrigin: row.origin || row.origen || 'CN'
        }],
        totals: {
          intrinsicValue: parseFloat(row.total_value || row.valor) || 0,
          shippingCost: parseFloat(row.shipping || row.envio) || 0,
          grossWeight: parseFloat(row.gross_weight || row.peso_bruto) || 0.5,
          netWeight: parseFloat(row.weight || row.peso) || 0.4,
          packages: parseInt(row.packages || row.bultos) || 1
        }
      });
    }

    return declarations;
  }
}

module.exports = new H7Service();
