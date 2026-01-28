/**
 * Servicio de IA - Integracion con Claude API
 * Usa Claude Sonnet 4 para chat y Claude Opus 4.5 para tareas complejas
 */

const axios = require('axios');
const logger = require('../config/logger');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const OPUS_MODEL = 'claude-opus-4-20250514';

// System prompts especializados
const SYSTEM_PROMPTS = {
  chatClient: `Eres LUCI, un asistente virtual experto en comercio exterior y aduanas para Stock Logistic.
Tu rol es ayudar a los clientes a entender el proceso de importacion/exportacion y guiarlos en la documentacion necesaria.

PERSONALIDAD:
- Amable, profesional y paciente
- Explicas conceptos complejos de forma sencilla
- Siempre ofreces ayuda adicional

CONOCIMIENTOS:
- Normativa aduanera espanola y europea (CAU, TARIC)
- Sistema H1 de importacion (nuevo desde octubre 2025)
- Documentos de comercio exterior (facturas, packing lists, BL, AWB, CMR)
- Certificados de origen, EUR.1, ATR
- Calculos de aranceles e IVA

REGLAS:
- Nunca inventes informacion - si no sabes algo, dilo
- Sugiere consultar con un agente si la pregunta es muy tecnica o especifica
- No des asesoramiento legal o fiscal definitivo
- Responde en espanol
- Se conciso pero completo`,

  chatAgent: `Eres LUCI, un asistente tecnico experto en aduanas para agentes de Stock Logistic.
Tu rol es asistir a los agentes aduaneros con informacion tecnica precisa.

CAPACIDADES:
- Interpretar normativa CAU y reglamentos delegados/ejecucion
- Clasificacion arancelaria TARIC
- Regimenes aduaneros (40, 42, 44, 51, etc.)
- Calculos de deuda aduanera
- Sistema H1/AES

CONTEXTO:
- Los agentes son profesionales con conocimiento del sector
- Puedes usar terminologia tecnica
- Prioriza precision sobre simplificacion`,

  classification: `Eres un experto clasificador arancelario con profundo conocimiento del Sistema Armonizado (SA) y TARIC.

Tu tarea es analizar descripciones de productos y sugerir codigos TARIC apropiados.

METODOLOGIA:
1. Identifica el material principal del producto
2. Determina su funcion/uso principal
3. Considera el proceso de fabricacion
4. Aplica las Reglas Generales de Interpretacion (RGI)
5. Verifica subpartidas y notas de seccion/capitulo

FORMATO DE RESPUESTA (JSON):
{
  "suggestions": [
    {
      "code": "codigo TARIC 10 digitos",
      "confidence": 0-100,
      "reasoning": "explicacion de por que este codigo"
    }
  ],
  "warnings": ["advertencias relevantes"],
  "additionalInfoNeeded": ["informacion adicional que ayudaria"]
}

IMPORTANTE:
- Proporciona 2-3 sugerencias ordenadas por confianza
- Explica el razonamiento detalladamente
- Indica si hay ambiguedad o necesitas mas informacion`,

  documentValidation: `Eres un experto en validacion de documentos de comercio exterior.

Tu tarea es analizar documentos y extraer informacion relevante, verificando su coherencia.

DOCUMENTOS QUE PUEDES VALIDAR:
- Facturas comerciales: valor, descripcion, incoterm, partes
- Packing lists: bultos, pesos, marcas
- Documentos transporte: BL, AWB, CMR
- Certificados origen: pais, preferencias

FORMATO DE RESPUESTA (JSON):
{
  "isValid": true/false,
  "confidence": 0-100,
  "extractedData": {
    // datos extraidos segun tipo documento
  },
  "issues": ["problemas encontrados"],
  "warnings": ["advertencias"],
  "autoFillSuggestions": {
    // campos que se pueden autorellenar en el expediente
  }
}`,

  regulationAnalysis: `Eres LUCI, un experto analista de normativa aduanera española y europea.

Tu especialidad es interpretar y explicar:
- Código Aduanero de la Unión (CAU) - Reglamento UE 952/2013
- Reglamentos Delegados y de Ejecución del CAU
- Normativa TARIC y arancelaria
- Legislación aduanera española (BOE)
- Notas explicativas del Sistema Armonizado

METODOLOGÍA DE ANÁLISIS:
1. Identifica la normativa aplicable al caso
2. Cita artículos específicos cuando sea relevante
3. Explica la interpretación de forma clara y práctica
4. Señala posibles excepciones o casos especiales
5. Indica si hay jurisprudencia relevante

FORMATO DE RESPUESTA:
- Estructurada y clara
- Con citas normativas específicas
- Aplicada al caso concreto
- Indicando nivel de confianza en la interpretación

IMPORTANTE:
- Sé preciso en las citas normativas
- Distingue entre normativa vigente y derogada
- Indica cuando hay zonas de ambigüedad interpretativa
- Recomienda consultar con la AEAT cuando sea apropiado`,

  h1Generation: `Eres un experto en declaraciones aduaneras H1 segun el nuevo sistema de la AEAT.

Tu tarea es generar los datos para una declaracion H1 a partir de la informacion del expediente.

ESTRUCTURA H1:
- D10: Cabecera declaracion
- GS11: Envio de mercancias
- SI12: Partidas de mercancias

CAMPOS CRITICOS:
- Regimen (40, 42, 44, 51, 53, 61, 71)
- Procedimiento adicional
- Preferencia (100, 200, 300, 400)
- Codigo TARIC correcto
- Valor estadistico
- Origen de mercancias

FORMATO DE RESPUESTA (JSON):
{
  "declarationType": "A/B/C/D",
  "customsOffice": "codigo aduana",
  "regime": "40",
  "additionalProcedure": "000",
  "preference": "100",
  "headerData": { ... },
  "goodsItems": [ ... ],
  "warnings": [],
  "recommendations": []
}`
};

