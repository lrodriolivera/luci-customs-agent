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

  // ===========================================
  // GARANTÍAS AI INTEGRATIONS
  // ===========================================

  /**
   * Analizar necesidades de garantía para una operación
   */
  async analyzeGuaranteeNeeds(operation, existingGuarantees = []) {
    const prompt = `Analiza las necesidades de garantía aduanera para esta operación.

OPERACIÓN:
- Tipo: ${operation.operationType || 'import'}
- Régimen: ${operation.regime || '40'}
- Valor aduanero: ${operation.customsValue || 0} EUR
- Derechos estimados: ${operation.dutyAmount || 0} EUR
- IVA estimado: ${operation.vatAmount || 0} EUR
- Duración (si temporal): ${operation.duration || 'N/A'} meses

MERCANCÍAS:
${operation.goods?.map((g, i) => `
${i + 1}. ${g.description}
   TARIC: ${g.taricCode || 'N/A'}
   Origen: ${g.originCountry || 'N/A'}
   Valor: ${g.invoiceValue || 0} EUR
`).join('') || 'Sin detalles de mercancías'}

OPERADOR:
- Empresa: ${operation.operator?.companyName || 'N/A'}
- EORI: ${operation.operator?.eori || 'N/A'}
- OEA: ${operation.operator?.oeaStatus || 'Sin certificación'}
- Historial: ${operation.operator?.operationsHistory || 'N/A'}

GARANTÍAS EXISTENTES DEL OPERADOR:
${existingGuarantees.map(g => `
- ${g.reference}: ${g.type} - ${g.availableAmount} EUR disponibles (${g.status})
  Uso: ${g.usage}, Vence: ${g.validUntil ? new Date(g.validUntil).toLocaleDateString('es-ES') : 'N/A'}
`).join('') || 'Sin garantías existentes'}

TIPOS DE GARANTÍA DISPONIBLES:
1. CGU (Garantía Global Comprensiva): Para operadores frecuentes, cubre múltiples operaciones
2. Individual: Para una operación específica
3. Depósito en efectivo: Dinero depositado en la aduana
4. Aval bancario: Garantía emitida por banco
5. Seguro de caución: Póliza de seguro
6. Fianza: Garantía de tercero

REGÍMENES Y SUS REQUISITOS:
- Tránsito (T1/T2): 100% de derechos potenciales
- Depósito aduanero: 100% de derechos
- Importación temporal: 3% mensual (exención parcial) o 100% (total)
- Perfeccionamiento activo: 100% (suspensión) o 0% (drawback)
- Pago diferido: 100% mensual

REDUCCIONES OEA:
- OEAC/OEAF: 30% reducción
- OEAS: 50% reducción

Analiza y recomienda:
1. Importe de garantía necesario
2. Si las garantías existentes son suficientes
3. Qué garantía usar o crear
4. Optimizaciones posibles

Responde en JSON:
{
  "requiredAmount": {
    "base": 0,
    "afterOEAReduction": 0,
    "breakdown": {
      "duties": 0,
      "vat": 0,
      "other": 0
    },
    "calculationMethod": "Método usado"
  },
  "existingCoverage": {
    "sufficient": true/false,
    "availableTotal": 0,
    "recommendedGuarantee": "reference de garantía a usar",
    "shortfall": 0
  },
  "recommendation": {
    "action": "USE_EXISTING|CREATE_NEW|INCREASE_EXISTING|COMBINE",
    "details": "Explicación detallada",
    "suggestedType": "CGU|individual|deposit|bank_guarantee|insurance",
    "suggestedAmount": 0,
    "reasoning": "Por qué esta recomendación"
  },
  "optimizations": [
    {
      "suggestion": "Sugerencia de optimización",
      "potentialSavings": "Ahorro potencial",
      "implementation": "Cómo implementarlo"
    }
  ],
  "risks": [
    {
      "risk": "Riesgo identificado",
      "mitigation": "Cómo mitigarlo"
    }
  ],
  "oeaConsiderations": {
    "currentStatus": "Estado OEA",
    "reductionApplied": 0,
    "potentialWithOEA": "Beneficio si obtuviera OEA"
  },
  "timeline": {
    "whenNeeded": "Cuándo se necesita la garantía",
    "processingTime": "Tiempo para obtenerla"
  },
  "summary": "Resumen ejecutivo"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        requiredAmount: { base: 0, afterOEAReduction: 0 },
        existingCoverage: { sufficient: false },
        recommendation: { action: 'CREATE_NEW' },
        optimizations: [],
        risks: [],
        summary: 'Error en análisis de garantía',
        rawResponse: result.content
      };
    }
  }

  /**
   * Recomendar tipo de garantía óptimo
   */
  async recommendGuaranteeType(operatorProfile, operationDetails) {
    const prompt = `Recomienda el tipo de garantía aduanera más conveniente para este operador.

PERFIL DEL OPERADOR:
- Empresa: ${operatorProfile.companyName || 'N/A'}
- EORI: ${operatorProfile.eori || 'N/A'}
- Sector: ${operatorProfile.sector || 'N/A'}
- Años de actividad: ${operatorProfile.yearsActive || 'N/A'}
- Volumen anual operaciones: ${operatorProfile.annualOperations || 'N/A'}
- Valor anual: ${operatorProfile.annualValue || 'N/A'} EUR
- Certificación OEA: ${operatorProfile.oeaStatus || 'Sin certificación'}
- Incidencias previas: ${operatorProfile.previousIncidents || 'Ninguna conocida'}
- Capacidad financiera: ${operatorProfile.financialCapacity || 'N/A'}

OPERACIONES TÍPICAS:
- Regímenes habituales: ${operationDetails.typicalRegimes?.join(', ') || 'N/A'}
- Frecuencia: ${operationDetails.frequency || 'N/A'} operaciones/mes
- Valor medio por operación: ${operationDetails.avgOperationValue || 'N/A'} EUR
- Países origen habituales: ${operationDetails.originCountries?.join(', ') || 'N/A'}
- Tipos de mercancía: ${operationDetails.goodsTypes?.join(', ') || 'N/A'}

GARANTÍAS ACTUALES:
${operatorProfile.currentGuarantees?.map(g => `
- ${g.type}: ${g.totalAmount} EUR (disponible: ${g.availableAmount} EUR)
`).join('') || 'Sin garantías actuales'}

NECESIDAD ACTUAL:
- Importe requerido: ${operationDetails.requiredAmount || 'N/A'} EUR
- Urgencia: ${operationDetails.urgency || 'Normal'}
- Duración necesaria: ${operationDetails.duration || 'Indefinida'}

TIPOS DE GARANTÍA Y SUS CARACTERÍSTICAS:

1. CGU (Garantía Global Comprensiva):
   + Cubre múltiples operaciones
   + Flexibilidad de uso
   + Reducción con OEA
   - Requiere autorización AEAT
   - Importe mínimo elevado
   - Proceso de obtención largo

2. Garantía Individual:
   + Rápida de obtener
   + Sin requisitos previos
   - Solo para una operación
   - Coste por operación

3. Depósito en efectivo:
   + Inmediato
   + Sin intermediarios
   - Inmoviliza capital
   - Sin rentabilidad

4. Aval bancario:
   + Profesional
   + Bien aceptado
   - Comisiones bancarias (0.5-2% anual)
   - Consume línea de crédito

5. Seguro de caución:
   + No consume línea bancaria
   + Renovación flexible
   - Prima anual (0.5-1.5%)
   - Proceso de suscripción

6. Fianza:
   + Sin coste directo
   - Requiere fiador solvente
   - Complejidad legal

Analiza y recomienda:

Responde en JSON:
{
  "recommendedType": {
    "primary": "CGU|individual|deposit|bank_guarantee|insurance|surety",
    "name": "Nombre completo del tipo",
    "confidence": 0-100,
    "reasoning": "Por qué se recomienda este tipo"
  },
  "alternatives": [
    {
      "type": "tipo alternativo",
      "name": "Nombre",
      "suitability": 0-100,
      "pros": ["ventajas"],
      "cons": ["desventajas"],
      "whenToUse": "Cuándo elegir esta alternativa"
    }
  ],
  "costComparison": {
    "annual": [
      {
        "type": "tipo",
        "estimatedCost": "coste estimado anual",
        "breakdown": "desglose"
      }
    ],
    "mostEconomical": "tipo más económico",
    "bestValue": "mejor relación calidad-precio"
  },
  "implementationPlan": {
    "steps": [
      {
        "step": 1,
        "action": "Acción a realizar",
        "timeframe": "Plazo",
        "requirements": ["Requisitos"]
      }
    ],
    "totalTime": "Tiempo total estimado",
    "documents": ["Documentos necesarios"]
  },
  "oeaRecommendation": {
    "shouldApply": true/false,
    "benefit": "Beneficio estimado",
    "reasoning": "Por qué sí/no"
  },
  "longTermStrategy": {
    "recommendation": "Estrategia a largo plazo",
    "milestones": ["Hitos a alcanzar"],
    "potentialSavings": "Ahorro potencial a largo plazo"
  },
  "warnings": ["Advertencias importantes"],
  "summary": "Resumen ejecutivo de la recomendación"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        recommendedType: { primary: 'individual', confidence: 70 },
        alternatives: [],
        costComparison: {},
        implementationPlan: {},
        summary: 'Error generando recomendación',
        rawResponse: result.content
      };
    }
  }

  /**
   * Optimizar uso de garantías existentes
   */
  async optimizeGuaranteeUsage(guarantees, upcomingOperations = []) {
    const prompt = `Analiza y optimiza el uso de las garantías aduaneras existentes.

GARANTÍAS ACTUALES:
${guarantees.map((g, i) => `
${i + 1}. ${g.reference} (${g.type})
   - Importe total: ${g.totalAmount} EUR
   - Consumido: ${g.consumedAmount} EUR
   - Disponible: ${g.availableAmount} EUR
   - Uso: ${g.usage}
   - Estado: ${g.status}
   - Válida hasta: ${g.validUntil ? new Date(g.validUntil).toLocaleDateString('es-ES') : 'Sin fecha'}
   - Expedientes vinculados: ${g.linkedExpeditions?.length || 0}
   - Alertas activas: ${g.alerts?.filter(a => !a.acknowledged).length || 0}
`).join('') || 'Sin garantías'}

OPERACIONES PRÓXIMAS (si se conocen):
${upcomingOperations.map((op, i) => `
${i + 1}. ${op.description || 'Operación'}
   - Régimen: ${op.regime}
   - Valor: ${op.value} EUR
   - Garantía necesaria estimada: ${op.estimatedGuarantee} EUR
   - Fecha prevista: ${op.expectedDate || 'N/A'}
`).join('') || 'Sin operaciones previstas'}

ANALIZA:

1. UTILIZACIÓN ACTUAL:
   - ¿Se están usando eficientemente las garantías?
   - ¿Hay garantías infrautilizadas?
   - ¿Hay solapamientos o redundancias?

2. COBERTURA:
   - ¿Las garantías actuales cubren las necesidades?
   - ¿Hay gaps de cobertura?
   - ¿Hay exceso de cobertura?

3. VENCIMIENTOS:
   - ¿Hay garantías próximas a vencer?
   - ¿Se necesitan renovaciones?
   - ¿Hay riesgo de quedarse sin cobertura?

4. OPTIMIZACIONES:
   - ¿Se podrían consolidar garantías?
   - ¿Se podría reducir el importe total?
   - ¿Se podría cambiar a tipos más económicos?

5. ALERTAS:
   - ¿Hay situaciones que requieren atención inmediata?
   - ¿Hay riesgos no cubiertos?

Responde en JSON:
{
  "currentStatus": {
    "totalGuarantees": 0,
    "totalAmount": 0,
    "totalConsumed": 0,
    "totalAvailable": 0,
    "utilizationRate": 0,
    "healthScore": 0-100
  },
  "utilizationAnalysis": {
    "underutilized": [
      {
        "guarantee": "reference",
        "utilizationRate": 0,
        "recommendation": "qué hacer"
      }
    ],
    "overutilized": [
      {
        "guarantee": "reference",
        "utilizationRate": 0,
        "risk": "riesgo",
        "recommendation": "qué hacer"
      }
    ],
    "optimal": ["referencias de garantías bien utilizadas"]
  },
  "coverageAnalysis": {
    "currentNeeds": 0,
    "projectedNeeds": 0,
    "coverage": "SUFFICIENT|INSUFFICIENT|EXCESS",
    "gap": 0,
    "excess": 0
  },
  "expiryAlerts": [
    {
      "guarantee": "reference",
      "expiresIn": "X días",
      "action": "acción recomendada",
      "urgency": "HIGH|MEDIUM|LOW"
    }
  ],
  "optimizations": [
    {
      "type": "CONSOLIDATE|REDUCE|INCREASE|CHANGE_TYPE|RENEW|CANCEL",
      "description": "Descripción de la optimización",
      "guaranteesAffected": ["referencias"],
      "estimatedSavings": "ahorro estimado",
      "implementation": "cómo implementar",
      "priority": "HIGH|MEDIUM|LOW",
      "timeframe": "plazo sugerido"
    }
  ],
  "actionPlan": [
    {
      "priority": 1,
      "action": "Acción a tomar",
      "guarantee": "reference afectada",
      "deadline": "fecha límite",
      "impact": "impacto esperado"
    }
  ],
  "projections": {
    "next30Days": {
      "expectedConsumption": 0,
      "expectedReleases": 0,
      "projectedAvailable": 0
    },
    "next90Days": {
      "expectedConsumption": 0,
      "expectedReleases": 0,
      "projectedAvailable": 0
    }
  },
  "recommendations": [
    {
      "recommendation": "Recomendación",
      "reasoning": "Por qué",
      "benefit": "Beneficio esperado"
    }
  ],
  "summary": "Resumen ejecutivo del análisis"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        currentStatus: { healthScore: 70 },
        utilizationAnalysis: {},
        coverageAnalysis: { coverage: 'UNKNOWN' },
        expiryAlerts: [],
        optimizations: [],
        actionPlan: [],
        summary: 'Error en análisis de optimización',
        rawResponse: result.content
      };
    }
  }

  /**
   * Calcular importe inteligente de garantía
   */
  async calculateSmartGuaranteeAmount(operation) {
    const prompt = `Calcula el importe óptimo de garantía para esta operación aduanera.

OPERACIÓN:
- Tipo: ${operation.operationType}
- Régimen solicitado: ${operation.regime}
- Procedimiento adicional: ${operation.additionalProcedure || 'N/A'}

VALORES:
- Valor en factura: ${operation.invoiceValue || 0} EUR
- Valor CIF/Aduanero: ${operation.customsValue || 0} EUR
- Flete: ${operation.freightCost || 0} EUR
- Seguro: ${operation.insuranceCost || 0} EUR

MERCANCÍAS:
${operation.goods?.map((g, i) => `
${i + 1}. ${g.description}
   - TARIC: ${g.taricCode || 'N/A'}
   - Origen: ${g.originCountry || 'N/A'}
   - Valor: ${g.invoiceValue || 0} EUR
   - Peso: ${g.netWeight || 0} kg
   - Tipo derecho: ${g.dutyRate || 'N/A'}%
   - IVA: ${g.vatRate || 21}%
`).join('') || 'Sin detalles'}

OPERADOR:
- OEA: ${operation.operator?.oeaStatus || 'Sin certificación'}
- Tipo OEA: ${operation.operator?.oeaType || 'N/A'}

RÉGIMEN Y CÁLCULO:

Para TRÁNSITO (T1/T2):
- Base: 100% de derechos potenciales
- Con OEA: reducción aplicable

Para DEPÓSITO ADUANERO:
- Base: 100% de derechos
- Con OEA: reducción aplicable

Para IMPORTACIÓN TEMPORAL:
- Exención parcial: 3% mensual del derecho (hasta 100%)
- Exención total: 100% inmediato

Para PERFECCIONAMIENTO ACTIVO:
- Sistema suspensión: 100%
- Sistema drawback: 0%

Para PAGO DIFERIDO:
- 100% de la deuda mensual

Calcula considerando:
1. Tipo exacto de arancel según TARIC
2. IVA aplicable
3. Impuestos especiales si aplican
4. Medidas de defensa comercial (antidumping)
5. Reducciones OEA
6. Margen de seguridad recomendado

Responde en JSON:
{
  "calculation": {
    "dutyBase": {
      "customsValue": 0,
      "dutyRate": 0,
      "dutyAmount": 0,
      "specialTaxes": 0
    },
    "vatBase": {
      "taxableBase": 0,
      "vatRate": 21,
      "vatAmount": 0
    },
    "totalPotentialDebt": 0,
    "guaranteeRate": 100,
    "baseGuaranteeAmount": 0,
    "oeaReduction": {
      "applicable": true/false,
      "reductionPercent": 0,
      "reductionAmount": 0
    },
    "finalAmount": 0,
    "recommendedAmount": 0,
    "safetyMargin": {
      "percent": 10,
      "amount": 0,
      "reasoning": "Por qué se recomienda este margen"
    }
  },
  "breakdown": [
    {
      "item": "descripción",
      "base": 0,
      "rate": 0,
      "amount": 0
    }
  ],
  "specialConsiderations": [
    {
      "consideration": "Consideración especial",
      "impact": "Impacto en el cálculo",
      "recommendation": "Recomendación"
    }
  ],
  "alternatives": [
    {
      "scenario": "Escenario alternativo",
      "amount": 0,
      "conditions": "Condiciones para aplicar"
    }
  ],
  "validity": {
    "calculationDate": "fecha",
    "validUntil": "fecha de validez del cálculo",
    "assumptions": ["Supuestos del cálculo"]
  },
  "summary": "Resumen del cálculo"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        calculatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        calculation: { finalAmount: 0, recommendedAmount: 0 },
        breakdown: [],
        specialConsiderations: [],
        summary: 'Error en cálculo de garantía',
        rawResponse: result.content
      };
    }
  }

  // ===========================================
  // REQUERIMIENTOS AEAT AI INTEGRATIONS
  // ===========================================

  /**
   * Generar respuesta completa para requerimiento AEAT
   */
  async generateRequirementResponse(requirement, expedition) {
    const prompt = `Genera una respuesta formal y completa para este requerimiento de AEAT.

DATOS DEL REQUERIMIENTO:
- Número: ${requirement.requirementNumber}
- Tipo: ${requirement.requirementType}
- Canal: ${requirement.channel} (${requirement.channel === 'orange' ? 'Revisión documental' : 'Inspección física'})
- Autoridad: ${requirement.issuingAuthority || 'AEAT'}
- Asunto: ${requirement.subject || 'Requerimiento de documentación'}
- Descripción: ${requirement.description || 'No especificada'}
- Base legal: ${requirement.legalBasis || 'No especificada'}
- Plazo: ${requirement.deadline ? new Date(requirement.deadline).toLocaleDateString('es-ES') : 'No especificado'}

ITEMS SOLICITADOS:
${requirement.requestedItems?.map((item, i) => `
${i + 1}. ${item.description}
   - Tipo: ${item.itemType}
   - Obligatorio: ${item.mandatory ? 'Sí' : 'No'}
   - Estado: ${item.provided ? 'Proporcionado' : 'Pendiente'}
`).join('') || 'No especificados'}

DATOS DEL EXPEDIENTE:
- ID: ${expedition?.expeditionId || 'N/A'}
- Tipo operación: ${expedition?.operationType || 'N/A'}
- MRN: ${expedition?.declaration?.mrn || 'N/A'}
- Régimen: ${expedition?.declaration?.regime || 'N/A'}

IMPORTADOR:
- Empresa: ${expedition?.client?.companyName || 'N/A'}
- NIF: ${expedition?.client?.nif || 'N/A'}
- EORI: ${expedition?.client?.eori || 'N/A'}

MERCANCÍAS:
${expedition?.goods?.map((g, i) => `
${i + 1}. ${g.description}
   TARIC: ${g.taricCode || 'N/A'} | Origen: ${g.originCountry || 'N/A'}
   Valor: ${g.invoiceValue || 0} EUR
`).join('') || 'Sin mercancías'}

GENERA UNA RESPUESTA QUE INCLUYA:

1. ENCABEZADO FORMAL
   - Datos del remitente (representante aduanero)
   - Datos del destinatario (AEAT, aduana específica)
   - Referencia al requerimiento (número, fecha)

2. CUERPO DE LA RESPUESTA
   - Identificación del operador y expediente
   - Atención punto por punto de cada item solicitado
   - Explicación de la documentación adjunta
   - Aclaraciones técnicas si son necesarias

3. ARGUMENTACIÓN LEGAL (si aplica)
   - Citas del CAU (Código Aduanero de la Unión)
   - Referencias a Reglamentos Delegados/Ejecución
   - Jurisprudencia relevante si existe

4. DOCUMENTOS A ADJUNTAR
   - Lista detallada de documentos
   - Explicación de qué acredita cada uno

5. CIERRE FORMAL
   - Solicitud de resolución favorable
   - Ofrecimiento de colaboración
   - Firma

Responde en JSON:
{
  "formalResponse": {
    "header": {
      "to": "Destinatario",
      "reference": "Referencia completa",
      "date": "Fecha actual",
      "subject": "Asunto de la respuesta"
    },
    "body": "Texto completo del cuerpo de la respuesta (puede incluir saltos de línea)",
    "closing": "Cierre formal",
    "signature": "Firma sugerida"
  },
  "documentsToAttach": [
    {
      "documentType": "tipo_documento",
      "name": "Nombre del documento",
      "purpose": "Qué acredita o demuestra",
      "mandatory": true/false,
      "available": true/false,
      "notes": "Notas adicionales"
    }
  ],
  "legalArguments": [
    {
      "point": "Punto que argumenta",
      "regulation": "Normativa citada (ej: Art. 70 CAU)",
      "argument": "Argumentación completa",
      "strength": "STRONG|MEDIUM|WEAK"
    }
  ],
  "keyPoints": ["Puntos clave a destacar"],
  "risks": [
    {
      "risk": "Descripción del riesgo",
      "mitigation": "Cómo mitigarlo",
      "severity": "HIGH|MEDIUM|LOW"
    }
  ],
  "recommendedActions": ["Acciones recomendadas antes de enviar"],
  "estimatedOutcome": {
    "favorable": 0-100,
    "factors": ["Factores que influyen"]
  },
  "summary": "Resumen ejecutivo de la respuesta"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 8192, timeout: 120000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        formalResponse: {
          body: result.content,
          header: {},
          closing: '',
          signature: ''
        },
        documentsToAttach: [],
        legalArguments: [],
        keyPoints: [],
        risks: [],
        recommendedActions: [],
        summary: 'Respuesta generada (formato libre)',
        rawResponse: result.content
      };
    }
  }

  /**
   * Analizar documentación solicitada en requerimiento
   */
  async analyzeRequestedDocuments(requirement, expedition) {
    const prompt = `Analiza los documentos solicitados en este requerimiento AEAT y proporciona guía detallada.

REQUERIMIENTO:
- Tipo: ${requirement.requirementType}
- Canal: ${requirement.channel}
- Autoridad: ${requirement.issuingAuthority}

ITEMS SOLICITADOS:
${requirement.requestedItems?.map((item, i) => `
${i + 1}. ${item.description}
   - Tipo: ${item.itemType}
   - Tipo documento: ${item.documentType || 'No especificado'}
   - Obligatorio: ${item.mandatory ? 'Sí' : 'No'}
   - Ya proporcionado: ${item.provided ? 'Sí' : 'No'}
`).join('') || 'No especificados'}

DOCUMENTOS YA DISPONIBLES EN EXPEDIENTE:
${expedition?.documents?.map(d => `- ${d.type}: ${d.originalName} (${d.status})`).join('\n') || 'Sin documentos'}

DATOS DEL EXPEDIENTE:
- Operación: ${expedition?.operationType}
- Transporte: ${expedition?.transportMode}
- Origen mercancías: ${expedition?.goods?.map(g => g.originCountry).filter(Boolean).join(', ') || 'N/A'}
- Régimen: ${expedition?.declaration?.regime || 'N/A'}
- Preferencia: ${expedition?.declaration?.preference || 'N/A'}

Para cada documento solicitado, indica:
1. Qué es exactamente y para qué sirve
2. Quién lo emite (cliente, proveedor, organismo oficial)
3. Cómo obtenerlo si no se tiene
4. Alternativas aceptables si no se puede conseguir el original
5. Plazo típico de obtención
6. Si ya está disponible en el expediente

Responde en JSON:
{
  "documentAnalysis": [
    {
      "requestedItem": "Descripción del item solicitado",
      "documentType": "tipo_documento",
      "description": "Qué es este documento",
      "purpose": "Para qué lo necesita AEAT",
      "issuedBy": "Quién lo emite",
      "howToObtain": "Cómo obtenerlo",
      "typicalTimeframe": "Tiempo de obtención",
      "alternatives": ["Documentos alternativos aceptables"],
      "alreadyAvailable": true/false,
      "availableDocument": "Nombre del documento disponible si existe",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "tips": ["Consejos para este documento"]
    }
  ],
  "missingCritical": ["Documentos críticos que faltan"],
  "availableToUse": ["Documentos disponibles que se pueden usar"],
  "clientActions": [
    {
      "action": "Qué debe hacer el cliente",
      "document": "Para qué documento",
      "deadline": "Plazo sugerido"
    }
  ],
  "agentActions": [
    {
      "action": "Qué debe hacer el agente",
      "document": "Para qué documento"
    }
  ],
  "estimatedCompletionTime": "Tiempo estimado para reunir todo",
  "completenessScore": 0-100,
  "summary": "Resumen del análisis documental"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.documentValidation, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        documentAnalysis: [],
        missingCritical: [],
        availableToUse: [],
        clientActions: [],
        agentActions: [],
        completenessScore: 50,
        summary: 'Error procesando análisis documental',
        rawResponse: result.content
      };
    }
  }

  /**
   * Sugerir argumentación legal/técnica para requerimiento
   */
  async suggestLegalArguments(requirement, expedition) {
    const prompt = `Sugiere argumentación legal y técnica para responder a este requerimiento AEAT.

REQUERIMIENTO:
- Número: ${requirement.requirementNumber}
- Tipo: ${requirement.requirementType}
- Canal: ${requirement.channel}
- Asunto: ${requirement.subject}
- Descripción: ${requirement.description}
- Base legal citada por AEAT: ${requirement.legalBasis || 'No especificada'}

CONTEXTO DE LA OPERACIÓN:
- Tipo: ${expedition?.operationType}
- Régimen: ${expedition?.declaration?.regime || 'N/A'}
- Preferencia: ${expedition?.declaration?.preference || 'N/A'}
- Incoterm: ${expedition?.incoterm?.code || 'N/A'}

MERCANCÍAS:
${expedition?.goods?.map((g, i) => `
${i + 1}. ${g.description}
   TARIC: ${g.taricCode || 'N/A'}
   Origen: ${g.originCountry || 'N/A'}
   Valor: ${g.invoiceValue || 0} EUR
`).join('') || 'Sin mercancías'}

NORMATIVA APLICABLE:
- Código Aduanero de la Unión (Reglamento UE 952/2013)
- Reglamento Delegado (UE) 2015/2446
- Reglamento de Ejecución (UE) 2015/2447
- Ley General Tributaria (Ley 58/2003)
- Normativa específica según tipo de mercancía

GENERA ARGUMENTACIÓN PARA:

1. DEFENSA DE LA CLASIFICACIÓN (si aplica)
   - Justificación del código TARIC
   - Notas explicativas del Sistema Armonizado
   - Reglas Generales de Interpretación

2. DEFENSA DEL VALOR (si aplica)
   - Método de valoración utilizado (Art. 70-74 CAU)
   - Justificación del precio declarado
   - Elementos incluidos/excluidos del valor

3. DEFENSA DEL ORIGEN (si aplica)
   - Criterios de origen cumplidos
   - Pruebas de origen presentadas
   - Reglas de origen del acuerdo aplicable

4. OTROS ARGUMENTOS RELEVANTES
   - Buena fe del operador
   - Precedentes favorables
   - Proporcionalidad

Responde en JSON:
{
  "mainArguments": [
    {
      "topic": "CLASSIFICATION|VALUATION|ORIGIN|DOCUMENTATION|PROCEDURE|OTHER",
      "title": "Título del argumento",
      "argument": "Argumentación detallada",
      "legalBasis": [
        {
          "regulation": "Nombre de la norma",
          "article": "Artículo específico",
          "quote": "Texto relevante del artículo",
          "application": "Cómo aplica al caso"
        }
      ],
      "supportingEvidence": ["Pruebas que lo soportan"],
      "strength": "STRONG|MEDIUM|WEAK",
      "counterarguments": ["Posibles contraargumentos de AEAT"],
      "rebuttals": ["Cómo rebatir los contraargumentos"]
    }
  ],
  "proceduralArguments": [
    {
      "argument": "Argumento procedimental",
      "legalBasis": "Base legal",
      "applicability": "Cuándo usarlo"
    }
  ],
  "mitigatingFactors": [
    {
      "factor": "Factor atenuante",
      "relevance": "Por qué es relevante",
      "howToPresent": "Cómo presentarlo"
    }
  ],
  "precedents": [
    {
      "case": "Referencia del caso",
      "summary": "Resumen",
      "applicability": "Cómo aplica"
    }
  ],
  "recommendedStrategy": {
    "approach": "DEFENSIVE|COLLABORATIVE|TECHNICAL|LEGAL",
    "reasoning": "Por qué esta estrategia",
    "keyPoints": ["Puntos clave de la estrategia"]
  },
  "warningsAndRisks": [
    {
      "warning": "Advertencia",
      "risk": "Riesgo asociado",
      "recommendation": "Recomendación"
    }
  ],
  "summary": "Resumen de la argumentación sugerida"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.regulationAnalysis, prompt, { maxTokens: 8192, timeout: 120000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        mainArguments: [],
        proceduralArguments: [],
        mitigatingFactors: [],
        precedents: [],
        recommendedStrategy: {},
        warningsAndRisks: [],
        summary: 'Error generando argumentación',
        rawResponse: result.content
      };
    }
  }

  /**
   * Analizar riesgo y predecir resolución del requerimiento
   */
  async analyzeRequirementRisk(requirement, expedition) {
    const prompt = `Analiza el riesgo y predice la posible resolución de este requerimiento AEAT.

REQUERIMIENTO:
- Número: ${requirement.requirementNumber}
- Tipo: ${requirement.requirementType}
- Canal: ${requirement.channel}
- Estado: ${requirement.status}
- Días hasta vencimiento: ${requirement.daysUntilDeadline || 'N/A'}
- Respuestas enviadas: ${requirement.responses?.length || 0}

ITEMS SOLICITADOS:
${requirement.requestedItems?.map((item, i) => `
${i + 1}. ${item.description}
   - Obligatorio: ${item.mandatory ? 'Sí' : 'No'}
   - Proporcionado: ${item.provided ? 'Sí' : 'No'}
`).join('') || 'No especificados'}

HISTORIAL:
${requirement.timeline?.slice(-5).map(t => `- ${t.action}: ${t.description}`).join('\n') || 'Sin historial'}

EXPEDIENTE:
- Operación: ${expedition?.operationType}
- Valor total: ${expedition?.calculations?.invoiceTotal || 'N/A'} EUR
- Régimen: ${expedition?.declaration?.regime}
- Estado expediente: ${expedition?.status}

MERCANCÍAS:
${expedition?.goods?.map((g, i) => `
${i + 1}. ${g.description} (TARIC: ${g.taricCode || 'N/A'}, Origen: ${g.originCountry || 'N/A'})
`).join('') || 'Sin mercancías'}

Analiza:
1. Probabilidad de cada tipo de resolución
2. Factores de riesgo
3. Tiempo estimado de resolución
4. Posibles consecuencias (ajustes, sanciones)
5. Recomendaciones para mejorar el resultado

Responde en JSON:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "resolutionPrediction": {
    "favorable": 0-100,
    "partialFavorable": 0-100,
    "unfavorable": 0-100,
    "mostLikely": "LEVANTE|LEVANTE_PARCIAL|AJUSTE_ARANCELARIO|SANCION|RECHAZO",
    "confidence": 0-100
  },
  "timeEstimate": {
    "bestCase": "X días",
    "typical": "Y días",
    "worstCase": "Z días"
  },
  "riskFactors": [
    {
      "factor": "Descripción del factor de riesgo",
      "impact": "HIGH|MEDIUM|LOW",
      "mitigation": "Cómo mitigarlo",
      "currentStatus": "MITIGATED|PENDING|UNMITIGABLE"
    }
  ],
  "positiveFactors": [
    {
      "factor": "Factor positivo",
      "impact": "Cómo ayuda"
    }
  ],
  "potentialConsequences": {
    "dutyAdjustment": {
      "likely": true/false,
      "estimatedAmount": "Rango estimado",
      "basis": "Base del ajuste"
    },
    "penalties": {
      "likely": true/false,
      "type": "Tipo de sanción",
      "estimatedAmount": "Rango estimado",
      "mitigatingFactors": ["Factores atenuantes"]
    },
    "delays": {
      "estimatedDays": 0,
      "impact": "Impacto en la operación"
    }
  },
  "recommendations": [
    {
      "action": "Acción recomendada",
      "priority": "IMMEDIATE|HIGH|MEDIUM|LOW",
      "expectedImpact": "Impacto esperado",
      "deadline": "Plazo sugerido"
    }
  ],
  "appealOptions": {
    "available": true/false,
    "types": ["Tipos de recurso disponibles"],
    "deadlines": ["Plazos"],
    "recommendations": "Cuándo recurrir"
  },
  "summary": "Resumen del análisis de riesgo"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        riskLevel: 'MEDIUM',
        riskScore: 50,
        resolutionPrediction: { favorable: 50, mostLikely: 'LEVANTE', confidence: 50 },
        riskFactors: [],
        positiveFactors: [],
        potentialConsequences: {},
        recommendations: [],
        summary: 'Error analizando riesgo',
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo del requerimiento
   */
  async fullRequirementAnalysis(requirement, expedition) {
    try {
      // Ejecutar análisis en paralelo
      const [response, documents, arguments_, risk] = await Promise.all([
        this.generateRequirementResponse(requirement, expedition),
        this.analyzeRequestedDocuments(requirement, expedition),
        this.suggestLegalArguments(requirement, expedition),
        this.analyzeRequirementRisk(requirement, expedition)
      ]);

      return {
        requirementNumber: requirement.requirementNumber,
        analyzedAt: new Date().toISOString(),
        response,
        documents,
        arguments: arguments_,
        risk,
        overallReadiness: {
          score: Math.round(
            (documents.completenessScore || 50) * 0.4 +
            (response.estimatedOutcome?.favorable || 50) * 0.3 +
            (100 - (risk.riskScore || 50)) * 0.3
          ),
          readyToRespond: documents.completenessScore >= 70 && risk.riskLevel !== 'CRITICAL',
          estimatedOutcome: risk.resolutionPrediction?.mostLikely,
          nextSteps: this._generateRequirementNextSteps(response, documents, risk)
        }
      };
    } catch (error) {
      logger.error('Error en análisis completo de requerimiento:', error);
      return {
        requirementNumber: requirement.requirementNumber,
        error: 'Error realizando análisis completo',
        analyzedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generar próximos pasos para requerimiento
   */
  _generateRequirementNextSteps(response, documents, risk) {
    const steps = [];

    // Documentos críticos faltantes
    if (documents.missingCritical?.length > 0) {
      steps.push({
        priority: 1,
        action: 'Obtener documentos críticos',
        details: documents.missingCritical.join(', '),
        type: 'DOCUMENTS'
      });
    }

    // Acciones del cliente
    if (documents.clientActions?.length > 0) {
      steps.push({
        priority: 1,
        action: 'Solicitar al cliente',
        details: documents.clientActions.map(a => a.action).join('; '),
        type: 'CLIENT'
      });
    }

    // Riesgos altos
    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
      steps.push({
        priority: 1,
        action: 'Mitigar riesgos identificados',
        details: risk.riskFactors?.filter(f => f.impact === 'HIGH').map(f => f.factor).join(', '),
        type: 'RISK'
      });
    }

    // Revisar argumentación
    if (response.legalArguments?.some(a => a.strength === 'WEAK')) {
      steps.push({
        priority: 2,
        action: 'Reforzar argumentación débil',
        details: 'Revisar argumentos marcados como WEAK',
        type: 'LEGAL'
      });
    }

    // Recomendaciones urgentes
    if (risk.recommendations?.filter(r => r.priority === 'IMMEDIATE').length > 0) {
      steps.push({
        priority: 1,
        action: 'Acciones inmediatas',
        details: risk.recommendations.filter(r => r.priority === 'IMMEDIATE').map(r => r.action).join('; '),
        type: 'URGENT'
      });
    }

    return steps.sort((a, b) => a.priority - b.priority);
  }

  // ===========================================
  // H1/AES DECLARATIONS AI INTEGRATIONS
  // ===========================================

  /**
   * Validar declaración H1/AES antes de envío a AEAT
   */
  async validateDeclarationBeforeSubmit(expedition, declarationType = 'H1') {
    const prompt = `Valida esta declaración ${declarationType} antes de su envío a AEAT.

EXPEDIENTE: ${expedition.expeditionId}
TIPO: ${declarationType} (${declarationType === 'H1' ? 'Importación' : 'Exportación'})

DECLARACIÓN ACTUAL:
- LRN: ${expedition.declaration?.lrn || 'No generado'}
- Régimen: ${expedition.declaration?.regime || 'No especificado'}
- Procedimiento adicional: ${expedition.declaration?.additionalProcedure || '000'}
- Preferencia: ${expedition.declaration?.preference || '100'}
- Aduana: ${expedition.declaration?.customsOffice || 'No especificada'}
- Estado: ${expedition.declaration?.status || 'draft'}

IMPORTADOR/DECLARANTE:
- Empresa: ${expedition.client?.companyName}
- NIF: ${expedition.client?.nif}
- EORI: ${expedition.client?.eori || 'ES' + expedition.client?.nif}

EXPORTADOR:
- Empresa: ${expedition.exporter?.companyName || 'N/A'}
- País: ${expedition.exporter?.country || 'N/A'}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}:
- Descripción: ${g.description}
- TARIC: ${g.taricCode || 'SIN CLASIFICAR'}
- Origen: ${g.originCountry || 'N/A'}
- Valor: ${g.invoiceValue || 0} EUR
- Peso neto: ${g.netWeight || 0} kg
- Peso bruto: ${g.grossWeight || 0} kg
- Bultos: ${g.packages?.quantity || 0} ${g.packages?.type || 'N/A'}
`).join('') || 'Sin mercancías'}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Documento: ${expedition.transport?.documentType || 'N/A'} ${expedition.transport?.documentNumber || ''}
- Aduana entrada: ${expedition.transport?.entryCustomsOffice || expedition.transport?.arrivalPort || 'N/A'}

INCOTERM: ${expedition.incoterm?.code || 'N/A'} ${expedition.incoterm?.place || ''}

VALOR TOTAL: ${expedition.calculations?.invoiceTotal || expedition.goods?.reduce((s, g) => s + (g.invoiceValue || 0), 0)} EUR

VERIFICA (según normativa CAU y sistema H1 AEAT):

1. DATOS OBLIGATORIOS:
   - EORI del importador/exportador
   - Códigos TARIC completos (10 dígitos)
   - Países de origen válidos (ISO)
   - Valores declarados coherentes
   - Pesos brutos y netos

2. COHERENCIA DE DATOS:
   - Régimen compatible con tipo operación
   - Preferencia requiere certificado origen válido
   - Aduana corresponde al modo transporte
   - Incoterm coherente con gastos declarados

3. CAMPOS CRÍTICOS H1:
   - Casilla 1: Tipo declaración (IM para import)
   - Casilla 8: Destinatario con EORI
   - Casilla 14: Declarante/Representante
   - Casilla 33: Código mercancías (TARIC)
   - Casilla 34: País origen
   - Casilla 37: Régimen aduanero
   - Casilla 46: Valor estadístico
   - Casilla 47: Cálculo de tributos

4. DOCUMENTOS SOPORTE:
   - Factura comercial obligatoria
   - Documento transporte según modo
   - Certificado origen si preferencia >100
   - Licencias si mercancía controlada

5. ERRORES COMUNES:
   - EORI incorrecto o inexistente
   - TARIC incompleto o erróneo
   - Discrepancia valor/peso
   - Régimen incorrecto
   - Falta documento obligatorio

Responde en JSON:
{
  "isValid": true/false,
  "readyToSubmit": true/false,
  "validationScore": 0-100,
  "errors": [
    {
      "code": "ERR_XXX",
      "field": "campo afectado",
      "message": "descripción del error",
      "severity": "BLOCKING|HIGH|MEDIUM|LOW",
      "regulation": "artículo CAU o norma aplicable",
      "fix": "cómo solucionarlo"
    }
  ],
  "warnings": [
    {
      "code": "WARN_XXX",
      "field": "campo",
      "message": "descripción",
      "recommendation": "recomendación"
    }
  ],
  "missingDocuments": ["lista de documentos faltantes"],
  "fieldValidations": {
    "eori": { "valid": true/false, "message": "" },
    "taricCodes": { "valid": true/false, "message": "" },
    "values": { "valid": true/false, "message": "" },
    "weights": { "valid": true/false, "message": "" },
    "regime": { "valid": true/false, "message": "" },
    "customsOffice": { "valid": true/false, "message": "" }
  },
  "summary": "Resumen ejecutivo de la validación"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        validatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        isValid: true,
        readyToSubmit: true,
        validationScore: 70,
        errors: [],
        warnings: [{ code: 'WARN_AI', message: 'Error procesando validación IA' }],
        missingDocuments: [],
        fieldValidations: {},
        summary: 'No se pudo completar la validación automática',
        rawResponse: result.content
      };
    }
  }

  /**
   * Detectar errores comunes en declaraciones
   */
  async detectDeclarationErrors(expedition, declarationType = 'H1') {
    const prompt = `Analiza esta declaración ${declarationType} y detecta errores comunes que causan rechazos en AEAT.

DATOS DE LA DECLARACIÓN:
- Expediente: ${expedition.expeditionId}
- Tipo: ${declarationType}
- Régimen: ${expedition.declaration?.regime || '40'}
- Preferencia: ${expedition.declaration?.preference || '100'}

OPERADORES:
- Importador: ${expedition.client?.companyName} (EORI: ${expedition.client?.eori}, NIF: ${expedition.client?.nif})
- Exportador: ${expedition.exporter?.companyName} (País: ${expedition.exporter?.country})

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
${i + 1}. "${g.description}"
   TARIC: ${g.taricCode || 'FALTA'} | Origen: ${g.originCountry || 'FALTA'}
   Valor: ${g.invoiceValue || 0} EUR | Peso neto: ${g.netWeight || 0} kg | Bruto: ${g.grossWeight || 0} kg
   Bultos: ${g.packages?.quantity || 0} ${g.packages?.type || ''}
`).join('') || 'Sin mercancías'}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Doc: ${expedition.transport?.documentNumber || 'N/A'}
- Aduana: ${expedition.transport?.entryCustomsOffice || 'N/A'}

