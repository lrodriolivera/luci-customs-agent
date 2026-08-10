/**
 * Quota Management Service
 * Servicio para gestión de Contingentes Arancelarios (TRQ - Tariff Rate Quotas)
 *
 * Los contingentes permiten importar ciertas cantidades de productos
 * a un tipo arancelario reducido o nulo dentro del límite establecido
 */

const logger = require('../config/logger');

/**
 * Contingentes Arancelarios activos (2024-2026)
 * Basado en Reglamento UE y acuerdos comerciales
 */
const ACTIVE_QUOTAS = {
  // Contingentes Autónomos UE
  'Q090001': {
    orderNumber: '090001',
    type: 'autonomous',
    description: 'Carne de vacuno de alta calidad',
    taricCodes: ['02011000', '02012090', '02013000'],
    originCountries: ['US', 'AR', 'BR', 'UY'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 45000000, unit: 'kg', used: 32450000, available: 12550000 },
    duty: { inQuota: 0.00, outQuota: 0.124 },
    allocationMethod: 'fcfs', // First Come First Served
    critical: false
  },
  'Q090002': {
    orderNumber: '090002',
    type: 'autonomous',
    description: 'Carne de porcino congelada',
    taricCodes: ['02032911', '02032915', '02032955'],
    originCountries: ['ALL'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 15000000, unit: 'kg', used: 14200000, available: 800000 },
    duty: { inQuota: 0.00, outQuota: 0.089 },
    allocationMethod: 'fcfs',
    critical: true // Casi agotado
  },
  'Q090003': {
    orderNumber: '090003',
    type: 'autonomous',
    description: 'Maíz',
    taricCodes: ['10051090', '10059000'],
    originCountries: ['ALL'],
    period: { start: '2025-07-01', end: '2026-06-30' },
    volume: { total: 300000000, unit: 'kg', used: 125000000, available: 175000000 },
    duty: { inQuota: 0.00, outQuota: 0.06 },
    allocationMethod: 'fcfs',
    critical: false
  },

  // Contingentes de Acuerdos Comerciales - CETA (Canadá)
  'Q094100': {
    orderNumber: '094100',
    type: 'fta',
    agreement: 'CETA',
    description: 'Carne de porcino fresca/refrigerada - CETA',
    taricCodes: ['02031110', '02031211', '02031911'],
    originCountries: ['CA'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 80000000, unit: 'kg', used: 52000000, available: 28000000 },
    duty: { inQuota: 0.00, outQuota: 0.088 },
    allocationMethod: 'fcfs',
    requiresCertificate: 'EUR.1',
    critical: false
  },
  'Q094101': {
    orderNumber: '094101',
    type: 'fta',
    agreement: 'CETA',
    description: 'Trigo blando - CETA',
    taricCodes: ['10019900'],
    originCountries: ['CA'],
    period: { start: '2025-07-01', end: '2026-06-30' },
    volume: { total: 100000000, unit: 'kg', used: 38500000, available: 61500000 },
    duty: { inQuota: 0.00, outQuota: 0.093 },
    allocationMethod: 'fcfs',
    requiresCertificate: 'EUR.1',
    critical: false
  },

  // Contingentes JEFTA (Japón)
  'Q094200': {
    orderNumber: '094200',
    type: 'fta',
    agreement: 'JEFTA',
    description: 'Quesos procesados - JEFTA',
    taricCodes: ['04061020', '04061080', '04069001'],
    originCountries: ['JP'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 20000000, unit: 'kg', used: 15800000, available: 4200000 },
    duty: { inQuota: 0.00, outQuota: 0.189 },
    allocationMethod: 'fcfs',
    requiresCertificate: 'EUR.1',
    critical: true
  },

  // Contingentes EU-MERCOSUR
  'Q094300': {
    orderNumber: '094300',
    type: 'fta',
    agreement: 'EU-MERCOSUR',
    description: 'Carne de vacuno - MERCOSUR',
    taricCodes: ['02011000', '02012020', '02013000'],
    originCountries: ['AR', 'BR', 'UY', 'PY'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 99000000, unit: 'kg', used: 85000000, available: 14000000 },
    duty: { inQuota: 0.00, outQuota: 0.124 },
    allocationMethod: 'fcfs',
    requiresCertificate: 'EUR.1',
    critical: true
  },
  'Q094301': {
    orderNumber: '094301',
    type: 'fta',
    agreement: 'EU-MERCOSUR',
    description: 'Etanol - MERCOSUR',
    taricCodes: ['22071000', '22072000'],
    originCountries: ['BR'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 450000000, unit: 'L', used: 280000000, available: 170000000 },
    duty: { inQuota: 0.00, outQuota: 0.192 },
    allocationMethod: 'fcfs',
    requiresCertificate: 'EUR.1',
    critical: false
  },

  // Contingentes Agrícolas Comunes
  'Q090100': {
    orderNumber: '090100',
    type: 'agricultural',
    description: 'Azúcar de caña en bruto',
    taricCodes: ['17011110'],
    originCountries: ['ALL'],
    period: { start: '2025-10-01', end: '2026-09-30' },
    volume: { total: 185000000, unit: 'kg', used: 95000000, available: 90000000 },
    duty: { inQuota: 0.00, outQuota: 0.339 },
    allocationMethod: 'traditional', // Basado en importadores tradicionales
    critical: false
  },
  'Q090101': {
    orderNumber: '090101',
    type: 'agricultural',
    description: 'Plátanos',
    taricCodes: ['08030019'],
    originCountries: ['ALL'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 850000000, unit: 'kg', used: 520000000, available: 330000000 },
    duty: { inQuota: 0.075, outQuota: 0.176 },
    allocationMethod: 'fcfs',
    critical: false
  },

  // Contingente Lácteos
  'Q090200': {
    orderNumber: '090200',
    type: 'agricultural',
    description: 'Leche en polvo desnatada',
    taricCodes: ['04021019'],
    originCountries: ['ALL'],
    period: { start: '2025-01-01', end: '2026-12-31' },
    volume: { total: 68000000, unit: 'kg', used: 64500000, available: 3500000 },
    duty: { inQuota: 0.08, outQuota: 0.189 },
    allocationMethod: 'fcfs',
    critical: true
  }
};