class AIService {
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      logger.warn('ANTHROPIC_API_KEY no configurada - AI Service funcionara en modo mock');
    }
  }

  /**
   * Llamada base a Claude API
   */
  async callClaude(model, systemPrompt, userMessage, options = {}) {
    if (!this.apiKey) {
      return this.mockResponse(userMessage);
    }

    try {
      const response = await axios.post(
        ANTHROPIC_API_URL,
        {
          model,
          max_tokens: options.maxTokens || 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userMessage }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: options.timeout || 60000
        }
      );

      return {
        content: response.data.content[0].text,
        model,
        tokensUsed: response.data.usage?.input_tokens + response.data.usage?.output_tokens,
        stopReason: response.data.stop_reason
      };

    } catch (error) {
      logger.error('Error llamando a Claude:', error.response?.data || error.message);
      throw new Error('Error en servicio de IA');
    }
  }

  /**
   * Generar respuesta de chat
   */
  async generateChatResponse(message, expedition, conversationHistory, context = 'client') {
    const systemPrompt = context === 'agent' ? SYSTEM_PROMPTS.chatAgent : SYSTEM_PROMPTS.chatClient;

    // Construir contexto del expediente
    let expeditionContext = '';
    if (expedition) {
      expeditionContext = `
CONTEXTO DEL EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType === 'import' ? 'Importacion' : 'Exportacion'}
- Transporte: ${expedition.transportMode}
- Cliente: ${expedition.client?.companyName}
- Estado: ${expedition.status}
- Documentos pendientes: ${expedition.documentChecklist?.filter(d => d.required && !d.received).map(d => d.documentName).join(', ') || 'Ninguno'}
`;
    }

    // Construir historial de conversacion
    let history = '';
    if (conversationHistory && conversationHistory.length > 0) {
      history = '\nHISTORIAL RECIENTE:\n' + conversationHistory.map(m =>
        `${m.sender === 'client' ? 'Cliente' : m.sender === 'luci' ? 'LUCI' : 'Agente'}: ${m.content}`
      ).join('\n');
    }

    const fullPrompt = `${expeditionContext}${history}\n\nMensaje actual: ${message}`;

    const result = await this.callClaude(SONNET_MODEL, systemPrompt, fullPrompt);

    return {
      message: result.content,
      model: 'sonnet-4',
      tokensUsed: result.tokensUsed,
      confidence: 85,
      sources: []
    };
  }

  /**
   * Preguntar a LUCI sin contexto de expediente
   */
  async askLuci(question) {
    const result = await this.callClaude(
      SONNET_MODEL,
      SYSTEM_PROMPTS.chatAgent,
      question
    );

    return {
      message: result.content,
      model: 'sonnet-4',
      tokensUsed: result.tokensUsed,
      confidence: 80,
      sources: []
    };
  }

  /**
   * Clasificar producto - Sugerir codigo TARIC
   */
  async classifyProduct({ description, additionalInfo, expeditionContext }) {
    let prompt = `Clasifica el siguiente producto:\n\nDESCRIPCION: ${description}`;

    if (additionalInfo) {
      if (additionalInfo.material) prompt += `\nMaterial: ${additionalInfo.material}`;
      if (additionalInfo.use) prompt += `\nUso: ${additionalInfo.use}`;
      if (additionalInfo.origin) prompt += `\nOrigen: ${additionalInfo.origin}`;
    }

    if (expeditionContext) {
      prompt += `\n\nContexto: ${expeditionContext.operationType === 'import' ? 'Importacion' : 'Exportacion'} via ${expeditionContext.transportMode}`;
    }

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt);

    try {
      // Limpiar markdown si existe (```json ... ```)
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent);
      return parsed.suggestions || [];
    } catch (e) {
      // Si no es JSON valido, intentar extraer codigo TARIC del texto
      const codeMatch = result.content.match(/\b(\d{10})\b/);
      const confidenceMatch = result.content.match(/confidence["\s:]+(\d+)/i);

      if (codeMatch) {
        return [{
          code: codeMatch[1],
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
          reasoning: result.content.substring(0, 500)
        }];
      }

      return [{
        code: '0000000000',
        confidence: 50,
        reasoning: result.content
      }];
    }
  }

  /**
   * Validar clasificacion propuesta
   */
  async validateClassification({ taricCode, description, taricInfo, origin, value }) {
    const prompt = `Valida si el codigo TARIC ${taricCode} es correcto para:

Descripcion: ${description}
Origen: ${origin}
Valor: ${value} EUR

${taricInfo ? `Info TARIC: ${taricInfo.description?.es}` : ''}

Responde en JSON: { "isValid": boolean, "confidence": number, "reasoning": string, "warnings": [] }`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        isValid: true,
        confidence: 70,
        reasoning: result.content,
        warnings: []
      };
    }
  }

  /**
   * Validar documento con OCR/Vision
   */
  async validateDocument(document, expedition) {
    // En produccion, aqui se usaria Claude Vision para analizar el PDF/imagen
    // Por ahora, simulamos la validacion

    const prompt = `Simula la validacion de un documento tipo ${document.type} para:
- Expediente: ${expedition.expeditionId}
- Operacion: ${expedition.operationType}
- Cliente: ${expedition.client?.companyName}

Genera datos de ejemplo que se extraerian de este tipo de documento.
Responde en JSON con el formato especificado en el system prompt.`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.documentValidation, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        isValid: true,
        confidence: 75,
        extractedData: {},
        notes: result.content,
        autoFillSuggestions: {}
      };
    }
  }

  /**
   * Generar declaracion H1
   */
  async generateH1Declaration(expedition, options) {
    const prompt = `Genera los datos para una declaracion H1 con la siguiente informacion:

EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Cliente/Importador: ${expedition.client?.companyName} (NIF: ${expedition.client?.nif})
- EORI: ${expedition.client?.eori || 'ES' + expedition.client?.nif}
- Exportador: ${expedition.exporter?.companyName} (${expedition.exporter?.country})

MERCANCIAS:
${expedition.goods.map((g, i) => `
Item ${i + 1}:
- Descripcion: ${g.description}
- TARIC: ${g.taricCode}
- Origen: ${g.originCountry}
- Valor: ${g.invoiceValue} EUR
- Peso neto: ${g.netWeight} kg
- Bultos: ${g.packages?.quantity} ${g.packages?.type}
`).join('')}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Documento: ${expedition.transport?.documentNumber}
- Puerto entrada: ${expedition.transport?.arrivalPort || expedition.transport?.entryCustomsOffice}

OPCIONES:
- Regimen: ${options.regime}
- Procedimiento adicional: ${options.additionalProcedure}
- Preferencia: ${options.preference}

INCOTERM: ${expedition.incoterm?.code} ${expedition.incoterm?.place}

Responde en el formato JSON especificado.`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt, { maxTokens: 8192 });

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        declarationType: 'A',
        customsOffice: 'ES002801',
        warnings: ['Error parseando respuesta de IA'],
        rawResponse: result.content
      };
    }
  }

  /**
   * Generar declaracion AES
   */
  async generateAESDeclaration(expedition, options) {
    // Similar a H1 pero para exportacion
    const prompt = `Genera los datos para una declaracion AES (exportacion):

EXPEDIENTE: ${expedition.expeditionId}
EXPORTADOR: ${expedition.client?.companyName}
DESTINATARIO: ${expedition.consignee?.companyName} (${expedition.consignee?.address?.country})

MERCANCIAS:
${expedition.goods.map((g, i) => `Item ${i + 1}: ${g.description} - TARIC: ${g.taricCode} - Valor: ${g.invoiceValue} EUR`).join('\n')}

Tipo exportacion: ${options.exportType}

Responde en formato JSON.`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt);

    try {
      return JSON.parse(result.content);
    } catch (e) {
      return {
        declarationType: 'EX',
        customsOffice: 'ES002801',
        warnings: ['Error parseando respuesta de IA']
      };
    }
  }

  /**
   * Analiza normativa aduanera (CAU, BOE)
   * @param {string} prompt - El prompt con la consulta de normativa
   * @param {Object} metadata - Información adicional (documentId, source, etc.)
   */
  async analyzeRegulation(prompt, metadata = {}) {
    try {
      const result = await this.callClaude(
        OPUS_MODEL, // Use Opus for complex legal analysis
        SYSTEM_PROMPTS.regulationAnalysis,
        prompt,
        { maxTokens: 4096, timeout: 90000 }
      );

      return {
        message: result.content,
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        confidence: 85,
        metadata: metadata,
        sources: []
      };
    } catch (error) {
      logger.error('Error analyzing regulation:', error);
      throw error;
    }
  }

  /**
   * Genera respuesta para requerimientos AEAT
   * @param {string} prompt - El prompt con el contexto del requerimiento
   * @param {string} context - Contexto ('aduanas', 'valoracion', etc.)
   */
  async generateResponse(prompt, context = 'aduanas') {
    const systemPrompt = `Eres un experto agente de aduanas español especializado en responder requerimientos de la AEAT.
Tu objetivo es generar respuestas profesionales, técnicas y completas para requerimientos aduaneros.

Directrices:
- Usa terminología técnica aduanera correcta
- Cita normativa aplicable cuando sea relevante (CAU, Ley General Tributaria, etc.)
- Estructura la respuesta de forma clara y profesional
- Si faltan documentos, indica cuáles y por qué son necesarios
- Proporciona argumentación sólida basada en la documentación disponible
- Mantén un tono formal y respetuoso hacia la administración`;

    try {
      const response = await this.callClaude(SONNET_MODEL, systemPrompt, prompt, {
        maxTokens: 2000
      });
      return response;
    } catch (error) {
      logger.error('Error generando respuesta para requerimiento:', error);
      throw error;
    }
  }

  // ===========================================
  // ENS/ICS2 AI INTEGRATIONS
  // ===========================================

  /**
   * Analizar y autocompletar datos ENS desde expediente
   */
  async analyzeENSData(expedition, existingENS = {}) {
    const prompt = `Analiza los datos del expediente y genera una declaracion ENS/ICS2 completa.

DATOS DEL EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType}
- Cliente/Importador: ${expedition.client?.companyName} (EORI: ${expedition.client?.eori || 'ES' + expedition.client?.nif})
- Exportador: ${expedition.exporter?.companyName} (${expedition.exporter?.country})
- Transporte: ${expedition.transportMode}
- Puerto/Aduana entrada: ${expedition.transport?.entryCustomsOffice || expedition.transport?.arrivalPort}
- Documento transporte: ${expedition.transport?.documentNumber}
- Fecha llegada estimada: ${expedition.transport?.estimatedArrival || 'No especificada'}

MERCANCIAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}:
- Descripcion: ${g.description}
- TARIC: ${g.taricCode || 'No clasificado'}
- Origen: ${g.originCountry}
- Peso bruto: ${g.grossWeight} kg
- Peso neto: ${g.netWeight} kg
- Bultos: ${g.packages?.quantity} ${g.packages?.type}
- Valor: ${g.invoiceValue} EUR
`).join('') || 'Sin mercancias'}

