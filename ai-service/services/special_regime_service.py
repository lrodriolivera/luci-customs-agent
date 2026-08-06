"""
Special Regime AI Service - Asistencia IA para Regimenes Especiales
Powered by Claude para analisis inteligente de operaciones aduaneras
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any

import anthropic

from services.bedrock_client import create_bedrock_anthropic_client

logger = logging.getLogger(__name__)

# System prompts para regimenes especiales
SPECIAL_REGIME_PROMPTS = {
    "regime_advisor": """Eres un experto en regimenes aduaneros especiales segun el Codigo Aduanero de la Union (CAU).

Tu tarea es analizar operaciones comerciales y recomendar el regimen especial mas adecuado.

REGIMENES ESPECIALES DISPONIBLES:

1. REGIMEN 51 - PERFECCIONAMIENTO ACTIVO:
   - Para: Importar materias primas/componentes, transformarlos y reexportar productos acabados
   - Ventaja: Suspension total de derechos e IVA durante la transformacion
   - Requisitos: Autorizacion previa AEAT, cuenta de existencias, garantia
   - Duracion: Hasta 12 meses (prorrogable hasta 3 anos)
   - Ideal para: Fabricantes que exportan productos transformados

2. REGIMEN 53 - IMPORTACION TEMPORAL:
   - Para: Uso temporal de mercancias con obligacion de reexportacion
   - Ventaja: Exencion total o parcial (3% mensual) de derechos
   - Requisitos: Autorizacion, garantia, plazo maximo 24 meses
   - Ideal para: Ferias, equipos profesionales, muestras, contenedores

3. REGIMEN 71 - DEPOSITO ADUANERO:
   - Para: Almacenar mercancias sin pago de derechos
   - Ventaja: Sin limite temporal, manipulaciones permitidas
   - Requisitos: Autorizacion deposito, cuenta existencias
   - Ideal para: Stock de seguridad, distribucion, reexpedicion

4. TRANSITO (T1/T2):
   - T1: Mercancias no comunitarias atravesando UE
   - T2: Mercancias comunitarias atravesando paises terceros
   - Ideal para: Movimientos geograficos sin despacho

RESPONDE SIEMPRE EN JSON:
{
  "recommended_regime": "codigo",
  "regime_name": "nombre",
  "confidence": 0-100,
  "reasoning": "explicacion detallada",
  "benefits": ["beneficio1", "beneficio2"],
  "requirements": ["requisito1", "requisito2"],
  "estimated_savings": {
    "duties_saved": porcentaje,
    "vat_saved": porcentaje,
    "explanation": "explicacion"
  },
  "alternatives": [
    {"regime": "codigo", "name": "nombre", "why": "razon alternativa"}
  ],
  "warnings": ["advertencia1"],
  "next_steps": ["paso1", "paso2"]
}""",

    "yield_validator": """Eres un experto en tasas de rendimiento para perfeccionamiento activo (regimen 51).

Tu tarea es validar y sugerir tasas de rendimiento realistas para operaciones de transformacion.

CONCEPTOS CLAVE:
- Tasa de rendimiento: Relacion entre cantidad de productos compensadores y materias primas
- Perdidas/desperdicios: Material que no se convierte en producto final
- Productos compensadores principales: Objetivo de la transformacion
- Productos secundarios: Subproductos de la operacion

METODOS DE CALCULO:
1. Metodo estandar: Tasas predefinidas por la aduana
2. Metodo calculado: Basado en especificaciones tecnicas
3. Metodo real: Basado en resultados efectivos

FACTORES A CONSIDERAR:
- Tipo de proceso industrial
- Calidad de materias primas
- Tecnologia empleada
- Tolerancias aceptables por sector

RESPONDE EN JSON:
{
  "yield_rate_valid": true/false,
  "suggested_yield_rate": porcentaje,
  "confidence": 0-100,
  "analysis": "explicacion tecnica",
  "waste_allowance": {
    "percentage": porcentaje,
    "justification": "explicacion"
  },
  "industry_benchmarks": {
    "typical_range": "rango",
    "source": "fuente"
  },
  "recommendations": ["recomendacion1"],
  "warnings": ["advertencia1"],
  "documentation_needed": ["documento1"]
}""",

    "deadline_analyzer": """Eres un experto en plazos y ultimacion de regimenes especiales.

Tu tarea es analizar si una operacion cumple los plazos y sugerir acciones.

PLAZOS MAXIMOS:
- Regimen 51: 12 meses estandar, maximo 3 anos con prorrogas
- Regimen 53: 24 meses maximo
- Regimen 71: Sin limite temporal
- Transito: Segun ruta y circunstancias