/**
 * Verificar disponibilidad de contingente para un producto
 */
function checkQuotaAvailability(taricCode, originCountry, quantity, unit = 'kg') {
  const applicableQuotas = [];

  // Normalizar TARIC code (eliminar espacios, convertir a string)
  const normalizedTaric = String(taricCode).replace(/\s/g, '');

  for (const [quotaId, quota] of Object.entries(ACTIVE_QUOTAS)) {
    // Verificar si el TARIC aplica
    // Buscar coincidencia: el código del contingente debe coincidir con el inicio del TARIC del producto
    // O usar coincidencia parcial de los primeros dígitos (4, 6 u 8)
    const taricMatches = quota.taricCodes.some(quotaTaric => {
      // Coincidencia exacta por prefijo
      if (normalizedTaric.startsWith(quotaTaric)) {
        return true;
      }

      // Coincidencia parcial: comparar los primeros N dígitos
      const minLength = Math.min(quotaTaric.length, normalizedTaric.length);
      if (minLength >= 4) {
        // Comparar al menos los primeros 4 dígitos (capítulo + partida)
        const quotaPrefix = quotaTaric.substring(0, Math.min(6, quotaTaric.length));
        const taricPrefix = normalizedTaric.substring(0, Math.min(6, normalizedTaric.length));
        if (quotaPrefix === taricPrefix) {
          return true;
        }
      }

      return false;
    });

    if (!taricMatches) {
      continue;
    }

    // Verificar origen (ALL significa cualquier país)
    if (quota.originCountries[0] !== 'ALL' &&
        !quota.originCountries.includes(originCountry)) {
      continue;
    }

    // Verificar período vigente
    const now = new Date();
    const start = new Date(quota.period.start);
    const end = new Date(quota.period.end);

    if (now < start || now > end) {
      continue;
    }

    // Convertir unidades si es necesario
    const requestedQuantity = unit === quota.volume.unit ? quantity : quantity; // Simplificado

    const available = quota.volume.available >= requestedQuantity;
    const utilization = (quota.volume.used / quota.volume.total) * 100;

    applicableQuotas.push({
      quotaId,
      orderNumber: quota.orderNumber,
      type: quota.type,
      agreement: quota.agreement,
      description: quota.description,
      originCountries: quota.originCountries,
      available,
      volume: {
        requested: requestedQuantity,
        available: quota.volume.available,
        total: quota.volume.total,
        used: quota.volume.used,
        unit: quota.volume.unit,
        utilizationPercent: parseFloat(utilization.toFixed(2)),
        // El saldo NO es en vivo: sale del catalogo estatico de este servicio, no del
        // sistema de contingentes de la Comision. Un contingente FCFS puede agotarse
        // en horas, asi que presentar este numero como disponibilidad actual es
        // afirmar algo que no se ha consultado. Quien lo muestre debe advertirlo y
        // remitir a la consulta oficial antes de declarar.
        isLiveBalance: false,
        source: 'catalogo_local',
        officialSource: 'https://ec.europa.eu/taxation_customs/dds2/taric/quota_consultation.jsp'
      },
      duty: {
        inQuota: quota.duty.inQuota,
        outQuota: quota.duty.outQuota,
        savings: parseFloat((quota.duty.outQuota - quota.duty.inQuota).toFixed(4))
      },
      period: quota.period,
      allocationMethod: quota.allocationMethod,
      requiresCertificate: quota.requiresCertificate,
      // Criticidad SIEMPRE derivada del consumo real, con un unico umbral.
      critical: utilization > 90,
      recommendation: available
        ? 'Solicitar número de orden en declaración aduanera'
        : 'Contingente agotado - se aplicará tipo arancelario normal'
    });
  }

  return {
    found: applicableQuotas.length > 0,
    count: applicableQuotas.length,
    quotas: applicableQuotas.sort((a, b) => a.duty.inQuota - b.duty.inQuota) // Ordenar por tipo más bajo
  };
}