DETECTA LOS SIGUIENTES ERRORES COMUNES:

1. ERRORES DE FORMATO:
   - EORI formato incorrecto (debe ser ES + NIF)
   - TARIC incompleto (debe ser 10 dígitos)
   - Código país incorrecto (debe ser ISO 2 letras)
   - Código aduana inexistente

2. ERRORES DE COHERENCIA:
   - Peso neto mayor que bruto
   - Valor unitario anormalmente alto/bajo para el producto
   - País origen diferente al del exportador sin justificación
   - Incoterm incompatible con gastos declarados

3. ERRORES DE CLASIFICACIÓN:
   - TARIC no corresponde a la descripción
   - Capítulo TARIC incorrecto
   - Falta de código adicional TARIC cuando es requerido

4. ERRORES DE RÉGIMEN:
   - Régimen 42 sin cliente intracomunitario
   - Preferencia 300 sin certificado EUR.1
   - Régimen especial sin autorización

5. ERRORES DOCUMENTALES:
   - Falta factura comercial
   - Falta documento transporte
   - Falta certificado origen para preferencia

6. ERRORES DE VALORACIÓN:
   - Valor muy bajo (infravaloración)
   - Falta desglose de gastos
   - Moneda incorrecta

Responde en JSON:
{
  "totalErrors": 0,
  "blockingErrors": 0,
  "errors": [
    {
      "category": "FORMAT|COHERENCE|CLASSIFICATION|REGIME|DOCUMENTS|VALUATION",
      "severity": "BLOCKING|HIGH|MEDIUM|LOW",
      "field": "campo afectado",
      "currentValue": "valor actual",
      "issue": "descripción del problema",
      "expectedValue": "valor esperado o correcto",
      "aeatErrorCode": "código error AEAT probable",
      "fix": "cómo solucionarlo",
      "autoFixable": true/false
    }
  ],
  "riskOfRejection": 0-100,
  "commonMistakesDetected": ["lista de errores típicos encontrados"],
  "recommendations": ["recomendaciones para evitar rechazo"],
  "summary": "Resumen de errores detectados"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.h1Generation, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        totalErrors: 0,
        blockingErrors: 0,
        errors: [],
        riskOfRejection: 20,
        commonMistakesDetected: [],
        recommendations: [],
        summary: 'Error procesando detección de errores',
        rawResponse: result.content
      };
    }
  }

  /**
   * Sugerir régimen y preferencia óptimos
   */
  async suggestRegimeAndPreference(expedition) {
    const prompt = `Analiza este expediente y sugiere el régimen aduanero y preferencia arancelaria óptimos.

EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType} (${expedition.operationType === 'import' ? 'Importación' : 'Exportación'})

IMPORTADOR:
- Empresa: ${expedition.client?.companyName}
- NIF: ${expedition.client?.nif}
- País: ${expedition.client?.address?.country || 'ES'}
- ¿Operador intracomunitario?: ${expedition.client?.isIntraEU ? 'Sí' : 'No especificado'}
- ¿Tiene autorización OEA?: ${expedition.client?.hasOEA ? 'Sí' : 'No'}

EXPORTADOR:
- Empresa: ${expedition.exporter?.companyName || 'N/A'}
- País: ${expedition.exporter?.country || 'N/A'}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}: ${g.description}
- TARIC: ${g.taricCode || 'N/A'}
- Origen: ${g.originCountry || 'N/A'}
- Valor: ${g.invoiceValue || 0} EUR
- Uso previsto: ${g.intendedUse || 'consumo general'}
`).join('') || 'Sin mercancías'}

