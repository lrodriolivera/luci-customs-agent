/**
 * NCTS Service - New Computerised Transit System
 * Integración con el sistema NCTS de la Unión Europea
 *
 * NCTS Phase 5 es el sistema oficial para:
 * - Tránsitos comunitarios (T1, T2)
 * - Tránsitos TIR
 * - Tránsitos ATA/MIT
 * - Gestión de garantías de tránsito
 * - Seguimiento de movimientos
 */

const crypto = require('crypto');
const logger = require('../../config/logger');

// Configuración NCTS
const NCTS_CONFIG = {
  environments: {
    simulation: {
      baseUrl: 'https://ncts-simulation.local',
      wsUrl: 'https://ncts-simulation.local/ws',
      description: 'Entorno de simulación local'
    },
    conformance: {
      baseUrl: 'https://conformance.taxud.ec.europa.eu/ncts',
      wsUrl: 'https://conformance.taxud.ec.europa.eu/ncts/ws',
      description: 'Entorno de conformidad UE'
    },
    production: {
      baseUrl: 'https://ncts.taxation.ec.europa.eu',
      wsUrl: 'https://ncts.taxation.ec.europa.eu/ws',
      description: 'Entorno de producción UE'
    }
  },

  // Tipos de tránsito
  transitTypes: {
    T1: {
      code: 'T1',
      name: 'Tránsito Comunitario Externo',
      description: 'Mercancías no comunitarias en tránsito por la UE',
      guaranteeRequired: true,
      customsStatus: 'T1'
    },
    T2: {
      code: 'T2',
      name: 'Tránsito Comunitario Interno',
      description: 'Mercancías comunitarias en tránsito por países EFTA',
      guaranteeRequired: true,
      customsStatus: 'T2'
    },
    T2F: {
      code: 'T2F',
      name: 'Tránsito Comunitario Interno (Fiscal)',
      description: 'Mercancías comunitarias desde/hacia territorios fiscales especiales',
      guaranteeRequired: true,
      customsStatus: 'T2F'
    },
    TIR: {
      code: 'TIR',
      name: 'Tránsito TIR',
      description: 'Tránsito bajo convenio TIR',
      guaranteeRequired: true,
      customsStatus: 'TIR',
      carnetRequired: true
    },
    ATA: {
      code: 'ATA',
      name: 'Cuaderno ATA',
      description: 'Admisión temporal bajo cuaderno ATA',
      guaranteeRequired: false,
      customsStatus: 'ATA',
      carnetRequired: true
    }
  },

  // Estados de tránsito NCTS Phase 5
  transitStates: {
    // Estados de declaración
    DRAFT: { code: '000', name: 'Borrador', phase: 'declaration' },
    SUBMITTED: { code: '001', name: 'Presentada', phase: 'declaration' },
    AMENDMENT_SUBMITTED: { code: '002', name: 'Modificación presentada', phase: 'declaration' },
    ACCEPTED: { code: '003', name: 'Aceptada', phase: 'declaration' },
    REJECTED: { code: '004', name: 'Rechazada', phase: 'declaration' },

    // Estados de liberación
    RELEASED: { code: '010', name: 'Mercancía liberada', phase: 'movement' },
    IN_TRANSIT: { code: '011', name: 'En tránsito', phase: 'movement' },
    ARRIVED: { code: '012', name: 'Llegada notificada', phase: 'movement' },
    UNLOADED: { code: '013', name: 'Descargada', phase: 'movement' },

    // Estados de finalización
    CONTROL_DECISION: { code: '020', name: 'Decisión de control', phase: 'completion' },
    WRITE_OFF: { code: '021', name: 'Ultimación', phase: 'completion' },
    DISCHARGED: { code: '022', name: 'Descargada de garantía', phase: 'completion' },

    // Estados de incidencia
    DISCREPANCY: { code: '030', name: 'Discrepancia detectada', phase: 'incident' },
    SEIZURE: { code: '031', name: 'Mercancía intervenida', phase: 'incident' },
    RECOVERY: { code: '032', name: 'Procedimiento de cobro', phase: 'incident' },

    // Estados de cancelación
    CANCELLED: { code: '040', name: 'Anulada', phase: 'cancelled' },
    INVALIDATED: { code: '041', name: 'Invalidada', phase: 'cancelled' }
  },

  // Mensajes NCTS (IE messages)
  messages: {
    // Declaración
    IE015: { name: 'Declaration Data', direction: 'sent', description: 'Envío de declaración de tránsito' },
    IE013: { name: 'Declaration Amendment', direction: 'sent', description: 'Modificación de declaración' },
    IE014: { name: 'Declaration Invalidation Request', direction: 'sent', description: 'Solicitud de invalidación' },

    // Respuestas aduana salida
    IE028: { name: 'MRN Allocated', direction: 'received', description: 'MRN asignado' },
    IE016: { name: 'Declaration Rejected', direction: 'received', description: 'Declaración rechazada' },
    IE029: { name: 'Release for Transit', direction: 'received', description: 'Levante para tránsito' },
    IE051: { name: 'No Release for Transit', direction: 'received', description: 'Denegación de levante' },

    // Notificaciones
    IE001: { name: 'Arrival Notification', direction: 'sent', description: 'Notificación de llegada' },
    IE044: { name: 'Unloading Remarks', direction: 'sent', description: 'Observaciones de descarga' },

    // Respuestas aduana destino
    IE007: { name: 'Arrival Notification Rejection', direction: 'received', description: 'Rechazo de llegada' },
    IE043: { name: 'Unloading Permission', direction: 'received', description: 'Permiso de descarga' },
    IE025: { name: 'Goods Released', direction: 'received', description: 'Mercancía liberada' },

    // Control y ultimación
    IE060: { name: 'Control Decision Notification', direction: 'received', description: 'Decisión de control' },
    IE045: { name: 'Write-Off Notification', direction: 'received', description: 'Notificación de ultimación' },

    // Garantías
    IE034: { name: 'Guarantee Query', direction: 'sent', description: 'Consulta de garantía' },
    IE037: { name: 'Guarantee Query Response', direction: 'received', description: 'Respuesta consulta garantía' }
  },

  // Tipos de garantía de tránsito
  guaranteeTypes: {
    '0': { code: '0', name: 'Garantía global', description: 'GRN del titular', comprehensive: true },
    '1': { code: '1', name: 'Garantía global reducida', description: 'GRN con reducción', comprehensive: true },
    '2': { code: '2', name: 'Garantía individual fiador', description: 'Fianza individual por tercero', comprehensive: false },
    '3': { code: '3', name: 'Garantía individual efectivo', description: 'Depósito en efectivo', comprehensive: false },
    '4': { code: '4', name: 'Garantía individual documento', description: 'Título de garantía', comprehensive: false },
    '5': { code: '5', name: 'Dispensa de garantía', description: 'Exención Art. 95 CDU', comprehensive: false },
    '8': { code: '8', name: 'Garantía no requerida', description: 'Mercancías exentas', comprehensive: false },
    '9': { code: '9', name: 'Garantía individual múltiple', description: 'Para varios tránsitos', comprehensive: false },
    'B': { code: 'B', name: 'Carnet TIR', description: 'Garantía TIR', comprehensive: false },
    'H': { code: 'H', name: 'Cuaderno ATA/MIT', description: 'Garantía ATA', comprehensive: false }
  },

  // Aduanas de tránsito españolas
  transitOffices: {
    departure: [
      { code: 'ES002801', name: 'Barcelona Puerto', type: 'departure' },
      { code: 'ES004601', name: 'Valencia Puerto', type: 'departure' },
      { code: 'ES001101', name: 'Algeciras Puerto', type: 'departure' },
      { code: 'ES002811', name: 'Barcelona Aeropuerto', type: 'departure' },
      { code: 'ES002801A', name: 'Madrid Barajas', type: 'departure' },
      { code: 'ES003101', name: 'Irún', type: 'departure' },
      { code: 'ES001701', name: 'La Junquera', type: 'departure' }
    ],
    destination: [
      { code: 'FR000001', name: 'Francia - Perpignan', type: 'destination', country: 'FR' },
      { code: 'FR000002', name: 'Francia - Bayonne', type: 'destination', country: 'FR' },
      { code: 'PT000001', name: 'Portugal - Lisboa', type: 'destination', country: 'PT' },
      { code: 'DE000001', name: 'Alemania - Frankfurt', type: 'destination', country: 'DE' },
      { code: 'IT000001', name: 'Italia - Milano', type: 'destination', country: 'IT' },
      { code: 'NL000001', name: 'Países Bajos - Rotterdam', type: 'destination', country: 'NL' },
      { code: 'BE000001', name: 'Bélgica - Antwerpen', type: 'destination', country: 'BE' },
      { code: 'GB000001', name: 'Reino Unido - Dover', type: 'destination', country: 'GB' },
      { code: 'CH000001', name: 'Suiza - Basel', type: 'destination', country: 'CH' }
    ],
    transit: [
      { code: 'FR000010', name: 'Francia Tránsito', type: 'transit', country: 'FR' },
      { code: 'PT000010', name: 'Portugal Tránsito', type: 'transit', country: 'PT' }
    ]
  },

  // Códigos de sellado
  sealTypes: {
    '1': { code: '1', name: 'Precinto aduanero', authority: 'customs' },
    '2': { code: '2', name: 'Precinto expedidor autorizado', authority: 'trader' },
    '3': { code: '3', name: 'Precinto transportista', authority: 'carrier' },
    '4': { code: '4', name: 'Precinto otro', authority: 'other' }
  }
};