/**
 * Reservar contingente (simulación)
 */
function reserveQuota(quotaId, quantity, operation) {
  const quota = ACTIVE_QUOTAS[quotaId];

  if (!quota) {
    return {
      success: false,
      error: 'Contingente no encontrado'
    };
  }

  if (quantity > quota.volume.available) {
    return {
      success: false,
      error: 'Cantidad solicitada excede disponibilidad',
      available: quota.volume.available,
      requested: quantity
    };
  }

  // En un sistema real, esto actualizaría la base de datos
  // y generaría un certificado de asignación

  const reservation = {
    success: true,
    reservationId: `RES-${quotaId}-${Date.now()}`,
    quotaId,
    orderNumber: quota.orderNumber,
    quantity,
    unit: quota.volume.unit,
    dutyRate: quota.duty.inQuota,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
    instructions: [
      `Indicar número de orden ${quota.orderNumber} en casilla 47 del DUA`,
      quota.requiresCertificate ? `Presentar certificado ${quota.requiresCertificate} válido` : null,
      'Conservar documentación probatoria por 3 años',
      quota.allocationMethod === 'traditional' ? 'Verificar elegibilidad como importador tradicional' : null
    ].filter(Boolean),
    warnings: (quota.volume.used / quota.volume.total) * 100 > 90
      ? ['Contingente en estado crítico - gestionar con prioridad'] : []
  };

  logger.info(`[QuotaService] Reservation created: ${reservation.reservationId}`);

  return reservation;
}

/**
 * Calcular ahorro potencial usando contingente
 */
function calculateQuotaSavings(taricCode, originCountry, quantity, customsValue) {
  const quotaCheck = checkQuotaAvailability(taricCode, originCountry, quantity);

  if (!quotaCheck.found || quotaCheck.quotas.length === 0) {
    return {
      applicable: false,
      savings: 0,
      message: 'No hay contingentes disponibles para este producto'
    };
  }

  const bestQuota = quotaCheck.quotas[0]; // Ya ordenado por tipo más bajo

  if (!bestQuota.available) {
    return {
      applicable: false,
      savings: 0,
      quota: bestQuota,
      message: 'Contingente agotado'
    };
  }

  const dutyWithoutQuota = customsValue * bestQuota.duty.outQuota;
  const dutyWithQuota = customsValue * bestQuota.duty.inQuota;
  const savings = dutyWithoutQuota - dutyWithQuota;

  return {
    applicable: true,
    quota: bestQuota,
    dutyWithoutQuota: parseFloat(dutyWithoutQuota.toFixed(2)),
    dutyWithQuota: parseFloat(dutyWithQuota.toFixed(2)),
    savings: parseFloat(savings.toFixed(2)),
    savingsPercent: parseFloat(((savings / dutyWithoutQuota) * 100).toFixed(2)),
    recommendation: `Utilizar contingente ${bestQuota.orderNumber} para ahorrar ${savings.toFixed(2)} EUR`
  };
}

/**
 * Obtener contingentes por acuerdo comercial
 */
function getQuotasByAgreement(agreementCode) {
  const quotas = [];

  for (const [quotaId, quota] of Object.entries(ACTIVE_QUOTAS)) {
    if (quota.agreement === agreementCode) {
      const utilization = (quota.volume.used / quota.volume.total) * 100;

      quotas.push({
        quotaId,
        orderNumber: quota.orderNumber,
        agreement: quota.agreement,
        description: quota.description,
        taricCodes: quota.taricCodes,
        originCountries: quota.originCountries,
        volume: {
          ...quota.volume,
          utilizationPercent: parseFloat(utilization.toFixed(2))
        },
        duty: quota.duty,
        period: quota.period,
        critical: utilization > 90
      });
    }
  }

  return {
    agreement: agreementCode,
    quotas,
    count: quotas.length
  };
}