ALERTAS:
- 30 dias antes: Alerta temprana
- 15 dias antes: Alerta urgente
- 7 dias antes: Alerta critica

OPCIONES AL VENCER:
1. Prorroga (si procede)
2. Ultimacion por reexportacion
3. Despacho a libre practica (pago derechos)
4. Transferencia a otro regimen
5. Destruccion bajo control aduanero

RESPONDE EN JSON:
{
  "status": "ok|warning|critical|expired",
  "days_remaining": numero,
  "deadline_analysis": "explicacion",
  "extension_possible": true/false,
  "extension_recommendation": {
    "recommended": true/false,
    "max_extension_date": "fecha",
    "requirements": ["requisito1"]
  },
  "discharge_options": [
    {
      "option": "tipo",
      "recommended": true/false,
      "implications": "explicacion",
      "estimated_cost": numero
    }
  ],
  "urgent_actions": ["accion1"],
  "recommendations": ["recomendacion1"]
}"""
}


class SpecialRegimeService:
    """Service for AI-powered special regime assistance"""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.client = create_bedrock_anthropic_client()

        if self.client:
            logger.info("Special Regime AI Service initialized with Bedrock")
            self.sonnet_model = os.getenv("DEFAULT_CHAT_MODEL", "global.anthropic.claude-sonnet-5")
            self.opus_model = os.getenv("DEFAULT_COMPLEX_MODEL", "global.anthropic.claude-opus-5")
        elif self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("Special Regime AI Service initialized")
            self.sonnet_model = os.getenv("DEFAULT_CHAT_MODEL", "global.anthropic.claude-sonnet-5")
            self.opus_model = os.getenv("DEFAULT_COMPLEX_MODEL", "global.anthropic.claude-opus-5")
        else:
            logger.warning("BEDROCK_*/ANTHROPIC_API_KEY not set - running in mock mode")
            self.sonnet_model = None
            self.opus_model = None

    async def _call_claude(
        self,
        model: str,
        system_prompt: str,
        user_message: str,
        max_tokens: int = 4096
    ) -> Dict[str, Any]:
        """Make a call to Claude API"""

        if not self.client:
            return self._mock_response(system_prompt, user_message)

        try:
            response = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}]
            )

            return {
                "content": response.content[0].text,
                "model": model,
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens
            }

        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    def _mock_response(self, system_prompt: str, message: str) -> Dict[str, Any]:
        """Generate mock response when API is not configured"""

        # Provide realistic mock responses based on the prompt type
        if "regime_advisor" in system_prompt or "REGIMEN 51" in system_prompt:
            mock_content = json.dumps({
                "recommended_regime": "51",
                "regime_name": "Perfeccionamiento Activo",
                "confidence": 85,
                "reasoning": "[MODO DEMO] Basado en la operacion descrita, el regimen 51 es adecuado para transformacion de mercancias con posterior reexportacion.",
                "benefits": [
                    "Suspension total de derechos de importacion",
                    "Suspension del IVA durante la transformacion",
                    "Mejora competitividad en mercados internacionales"
                ],
                "requirements": [
                    "Autorizacion previa de AEAT",
                    "Garantia por importe de derechos suspendidos",
                    "Cuenta de existencias actualizada"
                ],
                "estimated_savings": {
                    "duties_saved": 100,
                    "vat_saved": 100,
                    "explanation": "Ahorro total mientras las mercancias permanezcan en el regimen"
                },
                "alternatives": [
                    {"regime": "71", "name": "Deposito Aduanero", "why": "Si solo necesita almacenamiento sin transformacion"}
                ],
                "warnings": ["Requiere ultimacion dentro del plazo autorizado"],
                "next_steps": [
                    "Solicitar autorizacion en sede electronica AEAT",
                    "Preparar garantia bancaria o CGU",
                    "Establecer sistema de control de existencias"
                ]
            })
        elif "yield_validator" in system_prompt:
            mock_content = json.dumps({
                "yield_rate_valid": True,
                "suggested_yield_rate": 85,
                "confidence": 80,
                "analysis": "[MODO DEMO] La tasa de rendimiento propuesta esta dentro de los parametros habituales para este tipo de proceso industrial.",
                "waste_allowance": {
                    "percentage": 15,
                    "justification": "Perdidas tipicas por recortes y ajustes en procesos de fabricacion"
                },
                "industry_benchmarks": {
                    "typical_range": "80-90%",
                    "source": "Referencias sectoriales generales"
                },
                "recommendations": [
                    "Documentar proceso productivo detalladamente",
                    "Mantener registros de entradas y salidas"
                ],
                "warnings": [],
                "documentation_needed": [
                    "Ficha tecnica del proceso",
                    "Registros de produccion historicos"
                ]
            })
        else:
            mock_content = json.dumps({
                "status": "warning",
                "days_remaining": 25,
                "deadline_analysis": "[MODO DEMO] El regimen vence en 25 dias. Se recomienda iniciar tramites de ultimacion o prorroga.",
                "extension_possible": True,
                "extension_recommendation": {
                    "recommended": True,
                    "max_extension_date": "2027-01-12",
                    "requirements": ["Solicitud motivada", "Garantia vigente"]
                },
                "discharge_options": [
                    {
                        "option": "reexport",
                        "recommended": True,
                        "implications": "Sin pago de derechos",
                        "estimated_cost": 0
                    },
                    {
                        "option": "release_free_circulation",
                        "recommended": False,
                        "implications": "Pago de derechos suspendidos",
                        "estimated_cost": 12500
                    }
                ],
                "urgent_actions": ["Revisar estado de la operacion"],
                "recommendations": ["Solicitar prorroga si la operacion continua"]
            })

        return {
            "content": mock_content,
            "model": "mock",
            "tokens_used": 0
        }

    async def advise_regime(
        self,
        operation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze an operation and recommend the best special regime
        Uses Opus for complex analysis
        """
        prompt = f"""Analiza la siguiente operacion y recomienda el regimen especial mas adecuado:

TIPO DE OPERACION: {operation.get('operation_type', 'N/A')}

DESCRIPCION:
{operation.get('description', 'No especificada')}

MERCANCIAS:
- Descripcion: {operation.get('goods_description', 'N/A')}
- Codigo TARIC: {operation.get('taric_code', 'N/A')}
- Valor estimado: {operation.get('estimated_value', 0)} EUR
- Origen: {operation.get('origin_country', 'N/A')}

OBJETIVO:
{operation.get('objective', 'No especificado')}

DURACION PREVISTA: {operation.get('expected_duration', 'N/A')} meses

DESTINO FINAL:
- Reexportacion: {operation.get('will_reexport', 'No especificado')}
- Pais destino: {operation.get('destination_country', 'N/A')}

TRANSFORMACION:
- Proceso previsto: {operation.get('transformation_process', 'Ninguno')}
- Producto final: {operation.get('final_product', 'N/A')}

INFORMACION ADICIONAL:
{operation.get('additional_info', 'Ninguna')}

Analiza todos los factores y recomienda el regimen especial optimo."""

        result = await self._call_claude(
            self.opus_model,
            SPECIAL_REGIME_PROMPTS["regime_advisor"],
            prompt,
            max_tokens=4096
        )

        try:
            parsed = json.loads(result["content"])
            return {
                "success": True,
                "data": parsed,
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }
        except json.JSONDecodeError:
            return {
                "success": True,
                "data": {
                    "recommended_regime": "51",
                    "regime_name": "Perfeccionamiento Activo",
                    "confidence": 70,
                    "reasoning": result["content"],
                    "warnings": ["Respuesta no estructurada - revisar manualmente"]
                },
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }

    async def validate_yield_rate(
        self,
        regime_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validate yield rate for inward processing (regime 51)
        """
        prompt = f"""Valida la tasa de rendimiento para la siguiente operacion de perfeccionamiento activo:

MATERIAS PRIMAS:
{self._format_goods(regime_data.get('input_goods', []))}

PROCESO DE TRANSFORMACION:
- Tipo: {regime_data.get('process_type', 'N/A')}
- Descripcion: {regime_data.get('process_description', 'N/A')}

PRODUCTOS COMPENSADORES ESPERADOS:
{self._format_goods(regime_data.get('output_goods', []))}

TASA DE RENDIMIENTO PROPUESTA: {regime_data.get('proposed_yield_rate', 'N/A')}%

PERDIDAS/DESPERDICIOS ESTIMADOS: {regime_data.get('estimated_waste', 'N/A')}%

SECTOR INDUSTRIAL: {regime_data.get('industry_sector', 'N/A')}

METODO DE CALCULO: {regime_data.get('calculation_method', 'calculado')}

Evalua si la tasa de rendimiento propuesta es realista y justificable."""

        result = await self._call_claude(
            self.opus_model,
            SPECIAL_REGIME_PROMPTS["yield_validator"],
            prompt,
            max_tokens=4096
        )

        try:
            parsed = json.loads(result["content"])
            return {
                "success": True,
                "data": parsed,
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }
        except json.JSONDecodeError:
            return {
                "success": True,
                "data": {
                    "yield_rate_valid": True,
                    "suggested_yield_rate": regime_data.get('proposed_yield_rate', 80),
                    "confidence": 60,
                    "analysis": result["content"],
                    "warnings": ["Respuesta no estructurada - revisar manualmente"]
                },
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }

    async def analyze_deadline(
        self,
        regime_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze deadline compliance and suggest actions
        """
        import datetime

        # Calculate days remaining
        deadline_str = regime_data.get('deadline_date')
        if deadline_str:
            try:
                deadline = datetime.datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
                now = datetime.datetime.now(datetime.timezone.utc)
                days_remaining = (deadline - now).days
            except:
                days_remaining = "desconocido"
        else:
            days_remaining = "no especificado"

        prompt = f"""Analiza el estado del plazo para el siguiente regimen especial:

REGIMEN: {regime_data.get('regime_code', 'N/A')} - {regime_data.get('regime_type', 'N/A')}

FECHAS:
- Inicio: {regime_data.get('start_date', 'N/A')}
- Vencimiento actual: {regime_data.get('deadline_date', 'N/A')}
- Dias restantes: {days_remaining}

PRORROGAS ANTERIORES: {len(regime_data.get('extensions', []))}

ESTADO ACTUAL: {regime_data.get('status', 'N/A')}

VALOR EN ADUANA: {regime_data.get('customs_value', 0)} EUR
DERECHOS SUSPENDIDOS: {regime_data.get('suspended_duties', 0)} EUR
IVA SUSPENDIDO: {regime_data.get('suspended_vat', 0)} EUR

GARANTIA:
- Tipo: {regime_data.get('guarantee_type', 'N/A')}
- Importe: {regime_data.get('guarantee_amount', 0)} EUR
- Vencimiento garantia: {regime_data.get('guarantee_expiry', 'N/A')}

ESTADO DE LA MERCANCIA:
- Cantidad pendiente: {regime_data.get('pending_quantity', 'N/A')}
- Porcentaje ultimado: {regime_data.get('discharge_percentage', 0)}%

Analiza la situacion y recomienda acciones."""

        result = await self._call_claude(
            self.sonnet_model,  # Sonnet for faster response
            SPECIAL_REGIME_PROMPTS["deadline_analyzer"],
            prompt,
            max_tokens=4096
        )

        try:
            parsed = json.loads(result["content"])
            return {
                "success": True,
                "data": parsed,
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }
        except json.JSONDecodeError:
            # Determine status based on days remaining
            if isinstance(days_remaining, int):
                if days_remaining < 0:
                    status = "expired"
                elif days_remaining <= 7:
                    status = "critical"
                elif days_remaining <= 30:
                    status = "warning"
                else:
                    status = "ok"
            else:
                status = "unknown"

            return {
                "success": True,
                "data": {
                    "status": status,
                    "days_remaining": days_remaining,
                    "deadline_analysis": result["content"],
                    "extension_possible": True,
                    "warnings": ["Respuesta no estructurada - revisar manualmente"]
                },
                "model": result["model"],
                "tokens_used": result["tokens_used"]
            }

    async def generate_response(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a general response about special regimes
        Used for chat-like interactions about regimes
        """
        system_prompt = """Eres LUCI, un asistente experto en regimenes aduaneros especiales.

Responde preguntas sobre:
- Perfeccionamiento activo (51)
- Importacion temporal (53)
- Deposito aduanero (71)
- Transito (T1/T2/TIR)

Se preciso y cita normativa CAU cuando sea relevante."""

        full_prompt = prompt
        if context:
            full_prompt = f"""Contexto del regimen actual:
- Codigo: {context.get('regime_code', 'N/A')}
- Estado: {context.get('status', 'N/A')}
- Valor: {context.get('customs_value', 0)} EUR

Pregunta: {prompt}"""

        result = await self._call_claude(
            self.sonnet_model,
            system_prompt,
            full_prompt
        )

        return {
            "success": True,
            "message": result["content"],
            "model": result["model"],
            "tokens_used": result["tokens_used"]
        }

    def _format_goods(self, goods: List[Dict[str, Any]]) -> str:
        """Format goods list for prompt"""
        if not goods:
            return "No especificadas"

        lines = []
        for i, good in enumerate(goods, 1):
            lines.append(f"""
Item {i}:
- Descripcion: {good.get('description', 'N/A')}
- TARIC: {good.get('taric_code', 'N/A')}
- Cantidad: {good.get('quantity', 0)} {good.get('unit', 'unidades')}
- Peso: {good.get('weight', 0)} kg
- Valor: {good.get('value', 0)} EUR""")

        return "\n".join(lines)