class NCTSService {
  constructor() {
    this.environment = process.env.NCTS_ENVIRONMENT || 'simulation';
    this.config = NCTS_CONFIG.environments[this.environment];
    this.simulationMode = this.environment === 'simulation';
    this.operatorEORI = process.env.NCTS_OPERATOR_EORI;
    this.guaranteeReference = process.env.NCTS_GUARANTEE_GRN;
  }

  /**
   * Obtener configuración actual
   */
  getConfig() {
    return {
      environment: this.environment,
      simulationMode: this.simulationMode,
      baseUrl: this.config.baseUrl,
      transitTypes: Object.keys(NCTS_CONFIG.transitTypes).length,
      guaranteeTypes: Object.keys(NCTS_CONFIG.guaranteeTypes).length
    };
  }

  /**
   * Generar LRN (Local Reference Number)
   */
  generateLRN() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ES${year}${month}${day}${random}`;
  }

  /**
   * Crear declaración de tránsito (IE015)
   */
  async createTransitDeclaration(declarationData) {
    const {
      transitType,
      principal,
      consignee,
      departureOffice,
      destinationOffice,
      transitOffices = [],
      goods,
      transport,
      guarantee,
      seals = [],
      authorisations = []
    } = declarationData;

    try {
      const transitConfig = NCTS_CONFIG.transitTypes[transitType];
      if (!transitConfig) {
        throw new Error(`Tipo de tránsito no válido: ${transitType}`);
      }

      const lrn = this.generateLRN();

      logger.info(`NCTS: Creando declaración ${transitConfig.code} con LRN ${lrn}`);

      if (this.simulationMode) {
        return this._simulateCreateDeclaration(lrn, declarationData, transitConfig);
      }

      // Construir mensaje IE015
      const ie015 = this._buildIE015Message({
        lrn,
        transitType: transitConfig.code,
        ...declarationData
      });

      const result = await this._sendNCTSMessage('IE015', ie015);

      return result;
    } catch (error) {
      logger.error('NCTS: Error creando declaración:', error);
      throw error;
    }
  }

  /**
   * Modificar declaración (IE013)
   */
  async amendDeclaration(mrn, amendments) {
    try {
      logger.info(`NCTS: Modificando declaración ${mrn}`);

      if (this.simulationMode) {
        return this._simulateAmendDeclaration(mrn, amendments);
      }

      const ie013 = this._buildIE013Message({ mrn, ...amendments });
      const result = await this._sendNCTSMessage('IE013', ie013);

      return result;
    } catch (error) {
      logger.error('NCTS: Error modificando declaración:', error);
      throw error;
    }
  }

  /**
   * Solicitar invalidación (IE014)
   */
  async requestInvalidation(mrn, reason) {
    try {
      logger.info(`NCTS: Solicitando invalidación de ${mrn}`);

      if (this.simulationMode) {
        return this._simulateInvalidation(mrn, reason);
      }

      const ie014 = this._buildIE014Message({ mrn, reason });
      const result = await this._sendNCTSMessage('IE014', ie014);

      return result;
    } catch (error) {
      logger.error('NCTS: Error solicitando invalidación:', error);
      throw error;
    }
  }

  /**
   * Notificar llegada (IE001)
   */
  async notifyArrival(arrivalData) {
    const {
      mrn,
      arrivalOffice,
      arrivalDate,
      traderAtDestination,
      simplifiedProcedure = false
    } = arrivalData;

    try {
      logger.info(`NCTS: Notificando llegada de ${mrn}`);

      if (this.simulationMode) {
        return this._simulateArrivalNotification(arrivalData);
      }

      const ie001 = this._buildIE001Message(arrivalData);
      const result = await this._sendNCTSMessage('IE001', ie001);

      return result;
    } catch (error) {
      logger.error('NCTS: Error notificando llegada:', error);
      throw error;
    }
  }

  /**
   * Enviar observaciones de descarga (IE044)
   */
  async submitUnloadingRemarks(remarksData) {
    const {
      mrn,
      unloadingDate,
      newSealNumbers = [],
      remarks,
      discrepancies = []
    } = remarksData;

    try {
      logger.info(`NCTS: Enviando observaciones de descarga para ${mrn}`);

      if (this.simulationMode) {
        return this._simulateUnloadingRemarks(remarksData);
      }

      const ie044 = this._buildIE044Message(remarksData);
      const result = await this._sendNCTSMessage('IE044', ie044);

      return result;
    } catch (error) {
      logger.error('NCTS: Error enviando observaciones:', error);
      throw error;
    }
  }

  /**
   * Consultar garantía (IE034)
   */
  async queryGuarantee(grn, accessCode) {
    try {
      logger.info(`NCTS: Consultando garantía ${grn}`);

      if (this.simulationMode) {
        return this._simulateGuaranteeQuery(grn, accessCode);
      }

      const ie034 = this._buildIE034Message({ grn, accessCode });
      const result = await this._sendNCTSMessage('IE034', ie034);

      return result;
    } catch (error) {
      logger.error('NCTS: Error consultando garantía:', error);
      throw error;
    }
  }

  /**
   * Consultar estado de declaración
   */
  async getDeclarationStatus(mrn) {
    try {
      logger.info(`NCTS: Consultando estado de ${mrn}`);

      if (this.simulationMode) {
        return this._simulateDeclarationStatus(mrn);
      }

      const result = await this._callNCTSAPI('/transit/status', { mrn });

      return result;
    } catch (error) {
      logger.error('NCTS: Error consultando estado:', error);
      throw error;
    }
  }

  /**
   * Obtener detalle completo de tránsito
   */
  async getTransitDetail(mrn) {
    try {
      logger.info(`NCTS: Obteniendo detalle de ${mrn}`);

      if (this.simulationMode) {
        return this._simulateTransitDetail(mrn);
      }

      const result = await this._callNCTSAPI('/transit/detail', { mrn });

      return result;
    } catch (error) {
      logger.error('NCTS: Error obteniendo detalle:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de mensajes
   */
  async getMessageHistory(mrn) {
    try {
      logger.info(`NCTS: Obteniendo historial de mensajes para ${mrn}`);

      if (this.simulationMode) {
        return this._simulateMessageHistory(mrn);
      }

      const result = await this._callNCTSAPI('/transit/messages', { mrn });

      return result;
    } catch (error) {
      logger.error('NCTS: Error obteniendo historial:', error);
      throw error;
    }
  }

  /**
   * Calcular garantía requerida
   */
  calculateGuaranteeAmount(goods, transitType) {
    let totalDuties = 0;
    let totalVAT = 0;

    for (const item of goods) {
      const customsValue = item.customsValue || 0;
      const quantity = item.quantity || 1;
      const dutyRate = item.dutyRate || 0;
      const vatRate = item.vatRate || 21;

      const itemDuties = customsValue * quantity * (dutyRate / 100);
      const itemVAT = (customsValue * quantity + itemDuties) * (vatRate / 100);

      totalDuties += itemDuties;
      totalVAT += itemVAT;
    }

    const totalAmount = totalDuties + totalVAT;

    // Aplicar factores según tipo de tránsito
    let factor = 1;
    if (transitType === 'TIR') {
      factor = 0; // TIR usa carnet
    } else if (transitType === 'ATA') {
      factor = 0; // ATA usa cuaderno
    }

    return {
      duties: Math.round(totalDuties * 100) / 100,
      vat: Math.round(totalVAT * 100) / 100,
      total: Math.round(totalAmount * 100) / 100,
      guaranteeRequired: Math.round(totalAmount * factor * 100) / 100,
      currency: 'EUR'
    };
  }

  /**
   * Validar referencia de garantía
   */
  async validateGuaranteeReference(grn, accessCode) {
    try {
      logger.info(`NCTS: Validando garantía ${grn}`);

      const queryResult = await this.queryGuarantee(grn, accessCode);

      return {
        valid: queryResult.success && queryResult.status === 'VALID',
        ...queryResult
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Buscar tránsitos
   */
  async searchTransits(searchCriteria) {
    const {
      transitType,
      status,
      dateFrom,
      dateTo,
      departureOffice,
      destinationOffice,
      principalEORI,
      lrn,
      mrn
    } = searchCriteria;

    try {
      logger.info('NCTS: Buscando tránsitos');

      if (this.simulationMode) {
        return this._simulateSearchTransits(searchCriteria);
      }

      const result = await this._callNCTSAPI('/transit/search', searchCriteria);

      return result;
    } catch (error) {
      logger.error('NCTS: Error buscando tránsitos:', error);
      throw error;
    }
  }

  /**
   * Obtener tipos de tránsito
   */
  getTransitTypes() {
    return Object.entries(NCTS_CONFIG.transitTypes).map(([key, value]) => ({
      code: key,
      ...value
    }));
  }

  /**
   * Obtener estados de tránsito
   */
  getTransitStates() {
    return NCTS_CONFIG.transitStates;
  }

  /**
   * Obtener tipos de garantía
   */
  getGuaranteeTypes() {
    return Object.entries(NCTS_CONFIG.guaranteeTypes).map(([key, value]) => ({
      key,
      ...value
    }));
  }

  /**
   * Obtener aduanas de tránsito
   */
  getTransitOffices(type = null) {
    if (type) {
      return NCTS_CONFIG.transitOffices[type] || [];
    }
    return NCTS_CONFIG.transitOffices;
  }

  /**
   * Obtener mensajes NCTS
   */
  getNCTSMessages() {
    return NCTS_CONFIG.messages;
  }

  /**
   * Obtener tipos de precinto
   */
  getSealTypes() {
    return NCTS_CONFIG.sealTypes;
  }

  /**
   * Test de conectividad
   */
  async testConnectivity() {
    try {
      if (this.simulationMode) {
        return {
          success: true,
          environment: this.environment,
          message: 'Modo simulación activo',
          transitTypes: Object.keys(NCTS_CONFIG.transitTypes).length,
          timestamp: new Date().toISOString()
        };
      }

      const result = await this._callNCTSAPI('/health', {});

      return {
        success: result.success,
        environment: this.environment,
        message: result.message,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        environment: this.environment,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Información del servicio
   */
  getInfo() {
    return {
      service: 'NCTS Service',
      version: '5.0.0', // NCTS Phase 5
      environment: this.environment,
      simulationMode: this.simulationMode,
      transitTypes: Object.keys(NCTS_CONFIG.transitTypes).length,
      guaranteeTypes: Object.keys(NCTS_CONFIG.guaranteeTypes).length,
      messages: Object.keys(NCTS_CONFIG.messages).length,
      description: 'Integración con NCTS Phase 5 - Sistema de Tránsito Informatizado UE'
    };
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  async _sendNCTSMessage(messageType, messageData) {
    throw new Error('Integración real pendiente. Configure NCTS_ENVIRONMENT=simulation para pruebas.');
  }

  async _callNCTSAPI(endpoint, data) {
    throw new Error('Integración real pendiente. Configure NCTS_ENVIRONMENT=simulation para pruebas.');
  }

  _buildIE015Message(data) {
    // En producción, construir XML según especificación NCTS Phase 5
    return { type: 'IE015', data };
  }

  _buildIE013Message(data) {
    return { type: 'IE013', data };
  }

  _buildIE014Message(data) {
    return { type: 'IE014', data };
  }

  _buildIE001Message(data) {
    return { type: 'IE001', data };
  }

  _buildIE044Message(data) {
    return { type: 'IE044', data };
  }

  _buildIE034Message(data) {
    return { type: 'IE034', data };
  }

  // ============================================
  // SIMULACIONES
  // ============================================

  _simulateCreateDeclaration(lrn, declarationData, transitConfig) {
    const mrn = `24ES${crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 15)}`;

    return Promise.resolve({
      success: true,
      lrn,
      mrn,
      transitType: transitConfig.code,
      status: 'SUBMITTED',
      statusCode: '001',
      statusName: 'Presentada',
      messageReceived: 'IE028',
      messageReceivedName: 'MRN Allocated',
      submittedAt: new Date().toISOString(),
      departureOffice: declarationData.departureOffice,
      destinationOffice: declarationData.destinationOffice,
      estimatedTransitTime: '48 hours',
      guarantee: {
        type: declarationData.guarantee?.type || '0',
        grn: declarationData.guarantee?.grn || 'GRN-ES-2024-001',
        amount: this.calculateGuaranteeAmount(declarationData.goods || [], transitConfig.code).guaranteeRequired
      },
      nextActions: ['Esperar liberación (IE029)', 'Preparar documentación de tránsito']
    });
  }

  _simulateAmendDeclaration(mrn, amendments) {
    return Promise.resolve({
      success: true,
      mrn,
      status: 'AMENDMENT_SUBMITTED',
      statusCode: '002',
      amendedFields: Object.keys(amendments),
      submittedAt: new Date().toISOString(),
      message: 'Modificación enviada correctamente'
    });
  }

  _simulateInvalidation(mrn, reason) {
    return Promise.resolve({
      success: true,
      mrn,
      invalidationRequested: true,
      reason,
      requestedAt: new Date().toISOString(),
      message: 'Solicitud de invalidación registrada. Pendiente de aprobación.'
    });
  }

  _simulateArrivalNotification(arrivalData) {
    const accepted = Math.random() > 0.1;

    return Promise.resolve({
      success: accepted,
      mrn: arrivalData.mrn,
      messageReceived: accepted ? 'IE043' : 'IE007',
      messageReceivedName: accepted ? 'Unloading Permission' : 'Arrival Notification Rejection',
      status: accepted ? 'ARRIVED' : 'IN_TRANSIT',
      statusCode: accepted ? '012' : '011',
      arrivalRegisteredAt: new Date().toISOString(),
      unloadingPermitted: accepted,
      unloadingLocation: accepted ? arrivalData.arrivalOffice : null,
      message: accepted
        ? 'Llegada notificada. Descarga autorizada.'
        : 'Llegada rechazada. Verifique los datos.'
    });
  }

  _simulateUnloadingRemarks(remarksData) {
    const hasDiscrepancies = remarksData.discrepancies?.length > 0;

    return Promise.resolve({
      success: true,
      mrn: remarksData.mrn,
      status: hasDiscrepancies ? 'DISCREPANCY' : 'UNLOADED',
      statusCode: hasDiscrepancies ? '030' : '013',
      unloadingCompletedAt: new Date().toISOString(),
      discrepanciesReported: hasDiscrepancies,
      discrepancies: remarksData.discrepancies || [],
      nextActions: hasDiscrepancies
        ? ['Esperar decisión de control', 'Preparar justificación de discrepancias']
        : ['Esperar ultimación (IE045)']
    });
  }

  _simulateGuaranteeQuery(grn, accessCode) {
    return Promise.resolve({
      success: true,
      grn,
      status: 'VALID',
      type: '0',
      typeName: 'Garantía global',
      holder: {
        eori: 'ES12345678A',
        name: 'Operador Autorizado S.L.'
      },
      totalAmount: 500000,
      usedAmount: 125000,
      availableAmount: 375000,
      currency: 'EUR',
      validFrom: '2024-01-01',
      validUntil: '2024-12-31',
      customsOffice: 'ES002801'
    });
  }

  _simulateDeclarationStatus(mrn) {
    const states = Object.values(NCTS_CONFIG.transitStates);
    const randomState = states[Math.floor(Math.random() * states.length)];

    return Promise.resolve({
      success: true,
      mrn,
      status: randomState.code,
      statusName: randomState.name,
      phase: randomState.phase,
      lastUpdate: new Date().toISOString(),
      position: randomState.phase === 'movement'
        ? { latitude: 41.3851, longitude: 2.1734, location: 'En tránsito - Barcelona' }
        : null
    });
  }

  _simulateTransitDetail(mrn) {
    return Promise.resolve({
      success: true,
      mrn,
      lrn: 'ES20240115A1B2C3D4',
      transitType: 'T1',
      status: 'IN_TRANSIT',
      statusCode: '011',
      principal: {
        eori: 'ES12345678A',
        name: 'Operador Autorizado S.L.'
      },
      consignee: {
        eori: 'FR98765432B',
        name: 'Destinataire SARL',
        country: 'FR'
      },
      departureOffice: {
        code: 'ES002801',
        name: 'Barcelona Puerto'
      },
      destinationOffice: {
        code: 'FR000001',
        name: 'Francia - Perpignan'
      },
      goods: [
        {
          itemNumber: 1,
          commodityCode: '8471300000',
          description: 'Ordenadores portátiles',
          grossMass: 5000,
          netMass: 4500,
          packages: 100
        }
      ],
      transport: {
        mode: '3', // Road
        nationality: 'ES',
        registration: '1234ABC'
      },
      seals: [
        { number: 'SEAL001', type: '1' }
      ],
      guarantee: {
        type: '0',
        grn: 'GRN-ES-2024-001',
        amount: 15000
      },
      timeline: [
        { event: 'CREATED', timestamp: new Date(Date.now() - 86400000).toISOString(), description: 'Declaración creada' },
        { event: 'SUBMITTED', timestamp: new Date(Date.now() - 82800000).toISOString(), description: 'Declaración presentada' },
        { event: 'MRN_ALLOCATED', timestamp: new Date(Date.now() - 82000000).toISOString(), description: 'MRN asignado' },
        { event: 'RELEASED', timestamp: new Date(Date.now() - 72000000).toISOString(), description: 'Levante concedido' }
      ]
    });
  }

  _simulateMessageHistory(mrn) {
    return Promise.resolve({
      success: true,
      mrn,
      messages: [
        { type: 'IE015', direction: 'sent', timestamp: new Date(Date.now() - 86400000).toISOString(), description: 'Declaración enviada' },
        { type: 'IE028', direction: 'received', timestamp: new Date(Date.now() - 82000000).toISOString(), description: 'MRN asignado' },
        { type: 'IE029', direction: 'received', timestamp: new Date(Date.now() - 72000000).toISOString(), description: 'Levante concedido' }
      ]
    });
  }

  _simulateSearchTransits(searchCriteria) {
    return Promise.resolve({
      success: true,
      results: [
        {
          mrn: '24ESA1B2C3D4E5F6G7H8',
          lrn: 'ES20240115A1B2C3D4',
          transitType: 'T1',
          status: 'IN_TRANSIT',
          departureOffice: 'ES002801',
          destinationOffice: 'FR000001',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          mrn: '24ESZ9Y8X7W6V5U4T3S2',
          lrn: 'ES20240114E5F6G7H8',
          transitType: 'T2',
          status: 'DISCHARGED',
          departureOffice: 'ES004601',
          destinationOffice: 'CH000001',
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ],
      total: 2,
      page: 1,
      pageSize: 20
    });
  }
}

module.exports = new NCTSService();
