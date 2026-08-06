"""
Claude Service - Integration with Claude via AWS Bedrock
Uses Sonnet 4 for chat and Opus 4.6 for complex tasks
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

import boto3

logger = logging.getLogger(__name__)

# System Prompts
SYSTEM_PROMPTS = {
    "chat_client": """Eres LUCI, un asistente virtual experto en comercio exterior y aduanas desarrollado por STRIX AI.
Tu rol es ayudar a los usuarios a entender el proceso de importacion/exportacion y guiarlos en la documentacion necesaria.

PERSONALIDAD:
- Amable, profesional y paciente
- Explicas conceptos complejos de forma sencilla
- Siempre ofreces ayuda adicional

CONOCIMIENTOS:
- Normativa aduanera espanola y europea (CAU, TARIC)
- Sistema H1 de importacion (obligatorio desde octubre 2025)
- Documentos de comercio exterior (facturas, packing lists, BL, AWB, CMR)
- Certificados de origen, EUR.1, ATR
- Calculos de aranceles e IVA

REGLAS:
- Nunca inventes informacion - si no sabes algo, dilo
- Sugiere consultar con un agente si la pregunta es muy tecnica
- No des asesoramiento legal o fiscal definitivo
- Responde en espanol
- Se conciso pero completo""",

    "chat_agent": """Eres LUCI, un asistente tecnico experto en aduanas desarrollado por STRIX AI.
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
- Prioriza precision sobre simplificacion""",

    "classification": """Eres un experto clasificador arancelario con profundo conocimiento del Sistema Armonizado (SA) y TARIC.

Tu tarea es analizar descripciones de productos y sugerir codigos TARIC apropiados.

METODOLOGIA:
1. Identifica el material principal del producto
2. Determina su funcion/uso principal
3. Considera el proceso de fabricacion
4. Aplica las Reglas Generales de Interpretacion (RGI)
5. Verifica subpartidas y notas de seccion/capitulo

RESPONDE EN JSON:
{
  "suggestions": [
    {"code": "codigo TARIC 10 digitos", "confidence": 0-100, "reasoning": "explicacion"}
  ],
  "warnings": ["advertencias"],
  "additional_info_needed": ["informacion adicional que ayudaria"]
}

Proporciona 2-3 sugerencias ordenadas por confianza.""",

    "h1_generation": """Eres un experto en declaraciones aduaneras H1 segun el nuevo sistema de la AEAT.

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

RESPONDE EN JSON con estructura completa para H1."""
}


class ClaudeService:
    """Service for interacting with Claude via AWS Bedrock"""

    def __init__(self):
        access_key = os.getenv("BEDROCK_ACCESS_KEY_ID")
        secret_key = os.getenv("BEDROCK_SECRET_ACCESS_KEY")
        region = os.getenv("BEDROCK_REGION", "us-east-1")

        if access_key and secret_key:
            self.client = boto3.client(
                "bedrock-runtime",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key
            )
            logger.info(f"Bedrock client initialized (region: {region})")
        else:
            self.client = None
            logger.warning("BEDROCK_ACCESS_KEY_ID / BEDROCK_SECRET_ACCESS_KEY not set - running in mock mode")

        self.sonnet_model = os.getenv("DEFAULT_CHAT_MODEL", "us.anthropic.claude-sonnet-5")
        self.opus_model = os.getenv("DEFAULT_COMPLEX_MODEL", "us.anthropic.claude-opus-5")

    def is_configured(self) -> bool:
        """Check if Bedrock client is configured"""
        return self.client is not None

    async def _call_claude(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 4096
    ) -> Dict[str, Any]:
        """Make a call to Claude via Bedrock Converse API"""

        if not self.client:
            return self._mock_response(user_message)

        try:
            response = self.client.converse(
                modelId=model,
                system=[{"text": system_prompt}],
                messages=[{"role": "user", "content": [{"text": user_message}]}],
                inferenceConfig={"maxTokens": max_tokens}
            )

            return {
                "content": response["output"]["message"]["content"][0]["text"],
                "model": model,
                "tokens_used": response["usage"]["inputTokens"] + response["usage"]["outputTokens"],
                "stop_reason": response["stopReason"]
            }

        except Exception as e:
            logger.error(f"Bedrock API error: {e}")
            raise

    def _mock_response(self, message: str) -> Dict[str, Any]:
        """Generate mock response when API is not configured"""
        return {
            "content": f"[MODO DEMO] Respuesta simulada para: {message[:100]}...",
            "model": "mock",
            "tokens_used": 0,
            "stop_reason": "end_turn"
        }

    async def chat(
        self,
        message: str,
        expedition_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        context_type: str = "client"
    ) -> Dict[str, Any]:
        """
        Generate chat response
        Uses Sonnet for fast responses
        """
        system_prompt = SYSTEM_PROMPTS.get(
            f"chat_{context_type}",
            SYSTEM_PROMPTS["chat_client"]
        )

        # Build context
        full_prompt = ""

        if expedition_context:
            full_prompt += f"""