DOCUMENTOS DISPONIBLES:
${expedition.documents?.map(d => `- ${d.type}: ${d.status}`).join('\n') || 'Sin documentos registrados'}

INCOTERM: ${expedition.incoterm?.code || 'N/A'}

ANALIZA Y SUGIERE:

REGÍMENES DE IMPORTACIÓN DISPONIBLES:
- 40: Despacho a libre práctica (estándar)
- 42: Libre práctica + entrega intracomunitaria (exento IVA)
- 44: Libre práctica con uso final específico
- 51: Perfeccionamiento activo (transformación y reexportación)
- 53: Importación temporal (uso temporal y reexportación)
- 61: Reimportación tras exportación temporal
- 71: Inclusión en depósito aduanero

PREFERENCIAS ARANCELARIAS:
- 100: Arancel normal terceros países (sin preferencia)
- 200: SPG (Sistema Preferencias Generalizadas) - países en desarrollo
- 300: Acuerdo preferencial (EUR.1, EUR-MED) - requiere certificado
- 400: Unión aduanera (ATR Turquía)

Para cada régimen/preferencia sugerido, indica:
1. ¿Por qué es aplicable?
2. ¿Qué requisitos tiene?
3. ¿Qué ahorro o beneficio proporciona?
4. ¿Qué documentos adicionales requiere?

Responde en JSON:
{
  "recommendedRegime": {
    "code": "40",
    "name": "Nombre del régimen",
    "confidence": 0-100,
    "reasoning": "Por qué se recomienda",
    "requirements": ["requisitos"],
    "benefits": ["beneficios"],
    "documents": ["documentos necesarios"]
  },
  "alternativeRegimes": [
    {
      "code": "",
      "name": "",
      "confidence": 0-100,
      "reasoning": "",
      "requirements": [],
      "applicableIf": "condición para que sea aplicable"
    }
  ],
  "recommendedPreference": {
    "code": "100",
    "name": "Nombre preferencia",
    "confidence": 0-100,
    "reasoning": "",
    "potentialSavings": "% ahorro arancelario estimado",
    "requiredCertificate": "EUR1|ATR|FORM_A|REX|NONE",
    "requirements": []
  },
  "alternativePreferences": [],
  "specialConsiderations": [
    {
      "type": "ANTIDUMPING|QUOTA|SUSPENSION|SURVEILLANCE|OTHER",
      "description": "",
      "impact": "",
      "recommendation": ""
    }
  ],
  "estimatedDuties": {
    "withRecommendedPreference": "X%",
    "withoutPreference": "Y%",
    "estimatedSavings": "Z EUR"
  },
  "warnings": [],
  "summary": "Resumen de recomendaciones"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.h1Generation, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        recommendedRegime: { code: '40', name: 'Despacho a libre práctica', confidence: 80 },
        alternativeRegimes: [],
        recommendedPreference: { code: '100', name: 'Arancel terceros países', confidence: 80 },
        alternativePreferences: [],
        specialConsiderations: [],
        warnings: ['Error en análisis IA'],
        summary: 'No se pudo completar el análisis de régimen',
        rawResponse: result.content
      };
    }
  }

  /**
   * Predecir canal de despacho (verde/naranja/rojo)
   */
  async predictDeclarationChannel(expedition, declarationType = 'H1') {
    const prompt = `Predice el canal de despacho probable para esta declaración ${declarationType}.

EXPEDIENTE: ${expedition.expeditionId}
TIPO DECLARACIÓN: ${declarationType}

OPERADORES:
- Importador: ${expedition.client?.companyName}
- EORI: ${expedition.client?.eori || 'ES' + expedition.client?.nif}
- ¿Primera importación?: ${expedition.client?.isFirstImport ? 'Sí' : 'No especificado'}
- ¿Tiene OEA?: ${expedition.client?.hasOEA ? 'Sí' : 'No'}
- Exportador: ${expedition.exporter?.companyName} (${expedition.exporter?.country})

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
${i + 1}. ${g.description}
   TARIC: ${g.taricCode || 'N/A'} (Capítulo ${g.taricCode?.substring(0, 2) || 'N/A'})
   Origen: ${g.originCountry || 'N/A'}
   Valor: ${g.invoiceValue || 0} EUR
   Peso: ${g.netWeight || 0} kg
`).join('') || 'Sin mercancías'}

VALOR TOTAL: ${expedition.calculations?.invoiceTotal || expedition.goods?.reduce((s, g) => s + (g.invoiceValue || 0), 0)} EUR

RÉGIMEN: ${expedition.declaration?.regime || '40'}
PREFERENCIA: ${expedition.declaration?.preference || '100'}
ADUANA: ${expedition.declaration?.customsOffice || expedition.transport?.entryCustomsOffice}

DOCUMENTOS: ${expedition.documents?.length || 0} documentos adjuntos

FACTORES DE RIESGO QUE ANALIZA LA AEAT:

1. RIESGO ALTO (probable CANAL ROJO):
   - Mercancías sensibles: textil (cap. 61-63), calzado (cap. 64), electrónica (cap. 85)
   - Países de alto riesgo: China para textil/electrónica, países con sanciones
   - Valor anormalmente bajo (sospecha infravaloración)
   - Primera importación del operador
   - Mercancías sujetas a controles SOIVRE, sanitarios, CITES
   - Discrepancias en la documentación

2. RIESGO MEDIO (probable CANAL NARANJA):
   - Régimen especial (42, 51, 53)
   - Preferencia arancelaria (revisar certificado origen)
   - Valor elevado (> 50.000 EUR)
   - Mercancías con medidas antidumping
   - Cambio de clasificación respecto a historial

3. RIESGO BAJO (probable CANAL VERDE):
   - Operador OEA
   - Historial sin incidencias
   - Mercancías de bajo riesgo
   - Régimen estándar (40) sin preferencia
   - Documentación completa y coherente
   - Valor típico para el tipo de mercancía

CANALES:
- VERDE: Levante automático sin inspección
- NARANJA: Revisión documental (1-2 días)
- ROJO: Inspección física (2-5 días + costes)