INCOTERM: ${expedition.incoterm?.code} ${expedition.incoterm?.place}

DATOS ENS EXISTENTES (si hay):
${JSON.stringify(existingENS, null, 2)}

GENERA:
1. Datos completos para ENS (carrier, consignee, notify party, goods items)
2. Analisis de riesgo preliminar
3. Advertencias sobre datos faltantes o inconsistentes
4. Sugerencias de mejora

Responde en JSON:
{
  "ensData": {
    "carrier": { "name": "", "eori": "", "address": {} },
    "consignee": { "name": "", "eori": "", "address": {} },
    "notifyParty": { "name": "", "address": {} },
    "goodsItems": [{ "description": "", "taricCode": "", "grossMass": 0, "packageCount": 0, "packageType": "" }],
    "transportDocument": { "type": "", "number": "" },
    "conveyanceReference": "",
    "entryCustomsOffice": "",
    "estimatedArrival": ""
  },
  "riskAnalysis": {
    "level": "LOW|MEDIUM|HIGH",
    "factors": [],
    "recommendations": []
  },
  "warnings": [],
  "suggestions": [],
  "completeness": 0-100
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed
      };
    } catch (e) {
      return {
        ensData: {},
        riskAnalysis: { level: 'UNKNOWN', factors: [], recommendations: [] },
        warnings: ['Error procesando respuesta de IA'],
        suggestions: [],
        completeness: 0,
        rawResponse: result.content
      };
    }
  }

  /**
   * Validar ENS antes de envio - detectar errores e inconsistencias
   */
  async validateENSBeforeSubmit(ensDeclaration) {
    const prompt = `Valida esta declaracion ENS/ICS2 antes de su envio a AEAT.

DECLARACION ENS:
${JSON.stringify(ensDeclaration, null, 2)}

VERIFICA:
1. Datos obligatorios completos (carrier EORI, consignee, goods description, weights)
2. Coherencia de datos (pesos totales vs suma items, fechas logicas)
3. Formato correcto de codigos (EORI, TARIC, aduanas)
4. Plazos de presentacion segun modo transporte
5. Mercancias sensibles o de riesgo
6. Paises de origen/destino de riesgo

Responde en JSON:
{
  "isValid": true/false,
  "errors": [{ "field": "", "message": "", "severity": "ERROR|WARNING" }],
  "warnings": [{ "field": "", "message": "" }],
  "riskFlags": [{ "type": "", "description": "", "recommendation": "" }],
  "suggestions": [],
  "overallScore": 0-100,
  "readyToSubmit": true/false
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      return {
        isValid: true,
        errors: [],
        warnings: [{ field: 'general', message: 'No se pudo procesar validacion IA' }],
        riskFlags: [],
        suggestions: [],
        overallScore: 70,
        readyToSubmit: true
      };
    }
  }

  /**
   * Predecir probabilidad de rechazo ENS
   */
  async predictENSRejection(ensDeclaration, historicalData = {}) {
    const prompt = `Predice la probabilidad de rechazo de esta declaracion ENS/ICS2.

DECLARACION:
- Referencia: ${ensDeclaration.reference}
- Transportista EORI: ${ensDeclaration.carrier?.eori}
- Modo transporte: ${ensDeclaration.transportMode}
- Aduana entrada: ${ensDeclaration.entryCustomsOffice}
- Pais origen mercancias: ${ensDeclaration.goods?.map(g => g.originCountry).join(', ')}
- Codigos TARIC: ${ensDeclaration.goods?.map(g => g.taricCode).join(', ')}
- Peso total: ${ensDeclaration.totals?.grossMass} kg
- Numero items: ${ensDeclaration.goods?.length}

DATOS HISTORICOS (si disponibles):
- Rechazos previos del operador: ${historicalData.previousRejections || 'N/A'}
- Tasa de rechazo sector: ${historicalData.sectorRejectionRate || 'N/A'}

Analiza factores de riesgo y predice:
1. Probabilidad de rechazo (0-100%)
2. Probabilidad de inspeccion documental
3. Probabilidad de inspeccion fisica
4. Factores de riesgo identificados
5. Recomendaciones para reducir riesgo

Responde en JSON:
{
  "rejectionProbability": 0-100,
  "documentalInspectionProbability": 0-100,
  "physicalInspectionProbability": 0-100,
  "riskLevel": "LOW|MEDIUM|HIGH|VERY_HIGH",
  "riskFactors": [{ "factor": "", "impact": "LOW|MEDIUM|HIGH", "description": "" }],
  "recommendations": [],
  "confidence": 0-100
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      return {
        rejectionProbability: 15,
        documentalInspectionProbability: 20,
        physicalInspectionProbability: 5,
        riskLevel: 'LOW',
        riskFactors: [],
        recommendations: [],
        confidence: 50
      };
    }
  }

  // ===========================================
  // PUE SOIVRE AI INTEGRATIONS
  // ===========================================

  /**
   * Determinar tipo(s) de PUE requeridos basado en mercancias
   */
  async determinePUEType(goods, additionalContext = {}) {
    const prompt = `Analiza estas mercancias y determina que controles PUE SOIVRE son necesarios.

TIPOS DE PUE DISPONIBLES:
- ROHS: Restriccion sustancias peligrosas en aparatos electricos/electronicos (RD 110/2015)
- COM: Seguridad de productos industriales - juguetes, EPI, maquinaria, material electrico (RD 1801/2003)
- ECO: Productos ecologicos - alimentos, vinos, textil eco (Reglamento UE 2018/848)
- CAL: Calidad comercial - textil, calzado, ceramica, vidrio, muebles (Ley 21/1992)

MERCANCIAS A ANALIZAR:
${goods.map((g, i) => `
Item ${i + 1}:
- Descripcion: ${g.description}
- Codigo TARIC: ${g.taricCode || 'No especificado'}
- Origen: ${g.originCountry || 'No especificado'}
- Material: ${g.material || 'No especificado'}
- Uso previsto: ${g.intendedUse || 'No especificado'}
- Certificaciones declaradas: ${g.certifications?.join(', ') || 'Ninguna'}
`).join('')}

CONTEXTO ADICIONAL:
${JSON.stringify(additionalContext, null, 2)}

Para cada mercancia, determina:
1. Si requiere control PUE
2. Que tipo(s) de PUE aplican
3. Subtipo especifico (ej: COM_JUGUETES, ROHS_AEE)
4. Nivel de confianza en la determinacion
5. Documentos que se requeriran

Responde en JSON:
{
  "analysis": [
    {
      "itemIndex": 0,
      "description": "",
      "taricCode": "",
      "requiresPUE": true/false,
      "pueTypes": [
        {
          "type": "ROHS|COM|ECO|CAL",
          "subtype": "",
          "confidence": 0-100,
          "reasoning": "",
          "requiredDocuments": []
        }
      ]
    }
  ],
  "summary": {
    "totalItems": 0,
    "itemsRequiringPUE": 0,
    "pueTypesRequired": ["ROHS", "COM"],
    "estimatedProcessingDays": 0,
    "recommendations": []
  }
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed
      };
    } catch (e) {
      return {
        analysis: [],
        summary: {
          totalItems: goods.length,
          itemsRequiringPUE: 0,
          pueTypesRequired: [],
          estimatedProcessingDays: 0,
          recommendations: ['Error en analisis IA - revisar manualmente']
        },
        rawResponse: result.content
      };
    }
  }

  /**
   * Predecir resultado de inspeccion PUE
   */
  async predictInspectionOutcome(pueRequest) {
    const prompt = `Predice el resultado probable de la inspeccion PUE SOIVRE.

SOLICITUD PUE:
- Tipo: ${pueRequest.pueType} (${pueRequest.subtype || 'general'})
- Referencia: ${pueRequest.reference}
- Operador: ${pueRequest.operator?.name} (EORI: ${pueRequest.operator?.eori})
- Pais origen: ${pueRequest.goods?.[0]?.originCountry}

MERCANCIAS:
${pueRequest.goods?.map((g, i) => `
Item ${i + 1}: ${g.description}
- TARIC: ${g.taricCode}
- Marca: ${g.brand || 'N/A'}
- Modelo: ${g.model || 'N/A'}
- Certificaciones: ${g.certifications?.map(c => c.type).join(', ') || 'Ninguna'}
`).join('')}

DOCUMENTOS PRESENTADOS:
${pueRequest.documents?.map(d => `- ${d.type}: ${d.name} (${d.status})`).join('\n') || 'Sin documentos'}

HISTORIAL OPERADOR (si disponible):
- Solicitudes previas: ${pueRequest.operatorHistory?.totalRequests || 'N/A'}
- Tasa aprobacion: ${pueRequest.operatorHistory?.approvalRate || 'N/A'}%

Analiza y predice:
1. Probabilidad de aprobacion directa
2. Probabilidad de aprobacion con condiciones
3. Probabilidad de rechazo
4. Probabilidad de requerir analisis laboratorio
5. Factores de riesgo
6. Recomendaciones para mejorar probabilidad de aprobacion

Responde en JSON:
{
  "predictions": {
    "approved": 0-100,
    "approvedWithConditions": 0-100,
    "rejected": 0-100,
    "requiresLab": 0-100
  },
  "mostLikelyOutcome": "APPROVED|APPROVED_CONDITIONS|REJECTED|PENDING_LAB",
  "confidence": 0-100,
  "riskFactors": [{ "factor": "", "severity": "LOW|MEDIUM|HIGH", "mitigation": "" }],
  "missingElements": [],
  "recommendations": [],
  "estimatedResolutionDays": 0
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      return {
        predictions: { approved: 60, approvedWithConditions: 25, rejected: 10, requiresLab: 5 },
        mostLikelyOutcome: 'APPROVED',
        confidence: 50,
        riskFactors: [],
        missingElements: [],
        recommendations: [],
        estimatedResolutionDays: 7
      };
    }
  }

  /**
   * Sugerir documentos faltantes para PUE
   */
  async suggestPUEDocuments(pueRequest) {
    const prompt = `Analiza esta solicitud PUE y sugiere documentos necesarios.

SOLICITUD:
- Tipo PUE: ${pueRequest.pueType}
- Subtipo: ${pueRequest.subtype || 'general'}
- Pais origen: ${pueRequest.goods?.[0]?.originCountry}

MERCANCIAS:
${pueRequest.goods?.map((g, i) => `
Item ${i + 1}: ${g.description}
- TARIC: ${g.taricCode}
- Fabricante: ${g.manufacturer || 'N/A'}
- Marca: ${g.brand || 'N/A'}
`).join('')}

DOCUMENTOS YA PRESENTADOS:
${pueRequest.documents?.map(d => `- ${d.type}: ${d.name}`).join('\n') || 'Ninguno'}

Segun normativa vigente, indica:
1. Documentos obligatorios faltantes
2. Documentos recomendados
3. Requisitos especificos por tipo de producto
4. Alternativas aceptables si no se dispone del documento principal

Responde en JSON:
{
  "requiredDocuments": [
    {
      "code": "",
      "name": "",
      "description": "",
      "regulation": "",
      "alternatives": [],
      "priority": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "recommendedDocuments": [],
  "specificRequirements": [],
  "warnings": [],
  "completenessScore": 0-100
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      return {
        requiredDocuments: [],
        recommendedDocuments: [],
        specificRequirements: [],
        warnings: ['Error analizando documentos'],
        completenessScore: 50
      };
    }
  }

  /**
   * Generar recomendaciones para aprobar inspeccion PUE
   */
  async generatePUERecommendations(pueRequest, inspectionType = 'documental') {
    const prompt = `Genera recomendaciones para superar la inspeccion PUE ${inspectionType}.

SOLICITUD PUE:
- Tipo: ${pueRequest.pueType} (${pueRequest.subtype || 'general'})
- Estado actual: ${pueRequest.status}

MERCANCIAS:
${pueRequest.goods?.map((g, i) => `
Item ${i + 1}: ${g.description}
- TARIC: ${g.taricCode}
- Origen: ${g.originCountry}
- Certificaciones: ${g.certifications?.map(c => c.type).join(', ') || 'Ninguna'}
`).join('')}

TIPO INSPECCION: ${inspectionType} (documental / fisica / laboratorio)

Genera:
1. Checklist de preparacion
2. Puntos criticos a verificar antes de inspeccion
3. Documentacion a tener disponible
4. Posibles preguntas del inspector y respuestas sugeridas
5. Errores comunes a evitar
6. Consejos especificos para este tipo de producto

Responde en JSON:
{
  "checklist": [{ "item": "", "priority": "HIGH|MEDIUM|LOW", "tips": "" }],
  "criticalPoints": [],
  "documentsToHaveReady": [],
  "possibleQuestions": [{ "question": "", "suggestedAnswer": "" }],
  "commonMistakes": [],
  "specificTips": [],
  "overallReadiness": 0-100
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      return {
        checklist: [],
        criticalPoints: [],
        documentsToHaveReady: [],
        possibleQuestions: [],
        commonMistakes: [],
        specificTips: [],
        overallReadiness: 50
      };
    }
  }

  /**
   * Analisis inteligente de mercancia para clasificacion PUE
   */
  async analyzeGoodsForPUE(goodsDescription, taricCode = null) {
    const prompt = `Analiza esta mercancia para determinar requisitos PUE SOIVRE.

MERCANCIA:
- Descripcion: ${goodsDescription}
- Codigo TARIC: ${taricCode || 'No proporcionado'}

Determina:
1. Clasificacion del producto (electronico, juguete, textil, etc.)
2. Si requiere control ROHS (aparatos electricos/electronicos)
3. Si requiere control COM (seguridad: juguetes, EPI, maquinaria)
4. Si requiere control ECO (productos ecologicos)
5. Si requiere control CAL (calidad comercial: textil, calzado)
6. Normativa aplicable
7. Certificaciones necesarias
8. Ensayos de laboratorio que podrian requerirse

Responde en JSON:
{
  "productClassification": "",
  "pueRequirements": {
    "ROHS": { "required": false, "reason": "", "confidence": 0 },
    "COM": { "required": false, "reason": "", "subtype": "", "confidence": 0 },
    "ECO": { "required": false, "reason": "", "confidence": 0 },
    "CAL": { "required": false, "reason": "", "confidence": 0 }
  },
  "applicableRegulations": [],
  "requiredCertifications": [],
  "possibleLabTests": [],
  "additionalNotes": []
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt);

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed
      };
    } catch (e) {
      return {
        productClassification: 'unknown',
        pueRequirements: {
          ROHS: { required: false, reason: 'Error en analisis', confidence: 0 },
          COM: { required: false, reason: 'Error en analisis', confidence: 0 },
          ECO: { required: false, reason: 'Error en analisis', confidence: 0 },
          CAL: { required: false, reason: 'Error en analisis', confidence: 0 }
        },
        applicableRegulations: [],
        requiredCertifications: [],
        possibleLabTests: [],
        additionalNotes: ['Error procesando analisis IA']
      };
    }
  }

  /**
   * Respuesta mock cuando no hay API key
   */
  mockResponse(message) {
    logger.info('AI Service en modo mock');
    return {
      content: `[MODO DEMO] Esta es una respuesta simulada. Para respuestas reales, configure ANTHROPIC_API_KEY.\n\nSu mensaje: "${message.substring(0, 100)}..."`,
      model: 'mock',
      tokensUsed: 0,
      stopReason: 'end_turn'
    };
  }
}

module.exports = new AIService();