CONTEXTO DEL EXPEDIENTE:
- ID: {expedition_context.get('expeditionId', 'N/A')}
- Tipo: {expedition_context.get('operationType', 'N/A')}
- Cliente: {expedition_context.get('client', {}).get('companyName', 'N/A')}
- Estado: {expedition_context.get('status', 'N/A')}
"""

        if conversation_history:
            full_prompt += "\nHISTORIAL:\n"
            for msg in conversation_history[-5:]:  # Last 5 messages
                sender = msg.get("sender", "unknown")
                content = msg.get("content", "")
                full_prompt += f"{sender}: {content}\n"

        full_prompt += f"\nMensaje: {message}"

        result = await self._call_claude(
            self.sonnet_model,
            system_prompt,
            full_prompt
        )

        return {
            "message": result["content"],
            "model": "sonnet-4",
            "tokens_used": result["tokens_used"],
            "confidence": 85,
            "sources": []
        }

    async def ask(self, question: str) -> Dict[str, Any]:
        """Answer a general customs question"""
        result = await self._call_claude(
            self.sonnet_model,
            SYSTEM_PROMPTS["chat_agent"],
            question
        )

        return {
            "message": result["content"],
            "model": "sonnet-4",
            "tokens_used": result["tokens_used"],
            "confidence": 80,
            "sources": []
        }

    async def classify_product(
        self,
        description: str,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Classify a product and suggest TARIC codes
        Uses Opus for complex reasoning
        """
        prompt = f"Clasifica el siguiente producto:\n\nDESCRIPCION: {description}"

        if additional_info:
            if additional_info.get("material"):
                prompt += f"\nMaterial: {additional_info['material']}"
            if additional_info.get("use"):
                prompt += f"\nUso: {additional_info['use']}"
            if additional_info.get("origin"):
                prompt += f"\nOrigen: {additional_info['origin']}"

        result = await self._call_claude(
            self.opus_model,
            SYSTEM_PROMPTS["classification"],
            prompt,
            max_tokens=4096
        )

        try:
            parsed = json.loads(result["content"])
            return parsed
        except json.JSONDecodeError:
            return {
                "suggestions": [{
                    "code": "0000000000",
                    "confidence": 50,
                    "reasoning": result["content"]
                }],
                "warnings": ["No se pudo parsear la respuesta JSON"],
                "additional_info_needed": []
            }

    async def generate_h1(
        self,
        expedition: Dict[str, Any],
        regime: str = "40",
        additional_procedure: str = "000",
        preference: str = "100"
    ) -> Dict[str, Any]:
        """
        Generate H1 declaration data
        Uses Opus for complex form filling
        """
        goods_text = ""
        goods_list = expedition.get("goods", [])
        for i, good in enumerate(goods_list):
            goods_text += f"""
Item {i+1}:
- Descripcion: {good.get('description', good.get('descriptionEs', 'N/A'))}
- TARIC: {good.get('taricCode', 'N/A')}
- Origen: {good.get('originCountry', 'N/A')}
- Valor: {good.get('invoiceValue', 0)} EUR
- Peso Neto: {good.get('netWeight', 0)} kg
- Peso Bruto: {good.get('grossWeight', 0)} kg
"""

        client = expedition.get('client', {})
        exporter = expedition.get('exporter', {})
        transport = expedition.get('transport', {})
        incoterm = expedition.get('incoterm', {})
        calculations = expedition.get('calculations', {})

        prompt = f"""Genera los datos para una declaracion H1 de importacion.

EXPEDIENTE: {expedition.get('expeditionId', 'N/A')}

IMPORTADOR (DESTINATARIO):
- Razon Social: {client.get('companyName', 'N/A')}
- NIF: {client.get('nif', 'N/A')}
- EORI: {client.get('eori', 'N/A')}
- Direccion: {client.get('address', {}).get('street', '')} {client.get('address', {}).get('city', '')} {client.get('address', {}).get('postalCode', '')}

EXPORTADOR (EXPEDIDOR):
- Razon Social: {exporter.get('companyName', 'N/A')}
- Pais: {exporter.get('country', 'N/A')}
- Ciudad: {exporter.get('city', 'N/A')}

MERCANCIAS:
{goods_text}

TRANSPORTE:
- Modo: {expedition.get('transportMode', 'N/A')}
- Documento: {transport.get('documentNumber', 'N/A')}
- Puerto entrada: {transport.get('arrivalPort', 'N/A')}

VALOR:
- Valor factura: {calculations.get('invoiceTotal', 0)} EUR
- Flete: {calculations.get('freightCost', 0)} EUR
- Seguro: {calculations.get('insuranceCost', 0)} EUR
- Valor en aduana: {calculations.get('customsValue', 0)} EUR
- Incoterm: {incoterm.get('code', 'N/A')} {incoterm.get('place', '')}

OPCIONES ADUANERAS:
- Regimen: {regime}
- Procedimiento adicional: {additional_procedure}
- Preferencia arancelaria: {preference}

Genera la respuesta UNICAMENTE como JSON valido (sin texto adicional) con esta estructura:
{{
  "declarationType": "H1",
  "lrn": "numero referencia local",
  "customsOffice": "codigo aduana",
  "regime": "{regime}",
  "preference": "{preference}",
  "importer": {{ datos importador }},
  "exporter": {{ datos exportador }},
  "goodsItems": [ lista de partidas con taric, valor, peso, origen ],
  "customsValue": valor en aduana,
  "estimatedDuties": derechos estimados,
  "estimatedVAT": IVA estimado,
  "warnings": [ advertencias ],
  "recommendations": [ recomendaciones ]
}}"""

        result = await self._call_claude(
            self.sonnet_model,  # Using Sonnet for faster response
            SYSTEM_PROMPTS["h1_generation"],
            prompt,
            max_tokens=8192
        )

        content = result["content"]

        # Try to extract JSON from the response
        try:
            # First try direct parse
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                except json.JSONDecodeError:
                    parsed = None
            else:
                parsed = None

        if parsed:
            return {
                "declaration_data": parsed,
                "warnings": parsed.get("warnings", []),
                "recommendations": parsed.get("recommendations", []),
                "raw_response": content if not parsed else None
            }
        else:
            # Return the raw content as a structured response
            return {
                "declaration_data": {
                    "declarationType": "H1",
                    "regime": regime,
                    "preference": preference,
                    "expeditionId": expedition.get('expeditionId'),
                    "rawAnalysis": content
                },
                "warnings": ["La respuesta de IA no pudo ser parseada como JSON estructurado"],
                "recommendations": ["Revisar el analisis en rawAnalysis"],
                "raw_response": content
            }

    async def generate_aes(
        self,
        expedition: Dict[str, Any],
        export_type: str = "10"
    ) -> Dict[str, Any]:
        """Generate AES export declaration data"""
        # Similar to H1 but for exports
        prompt = f"""Genera datos para declaracion AES (exportacion):

EXPEDIENTE: {expedition.get('expeditionId', 'N/A')}
EXPORTADOR: {expedition.get('client', {}).get('companyName', 'N/A')}
DESTINATARIO: {expedition.get('consignee', {}).get('companyName', 'N/A')}
TIPO: {export_type}

Genera JSON con estructura AES."""

        result = await self._call_claude(
            self.opus_model,
            SYSTEM_PROMPTS["h1_generation"],
            prompt
        )

        try:
            parsed = json.loads(result["content"])
            return parsed
        except json.JSONDecodeError:
            return {
                "declaration_data": {},
                "warnings": ["Error procesando respuesta"]
            }

    async def search_knowledge(
        self,
        query: str,
        limit: int = 5
    ) -> Dict[str, Any]:
        """Search knowledge base (simplified version)"""
        # In production, this would search through vector embeddings
        return {
            "query": query,
            "results": [],
            "message": "Knowledge base search not implemented yet"
        }