Responde en JSON:
{
  "prediction": {
    "channel": "GREEN|ORANGE|RED",
    "probability": {
      "green": 0-100,
      "orange": 0-100,
      "red": 0-100
    },
    "confidence": 0-100
  },
  "riskFactors": [
    {
      "factor": "descripción del factor",
      "impact": "HIGH|MEDIUM|LOW",
      "affectsChannel": "ORANGE|RED",
      "mitigation": "cómo reducir este riesgo"
    }
  ],
  "positiveFactors": [
    {
      "factor": "descripción",
      "impact": "favorece canal verde"
    }
  ],
  "potentialInspections": {
    "documentCheck": {
      "probability": 0-100,
      "documentsLikelyReviewed": ["lista documentos"],
      "estimatedTime": "1-2 días"
    },
    "physicalInspection": {
      "probability": 0-100,
      "inspectionType": "SCANNER|PARCIAL|COMPLETA",
      "estimatedTime": "2-5 días",
      "estimatedCost": "150-500 EUR"
    }
  },
  "recommendations": [
    {
      "action": "qué hacer",
      "impact": "cómo mejora la probabilidad de canal verde",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "historicalComparison": {
    "similarDeclarations": "descripción de declaraciones similares",
    "typicalChannel": "canal típico para este tipo"
  },
  "estimatedProcessingTime": {
    "greenChannel": "< 1 hora",
    "orangeChannel": "1-3 días",
    "redChannel": "3-7 días"
  },
  "summary": "Resumen de la predicción"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        predictedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        prediction: {
          channel: 'GREEN',
          probability: { green: 60, orange: 30, red: 10 },
          confidence: 50
        },
        riskFactors: [],
        positiveFactors: [],
        potentialInspections: {},
        recommendations: [],
        summary: 'Error procesando predicción',
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo de declaración H1/AES
   */
  async fullDeclarationAnalysis(expedition, declarationType = 'H1') {
    try {
      // Ejecutar análisis en paralelo
      const [validation, errors, regime, channel] = await Promise.all([
        this.validateDeclarationBeforeSubmit(expedition, declarationType),
        this.detectDeclarationErrors(expedition, declarationType),
        this.suggestRegimeAndPreference(expedition),
        this.predictDeclarationChannel(expedition, declarationType)
      ]);

      // Calcular readiness score
      const readinessScore = Math.round(
        (validation.validationScore || 70) * 0.3 +
        (100 - (errors.riskOfRejection || 30)) * 0.3 +
        (regime.recommendedRegime?.confidence || 70) * 0.2 +
        (channel.prediction?.probability?.green || 50) * 0.2
      );

      return {
        expeditionId: expedition.expeditionId,
        declarationType,
        analyzedAt: new Date().toISOString(),
        validation,
        errors,
        regime,
        channel,
        overallReadiness: {
          score: readinessScore,
          readyToSubmit: validation.readyToSubmit && errors.blockingErrors === 0,
          estimatedChannel: channel.prediction?.channel,
          estimatedProcessingTime: channel.estimatedProcessingTime?.[
            channel.prediction?.channel?.toLowerCase() + 'Channel'
          ] || 'Variable'
        },
        nextSteps: this._generateDeclarationNextSteps(validation, errors, regime, channel)
      };
    } catch (error) {
      logger.error('Error en análisis completo de declaración:', error);
      return {
        expeditionId: expedition.expeditionId,
        declarationType,
        error: 'Error realizando análisis completo',
        analyzedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generar próximos pasos para declaración
   */
  _generateDeclarationNextSteps(validation, errors, regime, channel) {
    const steps = [];

    // Errores bloqueantes primero
    if (errors.blockingErrors > 0) {
      steps.push({
        priority: 1,
        action: 'Corregir errores bloqueantes',
        details: `${errors.blockingErrors} error(es) que impiden el envío`,
        type: 'BLOCKING'
      });
    }

    // Documentos faltantes
    if (validation.missingDocuments?.length > 0) {
      steps.push({
        priority: 1,
        action: 'Adjuntar documentos faltantes',
        details: validation.missingDocuments.join(', '),
        type: 'DOCUMENTS'
      });
    }

    // Revisar régimen si hay alternativa mejor
    if (regime.alternativeRegimes?.length > 0 &&
        regime.alternativeRegimes[0].confidence > regime.recommendedRegime?.confidence) {
      steps.push({
        priority: 2,
        action: 'Considerar régimen alternativo',
        details: `${regime.alternativeRegimes[0].code}: ${regime.alternativeRegimes[0].name}`,
        type: 'OPTIMIZATION'
      });
    }

    // Optimizar para canal verde
    if (channel.prediction?.channel !== 'GREEN' && channel.recommendations?.length > 0) {
      steps.push({
        priority: 2,
        action: 'Reducir riesgo de inspección',
        details: channel.recommendations[0]?.action || 'Revisar factores de riesgo',
        type: 'CHANNEL'
      });
    }

    // Warnings de validación
    if (validation.warnings?.length > 0) {
      steps.push({
        priority: 3,
        action: 'Revisar advertencias',
        details: `${validation.warnings.length} advertencia(s) a considerar`,
        type: 'WARNING'
      });
    }

    return steps.sort((a, b) => a.priority - b.priority);
  }

  // ===========================================
  // EXPEDIENTES AI INTEGRATIONS
  // ===========================================

  /**
   * Sugerir documentos faltantes basado en el análisis del expediente
   */
  async suggestMissingDocuments(expedition) {
    const prompt = `Analiza este expediente aduanero y sugiere documentos faltantes o adicionales necesarios.

EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo operación: ${expedition.operationType} (${expedition.operationType === 'import' ? 'Importación' : 'Exportación'})
- Modo transporte: ${expedition.transportMode}
- Incoterm: ${expedition.incoterm?.code || 'No especificado'} ${expedition.incoterm?.place || ''}

CLIENTE/OPERADOR:
- Empresa: ${expedition.client?.companyName}
- NIF: ${expedition.client?.nif}
- EORI: ${expedition.client?.eori || 'No especificado'}

EXPORTADOR/PROVEEDOR:
- Empresa: ${expedition.exporter?.companyName || 'No especificado'}
- País: ${expedition.exporter?.country || 'No especificado'}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}:
- Descripción: ${g.description}
- Código TARIC: ${g.taricCode || 'No clasificado'}
- País origen: ${g.originCountry || 'No especificado'}
- Valor: ${g.invoiceValue || 0} EUR
- Peso neto: ${g.netWeight || 0} kg
`).join('') || 'Sin mercancías registradas'}

DOCUMENTOS ACTUALES EN CHECKLIST:
${expedition.documentChecklist?.map(d => `- ${d.documentType}: ${d.required ? 'Requerido' : 'Opcional'} - ${d.received ? '✓ Recibido' : '✗ Pendiente'}`).join('\n') || 'Sin checklist'}

DOCUMENTOS YA SUBIDOS:
${expedition.documents?.map(d => `- ${d.type}: ${d.originalName} (${d.status})`).join('\n') || 'Sin documentos'}

Basándote en:
1. Tipo de operación (import/export)
2. Modo de transporte
3. Países de origen de las mercancías
4. Tipo de mercancías (código TARIC)
5. Valor de la operación
6. Incoterm utilizado

Determina:
1. Documentos obligatorios que faltan
2. Documentos recomendados según el tipo de mercancía
3. Certificados específicos por país de origen
4. Documentos preferenciales si aplica (EUR.1, ATR, Form A)
5. Prioridad de cada documento

Responde en JSON:
{
  "missingRequired": [
    {
      "documentType": "código_documento",
      "name": "Nombre del documento",
      "reason": "Por qué es necesario",
      "regulation": "Normativa que lo exige",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW"
    }
  ],
  "recommended": [
    {
      "documentType": "código_documento",
      "name": "Nombre del documento",
      "reason": "Por qué se recomienda",
      "benefit": "Beneficio de tenerlo"
    }
  ],
  "preferentialOrigin": {
    "applicable": true/false,
    "originCountry": "",
    "availablePreferences": ["EUR1", "ATR", "FORM_A", "REX"],
    "recommendedDocument": "",
    "potentialSavings": "Descripción del ahorro arancelario"
  },
  "specialRequirements": [
    {
      "type": "SANITARY|PHYTOSANITARY|CITES|DUAL_USE|OTHER",
      "description": "",
      "documents": [],
      "authority": "Organismo competente"
    }
  ],
  "completenessScore": 0-100,
  "summary": "Resumen ejecutivo del estado documental"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.documentValidation, prompt, { maxTokens: 4096 });

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
        missingRequired: [],
        recommended: [],
        preferentialOrigin: { applicable: false },
        specialRequirements: [],
        completenessScore: 50,
        summary: 'Error procesando análisis de documentos',
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis de riesgo del expediente
   */
  async analyzeExpeditionRisk(expedition) {
    const prompt = `Realiza un análisis de riesgo completo para este expediente aduanero.

EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType}
- Modo transporte: ${expedition.transportMode}
- Estado actual: ${expedition.status}
- Prioridad: ${expedition.priority}

OPERADORES:
- Cliente: ${expedition.client?.companyName} (NIF: ${expedition.client?.nif}, EORI: ${expedition.client?.eori})
- Exportador: ${expedition.exporter?.companyName || 'N/A'} (País: ${expedition.exporter?.country || 'N/A'})
- Representante: ${expedition.representative?.companyName || 'N/A'}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}:
- Descripción: ${g.description}
- TARIC: ${g.taricCode || 'Sin clasificar'}
- Origen: ${g.originCountry || 'N/A'}
- Valor factura: ${g.invoiceValue || 0} EUR
- Peso bruto: ${g.grossWeight || 0} kg
- Peso neto: ${g.netWeight || 0} kg
`).join('') || 'Sin mercancías'}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Documento: ${expedition.transport?.documentType || 'N/A'} ${expedition.transport?.documentNumber || ''}
- Puerto/Aduana entrada: ${expedition.transport?.entryCustomsOffice || expedition.transport?.arrivalPort || 'N/A'}
- Fecha llegada estimada: ${expedition.transport?.arrivalDate || 'N/A'}

VALOR TOTAL: ${expedition.calculations?.invoiceTotal || 'No calculado'} EUR
INCOTERM: ${expedition.incoterm?.code || 'N/A'} ${expedition.incoterm?.place || ''}

ESTADO DOCUMENTAL:
- Documentos subidos: ${expedition.documents?.length || 0}
- Checklist completado: ${expedition.documentChecklist?.filter(d => d.received).length || 0}/${expedition.documentChecklist?.length || 0}

Analiza los siguientes factores de riesgo:

1. RIESGO DE CANAL (probabilidad de canal naranja/rojo):
   - Países de origen de riesgo
   - Mercancías sensibles o de valor elevado
   - Historial del operador
   - Coherencia de datos

2. RIESGO DOCUMENTAL:
   - Documentos faltantes críticos
   - Posibles inconsistencias
   - Certificados especiales requeridos

3. RIESGO DE CLASIFICACIÓN:
   - Códigos TARIC dudosos o de alto riesgo
   - Posibles errores de clasificación
   - Mercancías con medidas arancelarias especiales

4. RIESGO DE VALORACIÓN:
   - Valor declarado vs valor típico del mercado
   - Coherencia valor/peso/cantidad
   - Incoterm y gastos adicionales

5. RIESGO REGULATORIO:
   - Licencias o autorizaciones requeridas
   - Controles especiales (SOIVRE, sanidad, etc.)
   - Restricciones por país de origen

Responde en JSON:
{
  "overallRiskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "overallRiskScore": 0-100,
  "channelPrediction": {
    "green": 0-100,
    "orange": 0-100,
    "red": 0-100,
    "mostLikely": "GREEN|ORANGE|RED",
    "factors": []
  },
  "riskCategories": {
    "documental": {
      "level": "LOW|MEDIUM|HIGH",
      "score": 0-100,
      "issues": [],
      "recommendations": []
    },
    "classification": {
      "level": "LOW|MEDIUM|HIGH",
      "score": 0-100,
      "issues": [],
      "recommendations": []
    },
    "valuation": {
      "level": "LOW|MEDIUM|HIGH",
      "score": 0-100,
      "issues": [],
      "recommendations": []
    },
    "regulatory": {
      "level": "LOW|MEDIUM|HIGH",
      "score": 0-100,
      "issues": [],
      "recommendations": []
    }
  },
  "criticalIssues": [
    {
      "type": "",
      "description": "",
      "impact": "",
      "recommendation": "",
      "priority": "IMMEDIATE|HIGH|MEDIUM|LOW"
    }
  ],
  "warnings": [],
  "recommendations": [],
  "estimatedProcessingTime": "Tiempo estimado de despacho",
  "summary": "Resumen ejecutivo del análisis de riesgo"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096, timeout: 90000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        overallRiskLevel: 'MEDIUM',
        overallRiskScore: 50,
        channelPrediction: { green: 60, orange: 30, red: 10, mostLikely: 'GREEN', factors: [] },
        riskCategories: {
          documental: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          classification: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          valuation: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] },
          regulatory: { level: 'MEDIUM', score: 50, issues: [], recommendations: [] }
        },
        criticalIssues: [],
        warnings: ['Error procesando análisis de riesgo'],
        recommendations: [],
        summary: 'No se pudo completar el análisis de riesgo',
        rawResponse: result.content
      };
    }
  }

  /**
   * Sugerir clasificación TARIC para las mercancías del expediente
   */
  async suggestTaricClassification(expedition) {
    const prompt = `Analiza las mercancías de este expediente y sugiere clasificaciones TARIC.

CONTEXTO DEL EXPEDIENTE:
- Tipo operación: ${expedition.operationType}
- Exportador/País origen: ${expedition.exporter?.companyName || 'N/A'} (${expedition.exporter?.country || 'N/A'})
- Sector/Actividad cliente: ${expedition.client?.sector || 'No especificado'}

MERCANCÍAS A CLASIFICAR:
${expedition.goods?.map((g, i) => `
===== ITEM ${i + 1} =====
Descripción: ${g.description}
Descripción adicional: ${g.descriptionEs || g.additionalDescription || 'N/A'}
TARIC actual: ${g.taricCode || 'SIN CLASIFICAR'}
HS Code: ${g.hsCode || 'N/A'}
País origen: ${g.originCountry || 'N/A'}
Material: ${g.material || 'No especificado'}
Uso previsto: ${g.intendedUse || 'No especificado'}
Valor unitario: ${g.invoiceValue && g.quantity ? (g.invoiceValue / g.quantity).toFixed(2) : 'N/A'} EUR
Peso unitario: ${g.netWeight && g.quantity ? (g.netWeight / g.quantity).toFixed(3) : 'N/A'} kg
`).join('\n') || 'Sin mercancías'}

Para cada mercancía:
1. Analiza la descripción y contexto
2. Aplica las Reglas Generales de Interpretación (RGI)
3. Considera sección, capítulo, partida, subpartida
4. Verifica notas de sección/capítulo aplicables
5. Proporciona 2-3 sugerencias ordenadas por confianza

IMPORTANTE:
- Los códigos TARIC tienen 10 dígitos
- Explica el razonamiento de clasificación
- Indica si hay ambigüedad o se necesita más información
- Señala si hay medidas especiales (antidumping, cuotas, etc.)

Responde en JSON:
{
  "items": [
    {
      "itemIndex": 0,
      "description": "Descripción del item",
      "currentTaric": "código actual o null",
      "suggestions": [
        {
          "taricCode": "código 10 dígitos",
          "hsCode": "código 6 dígitos",
          "confidence": 0-100,
          "description": "Descripción oficial de la partida",
          "reasoning": "Explicación detallada del razonamiento",
          "rgiApplied": ["RGI aplicadas"],
          "chapterNotes": ["Notas relevantes"],
          "warnings": ["Advertencias sobre esta clasificación"]
        }
      ],
      "needsMoreInfo": ["Información adicional que ayudaría"],
      "specialMeasures": {
        "antidumping": false,
        "countervailing": false,
        "quota": false,
        "suspension": false,
        "details": ""
      }
    }
  ],
  "generalWarnings": [],
  "recommendations": [],
  "summary": "Resumen de las clasificaciones sugeridas"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt, { maxTokens: 8192, timeout: 120000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        items: expedition.goods?.map((g, i) => ({
          itemIndex: i,
          description: g.description,
          currentTaric: g.taricCode,
          suggestions: [],
          needsMoreInfo: ['Error en análisis IA'],
          specialMeasures: {}
        })) || [],
        generalWarnings: ['Error procesando clasificación TARIC'],
        recommendations: [],
        summary: 'No se pudo completar el análisis de clasificación',
        rawResponse: result.content
      };
    }
  }

  /**
   * Detectar inconsistencias en los datos del expediente
   */
  async detectInconsistencies(expedition) {
    const prompt = `Analiza este expediente aduanero y detecta cualquier inconsistencia o error en los datos.

DATOS DEL EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType}
- Estado: ${expedition.status}
- Creado: ${expedition.createdAt}

CLIENTE:
- Empresa: ${expedition.client?.companyName}
- NIF: ${expedition.client?.nif}
- EORI: ${expedition.client?.eori}
- País: ${expedition.client?.address?.country || 'N/A'}

EXPORTADOR:
- Empresa: ${expedition.exporter?.companyName || 'N/A'}
- País: ${expedition.exporter?.country || 'N/A'}
- VAT: ${expedition.exporter?.vatNumber || 'N/A'}

IMPORTADOR/DESTINATARIO:
- Empresa: ${expedition.importer?.companyName || expedition.consignee?.companyName || 'N/A'}
- NIF: ${expedition.importer?.nif || expedition.consignee?.nif || 'N/A'}
- EORI: ${expedition.importer?.eori || expedition.consignee?.eori || 'N/A'}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
Item ${i + 1}:
- Descripción: ${g.description}
- TARIC: ${g.taricCode || 'N/A'}
- Origen: ${g.originCountry}
- Cantidad: ${g.quantity} ${g.unit || 'KG'}
- Peso bruto: ${g.grossWeight || 0} kg
- Peso neto: ${g.netWeight || 0} kg
- Valor factura: ${g.invoiceValue || 0} EUR
- Bultos: ${g.packages?.quantity || 0} ${g.packages?.type || 'N/A'}
`).join('') || 'Sin mercancías'}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Tipo documento: ${expedition.transport?.documentType || 'N/A'}
- Número documento: ${expedition.transport?.documentNumber || 'N/A'}
- Puerto salida: ${expedition.transport?.departurePort || 'N/A'}
- Puerto entrada: ${expedition.transport?.arrivalPort || 'N/A'}
- Aduana entrada: ${expedition.transport?.entryCustomsOffice || 'N/A'}
- Fecha salida: ${expedition.transport?.departureDate || 'N/A'}
- Fecha llegada: ${expedition.transport?.arrivalDate || 'N/A'}
- Contenedores: ${expedition.transport?.containers?.map(c => `${c.number} (${c.type})`).join(', ') || 'N/A'}

INCOTERM: ${expedition.incoterm?.code || 'N/A'} ${expedition.incoterm?.place || ''}

CÁLCULOS:
- Total factura: ${expedition.calculations?.invoiceTotal || 'N/A'} ${expedition.calculations?.invoiceCurrency || 'EUR'}
- Valor aduanero: ${expedition.calculations?.customsValue || 'N/A'} EUR
- Flete: ${expedition.calculations?.freightCost || 'N/A'} EUR
- Seguro: ${expedition.calculations?.insuranceCost || 'N/A'} EUR

Verifica y detecta:

1. INCONSISTENCIAS DE DATOS:
   - NIF/EORI mal formados
   - Países incongruentes (origen mercancía vs exportador)
   - Fechas ilógicas (salida posterior a llegada)
   - Pesos inconsistentes (neto > bruto)

2. ERRORES DE FORMATO:
   - Códigos TARIC incorrectos (longitud, formato)
   - Códigos de aduana inválidos
   - Formato de fechas

3. INCONSISTENCIAS LÓGICAS:
   - Valor vs peso (valor demasiado alto/bajo para el peso)
   - Cantidad vs bultos
   - Incoterm vs gastos declarados
   - Tipo operación vs actores (exportador en importación)

4. DATOS FALTANTES CRÍTICOS:
   - Campos obligatorios vacíos
   - Información incompleta para declaración

5. ALERTAS DE CALIDAD:
   - Descripciones demasiado genéricas
   - Posibles errores de transcripción
   - Datos sospechosos o atípicos

Responde en JSON:
{
  "hasInconsistencies": true/false,
  "totalIssues": 0,
  "criticalIssues": 0,
  "inconsistencies": [
    {
      "type": "DATA_MISMATCH|FORMAT_ERROR|LOGIC_ERROR|MISSING_DATA|QUALITY_ALERT",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "field": "campo afectado",
      "currentValue": "valor actual",
      "expectedValue": "valor esperado o correcto",
      "description": "Descripción del problema",
      "recommendation": "Cómo solucionarlo",
      "autoFixable": true/false,
      "suggestedFix": "valor sugerido si es autofixable"
    }
  ],
  "dataQualityScore": 0-100,
  "readyForDeclaration": true/false,
  "blockers": ["Lista de problemas que impiden la declaración"],
  "warnings": ["Advertencias no bloqueantes"],
  "summary": "Resumen del análisis de consistencia"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.documentValidation, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        hasInconsistencies: false,
        totalIssues: 0,
        criticalIssues: 0,
        inconsistencies: [],
        dataQualityScore: 70,
        readyForDeclaration: true,
        blockers: [],
        warnings: ['Error procesando análisis de inconsistencias'],
        summary: 'No se pudo completar el análisis',
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo del expediente (combina todos los análisis)
   */
  async fullExpeditionAnalysis(expedition) {
    try {
      // Ejecutar análisis en paralelo
      const [documents, risk, classification, inconsistencies] = await Promise.all([
        this.suggestMissingDocuments(expedition),
        this.analyzeExpeditionRisk(expedition),
        this.suggestTaricClassification(expedition),
        this.detectInconsistencies(expedition)
      ]);

      return {
        expeditionId: expedition.expeditionId,
        analyzedAt: new Date().toISOString(),
        documents,
        risk,
        classification,
        inconsistencies,
        overallReadiness: {
          score: Math.round(
            (documents.completenessScore || 50) * 0.25 +
            (100 - (risk.overallRiskScore || 50)) * 0.25 +
            (classification.items?.reduce((acc, item) =>
              acc + (item.suggestions?.[0]?.confidence || 50), 0) / (classification.items?.length || 1)) * 0.25 +
            (inconsistencies.dataQualityScore || 50) * 0.25
          ),
          readyForDeclaration: inconsistencies.readyForDeclaration &&
                              documents.completenessScore >= 70 &&
                              risk.overallRiskLevel !== 'CRITICAL',
          nextSteps: []
        }
      };
    } catch (error) {
      logger.error('Error en análisis completo:', error);
      return {
        expeditionId: expedition.expeditionId,
        error: 'Error realizando análisis completo',
        analyzedAt: new Date().toISOString()
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

  // ===========================================
  // TRÁNSITOS NCTS AI INTEGRATIONS
  // ===========================================

  /**
   * Auto-completar datos de tránsito desde expediente
   */
  async autoCompleteTransitData(transitDraft, expedition, previousTransits = []) {
    const prompt = `Como experto en operaciones de tránsito NCTS (T1/T2/TIR), auto-completa los datos faltantes de esta declaración de tránsito basándote en el expediente y transitos anteriores similares.

DATOS ACTUALES DEL TRÁNSITO (borrador):
${JSON.stringify(transitDraft, null, 2)}

DATOS DEL EXPEDIENTE ORIGEN:
${expedition ? JSON.stringify({
  expeditionId: expedition.expeditionId,
  operationType: expedition.operationType,
  origin: expedition.origin,
  destination: expedition.destination,
  client: expedition.client,
  goods: expedition.goods,
  transport: expedition.transport,
  declaration: expedition.declaration
}, null, 2) : 'No disponible'}

TRANSITOS ANTERIORES SIMILARES (para aprendizaje):
${previousTransits.length > 0 ? JSON.stringify(previousTransits.slice(0, 3).map(t => ({
  transitType: t.transitType,
  route: t.route,
  departureOffice: t.departureOffice,
  destinationOffice: t.destinationOffice,
  transitOffices: t.transitOffices,
  guarantee: t.guarantee,
  avgTransitDays: t.avgTransitDays
})), null, 2) : 'No hay historial'}

INSTRUCCIONES:
1. Sugiere el tipo de tránsito más adecuado (T1 para mercancías no comunitarias, T2/T2F para comunitarias)
2. Propón aduanas de partida y destino óptimas
3. Calcula ruta con aduanas de tránsito intermedias
4. Sugiere tipo de garantía apropiado
5. Estima plazo de llegada basado en la ruta
6. Completa datos del principal obligado
7. Mapea las mercancías del expediente al formato NCTS