/**
 * Obtener contingentes críticos (>90% utilización)
 */
function getCriticalQuotas() {
  const critical = [];

  for (const [quotaId, quota] of Object.entries(ACTIVE_QUOTAS)) {
    const utilization = (quota.volume.used / quota.volume.total) * 100;

    // La criticidad sale del consumo REAL, no de una marca manual del catalogo. La
    // condicion incluia `|| quota.critical`, y dos contingentes venian marcados a mano
    // con el 79% y el 85,86% consumido: la pantalla los listaba como criticos con
    // "Solicite reserva urgente" mientras su propio dato decia "Mas de 90 dias" de
    // margen. Un aviso de urgencia que contradice la cifra que lo acompaña no orienta,
    // desorienta.
    if (utilization > 90) {
      critical.push({
        quotaId,
        orderNumber: quota.orderNumber,
        description: quota.description,
        type: quota.type,
        agreement: quota.agreement,
        utilizationPercent: parseFloat(utilization.toFixed(2)),
        available: quota.volume.available,
        unit: quota.volume.unit,
        estimatedExhaustion: calculateExhaustionDate(quota)
      });
    }
  }

  return critical.sort((a, b) => b.utilizationPercent - a.utilizationPercent);
}

/**
 * Calcular fecha estimada de agotamiento
 */
function calculateExhaustionDate(quota) {
  const utilizationRate = quota.volume.used / quota.volume.total;

  if (utilizationRate < 0.5) {
    return 'No previsto en período actual';
  }

  const start = new Date(quota.period.start);
  const now = new Date();
  const elapsed = now - start;
  const daysElapsed = elapsed / (1000 * 60 * 60 * 24);

  const usagePerDay = quota.volume.used / daysElapsed;
  const daysToExhaustion = quota.volume.available / usagePerDay;

  if (daysToExhaustion < 0 || !isFinite(daysToExhaustion)) {
    return 'Agotado o sin datos suficientes';
  }

  const exhaustionDate = new Date(now.getTime() + daysToExhaustion * 24 * 60 * 60 * 1000);

  // La fecha es una PROYECCION lineal sobre un consumo que no se actualiza: sale del
  // catalogo estatico de este servicio, no del sistema de contingentes de la Comision.
  // Se dice explicitamente, porque una fecha concreta se lee como un dato comprobado
  // y aqui es una extrapolacion sobre cifras que pueden llevar meses congeladas.
  const proyeccion = '(proyeccion sobre datos no actualizados)';

  if (daysToExhaustion < 30) {
    return `Crítico: ~${Math.round(daysToExhaustion)} días (${exhaustionDate.toISOString().split('T')[0]}) ${proyeccion}`;
  } else if (daysToExhaustion < 90) {
    return `~${Math.round(daysToExhaustion)} días (${exhaustionDate.toISOString().split('T')[0]}) ${proyeccion}`;
  } else {
    return `Más de 90 días ${proyeccion}`;
  }
}

/**
 * Generar reporte de contingentes
 */
function generateQuotaReport(filters = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    filters,
    summary: {
      total: 0,
      critical: 0,
      available: 0,
      exhausted: 0,
      byType: {}
    },
    quotas: []
  };

  for (const [quotaId, quota] of Object.entries(ACTIVE_QUOTAS)) {
    // Aplicar filtros
    if (filters.type && quota.type !== filters.type) continue;
    if (filters.agreement && quota.agreement !== filters.agreement) continue;
    if (filters.originCountry &&
        quota.originCountries[0] !== 'ALL' &&
        !quota.originCountries.includes(filters.originCountry)) continue;

    const utilization = (quota.volume.used / quota.volume.total) * 100;
    const isCritical = utilization > 90;
    const isExhausted = quota.volume.available <= 0;

    report.summary.total++;
    if (isCritical) report.summary.critical++;
    if (isExhausted) report.summary.exhausted++;
    if (quota.volume.available > 0) report.summary.available++;

    report.summary.byType[quota.type] = (report.summary.byType[quota.type] || 0) + 1;

    report.quotas.push({
      quotaId,
      orderNumber: quota.orderNumber,
      type: quota.type,
      agreement: quota.agreement,
      description: quota.description,
      originCountries: quota.originCountries,
      utilization: parseFloat(utilization.toFixed(2)),
      status: isExhausted ? 'exhausted' : isCritical ? 'critical' : 'available',
      volume: quota.volume,
      period: quota.period
    });
  }

  return report;
}

module.exports = {
  ACTIVE_QUOTAS,
  checkQuotaAvailability,
  reserveQuota,
  calculateQuotaSavings,
  getQuotasByAgreement,
  getCriticalQuotas,
  generateQuotaReport
};