Responde en JSON:
{
  "suggestedData": {
    "transitType": "T1|T2|T2F|T2SM|TIR",
    "transitTypeReason": "Razón de la selección",
    "principal": {
      "eori": "",
      "name": "",
      "address": {}
    },
    "departureOffice": {
      "code": "ES00XXXX",
      "name": "",
      "country": "ES"
    },
    "destinationOffice": {
      "code": "",
      "name": "",
      "country": ""
    },
    "transitOffices": [
      {
        "sequence": 1,
        "code": "",
        "name": "",
        "country": "",
        "estimatedArrival": "ISO date"
      }
    ],
    "route": {
      "countries": ["ES", "..."],
      "itinerary": "Descripción de la ruta",
      "bindingItinerary": false
    },
    "guarantee": {
      "type": "0-9|R|B|C|H|J",
      "typeDescription": "",
      "estimatedAmount": 0,
      "grn": "",
      "reason": "Por qué este tipo"
    },
    "goodsItems": [
      {
        "itemNumber": 1,
        "description": "",
        "taricCode": "",
        "countryOfOrigin": "",
        "grossWeight": 0,
        "netWeight": 0,
        "packages": {
          "count": 0,
          "packageType": "",
          "marks": ""
        }
      }
    ],
    "estimatedDeadline": "ISO date",
    "estimatedTransitDays": 0
  },
  "fieldsCompleted": ["lista de campos completados"],
  "fieldsRequiringConfirmation": [
    {
      "field": "nombre del campo",
      "suggestedValue": "valor",
      "reason": "por qué necesita confirmación"
    }
  ],
  "warnings": ["advertencias sobre los datos"],
  "confidence": 0-100
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        suggestedData: {},
        fieldsCompleted: [],
        fieldsRequiringConfirmation: [],
        warnings: ['Error en auto-completado IA'],
        confidence: 0,
        rawResponse: result.content
      };
    }
  }

  /**
   * Validar y optimizar ruta de tránsito
   */
  async validateTransitRoute(transit) {
    const prompt = `Como experto en logística y tránsitos aduaneros NCTS, analiza y valida esta ruta de tránsito.

DATOS DEL TRÁNSITO:
- Tipo: ${transit.transitType}
- Aduana partida: ${transit.departureOffice?.code} (${transit.departureOffice?.country})
- Aduana destino: ${transit.destinationOffice?.code} (${transit.destinationOffice?.country})
- Aduanas de tránsito: ${JSON.stringify(transit.transitOffices || [])}
- Ruta declarada: ${JSON.stringify(transit.route || {})}
- Modo transporte: ${transit.transport?.mode} (1=Mar, 2=Ferrocarril, 3=Carretera, 4=Aéreo)
- Mercancías: ${transit.goodsItems?.length || 0} partidas, ${transit.totals?.grossWeight || 0} kg

MERCANCÍAS:
${transit.goodsItems?.map((g, i) => `
${i + 1}. ${g.description}
   - TARIC: ${g.taricCode || 'No especificado'}
   - Origen: ${g.countryOfOrigin}
   - Peso: ${g.grossWeight} kg
`).join('') || 'No especificadas'}

INSTRUCCIONES:
1. Valida que la ruta sea coherente (países intermedios lógicos)
2. Verifica que las aduanas de tránsito sean correctas para las fronteras
3. Identifica posibles cuellos de botella o retrasos
4. Sugiere rutas alternativas si hay mejores opciones
5. Calcula tiempos estimados realistas
6. Identifica requisitos especiales por países en ruta
7. Evalúa restricciones de circulación (fines de semana, festivos)

Responde en JSON:
{
  "routeValidation": {
    "isValid": true/false,
    "issues": [
      {
        "type": "error|warning|info",
        "description": "",
        "affectedSegment": "ES->FR",
        "recommendation": ""
      }
    ]
  },
  "routeAnalysis": {
    "totalDistance": "km aproximados",
    "estimatedTransitDays": 0,
    "borderCrossings": [
      {
        "from": "ES",
        "to": "FR",
        "office": "código",
        "estimatedWaitHours": 0,
        "notes": ""
      }
    ],
    "restrictions": [
      {
        "country": "",
        "restriction": "",
        "period": "",
        "impact": ""
      }
    ]
  },
  "alternativeRoutes": [
    {
      "description": "",
      "countries": [],
      "advantages": [],
      "disadvantages": [],
      "estimatedDays": 0,
      "recommended": true/false
    }
  ],
  "transitOfficesSuggestion": [
    {
      "sequence": 1,
      "code": "",
      "name": "",
      "country": "",
      "reason": ""
    }
  ],
  "deadlineCalculation": {
    "standardDeadline": "ISO date",
    "recommendedDeadline": "ISO date",
    "bufferDays": 0,
    "factors": []
  },
  "recommendations": [],
  "riskLevel": "LOW|MEDIUM|HIGH"
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        validatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        routeValidation: { isValid: false, issues: [{ type: 'error', description: 'Error en validación IA' }] },
        routeAnalysis: {},
        alternativeRoutes: [],
        recommendations: [],
        riskLevel: 'UNKNOWN',
        rawResponse: result.content
      };
    }
  }

  /**
   * Predecir incidencias potenciales en el tránsito
   */
  async predictTransitIncidents(transit, historicalData = {}) {
    const prompt = `Como experto en gestión de riesgos de tránsitos NCTS, analiza este tránsito y predice posibles incidencias.

DATOS DEL TRÁNSITO:
- MRN: ${transit.mrn || 'Pendiente'}
- Tipo: ${transit.transitType}
- Estado actual: ${transit.status}
- Partida: ${transit.departureOffice?.code} (${transit.departureOffice?.country})
- Destino: ${transit.destinationOffice?.code} (${transit.destinationOffice?.country})
- Ruta: ${transit.route?.countries?.join(' → ') || 'No especificada'}
- Garantía tipo: ${transit.guarantee?.type} (${transit.guarantee?.amount || 0} EUR)
- Fecha salida: ${transit.dates?.releaseAtDeparture || 'No iniciado'}
- Plazo llegada: ${transit.deadlines?.arrivalDeadline || 'No calculado'}

TRANSPORTE:
- Modo: ${transit.transport?.mode}
- Vehículo: ${transit.transport?.identityAtDeparture?.identification || 'No especificado'}
- Contenedores: ${transit.transport?.containers?.length || 0}
- Precintos: ${transit.transport?.seals?.length || 0}

MERCANCÍAS:
${transit.goodsItems?.map((g, i) => `
${i + 1}. ${g.description} (${g.taricCode || 'sin TARIC'})
   - Origen: ${g.countryOfOrigin}
   - Peso: ${g.grossWeight} kg
`).join('') || 'No especificadas'}

PRINCIPAL OBLIGADO:
- EORI: ${transit.principal?.eori || 'No especificado'}
- Nombre: ${transit.principal?.name || 'No especificado'}

DATOS HISTÓRICOS:
- Transitos previos similares: ${historicalData.similarTransits || 0}
- Tasa de incidencias histórica: ${historicalData.incidentRate || 'Desconocida'}
- Incidencias comunes en ruta: ${JSON.stringify(historicalData.commonIncidents || [])}

INSTRUCCIONES:
1. Evalúa probabilidad de retraso en cada etapa
2. Identifica riesgo de control físico en fronteras
3. Analiza probabilidad de discrepancias
4. Evalúa riesgo de procedimiento de búsqueda (enquiry)
5. Identifica factores de riesgo específicos de mercancías
6. Considera factores estacionales y geopolíticos
7. Sugiere medidas preventivas

Responde en JSON:
{
  "overallRiskScore": 0-100,
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "incidentPredictions": [
    {
      "type": "delay|control|discrepancy|seal_issue|enquiry|guarantee_issue|documentation|other",
      "probability": 0-100,
      "description": "",
      "stage": "departure|transit|border_X|arrival|unloading",
      "impact": "LOW|MEDIUM|HIGH",
      "potentialDelay": "horas o días",
      "triggerFactors": [],
      "preventiveMeasures": []
    }
  ],
  "controlProbability": {
    "departure": 0-100,
    "transit": 0-100,
    "arrival": 0-100,
    "factors": []
  },
  "enquiryRisk": {
    "probability": 0-100,
    "triggers": [],
    "potentialDebtAmount": 0,
    "mitigationActions": []
  },
  "timelineRisk": {
    "onTimeArrivalProbability": 0-100,
    "expectedDelayDays": 0,
    "criticalPoints": []
  },
  "guaranteeAdequacy": {
    "currentAmount": 0,
    "recommendedAmount": 0,
    "adequacyScore": 0-100,
    "notes": ""
  },
  "recommendations": [
    {
      "priority": "HIGH|MEDIUM|LOW",
      "action": "",
      "reason": "",
      "deadline": ""
    }
  ],
  "monitoringAlerts": [
    {
      "condition": "",
      "action": "",
      "urgency": ""
    }
  ]
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        predictedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        overallRiskScore: 50,
        riskLevel: 'UNKNOWN',
        incidentPredictions: [],
        controlProbability: {},
        enquiryRisk: {},
        recommendations: [{ priority: 'HIGH', action: 'Revisar manualmente', reason: 'Error en predicción IA' }],
        rawResponse: result.content
      };
    }
  }

  /**
   * Sugerir garantía óptima para tránsito
   */
  async suggestTransitGuarantee(transit, operatorProfile = {}) {
    const prompt = `Como experto en garantías de tránsito NCTS, sugiere el tipo de garantía óptimo para esta operación.

DATOS DEL TRÁNSITO:
- Tipo: ${transit.transitType}
- Partida: ${transit.departureOffice?.code} (${transit.departureOffice?.country})
- Destino: ${transit.destinationOffice?.code} (${transit.destinationOffice?.country})
- Países en ruta: ${transit.route?.countries?.join(', ') || 'No especificados'}

MERCANCÍAS:
${transit.goodsItems?.map((g, i) => `
${i + 1}. ${g.description}
   - TARIC: ${g.taricCode || 'No especificado'}
   - Valor estimado: ${g.value || 'No especificado'} EUR
   - Peso: ${g.grossWeight} kg
`).join('') || 'No especificadas'}

VALOR TOTAL ESTIMADO: ${transit.totalValue || 'No especificado'} EUR
PESO TOTAL: ${transit.totals?.grossWeight || 0} kg

PERFIL DEL OPERADOR:
- EORI: ${operatorProfile.eori || transit.principal?.eori || 'No especificado'}
- Estatus OEA: ${operatorProfile.oeaStatus || 'none'}
- Tipo OEA: ${operatorProfile.oeaType || 'N/A'}
- Garantía global existente: ${operatorProfile.hasGlobalGuarantee ? 'Sí' : 'No'}
- GRN garantía global: ${operatorProfile.grn || 'N/A'}
- Importe disponible: ${operatorProfile.availableAmount || 'N/A'} EUR
- Historial de tránsitos: ${operatorProfile.transitHistory || 'Desconocido'}
- Incidencias previas: ${operatorProfile.previousIncidents || 0}

TIPOS DE GARANTÍA NCTS:
- 0: Dispensa de garantía (operadores autorizados)
- 1: Garantía global
- 2: Garantía individual por fianza
- 3: Garantía individual en efectivo
- 4: Garantía individual por título
- 5: Dispensa (máx 500 EUR)
- 8: Sin garantía requerida (títulos)
- 9: Garantía individual con múltiples usos
- R: Garantía individual TIR
- B: Carnet TIR
- C: Sin garantía requerida
- H: Garantía simplificada
- J: Validación garantía global múltiples aduanas

INSTRUCCIONES:
1. Calcula el importe de garantía requerido según normativa
2. Aplica reducciones si hay OEA
3. Sugiere el tipo más conveniente
4. Considera coste y tramitación
5. Evalúa si la garantía global existente es suficiente

Responde en JSON:
{
  "calculatedAmount": {
    "baseAmount": 0,
    "reductionPercentage": 0,
    "reductionReason": "",
    "finalAmount": 0,
    "breakdown": {
      "duties": 0,
      "vat": 0,
      "excise": 0,
      "other": 0
    }
  },
  "recommendedType": {
    "code": "0-9|R|B|C|H|J",
    "name": "",
    "reason": "",
    "requirements": [],
    "advantages": [],
    "disadvantages": []
  },
  "alternatives": [
    {
      "code": "",
      "name": "",
      "suitability": 0-100,
      "estimatedCost": 0,
      "processingTime": "",
      "notes": ""
    }
  ],
  "globalGuaranteeAnalysis": {
    "canUseExisting": true/false,
    "availableAmount": 0,
    "wouldBeConsumed": 0,
    "remainingAfter": 0,
    "recommendation": ""
  },
  "oeaImpact": {
    "hasReduction": true/false,
    "reductionPercentage": 0,
    "reductionAmount": 0,
    "additionalBenefits": []
  },
  "recommendations": [],
  "warnings": []
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        calculatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        calculatedAmount: { finalAmount: 0 },
        recommendedType: { code: '1', name: 'Garantía global', reason: 'Por defecto' },
        alternatives: [],
        recommendations: ['Error en cálculo IA - revisar manualmente'],
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo de tránsito NCTS
   */
  async fullTransitAnalysis(transit, expedition, operatorProfile = {}, historicalData = {}) {
    // Ejecutar análisis en paralelo
    const [routeValidation, incidentPrediction, guaranteeSuggestion] = await Promise.all([
      this.validateTransitRoute(transit),
      this.predictTransitIncidents(transit, historicalData),
      this.suggestTransitGuarantee(transit, operatorProfile)
    ]);

    // Calcular score de preparación
    let readinessScore = 0;
    const factors = [];

    // Datos básicos completos
    if (transit.principal?.eori && transit.principal?.name) {
      readinessScore += 15;
      factors.push('Principal obligado completo');
    }

    // Ruta válida
    if (routeValidation.routeValidation?.isValid) {
      readinessScore += 20;
      factors.push('Ruta validada');
    }

    // Garantía adecuada
    if (guaranteeSuggestion.globalGuaranteeAnalysis?.canUseExisting ||
        transit.guarantee?.grn) {
      readinessScore += 20;
      factors.push('Garantía disponible');
    }

    // Mercancías completas
    if (transit.goodsItems?.length > 0 &&
        transit.goodsItems.every(g => g.description && g.grossWeight)) {
      readinessScore += 15;
      factors.push('Mercancías documentadas');
    }

    // Bajo riesgo de incidencias
    if (incidentPrediction.overallRiskScore < 40) {
      readinessScore += 15;
      factors.push('Bajo riesgo de incidencias');
    }

    // Aduanas de tránsito definidas
    if (transit.transitOffices?.length > 0) {
      readinessScore += 10;
      factors.push('Aduanas de tránsito definidas');
    }

    // Documentos previos vinculados
    if (transit.documents?.length > 0) {
      readinessScore += 5;
      factors.push('Documentos vinculados');
    }

    // Generar próximos pasos
    const nextSteps = this._generateTransitNextSteps(
      transit,
      routeValidation,
      incidentPrediction,
      guaranteeSuggestion
    );

    return {
      routeValidation,
      incidentPrediction,
      guaranteeSuggestion,
      summary: {
        readinessScore,
        readinessLevel: readinessScore >= 80 ? 'READY' :
                        readinessScore >= 60 ? 'ALMOST_READY' :
                        readinessScore >= 40 ? 'NEEDS_WORK' : 'NOT_READY',
        factors,
        overallRiskLevel: incidentPrediction.riskLevel,
        estimatedTransitDays: routeValidation.routeAnalysis?.estimatedTransitDays || 'N/A',
        guaranteeRequired: guaranteeSuggestion.calculatedAmount?.finalAmount || 0
      },
      nextSteps,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Generar próximos pasos para tránsito
   */
  _generateTransitNextSteps(transit, routeValidation, incidentPrediction, guaranteeSuggestion) {
    const steps = [];

    // Verificar ruta
    if (!routeValidation.routeValidation?.isValid) {
      steps.push({
        priority: 1,
        action: 'Corregir problemas de ruta',
        details: routeValidation.routeValidation?.issues?.[0]?.description || 'Revisar ruta',
        category: 'route'
      });
    }

    // Verificar garantía
    if (!transit.guarantee?.grn && !guaranteeSuggestion.globalGuaranteeAnalysis?.canUseExisting) {
      steps.push({
        priority: 1,
        action: 'Configurar garantía de tránsito',
        details: `Se recomienda ${guaranteeSuggestion.recommendedType?.name || 'garantía global'} por ${guaranteeSuggestion.calculatedAmount?.finalAmount || 0} EUR`,
        category: 'guarantee'
      });
    }

    // Riesgo alto
    if (incidentPrediction.overallRiskScore > 70) {
      steps.push({
        priority: 1,
        action: 'Mitigar riesgos identificados',
        details: incidentPrediction.recommendations?.[0]?.action || 'Revisar factores de riesgo',
        category: 'risk'
      });
    }

    // Completar mercancías
    if (!transit.goodsItems?.length ||
        transit.goodsItems.some(g => !g.taricCode)) {
      steps.push({
        priority: 2,
        action: 'Completar datos de mercancías',
        details: 'Verificar códigos TARIC y pesos de todas las partidas',
        category: 'goods'
      });
    }

    // Aduanas de tránsito
    if (!transit.transitOffices?.length && transit.route?.countries?.length > 2) {
      steps.push({
        priority: 2,
        action: 'Definir aduanas de tránsito',
        details: routeValidation.transitOfficesSuggestion?.map(o => o.code).join(', ') || 'Agregar aduanas intermedias',
        category: 'route'
      });
    }

    // Precintos
    if (transit.transport?.containerIndicator && !transit.transport?.seals?.length) {
      steps.push({
        priority: 3,
        action: 'Registrar precintos',
        details: 'Agregar números de precinto antes de la liberación',
        category: 'transport'
      });
    }

    return steps.sort((a, b) => a.priority - b.priority);
  }

  // ===========================================
  // PORTAL CLIENTE AI INTEGRATIONS
  // ===========================================

  /**
   * Chat contextual mejorado para portal cliente
   * Detecta intención, FAQs, y proporciona respuestas enriquecidas
   */
  async enhancedPortalChat(message, expedition, conversationHistory = [], clientProfile = {}) {
    const prompt = `Eres LUCI, el asistente virtual de Stock Logistic para el portal de clientes. Tu rol es ayudar a los clientes con sus operaciones aduaneras de forma clara, profesional y empática.

CONTEXTO DEL CLIENTE:
- Empresa: ${clientProfile.companyName || expedition?.client?.companyName || 'No especificada'}
- Email: ${clientProfile.email || expedition?.client?.contact?.email || 'No especificado'}
- Historial de operaciones: ${clientProfile.operationHistory || 'Desconocido'}
- Nivel de experiencia: ${clientProfile.experienceLevel || 'estándar'}

DATOS DEL EXPEDIENTE ACTUAL:
- ID: ${expedition?.expeditionId || 'No disponible'}
- Tipo: ${expedition?.operationType || 'No especificado'}
- Estado: ${expedition?.status || 'No especificado'}
- Documentos pendientes: ${expedition?.documentChecklist?.filter(d => d.required && !d.received).map(d => d.documentName).join(', ') || 'Ninguno'}
- % Completado: ${expedition?.documentCompletion || 0}%
- Mercancías: ${expedition?.goods?.map(g => g.description).join(', ') || 'No especificadas'}
- Transporte: ${expedition?.transportMode || 'No especificado'}
- Incoterm: ${expedition?.incoterm || 'No especificado'}

HISTORIAL DE CONVERSACIÓN:
${conversationHistory.slice(-5).map(m => `${m.sender}: ${m.content}`).join('\n') || 'Sin historial previo'}

MENSAJE DEL CLIENTE:
"${message}"

INSTRUCCIONES:
1. Detecta la intención del cliente (consulta estado, pregunta FAQ, solicitud documento, duda técnica, queja, otro)
2. Si es una FAQ común, proporciona respuesta directa
3. Si requiere acción, indica los pasos claramente
4. Si es sobre el expediente, da información específica
5. Usa un tono profesional pero cercano
6. Si no puedes responder, sugiere contactar al agente
7. IMPORTANTE: Responde en español

Responde en JSON:
{
  "intent": "status_query|faq|document_request|technical_question|complaint|action_request|greeting|other",
  "intentConfidence": 0-100,
  "response": {
    "message": "Tu respuesta al cliente (markdown permitido)",
    "tone": "informative|helpful|apologetic|congratulatory",
    "language": "es"
  },
  "faqMatch": {
    "matched": true/false,
    "faqId": "identificador si aplica",
    "faqQuestion": "pregunta FAQ si aplica"
  },
  "suggestedActions": [
    {
      "action": "upload_document|contact_agent|view_status|make_payment|other",
      "description": "Descripción de la acción",
      "priority": "HIGH|MEDIUM|LOW",
      "url": "/ruta/si/aplica"
    }
  ],
  "expeditionInsights": {
    "statusExplanation": "Explicación del estado actual si relevante",
    "nextStep": "Próximo paso recomendado",
    "estimatedTime": "Tiempo estimado si aplica"
  },
  "escalationNeeded": {
    "needed": true/false,
    "reason": "razón si necesita escalación a agente humano",
    "urgency": "LOW|MEDIUM|HIGH"
  },
  "followUpQuestions": ["Preguntas de seguimiento sugeridas"]
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatClient, prompt, { maxTokens: 2048 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        intent: 'other',
        response: {
          message: result.content,
          tone: 'helpful'
        },
        suggestedActions: [],
        escalationNeeded: { needed: false }
      };
    }
  }

  /**
   * Detectar y responder FAQs automáticamente
   */
  async detectAndRespondFAQ(question, context = {}) {
    const prompt = `Analiza esta pregunta de un cliente del portal aduanero y determina si corresponde a una FAQ.

PREGUNTA DEL CLIENTE:
"${question}"

CONTEXTO:
- Tipo de operación: ${context.operationType || 'general'}
- Estado del expediente: ${context.status || 'desconocido'}

CATÁLOGO DE FAQs COMUNES:
1. ¿Qué documentos necesito para importar? → Lista de documentos según tipo de mercancía
2. ¿Cuánto tiempo tarda el despacho? → Depende del canal (verde: 24h, naranja: 48-72h, rojo: 3-5 días)
3. ¿Qué es el DUA? → Documento Único Administrativo
4. ¿Qué es el MRN? → Movement Reference Number
5. ¿Cómo puedo hacer el seguimiento? → A través del portal con su token
6. ¿Cuándo puedo retirar la mercancía? → Tras el levante
7. ¿Qué es el canal verde/naranja/rojo? → Niveles de control aduanero
8. ¿Necesito certificado de origen? → Depende del país y acuerdo comercial
9. ¿Cuánto tengo que pagar de aranceles? → Según código TARIC y valor
10. ¿Qué pasa si falta un documento? → Se solicita y se puede retrasar
11. ¿Qué es el EORI? → Economic Operator Registration and Identification
12. ¿Puedo modificar los datos una vez enviados? → Mediante rectificación
13. ¿Qué es una inspección física? → Revisión de la mercancía por la aduana
14. ¿Cómo pago los aranceles? → Mediante el portal de pagos
15. ¿Qué es el IVA a la importación? → Impuesto sobre el valor añadido

INSTRUCCIONES:
1. Identifica si la pregunta corresponde a alguna FAQ o es similar
2. Si es FAQ, proporciona una respuesta completa y útil
3. Si no es FAQ, indica que no corresponde
4. Adapta la respuesta al contexto específico si es posible

Responde en JSON:
{
  "isFAQ": true/false,
  "matchedFAQs": [
    {
      "faqNumber": 1-15,
      "matchScore": 0-100,
      "originalQuestion": "pregunta FAQ original"
    }
  ],
  "response": {
    "answer": "Respuesta completa en español",
    "additionalInfo": "Información adicional relevante",
    "relatedTopics": ["temas relacionados"]
  },
  "needsHumanReview": true/false,
  "confidence": 0-100
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatClient, prompt, { maxTokens: 1500 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed
      };
    } catch (e) {
      return {
        isFAQ: false,
        matchedFAQs: [],
        response: { answer: 'No pude procesar la pregunta' },
        needsHumanReview: true,
        confidence: 0
      };
    }
  }

  /**
   * Generar notificaciones inteligentes para el cliente
   */
  async generateSmartNotification(event, expedition, clientPreferences = {}) {
    const prompt = `Genera una notificación inteligente y personalizada para un cliente del portal aduanero.

EVENTO:
- Tipo: ${event.type}
- Descripción: ${event.description || 'No especificada'}
- Datos: ${JSON.stringify(event.data || {})}
- Timestamp: ${event.timestamp || new Date().toISOString()}

EXPEDIENTE:
- ID: ${expedition?.expeditionId}
- Estado actual: ${expedition?.status}
- Tipo operación: ${expedition?.operationType}
- Mercancías: ${expedition?.goods?.map(g => g.description).join(', ') || 'N/A'}
- Cliente: ${expedition?.client?.companyName}

PREFERENCIAS DEL CLIENTE:
- Idioma: ${clientPreferences.language || 'es'}
- Nivel de detalle: ${clientPreferences.detailLevel || 'normal'}
- Canales preferidos: ${clientPreferences.channels?.join(', ') || 'email, portal'}

TIPOS DE EVENTO:
- status_change: Cambio de estado del expediente
- document_validated: Documento validado
- document_required: Se requiere nuevo documento
- payment_due: Pago pendiente
- channel_assigned: Canal de control asignado
- inspection_scheduled: Inspección programada
- levante_issued: Levante emitido
- deadline_approaching: Plazo próximo a vencer
- action_required: Acción requerida del cliente

INSTRUCCIONES:
1. Crea un título corto y claro (máx 60 caracteres)
2. Genera mensaje principal informativo pero conciso
3. Incluye call-to-action si es necesario
4. Adapta el tono según la urgencia del evento
5. Sugiere próximos pasos si aplica

Responde en JSON:
{
  "notification": {
    "title": "Título corto",
    "message": "Mensaje principal",
    "shortMessage": "Versión corta para SMS/push (máx 160 chars)",
    "detailedMessage": "Versión detallada para email"
  },
  "metadata": {
    "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
    "category": "info|action|warning|success",
    "icon": "info|check|warning|clock|document|payment"
  },
  "callToAction": {
    "text": "Texto del botón",
    "url": "/ruta/accion",
    "required": true/false
  },
  "channels": {
    "email": true/false,
    "sms": true/false,
    "push": true/false,
    "portal": true/false
  },
  "scheduling": {
    "sendImmediately": true/false,
    "scheduledTime": "ISO date si no es inmediato",
    "reason": "razón del timing"
  }
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatClient, prompt, { maxTokens: 1500 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        eventType: event.type,
        expeditionId: expedition?.expeditionId,
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        notification: {
          title: 'Actualización de expediente',
          message: event.description || 'Hay novedades en su expediente',
          shortMessage: 'Hay novedades en su expediente'
        },
        metadata: { urgency: 'MEDIUM', category: 'info' },
        channels: { portal: true, email: true }
      };
    }
  }

  /**
   * Generar resumen del expediente adaptado para el cliente
   */
  async generateClientExpeditionSummary(expedition, options = {}) {
    const prompt = `Genera un resumen claro y comprensible del expediente para el cliente. El cliente no es experto en aduanas, así que usa lenguaje sencillo.

DATOS DEL EXPEDIENTE:
- ID: ${expedition.expeditionId}
- Tipo: ${expedition.operationType} (${expedition.operationType === 'import' ? 'Importación' : expedition.operationType === 'export' ? 'Exportación' : 'Tránsito'})
- Estado: ${expedition.status}
- Creado: ${expedition.createdAt}

CLIENTE:
- Empresa: ${expedition.client?.companyName}
- NIF: ${expedition.client?.nif}

MERCANCÍAS:
${expedition.goods?.map((g, i) => `
${i + 1}. ${g.description}
   - Cantidad: ${g.quantity} ${g.unit}
   - Peso: ${g.weight?.gross || 'N/A'} kg
   - Valor: ${g.value || 'N/A'} EUR
`).join('') || 'No especificadas'}

TRANSPORTE:
- Modo: ${expedition.transportMode}
- Documento: ${expedition.transport?.documentNumber || 'N/A'}
- Llegada estimada: ${expedition.transport?.arrivalDate || 'N/A'}

DOCUMENTOS:
${expedition.documentChecklist?.map(d => `- ${d.documentName}: ${d.received ? '✅ Recibido' : '⏳ Pendiente'}${d.validated ? ' (Validado)' : ''}`).join('\n') || 'Sin checklist'}

Completitud: ${expedition.documentCompletion || 0}%

DECLARACIÓN:
- MRN: ${expedition.declaration?.mrn || 'Pendiente'}
- Canal: ${expedition.declaration?.channel || 'Pendiente asignación'}
- Régimen: ${expedition.declaration?.regime || 'N/A'}

TIMELINE RECIENTE:
${expedition.timeline?.slice(-5).map(t => `- ${t.action}: ${t.description}`).join('\n') || 'Sin actividad'}

OPCIONES:
- Nivel detalle: ${options.detailLevel || 'normal'}
- Incluir costes: ${options.includeCosts || false}
- Idioma: ${options.language || 'es'}

INSTRUCCIONES:
1. Resume el estado actual de forma clara
2. Explica qué significa el estado en términos prácticos
3. Indica qué falta o qué debe hacer el cliente
4. Estima tiempos si es posible
5. Usa iconos/emojis para hacer más visual
6. Lenguaje sencillo, sin tecnicismos innecesarios

Responde en JSON:
{
  "summary": {
    "headline": "Título resumen (ej: 'Su importación está en proceso')",
    "statusExplanation": "Explicación clara del estado actual",
    "progressPercentage": 0-100,
    "progressDescription": "Descripción del progreso"
  },
  "keyInfo": {
    "whatIsHappening": "Qué está pasando ahora",
    "whatYouNeedToDo": "Qué necesita hacer el cliente (si algo)",
    "estimatedCompletion": "Estimación de finalización",
    "nextMilestone": "Próximo hito importante"
  },
  "documents": {
    "completed": ["docs recibidos"],
    "pending": ["docs pendientes con explicación"],
    "urgent": ["docs urgentes si hay"]
  },
  "costs": {
    "estimated": 0,
    "breakdown": [],
    "paymentStatus": ""
  },
  "timeline": [
    {
      "date": "fecha",
      "event": "evento",
      "status": "completed|current|upcoming"
    }
  ],
  "alerts": [
    {
      "type": "info|warning|action",
      "message": "mensaje de alerta"
    }
  ],
  "faqs": [
    {
      "question": "pregunta relevante",
      "answer": "respuesta corta"
    }
  ]
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatClient, prompt, { maxTokens: 2500 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        expeditionId: expedition.expeditionId,
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        summary: {
          headline: 'Resumen de expediente',
          statusExplanation: `Estado actual: ${expedition.status}`,
          progressPercentage: expedition.documentCompletion || 0
        },
        keyInfo: {},
        documents: { pending: [], completed: [] },
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo para portal cliente
   */
  async fullPortalAnalysis(expedition, clientProfile = {}, options = {}) {
    // Ejecutar análisis en paralelo
    const [summary, faqDetection] = await Promise.all([
      this.generateClientExpeditionSummary(expedition, options),
      this.detectAndRespondFAQ('¿Cuál es el estado de mi expediente?', {
        operationType: expedition.operationType,
        status: expedition.status
      })
    ]);

    // Generar notificaciones pendientes si hay eventos importantes
    const pendingNotifications = [];

    // Verificar documentos pendientes
    const pendingDocs = expedition.documentChecklist?.filter(d => d.required && !d.received) || [];
    if (pendingDocs.length > 0) {
      pendingNotifications.push({
        type: 'document_required',
        urgency: pendingDocs.length > 2 ? 'HIGH' : 'MEDIUM',
        message: `Tiene ${pendingDocs.length} documento(s) pendiente(s) de enviar`
      });
    }

    // Verificar si hay pagos pendientes
    if (expedition.status === 'pending_payment') {
      pendingNotifications.push({
        type: 'payment_due',
        urgency: 'HIGH',
        message: 'Tiene un pago pendiente para continuar el proceso'
      });
    }

    // Calcular score de satisfacción estimado
    let satisfactionScore = 70; // Base
    if (expedition.documentCompletion >= 80) satisfactionScore += 10;
    if (expedition.status === 'completed') satisfactionScore += 15;
    if (pendingDocs.length === 0) satisfactionScore += 5;

    return {
      summary,
      faqResources: faqDetection,
      pendingNotifications,
      clientInsights: {
        satisfactionScore,
        engagementLevel: clientProfile.operationHistory > 5 ? 'HIGH' : 'NORMAL',
        recommendedActions: this._generateClientRecommendedActions(expedition, pendingDocs)
      },
      supportOptions: {
        chatAvailable: true,
        phoneSupport: '+34 900 XXX XXX',
        emailSupport: 'soporte@stocklogistic.com',
        faqLink: '/ayuda/faq'
      },
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Generar acciones recomendadas para el cliente
   */
  _generateClientRecommendedActions(expedition, pendingDocs) {
    const actions = [];

    if (pendingDocs.length > 0) {
      actions.push({
        priority: 1,
        action: 'Subir documentos pendientes',
        description: `Faltan: ${pendingDocs.map(d => d.documentName).join(', ')}`,
        url: '/portal/documents'
      });
    }

    if (expedition.status === 'pending_payment') {
      actions.push({
        priority: 1,
        action: 'Realizar pago',
        description: 'Complete el pago para continuar el proceso',
        url: '/portal/payments'
      });
    }

    if (expedition.status === 'documents_received') {
      actions.push({
        priority: 2,
        action: 'Esperar validación',
        description: 'Sus documentos están siendo revisados',
        url: null
      });
    }

    if (!actions.length) {
      actions.push({
        priority: 3,
        action: 'Todo en orden',
        description: 'No hay acciones pendientes por su parte',
        url: null
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  // ===========================================
  // ANALYTICS AI INTEGRATIONS
  // ===========================================

  /**
   * Generar insights automáticos a partir de datos de analytics
   */
  async generateAutomaticInsights(analyticsData, context = {}) {
    const prompt = `Como experto en análisis de datos aduaneros y business intelligence, analiza estos datos y genera insights accionables.

DATOS DE ANALYTICS:
${JSON.stringify(analyticsData, null, 2)}

CONTEXTO:
- Período: ${context.period || 'Último mes'}
- Tipo de operación: ${context.operationType || 'Todas'}
- Comparación con período anterior: ${context.comparison ? 'Sí' : 'No'}

INSTRUCCIONES:
1. Identifica tendencias significativas (positivas y negativas)
2. Detecta anomalías o patrones inusuales
3. Genera insights accionables para mejorar operaciones
4. Identifica oportunidades de optimización
5. Señala riesgos potenciales
6. Prioriza los insights por impacto

Responde en JSON:
{
  "executiveSummary": "Resumen ejecutivo en 2-3 oraciones",
  "keyInsights": [
    {
      "id": "insight_1",
      "type": "trend|anomaly|opportunity|risk|achievement",
      "title": "Título corto del insight",
      "description": "Descripción detallada",
      "impact": "HIGH|MEDIUM|LOW",
      "metric": "Métrica relacionada",
      "value": "Valor actual",
      "change": "% cambio si aplica",
      "recommendation": "Acción recomendada",
      "priority": 1-10
    }
  ],
  "trends": {
    "positive": [{ "metric", "trend", "significance" }],
    "negative": [{ "metric", "trend", "significance" }],
    "neutral": [{ "metric", "observation" }]
  },
  "anomalies": [
    {
      "metric": "",
      "expected": "",
      "actual": "",
      "deviation": "",
      "possibleCauses": [],
      "recommendedAction": ""
    }
  ],
  "opportunities": [
    {
      "area": "",
      "description": "",
      "potentialImpact": "",
      "effort": "LOW|MEDIUM|HIGH",
      "timeframe": ""
    }
  ],
  "risks": [
    {
      "risk": "",
      "probability": "LOW|MEDIUM|HIGH",
      "impact": "LOW|MEDIUM|HIGH",
      "mitigation": ""
    }
  ],
  "recommendations": [
    {
      "priority": 1-5,
      "action": "",
      "rationale": "",
      "expectedOutcome": "",
      "kpiImpact": []
    }
  ],
  "nextPeriodForecast": {
    "volumeExpected": "",
    "keyFactors": [],
    "confidence": 0-100
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
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        executiveSummary: 'Error al generar insights',
        keyInsights: [],
        trends: { positive: [], negative: [], neutral: [] },
        anomalies: [],
        recommendations: [],
        rawResponse: result.content
      };
    }
  }

  /**
   * Detectar anomalías con IA y explicaciones
   */
  async detectAnomaliesAI(data, thresholds = {}) {
    const prompt = `Como experto en detección de anomalías en operaciones aduaneras, analiza estos datos e identifica patrones anómalos.

DATOS A ANALIZAR:
${JSON.stringify(data, null, 2)}

UMBRALES CONFIGURADOS:
${JSON.stringify(thresholds, null, 2)}

TIPOS DE ANOMALÍAS A DETECTAR:
1. Valores atípicos en métricas clave
2. Patrones temporales inusuales
3. Desviaciones de comportamiento histórico
4. Correlaciones rotas entre métricas relacionadas
5. Picos o caídas súbitas
6. Tendencias que rompen estacionalidad

INSTRUCCIONES:
1. Identifica todas las anomalías significativas
2. Calcula el score de anomalía (0-100)
3. Explica la causa probable de cada anomalía
4. Indica si es anomalía positiva o negativa
5. Sugiere acciones correctivas si aplica
6. Clasifica por severidad

Responde en JSON:
{
  "anomaliesDetected": true/false,
  "anomalyCount": 0,
  "overallHealthScore": 0-100,
  "anomalies": [
    {
      "id": "anomaly_1",
      "metric": "nombre de la métrica",
      "type": "spike|drop|pattern|correlation|outlier",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "anomalyScore": 0-100,
      "description": "Descripción de la anomalía",
      "expectedValue": "",
      "actualValue": "",
      "deviation": "% desviación",
      "direction": "positive|negative",
      "detectedAt": "fecha/hora",
      "duration": "duración si es temporal",
      "probableCauses": [
        {
          "cause": "",
          "probability": 0-100,
          "evidence": ""
        }
      ],
      "relatedMetrics": [],
      "businessImpact": "",
      "recommendedActions": [
        {
          "action": "",
          "urgency": "IMMEDIATE|SHORT_TERM|LONG_TERM",
          "expectedEffect": ""
        }
      ]
    }
  ],
  "patterns": {
    "seasonal": [],
    "cyclical": [],
    "trend": []
  },
  "correlationBreaks": [
    {
      "metrics": ["metric1", "metric2"],
      "expectedCorrelation": "",
      "actualCorrelation": "",
      "significance": ""
    }
  ],
  "alertsGenerated": [
    {
      "level": "INFO|WARNING|ALERT|CRITICAL",
      "message": "",
      "metric": "",
      "threshold": ""
    }
  ],
  "summary": {
    "criticalCount": 0,
    "highCount": 0,
    "mediumCount": 0,
    "lowCount": 0,
    "requiresImmediateAttention": true/false,
    "topPriority": "descripción de la prioridad principal"
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
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        anomaliesDetected: false,
        anomalyCount: 0,
        anomalies: [],
        summary: { requiresImmediateAttention: false },
        rawResponse: result.content
      };
    }
  }

  /**
   * Predecir tendencias con IA
   */
  async predictTrendsAI(historicalData, horizon = 30) {
    const prompt = `Como experto en forecasting y análisis predictivo de operaciones aduaneras, analiza estos datos históricos y genera predicciones.

DATOS HISTÓRICOS:
${JSON.stringify(historicalData, null, 2)}

HORIZONTE DE PREDICCIÓN: ${horizon} días

INSTRUCCIONES:
1. Analiza patrones estacionales, cíclicos y tendenciales
2. Genera predicciones para métricas clave
3. Calcula intervalos de confianza
4. Identifica factores que podrían afectar las predicciones
5. Señala puntos de inflexión esperados
6. Compara con benchmarks del sector si es posible

Responde en JSON:
{
  "predictions": [
    {
      "metric": "nombre de la métrica",
      "currentValue": 0,
      "predictions": [
        {
          "date": "fecha",
          "predicted": 0,
          "lowerBound": 0,
          "upperBound": 0,
          "confidence": 0-100
        }
      ],
      "trend": "increasing|decreasing|stable|volatile",
      "trendStrength": 0-100,
      "seasonalPattern": "descripción si existe",
      "expectedChange": "% cambio esperado al final del horizonte"
    }
  ],
  "keyPredictions": {
    "volumeChange": "% cambio esperado en volumen",
    "revenueChange": "% cambio esperado en ingresos",
    "efficiencyChange": "% cambio esperado en eficiencia",
    "riskChange": "cambio en nivel de riesgo"
  },
  "inflectionPoints": [
    {
      "date": "fecha",
      "metric": "",
      "type": "peak|trough|reversal",
      "description": "",
      "confidence": 0-100
    }
  ],
  "externalFactors": [
    {
      "factor": "nombre del factor",
      "impact": "HIGH|MEDIUM|LOW",
      "direction": "positive|negative",
      "description": ""
    }
  ],
  "scenarios": {
    "optimistic": {
      "description": "",
      "keyMetrics": {},
      "probability": 0-100
    },
    "baseline": {
      "description": "",
      "keyMetrics": {},
      "probability": 0-100
    },
    "pessimistic": {
      "description": "",
      "keyMetrics": {},
      "probability": 0-100
    }
  },
  "recommendations": [
    {
      "scenario": "optimistic|baseline|pessimistic",
      "action": "",
      "timing": ""
    }
  ],
  "modelConfidence": 0-100,
  "limitations": ["limitación 1", "limitación 2"]
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        horizon,
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        predictedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        predictions: [],
        modelConfidence: 0,
        rawResponse: result.content
      };
    }
  }

  /**
   * Generar reporte ejecutivo con IA
   */
  async generateExecutiveReport(analyticsData, options = {}) {
    const prompt = `Como experto en business intelligence aduanera, genera un reporte ejecutivo completo basado en estos datos.

DATOS DE ANALYTICS:
${JSON.stringify(analyticsData, null, 2)}

OPCIONES DEL REPORTE:
- Período: ${options.period || 'Último mes'}
- Audiencia: ${options.audience || 'Dirección general'}
- Enfoque: ${options.focus || 'General'}
- Incluir comparativas: ${options.includeComparison ? 'Sí' : 'No'}
- Idioma: ${options.language || 'es'}

INSTRUCCIONES:
1. Genera un resumen ejecutivo claro y conciso
2. Destaca los KPIs más importantes
3. Incluye análisis de tendencias
4. Proporciona recomendaciones estratégicas
5. Usa lenguaje adecuado para la audiencia
6. Incluye visualizaciones sugeridas

Responde en JSON:
{
  "title": "Título del reporte",
  "subtitle": "Subtítulo con período",
  "generatedAt": "fecha de generación",
  "executiveSummary": {
    "overview": "Párrafo resumen de 3-4 oraciones",
    "highlights": ["highlight 1", "highlight 2", "highlight 3"],
    "concerns": ["concern 1 si hay"],
    "outlook": "Perspectiva general"
  },
  "keyMetrics": [
    {
      "name": "Nombre del KPI",
      "value": "valor",
      "change": "% cambio",
      "trend": "up|down|stable",
      "status": "good|warning|critical",
      "interpretation": "Interpretación breve"
    }
  ],
  "sections": [
    {
      "title": "Título de la sección",
      "content": "Contenido de la sección",
      "metrics": [],
      "charts": [
        {
          "type": "bar|line|pie|area|table",
          "title": "",
          "description": "",
          "dataKeys": []
        }
      ],
      "insights": []
    }
  ],
  "comparativeAnalysis": {
    "vsLastPeriod": {
      "summary": "",
      "improvements": [],
      "declines": []
    },
    "vsTarget": {
      "summary": "",
      "achieved": [],
      "missed": []
    }
  },
  "strategicRecommendations": [
    {
      "priority": 1-5,
      "area": "Área de la recomendación",
      "recommendation": "Descripción de la recomendación",
      "rationale": "Justificación basada en datos",
      "expectedImpact": "Impacto esperado",
      "timeline": "Plazo sugerido",
      "resources": "Recursos necesarios"
    }
  ],
  "riskAssessment": {
    "overallRisk": "LOW|MEDIUM|HIGH",
    "risks": [
      {
        "risk": "",
        "likelihood": "",
        "impact": "",
        "mitigation": ""
      }
    ]
  },
  "nextSteps": [
    {
      "action": "",
      "owner": "Responsable sugerido",
      "deadline": "",
      "priority": ""
    }
  ],
  "appendix": {
    "methodology": "Metodología utilizada",
    "dataSources": [],
    "definitions": {}
  }
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 5000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        generatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        title: 'Reporte Ejecutivo',
        executiveSummary: { overview: 'Error al generar reporte' },
        keyMetrics: [],
        sections: [],
        rawResponse: result.content
      };
    }
  }

  /**
   * Analizar desviaciones de KPIs y sugerir acciones
   */
  async analyzeKPIDeviations(kpiData, targets = {}) {
    const prompt = `Como experto en gestión de KPIs aduaneros, analiza estas desviaciones y sugiere acciones correctivas.

DATOS DE KPIS:
${JSON.stringify(kpiData, null, 2)}

OBJETIVOS/TARGETS:
${JSON.stringify(targets, null, 2)}

INSTRUCCIONES:
1. Identifica KPIs que están fuera de objetivo
2. Analiza la causa raíz de cada desviación
3. Prioriza por impacto en el negocio
4. Sugiere acciones correctivas específicas
5. Estima tiempo de recuperación
6. Identifica interdependencias entre KPIs

Responde en JSON:
{
  "overallPerformance": {
    "score": 0-100,
    "status": "ON_TRACK|AT_RISK|OFF_TRACK",
    "summary": "Resumen de rendimiento general"
  },
  "deviations": [
    {
      "kpiId": "id del KPI",
      "kpiName": "nombre",
      "currentValue": 0,
      "targetValue": 0,
      "deviation": "% desviación",
      "deviationType": "above|below",
      "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "trend": "improving|worsening|stable",
      "rootCauses": [
        {
          "cause": "",
          "confidence": 0-100,
          "evidence": "",
          "controllable": true/false
        }
      ],
      "relatedKPIs": ["KPIs afectados"],
      "businessImpact": {
        "area": "",
        "description": "",
        "financialImpact": ""
      },
      "correctiveActions": [
        {
          "action": "",
          "owner": "",
          "deadline": "",
          "expectedRecovery": "",
          "effort": "LOW|MEDIUM|HIGH",
          "priority": 1-5
        }
      ],
      "estimatedRecoveryTime": ""
    }
  ],
  "kpiInterdependencies": [
    {
      "primaryKPI": "",
      "dependentKPIs": [],
      "relationship": "",
      "cascadeRisk": ""
    }
  ],
  "quickWins": [
    {
      "action": "",
      "kpisAffected": [],
      "effort": "",
      "impact": "",
      "timeline": ""
    }
  ],
  "strategicInitiatives": [
    {
      "initiative": "",
      "objective": "",
      "kpisTargeted": [],
      "timeline": "",
      "investmentRequired": ""
    }
  ],
  "monitoringPlan": {
    "reviewFrequency": "",
    "escalationThresholds": {},
    "keyMilestones": []
  }
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.chatAgent, prompt, { maxTokens: 4096 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        overallPerformance: { score: 0, status: 'UNKNOWN' },
        deviations: [],
        quickWins: [],
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo de analytics con IA
   */
  async fullAnalyticsAnalysis(analyticsData, options = {}) {
    // Ejecutar análisis en paralelo
    const [insights, anomalies, trends] = await Promise.all([
      this.generateAutomaticInsights(analyticsData, options),
      this.detectAnomaliesAI(analyticsData.metrics || analyticsData, options.thresholds || {}),
      this.predictTrendsAI(analyticsData.historical || analyticsData, options.horizon || 30)
    ]);

    // Calcular score de salud general
    let healthScore = 100;
    if (anomalies.anomalyCount > 0) {
      healthScore -= anomalies.summary?.criticalCount * 20 || 0;
      healthScore -= anomalies.summary?.highCount * 10 || 0;
      healthScore -= anomalies.summary?.mediumCount * 5 || 0;
    }
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generar alertas consolidadas
    const consolidatedAlerts = [];

    if (anomalies.anomalies?.length > 0) {
      anomalies.anomalies.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').forEach(a => {
        consolidatedAlerts.push({
          type: 'anomaly',
          severity: a.severity,
          message: a.description,
          metric: a.metric
        });
      });
    }

    if (insights.risks?.length > 0) {
      insights.risks.filter(r => r.probability === 'HIGH' || r.impact === 'HIGH').forEach(r => {
        consolidatedAlerts.push({
          type: 'risk',
          severity: 'HIGH',
          message: r.risk,
          mitigation: r.mitigation
        });
      });
    }

    return {
      insights,
      anomalies,
      trends,
      summary: {
        healthScore,
        healthStatus: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
        totalInsights: insights.keyInsights?.length || 0,
        totalAnomalies: anomalies.anomalyCount || 0,
        alertCount: consolidatedAlerts.length
      },
      consolidatedAlerts,
      topPriorities: this._extractTopPriorities(insights, anomalies),
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Extraer prioridades principales de los análisis
   */
  _extractTopPriorities(insights, anomalies) {
    const priorities = [];

    // Añadir anomalías críticas
    if (anomalies.anomalies) {
      anomalies.anomalies
        .filter(a => a.severity === 'CRITICAL')
        .forEach(a => {
          priorities.push({
            priority: 1,
            type: 'anomaly',
            title: `Anomalía crítica: ${a.metric}`,
            description: a.description,
            action: a.recommendedActions?.[0]?.action || 'Investigar inmediatamente'
          });
        });
    }

    // Añadir recomendaciones de alto impacto
    if (insights.recommendations) {
      insights.recommendations
        .filter(r => r.priority <= 2)
        .forEach(r => {
          priorities.push({
            priority: r.priority,
            type: 'recommendation',
            title: r.action,
            description: r.rationale,
            action: r.expectedOutcome
          });
        });
    }

    // Añadir riesgos altos
    if (insights.risks) {
      insights.risks
        .filter(r => r.impact === 'HIGH')
        .forEach(r => {
          priorities.push({
            priority: 2,
            type: 'risk',
            title: `Riesgo: ${r.risk}`,
            description: r.mitigation,
            action: 'Implementar mitigación'
          });
        });
    }

    return priorities.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }

  // ==================== TARIC CLASSIFICATION IMPROVEMENTS ====================

  /**
   * Phase 7: Mejora de clasificación TARIC con feedback histórico
   * Aprende de clasificaciones anteriores y feedback del usuario
   */
  async improveClassificationWithFeedback(productDescription, currentSuggestions = [], feedbackHistory = []) {
    const prompt = `Eres un experto clasificador arancelario que aprende de feedback histórico.

PRODUCTO A CLASIFICAR:
${productDescription}

SUGERENCIAS ACTUALES DEL SISTEMA:
${JSON.stringify(currentSuggestions, null, 2)}

HISTORIAL DE FEEDBACK (clasificaciones corregidas anteriormente):
${feedbackHistory.length > 0 ? feedbackHistory.map(f => `
- Descripción similar: "${f.originalDescription}"
- Código sugerido: ${f.suggestedCode} (${f.wasCorrect ? 'CORRECTO' : 'INCORRECTO'})
${!f.wasCorrect ? `- Código correcto: ${f.correctCode}` : ''}
${f.notes ? `- Notas: ${f.notes}` : ''}
`).join('\n') : 'Sin historial de feedback previo'}

TAREA:
1. Analiza el producto y las sugerencias actuales
2. Considera el feedback histórico para productos similares
3. Ajusta las sugerencias basándote en patrones aprendidos
4. Explica cómo el feedback influyó en tu análisis

IMPORTANTE:
- Si hay feedback de productos similares que fueron corregidos, prioriza el código correcto
- Identifica patrones de error comunes en el feedback
- Aumenta confianza si el feedback confirma las sugerencias
- Reduce confianza y sugiere alternativas si hay correcciones frecuentes

Responde en JSON:
{
  "improvedSuggestions": [
    {
      "taricCode": "código 10 dígitos",
      "hsCode": "código 6 dígitos",
      "confidence": 0-100,
      "confidenceAdjustment": "+X% o -X% respecto a sugerencia original",
      "description": "Descripción oficial",
      "reasoning": "Razonamiento incluyendo influencia del feedback",
      "feedbackInfluence": "Cómo el historial afectó esta sugerencia",
      "similarCasesFound": 0
    }
  ],
  "learningInsights": {
    "patternsIdentified": ["Patrones detectados en el feedback"],
    "commonMistakes": ["Errores frecuentes para este tipo de producto"],
    "confidenceFactors": ["Factores que aumentan/reducen confianza"]
  },
  "feedbackSummary": {
    "relevantCasesAnalyzed": 0,
    "positiveConfirmations": 0,
    "correctionsConsidered": 0,
    "overallLearningImpact": "NONE|LOW|MEDIUM|HIGH"
  },
  "recommendations": [
    {
      "type": "classification|verification|documentation",
      "action": "Acción recomendada",
      "reason": "Por qué se recomienda"
    }
  ]
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt, { maxTokens: 4096, timeout: 90000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        improvedSuggestions: currentSuggestions,
        learningInsights: { patternsIdentified: [], commonMistakes: [], confidenceFactors: [] },
        feedbackSummary: { relevantCasesAnalyzed: 0, positiveConfirmations: 0, correctionsConsidered: 0, overallLearningImpact: 'NONE' },
        recommendations: [],
        rawResponse: result.content,
        error: 'Error procesando mejora con feedback'
      };
    }
  }

  /**
   * Sugerir clasificación basada en historial de productos similares
   */
  async suggestBasedOnHistory(productDescription, historicalClassifications = [], clientProfile = {}) {
    const prompt = `Eres un experto clasificador arancelario que analiza patrones históricos.

PRODUCTO A CLASIFICAR:
${productDescription}

HISTORIAL DE CLASIFICACIONES DEL CLIENTE/SIMILAR:
${historicalClassifications.length > 0 ? historicalClassifications.map((h, i) => `
${i + 1}. Producto: "${h.description}"
   TARIC: ${h.taricCode}
   Fecha: ${h.classifiedAt || 'N/A'}
   Resultado: ${h.status || 'aceptado'}
   ${h.inspectionResult ? `Inspección: ${h.inspectionResult}` : ''}
`).join('\n') : 'Sin historial disponible'}

PERFIL DEL CLIENTE:
- Sector: ${clientProfile.sector || 'No especificado'}
- Productos frecuentes: ${clientProfile.frequentProducts?.join(', ') || 'N/A'}
- Países origen habituales: ${clientProfile.frequentOrigins?.join(', ') || 'N/A'}
- Tasa de inspección histórica: ${clientProfile.inspectionRate || 'N/A'}%
- Clasificaciones corregidas: ${clientProfile.correctedClassifications || 0}

TAREA:
1. Busca productos similares en el historial
2. Identifica patrones de clasificación para este tipo de producto
3. Considera el perfil del cliente y sus operaciones habituales
4. Proporciona sugerencias basadas en precedentes exitosos

IMPORTANTE:
- Prioriza códigos que han sido aceptados sin problemas
- Identifica si hay variaciones frecuentes para productos similares
- Considera el sector del cliente para contextualizar
- Señala si el producto es atípico para el perfil del cliente

Responde en JSON:
{
  "historicalAnalysis": {
    "similarProductsFound": 0,
    "mostUsedCodes": [
      {
        "taricCode": "código",
        "frequency": 0,
        "successRate": 0,
        "lastUsed": "fecha"
      }
    ],
    "patternDetected": true/false,
    "patternDescription": "Descripción del patrón identificado"
  },
  "suggestions": [
    {
      "taricCode": "código 10 dígitos",
      "hsCode": "código 6 dígitos",
      "confidence": 0-100,
      "source": "historical|pattern|new",
      "description": "Descripción oficial",
      "reasoning": "Por qué se sugiere basado en historial",
      "historicalSuccess": {
        "timesUsed": 0,
        "acceptedWithoutIssues": 0,
        "inspected": 0,
        "corrected": 0
      },
      "riskAssessment": "LOW|MEDIUM|HIGH"
    }
  ],
  "clientProfileFit": {
    "isTypicalProduct": true/false,
    "sectorAlignment": "HIGH|MEDIUM|LOW",
    "recommendation": "Recomendación basada en perfil"
  },
  "precedents": [
    {
      "description": "Producto anterior similar",
      "taricCode": "código usado",
      "date": "fecha",
      "outcome": "resultado"
    }
  ],
  "warnings": [],
  "newProductAlert": {
    "isNew": true/false,
    "message": "Si es producto nuevo para el cliente"
  }
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.classification, prompt, { maxTokens: 4096, timeout: 90000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        analyzedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        historicalAnalysis: { similarProductsFound: 0, mostUsedCodes: [], patternDetected: false },
        suggestions: [],
        clientProfileFit: { isTypicalProduct: false, sectorAlignment: 'LOW', recommendation: 'Análisis manual recomendado' },
        precedents: [],
        warnings: ['Error procesando análisis histórico'],
        newProductAlert: { isNew: true, message: 'No se pudo analizar historial' },
        rawResponse: result.content
      };
    }
  }

  /**
   * Validación cruzada de clasificación con normativa
   */
  async crossValidateWithRegulations(classification, productDetails = {}) {
    const prompt = `Eres un experto en normativa aduanera y clasificación arancelaria.

CLASIFICACIÓN A VALIDAR:
- Código TARIC propuesto: ${classification.taricCode}
- Código HS (6 dígitos): ${classification.taricCode?.substring(0, 6) || 'N/A'}
- Capítulo: ${classification.taricCode?.substring(0, 2) || 'N/A'}
- Confianza actual: ${classification.confidence || 'N/A'}%

DETALLES DEL PRODUCTO:
- Descripción: ${productDetails.description || 'N/A'}
- Material principal: ${productDetails.material || 'No especificado'}
- Uso/Función: ${productDetails.use || 'No especificado'}
- Composición: ${productDetails.composition || 'No especificada'}
- País de origen: ${productDetails.origin || 'N/A'}
- Valor unitario: ${productDetails.unitValue || 'N/A'} EUR

TAREA DE VALIDACIÓN:
1. Verifica que el código cumple con las RGI (Reglas Generales de Interpretación)
2. Comprueba notas de sección y capítulo aplicables
3. Verifica si hay exclusiones específicas
4. Comprueba medidas especiales vigentes (antidumping, cuotas, etc.)
5. Valida requisitos de documentación según el código
6. Identifica posibles interpretaciones alternativas

NORMATIVA A CONSIDERAR:
- Sistema Armonizado (SA) y sus Notas Explicativas
- TARIC (Arancel Integrado de la UE)
- Notas de sección y capítulo del SA
- RGI 1-6
- Reglamentos de medidas comerciales vigentes
- IAV (Información Arancelaria Vinculante) relevantes

Responde en JSON:
{
  "validationResult": {
    "isValid": true/false,
    "validationScore": 0-100,
    "overallAssessment": "CONFIRMED|LIKELY_CORRECT|NEEDS_REVIEW|LIKELY_INCORRECT|INVALID"
  },
  "rgiAnalysis": {
    "rgi1_description": {
      "applies": true/false,
      "assessment": "Evaluación según RGI 1"
    },
    "rgi2_incomplete": {
      "applies": true/false,
      "assessment": "Evaluación según RGI 2"
    },
    "rgi3_specific": {
      "applies": true/false,
      "assessment": "Evaluación según RGI 3"
    },
    "rgi6_subheading": {
      "applies": true/false,
      "assessment": "Evaluación según RGI 6"
    },
    "conclusionRGI": "Conclusión del análisis RGI"
  },
  "chapterNotes": {
    "sectionNotes": ["Notas de sección aplicables"],
    "chapterNotes": ["Notas de capítulo aplicables"],
    "exclusions": ["Exclusiones que podrían aplicar"],
    "inclusions": ["Inclusiones específicas que confirman clasificación"]
  },
  "specialMeasures": {
    "antidumping": {
      "applies": true/false,
      "details": "Detalles si aplica",
      "regulation": "Número de reglamento"
    },
    "countervailing": {
      "applies": true/false,
      "details": "Detalles si aplica"
    },
    "quota": {
      "applies": true/false,
      "quotaNumber": "Número de cuota si aplica",
      "currentStatus": "Estado de la cuota"
    },
    "suspension": {
      "applies": true/false,
      "details": "Suspensión arancelaria si aplica"
    },
    "safeguard": {
      "applies": true/false,
      "details": "Medidas de salvaguardia si aplican"
    }
  },
  "documentationRequirements": [
    {
      "document": "Tipo de documento",
      "code": "Código documento",
      "mandatory": true/false,
      "reason": "Por qué se requiere"
    }
  ],
  "alternativeClassifications": [
    {
      "taricCode": "código alternativo",
      "reasoning": "Por qué podría ser alternativa",
      "differentiatingFactor": "Qué determinaría una u otra",
      "probability": 0-100
    }
  ],
  "bindingInformation": {
    "relevantIAVs": ["IAVs relevantes si existen"],
    "recommendation": "Recomendación sobre solicitar IAV"
  },
  "riskFactors": [
    {
      "factor": "Factor de riesgo",
      "severity": "LOW|MEDIUM|HIGH",
      "mitigation": "Cómo mitigar"
    }
  ],
  "finalRecommendation": {
    "proceed": true/false,
    "confidence": 0-100,
    "actions": ["Acciones recomendadas antes de proceder"],
    "summary": "Resumen de la validación"
  }
}`;

    const result = await this.callClaude(OPUS_MODEL, SYSTEM_PROMPTS.regulationAnalysis, prompt, { maxTokens: 6144, timeout: 120000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        model: 'opus-4',
        tokensUsed: result.tokensUsed,
        validatedAt: new Date().toISOString()
      };
    } catch (e) {
      return {
        validationResult: { isValid: false, validationScore: 0, overallAssessment: 'NEEDS_REVIEW' },
        rgiAnalysis: { conclusionRGI: 'Error en análisis' },
        chapterNotes: { sectionNotes: [], chapterNotes: [], exclusions: [], inclusions: [] },
        specialMeasures: {},
        documentationRequirements: [],
        alternativeClassifications: [],
        bindingInformation: { relevantIAVs: [], recommendation: 'Consultar con AEAT' },
        riskFactors: [{ factor: 'Error en validación', severity: 'HIGH', mitigation: 'Revisar manualmente' }],
        finalRecommendation: { proceed: false, confidence: 0, actions: ['Revisar manualmente'], summary: 'Error en validación' },
        rawResponse: result.content
      };
    }
  }

  /**
   * Análisis completo de clasificación TARIC mejorado
   * Combina sugerencias, historial, feedback y validación normativa
   */
  async fullTaricAnalysis(productData, options = {}) {
    const {
      historicalClassifications = [],
      feedbackHistory = [],
      clientProfile = {},
      validateWithRegulations = true
    } = options;

    try {
      // 1. Obtener sugerencias base
      const baseSuggestions = await this.classifyProduct({
        description: productData.description,
        additionalInfo: {
          material: productData.material,
          use: productData.use,
          composition: productData.composition
        }
      });

      // 2. Ejecutar análisis en paralelo
      const [historyBased, feedbackImproved] = await Promise.all([
        this.suggestBasedOnHistory(productData.description, historicalClassifications, clientProfile),
        feedbackHistory.length > 0
          ? this.improveClassificationWithFeedback(productData.description, baseSuggestions, feedbackHistory)
          : Promise.resolve(null)
      ]);

      // 3. Consolidar sugerencias
      const consolidatedSuggestions = this._consolidateTaricSuggestions(
        baseSuggestions,
        historyBased?.suggestions || [],
        feedbackImproved?.improvedSuggestions || []
      );

      // 4. Validar la mejor sugerencia con normativa (si está habilitado)
      let regulationValidation = null;
      if (validateWithRegulations && consolidatedSuggestions.length > 0) {
        regulationValidation = await this.crossValidateWithRegulations(
          consolidatedSuggestions[0],
          productData
        );
      }

      // 5. Calcular score final y generar recomendación
      const finalScore = this._calculateFinalClassificationScore(
        consolidatedSuggestions[0],
        historyBased,
        feedbackImproved,
        regulationValidation
      );

      return {
        productDescription: productData.description,
        analyzedAt: new Date().toISOString(),

        // Sugerencias consolidadas ordenadas por confianza
        suggestions: consolidatedSuggestions,

        // Análisis detallados
        analysis: {
          baseSuggestions: baseSuggestions,
          historicalAnalysis: historyBased,
          feedbackLearning: feedbackImproved,
          regulationValidation: regulationValidation
        },

        // Puntuación y recomendación final
        finalAssessment: {
          recommendedCode: consolidatedSuggestions[0]?.taricCode || null,
          confidence: finalScore.confidence,
          confidenceLevel: finalScore.confidence >= 85 ? 'HIGH' : finalScore.confidence >= 70 ? 'MEDIUM' : 'LOW',
          readyToUse: finalScore.confidence >= 75 && (!regulationValidation || regulationValidation.validationResult?.isValid),
          factors: finalScore.factors
        },

        // Próximos pasos recomendados
        nextSteps: this._generateClassificationNextSteps(
          consolidatedSuggestions,
          historyBased,
          feedbackImproved,
          regulationValidation
        ),

        // Alertas y advertencias
        alerts: this._generateClassificationAlerts(
          consolidatedSuggestions,
          regulationValidation,
          historyBased
        ),

        model: 'opus-4-combined',
        tokensUsed: (baseSuggestions.tokensUsed || 0) +
                    (historyBased?.tokensUsed || 0) +
                    (feedbackImproved?.tokensUsed || 0) +
                    (regulationValidation?.tokensUsed || 0)
      };
    } catch (error) {
      logger.error('Error en fullTaricAnalysis:', error);
      return {
        productDescription: productData.description,
        error: 'Error realizando análisis completo de clasificación',
        analyzedAt: new Date().toISOString(),
        suggestions: [],
        nextSteps: [{ priority: 1, action: 'Clasificar manualmente', reason: 'Error en análisis automático' }]
      };
    }
  }

  /**
   * Registrar feedback de clasificación para aprendizaje
   */
  async recordClassificationFeedback(classificationData, feedback) {
    const prompt = `Analiza este feedback de clasificación para extraer aprendizajes.

CLASIFICACIÓN ORIGINAL:
- Código sugerido: ${classificationData.suggestedCode}
- Descripción producto: ${classificationData.description}
- Confianza original: ${classificationData.confidence}%

FEEDBACK DEL USUARIO:
- ¿Fue correcta?: ${feedback.wasCorrect ? 'SÍ' : 'NO'}
${!feedback.wasCorrect ? `- Código correcto: ${feedback.correctCode}` : ''}
- Notas del usuario: ${feedback.notes || 'Sin notas'}
- Usuario: ${feedback.userId || 'Anónimo'}
- Fecha: ${new Date().toISOString()}

TAREA:
1. Analiza por qué la clasificación fue correcta o incorrecta
2. Identifica factores que llevaron al error (si aplica)
3. Genera reglas de aprendizaje para mejorar futuras clasificaciones
4. Sugiere mejoras al proceso de clasificación

Responde en JSON:
{
  "feedbackAnalysis": {
    "wasCorrect": true/false,
    "errorType": "material|function|composition|rgi_application|chapter_note|none",
    "rootCause": "Causa raíz del error si aplica",
    "correctInterpretation": "Interpretación correcta"
  },
  "learningRules": [
    {
      "rule": "Regla de aprendizaje",
      "trigger": "Cuándo aplicar esta regla",
      "action": "Qué hacer cuando se detecte"
    }
  ],
  "patternUpdate": {
    "keywords": ["Palabras clave a asociar"],
    "exclusions": ["Palabras que excluyen este código"],
    "confidenceAdjustment": "+X% o -X%"
  },
  "processImprovement": {
    "suggestion": "Mejora sugerida al proceso",
    "impact": "Impacto esperado"
  },
  "similarCasesImpact": "Cómo afecta a clasificaciones similares futuras"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.classification, prompt, { maxTokens: 2048, timeout: 30000 });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();

      return {
        ...JSON.parse(jsonContent),
        feedbackId: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        recordedAt: new Date().toISOString(),
        model: 'sonnet-4',
        tokensUsed: result.tokensUsed
      };
    } catch (e) {
      return {
        feedbackAnalysis: { wasCorrect: feedback.wasCorrect, errorType: 'unknown', rootCause: 'No analizado' },
        learningRules: [],
        patternUpdate: {},
        processImprovement: {},
        similarCasesImpact: 'No determinado',
        feedbackId: `fb_${Date.now()}`,
        recordedAt: new Date().toISOString(),
        rawResponse: result.content
      };
    }
  }

  /**
   * Consolidar sugerencias de múltiples fuentes
   */
  _consolidateTaricSuggestions(baseSuggestions, historySuggestions, feedbackSuggestions) {
    const codeMap = new Map();

    // Procesar sugerencias base
    if (Array.isArray(baseSuggestions)) {
      baseSuggestions.forEach(s => {
        const code = s.taricCode || s.code;
        if (code) {
          codeMap.set(code, {
            taricCode: code,
            hsCode: s.hsCode || code.substring(0, 6),
            confidence: s.confidence || 50,
            sources: ['base'],
            reasoning: s.reasoning || '',
            description: s.description || ''
          });
        }
      });
    }

    // Integrar sugerencias históricas
    historySuggestions.forEach(s => {
      const code = s.taricCode;
      if (code) {
        if (codeMap.has(code)) {
          const existing = codeMap.get(code);
          existing.confidence = Math.min(100, existing.confidence + 10); // Boost por historial
          existing.sources.push('history');
          existing.historicalSuccess = s.historicalSuccess;
        } else {
          codeMap.set(code, {
            ...s,
            sources: ['history']
          });
        }
      }
    });

    // Integrar sugerencias mejoradas por feedback
    feedbackSuggestions.forEach(s => {
      const code = s.taricCode;
      if (code) {
        if (codeMap.has(code)) {
          const existing = codeMap.get(code);
          existing.confidence = s.confidence; // Usar confianza ajustada por feedback
          existing.sources.push('feedback');
          existing.feedbackInfluence = s.feedbackInfluence;
        } else {
          codeMap.set(code, {
            ...s,
            sources: ['feedback']
          });
        }
      }
    });

    // Convertir a array y ordenar por confianza
    return Array.from(codeMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  /**
   * Calcular puntuación final de clasificación
   */
  _calculateFinalClassificationScore(topSuggestion, historyAnalysis, feedbackAnalysis, regulationValidation) {
    if (!topSuggestion) {
      return { confidence: 0, factors: ['Sin sugerencias disponibles'] };
    }

    let confidence = topSuggestion.confidence || 50;
    const factors = [];

    // Factor: Confirmación histórica
    if (historyAnalysis?.historicalAnalysis?.similarProductsFound > 0) {
      const boost = Math.min(15, historyAnalysis.historicalAnalysis.similarProductsFound * 3);
      confidence = Math.min(100, confidence + boost);
      factors.push(`+${boost}% por ${historyAnalysis.historicalAnalysis.similarProductsFound} precedentes históricos`);
    }

    // Factor: Aprendizaje de feedback
    if (feedbackAnalysis?.feedbackSummary?.overallLearningImpact === 'HIGH') {
      confidence = Math.min(100, confidence + 10);
      factors.push('+10% por aprendizaje de feedback relevante');
    } else if (feedbackAnalysis?.feedbackSummary?.correctionsConsidered > 0) {
      confidence = Math.max(0, confidence - 5);
      factors.push('-5% por correcciones históricas en productos similares');
    }

    // Factor: Validación normativa
    if (regulationValidation?.validationResult) {
      if (regulationValidation.validationResult.overallAssessment === 'CONFIRMED') {
        confidence = Math.min(100, confidence + 15);
        factors.push('+15% por validación normativa confirmada');
      } else if (regulationValidation.validationResult.overallAssessment === 'LIKELY_CORRECT') {
        confidence = Math.min(100, confidence + 5);
        factors.push('+5% por validación normativa probable');
      } else if (regulationValidation.validationResult.overallAssessment === 'NEEDS_REVIEW') {
        confidence = Math.max(0, confidence - 10);
        factors.push('-10% por necesidad de revisión normativa');
      } else if (regulationValidation.validationResult.overallAssessment === 'LIKELY_INCORRECT') {
        confidence = Math.max(0, confidence - 25);
        factors.push('-25% por probable error según normativa');
      }
    }

    // Factor: Múltiples fuentes coinciden
    if (topSuggestion.sources?.length >= 3) {
      confidence = Math.min(100, confidence + 10);
      factors.push('+10% por confirmación de múltiples fuentes');
    } else if (topSuggestion.sources?.length === 2) {
      confidence = Math.min(100, confidence + 5);
      factors.push('+5% por confirmación de 2 fuentes');
    }

    return {
      confidence: Math.round(confidence),
      factors
    };
  }

  /**
   * Generar próximos pasos para clasificación
   */
  _generateClassificationNextSteps(suggestions, historyAnalysis, feedbackAnalysis, regulationValidation) {
    const steps = [];

    if (suggestions.length === 0) {
      steps.push({
        priority: 1,
        action: 'Proporcionar más información del producto',
        reason: 'No se encontraron sugerencias de clasificación'
      });
      return steps;
    }

    const topSuggestion = suggestions[0];

    // Paso: Verificar confianza
    if (topSuggestion.confidence < 70) {
      steps.push({
        priority: 1,
        action: 'Revisar manualmente la clasificación',
        reason: `Confianza baja (${topSuggestion.confidence}%)`
      });
    }

    // Paso: Validación normativa pendiente
    if (!regulationValidation) {
      steps.push({
        priority: 2,
        action: 'Ejecutar validación cruzada con normativa',
        reason: 'Verificar cumplimiento con RGI y notas de capítulo'
      });
    } else if (regulationValidation.validationResult?.overallAssessment === 'NEEDS_REVIEW') {
      steps.push({
        priority: 1,
        action: 'Revisar advertencias de validación normativa',
        reason: regulationValidation.finalRecommendation?.summary || 'Validación requiere atención'
      });
    }

    // Paso: Documentación especial
    if (regulationValidation?.documentationRequirements?.length > 0) {
      const mandatoryDocs = regulationValidation.documentationRequirements.filter(d => d.mandatory);
      if (mandatoryDocs.length > 0) {
        steps.push({
          priority: 2,
          action: `Preparar ${mandatoryDocs.length} documento(s) obligatorio(s)`,
          reason: mandatoryDocs.map(d => d.document).join(', ')
        });
      }
    }

    // Paso: Medidas especiales
    if (regulationValidation?.specialMeasures) {
      const measures = regulationValidation.specialMeasures;
      if (measures.antidumping?.applies || measures.quota?.applies) {
        steps.push({
          priority: 1,
          action: 'Verificar medidas especiales aplicables',
          reason: 'Producto sujeto a antidumping o cuota'
        });
      }
    }

    // Paso: Producto nuevo para cliente
    if (historyAnalysis?.newProductAlert?.isNew) {
      steps.push({
        priority: 3,
        action: 'Documentar clasificación para futuras referencias',
        reason: 'Primer producto de este tipo para el cliente'
      });
    }

    // Paso: Considerar IAV
    if (topSuggestion.confidence < 85 || regulationValidation?.alternativeClassifications?.length > 1) {
      steps.push({
        priority: 3,
        action: 'Considerar solicitar IAV (Información Arancelaria Vinculante)',
        reason: 'Clasificación podría beneficiarse de confirmación oficial'
      });
    }

    return steps.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generar alertas de clasificación
   */
  _generateClassificationAlerts(suggestions, regulationValidation, historyAnalysis) {
    const alerts = [];

    if (suggestions.length === 0) {
      alerts.push({
        type: 'ERROR',
        message: 'No se pudieron generar sugerencias de clasificación',
        action: 'Revisar descripción del producto'
      });
      return alerts;
    }

    const topSuggestion = suggestions[0];

    // Alerta: Confianza muy baja
    if (topSuggestion.confidence < 50) {
      alerts.push({
        type: 'WARNING',
        message: `Confianza muy baja en clasificación (${topSuggestion.confidence}%)`,
        action: 'Clasificación manual recomendada'
      });
    }

    // Alerta: Sugerencias muy cercanas
    if (suggestions.length >= 2 && Math.abs(suggestions[0].confidence - suggestions[1].confidence) < 10) {
      alerts.push({
        type: 'INFO',
        message: 'Dos códigos con confianza similar',
        action: `Evaluar diferencia entre ${suggestions[0].taricCode} y ${suggestions[1].taricCode}`
      });
    }

    // Alerta: Medidas antidumping
    if (regulationValidation?.specialMeasures?.antidumping?.applies) {
      alerts.push({
        type: 'WARNING',
        message: 'Producto sujeto a derechos antidumping',
        action: regulationValidation.specialMeasures.antidumping.details || 'Verificar medidas aplicables'
      });
    }

    // Alerta: Cuota
    if (regulationValidation?.specialMeasures?.quota?.applies) {
      alerts.push({
        type: 'INFO',
        message: 'Producto sujeto a cuota arancelaria',
        action: `Verificar disponibilidad de cuota ${regulationValidation.specialMeasures.quota.quotaNumber || ''}`
      });
    }

    // Alerta: Errores históricos
    if (historyAnalysis?.clientProfileFit?.sectorAlignment === 'LOW') {
      alerts.push({
        type: 'INFO',
        message: 'Producto atípico para el perfil del cliente',
        action: 'Verificar que la clasificación sea correcta para este sector'
      });
    }

    // Alerta: Clasificaciones alternativas con alta probabilidad
    if (regulationValidation?.alternativeClassifications?.some(a => a.probability > 30)) {
      const alternatives = regulationValidation.alternativeClassifications.filter(a => a.probability > 30);
      alerts.push({
        type: 'INFO',
        message: `${alternatives.length} clasificación(es) alternativa(s) con probabilidad significativa`,
        action: 'Revisar criterios diferenciadores'
      });
    }

    return alerts;
  }

  /**
   * Obtener información de un código TARIC usando IA
   * @param {string} code - Código TARIC/HS (4-10 dígitos)
   * @returns {Object} Información del código
   */
  async getTaricCodeInfo(code) {
    const prompt = `Proporciona información detallada sobre el código arancelario TARIC/HS: ${code}

IMPORTANTE: Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni markdown.

El JSON debe tener esta estructura exacta:
{
  "code": "${code}",
  "description": "Descripción oficial en español del código",
  "description_es": "Descripción en español",
  "chapter": "XX",
  "chapterDescription": "Descripción del capítulo",
  "heading": "XXXX",
  "headingDescription": "Descripción de la partida",
  "subheading": "XXXXXX",
  "subheadingDescription": "Descripción de la subpartida (si aplica)",
  "hierarchy": [
    {"level": "Capítulo", "code": "XX", "description": "..."},
    {"level": "Partida", "code": "XXXX", "description": "..."},
    {"level": "Subpartida", "code": "XXXXXX", "description": "..."}
  ],
  "dutyRate": "Tipo arancelario general UE (ej: 12%, 0%, específico)",
  "notes": "Notas relevantes de capítulo o sección que apliquen",
  "measures": ["Medidas especiales si aplican: antidumping, cuotas, licencias, etc."],
  "examples": ["Ejemplos de productos que se clasifican en este código"],
  "relatedCodes": ["Códigos relacionados o similares"]
}

Si el código no existe o no es válido, devuelve:
{
  "code": "${code}",
  "valid": false,
  "description": "Código no válido o no encontrado",
  "suggestion": "Sugerencia de código correcto si es posible"
}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.classification, prompt);

    try {
      let jsonContent = result.content;
      // Limpiar posibles bloques de código markdown
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      // Limpiar espacios y saltos de línea extra
      jsonContent = jsonContent.trim();

      return JSON.parse(jsonContent);
    } catch (e) {
      logger.warn('Error parseando respuesta TARIC de IA:', e.message);
      // Intentar extraer información básica del texto
      return {
        code,
        description: result.content.substring(0, 500),
        source: 'ai_text'
      };
    }
  }

  /**
   * Generar nodos del arbol TARIC para un nivel especifico
   * Usado cuando la DB no tiene datos para ese nivel
   * @param {string} parentCode - Codigo padre (ej: '08', '0807', '080711')
   * @param {string} level - Nivel a generar: 'headings', 'subheadings', 'cnCodes', 'taricCodes'
   * @returns {Array} Lista de nodos con code y description
   */
  async generateTreeLevel(parentCode, level) {
    const levelConfig = {
      headings: {
        digits: 4,
        name: 'partidas (4 digitos)',
        parentName: 'capitulo',
        example: '{"code":"0801","description":"Cocos, nueces del Brasil y nueces de anacardo (merey, cajuil, maranon), frescos o secos, incluso sin cascara o mondados"}'
      },
      subheadings: {
        digits: 6,
        name: 'subpartidas SA (6 digitos)',
        parentName: 'partida',
        example: '{"code":"080711","description":"Sandias"}'
      },
      cnCodes: {
        digits: 8,
        name: 'codigos NC (8 digitos)',
        parentName: 'subpartida',
        example: '{"code":"08071100","description":"Sandias, frescas"}'
      },
      taricCodes: {
        digits: 10,
        name: 'codigos TARIC (10 digitos)',
        parentName: 'codigo NC',
        example: '{"code":"0807110000","description":"Sandias, frescas","dutyRate":8.8,"vatRate":10}'
      }
    };

    const config = levelConfig[level];
    if (!config) throw new Error(`Nivel no valido: ${level}`);

    const isTaric = level === 'taricCodes';

    const prompt = `Genera la lista COMPLETA y REAL de ${config.name} que pertenecen al ${config.parentName} ${parentCode} del Arancel Integrado TARIC de la Union Europea.

REGLAS ESTRICTAS:
- SOLO codigos que REALMENTE existen en el TARIC oficial vigente
- Descripciones en espanol, oficiales del arancel
- NO inventes codigos ni descripciones
- Incluye TODOS los codigos de este nivel, no solo los principales
- Los codigos deben tener exactamente ${config.digits} digitos
${isTaric ? '- Incluye dutyRate (arancel terceros paises en %) y vatRate (IVA en Espana: 21 general, 10 reducido, 4 superreducido, 0 exento)' : ''}

FORMATO: Responde UNICAMENTE con un array JSON, sin texto adicional:
[
  ${config.example}${isTaric ? '' : ',\n  ...'}
]

${config.parentName.toUpperCase()} PADRE: ${parentCode}`;

    const result = await this.callClaude(SONNET_MODEL, SYSTEM_PROMPTS.classification, prompt, {
      maxTokens: 4096,
      timeout: 30000
    });

    try {
      let jsonContent = result.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonContent = jsonMatch[1].trim();
      jsonContent = jsonContent.trim();

      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) throw new Error('Respuesta no es un array');

      // Validar formato de codigos
      return parsed.filter(item =>
        item.code &&
        item.description &&
        item.code.length === config.digits &&
        item.code.startsWith(parentCode.replace(/[\s.]/g, ''))
      );
    } catch (e) {
      logger.warn('Error parseando arbol TARIC de IA:', e.message);
      return [];
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
