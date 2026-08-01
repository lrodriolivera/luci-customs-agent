"""
Classification Service - TARIC code classification and duty calculation
Uses Claude API for intelligent classification
"""

import os
import json
import re
import logging
from typing import Optional, Dict, Any, List

import anthropic

from services.bedrock_client import create_bedrock_anthropic_client

logger = logging.getLogger(__name__)

# System prompt for TARIC classification
CLASSIFICATION_PROMPT = """Eres un experto clasificador arancelario con profundo conocimiento del Sistema Armonizado (SA), Nomenclatura Combinada (NC) y TARIC europeo.

Tu tarea es analizar descripciones de productos y sugerir codigos TARIC de 10 digitos apropiados.

METODOLOGIA:
1. Identifica el material principal del producto
2. Determina su funcion/uso principal
3. Considera el proceso de fabricacion
4. Aplica las Reglas Generales de Interpretacion (RGI)
5. Verifica subpartidas y notas de seccion/capitulo

ESTRUCTURA TARIC:
- Capitulos 01-24: Productos agricolas, alimentos
- Capitulos 25-27: Minerales
- Capitulos 28-38: Productos quimicos
- Capitulos 39-40: Plasticos y caucho
- Capitulos 41-43: Cuero y pieles
- Capitulos 44-49: Madera, papel
- Capitulos 50-63: Textiles
- Capitulos 64-67: Calzado
- Capitulos 68-71: Piedra, ceramica, vidrio
- Capitulos 72-83: Metales
- Capitulos 84-85: Maquinaria, electronica
- Capitulos 86-89: Vehiculos, transporte
- Capitulos 90-92: Instrumentos opticos, medicos
- Capitulos 93: Armas
- Capitulos 94-96: Muebles, juguetes, otros
- Capitulos 97-99: Objetos arte, especiales

CODIGOS COMUNES DE REFERENCIA:
- Plasticos manufacturas: 3926 (ej: 3926909790)
- Fundas/estuches plastico: 4202929800 o 3926909790
- Telefonos moviles: 8517130000 (smartphones), 8517120000 (otros)
- Ordenadores portatiles: 8471300000
- Textiles algodon: 6109 (camisetas), 6110 (jerseys)
- Muebles madera: 9403600000
- Vehiculos: 8703 (turismos)

RESPONDE UNICAMENTE EN JSON (sin markdown, sin texto adicional):
{
  "suggestions": [
    {"code": "1234567890", "confidence": 85, "reasoning": "explicacion detallada", "duty_rate": 6.5}
  ],
  "warnings": ["advertencias si las hay"],
  "additional_info_needed": ["informacion que ayudaria"]
}

Proporciona 2-3 sugerencias ordenadas por confianza. El codigo debe ser de 10 digitos."""


# Preference rates by country/agreement
PREFERENCE_AGREEMENTS = {
    "200": {
        "name": "SPG",
        "countries": ["BD", "KH", "LA", "MM", "NP", "AF", "ET"],
        "reduction": 100
    },
    "300": {
        "name": "Acuerdos Libre Comercio",
        "countries": ["JP", "KR", "MX", "CA", "SG", "VN", "GB", "CL"],
        "reduction": 100
    },
    "400": {
        "name": "Union Aduanera",
        "countries": ["TR", "AD", "SM"],
        "reduction": 100
    }
}

# Common duty rates by chapter
DUTY_RATES = {
    "39": 6.5,   # Plasticos
    "42": 3.7,   # Articulos de cuero
    "61": 12.0,  # Prendas de punto
    "62": 12.0,  # Prendas excepto punto
    "64": 8.0,   # Calzado
    "84": 0.0,   # Maquinaria
    "85": 0.0,   # Electronica
    "87": 10.0,  # Vehiculos
    "94": 0.0,   # Muebles
}


class ClassificationService:
    """Service for TARIC classification using Claude AI"""

    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.client = create_bedrock_anthropic_client()

        if self.client:
            logger.info("Classification service initialized with Bedrock")
            self.model = os.getenv("DEFAULT_COMPLEX_MODEL", "us.anthropic.claude-sonnet-4-20250514-v1:0")
        elif self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
            logger.info("Classification service initialized with Claude API")
            self.model = os.getenv("DEFAULT_COMPLEX_MODEL", "claude-sonnet-4-20250514")
        else:
            logger.warning("BEDROCK_*/ANTHROPIC_API_KEY not set - classification will use fallback mode")
            self.model = None

    async def classify(
        self,
        description: str,
        additional_info: Optional[Dict[str, Any]] = None,
        language: str = "es"
    ) -> Dict[str, Any]:
        """
        Classify a product and suggest TARIC codes using Claude AI
        """
        # Build the prompt with all available information
        prompt = f"Clasifica el siguiente producto para importacion a Espana:\n\nDESCRIPCION: {description}"

        if additional_info:
            if additional_info.get("material"):
                prompt += f"\nMATERIAL PRINCIPAL: {additional_info['material']}"
            if additional_info.get("use"):
                prompt += f"\nUSO/FUNCION: {additional_info['use']}"
            if additional_info.get("origin"):
                prompt += f"\nPAIS ORIGEN: {additional_info['origin']}"
            if additional_info.get("composition"):
                prompt += f"\nCOMPOSICION: {additional_info['composition']}"

        prompt += "\n\nProporciona el codigo TARIC de 10 digitos mas apropiado."

        # Call Claude API
        if self.client:
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=2048,
                    system=CLASSIFICATION_PROMPT,
                    messages=[{"role": "user", "content": prompt}]
                )

                content = response.content[0].text
                logger.info(f"Claude response for classification: {content[:200]}...")

                # Parse JSON response
                result = self._parse_classification_response(content)

                # Add duty rates if not present
                for suggestion in result.get("suggestions", []):
                    if "duty_rate" not in suggestion or suggestion["duty_rate"] is None:
                        chapter = suggestion.get("code", "")[:2]
                        suggestion["duty_rate"] = DUTY_RATES.get(chapter, 0)

                return result

            except Exception as e:
                logger.error(f"Claude API error in classification: {e}")
                return self._fallback_classification(description, additional_info)
        else:
            return self._fallback_classification(description, additional_info)

    def _parse_classification_response(self, content: str) -> Dict[str, Any]:
        """Parse Claude's response, handling various formats"""

        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code blocks
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
        if json_match:
            try:
                return json.loads(json_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try to find JSON object in text
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # Extract TARIC code from text as last resort
        code_match = re.search(r'\b(\d{10})\b', content)
        confidence_match = re.search(r'(\d+)\s*%', content)

        if code_match:
            code = code_match.group(1)
            chapter = code[:2]
            return {
                "suggestions": [{
                    "code": code,
                    "confidence": int(confidence_match.group(1)) if confidence_match else 75,
                    "reasoning": content[:500],
                    "duty_rate": DUTY_RATES.get(chapter, 0)
                }],
                "warnings": [],
                "additional_info_needed": []
            }

        # Complete fallback
        return {
            "suggestions": [{
                "code": "0000000000",
                "confidence": 30,
                "reasoning": f"No se pudo determinar codigo. Respuesta IA: {content[:300]}",
                "duty_rate": 0
            }],
            "warnings": ["Clasificacion requiere revision manual"],
            "additional_info_needed": ["Descripcion mas detallada del producto"]
        }

    def _fallback_classification(
        self,
        description: str,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Fallback classification when Claude is not available"""
        description_lower = description.lower()
        material = (additional_info or {}).get("material", "").lower()
        use = (additional_info or {}).get("use", "").lower()

        # Enhanced keyword mappings with duty rates
        keyword_mappings = [
            # Plasticos y manufacturas - COMBINACIONES ESPECIFICAS PRIMERO
            (["funda", "movil"], "3926909790", 90, 6.5, "Fundas para movil de plastico"),
            (["funda", "telefono"], "3926909790", 90, 6.5, "Fundas para telefono de plastico"),
            (["case", "phone"], "3926909790", 90, 6.5, "Phone cases de plastico"),
            (["funda", "plastico"], "3926909790", 88, 6.5, "Fundas de plastico"),
            (["estuche", "plastico"], "3926909790", 88, 6.5, "Estuches de plastico"),
            (["manufactura", "plastico"], "3926909790", 85, 6.5, "Manufacturas de plastico"),

            # Plasticos genericos
            (["plastico", "plastic", "pvc", "polietileno", "polipropileno", "tpu", "silicona"], "3926909790", 80, 6.5, "Manufacturas de plastico"),
            (["funda", "estuche", "case", "cover", "carcasa", "protector"], "3926909790", 75, 6.5, "Fundas/estuches"),

            # Electronica
            (["telefono", "movil", "smartphone", "celular", "iphone", "samsung", "galaxy", "xiaomi", "huawei"], "8517130000", 90, 0, "Telefonos inteligentes"),
            (["ordenador", "laptop", "portatil", "computer", "notebook", "macbook"], "8471300000", 90, 0, "Ordenadores portatiles"),
            (["router", "modem", "switch", "access point"], "8517620000", 85, 0, "Equipos de red"),
            (["auricular", "headphone", "earbud", "airpod", "cascos"], "8518300000", 85, 0, "Auriculares"),
            (["television", "tv", "monitor", "pantalla"], "8528720000", 80, 14, "Televisores/monitores"),
            (["cargador", "charger", "adaptador"], "8504400000", 80, 0, "Cargadores electricos"),
            (["cable", "usb", "hdmi"], "8544420000", 80, 0, "Cables electricos"),

            # Textiles
            (["camiseta", "tshirt", "t-shirt"], "6109100000", 85, 12, "Camisetas de algodon"),
            (["jersey", "sueter", "pullover", "sweater"], "6110209100", 85, 12, "Jerseys de algodon"),
            (["pantalon", "pants", "trousers", "jeans", "vaquero"], "6203420000", 80, 12, "Pantalones"),
            (["vestido", "dress", "falda", "skirt"], "6204520000", 80, 12, "Vestidos/faldas"),
            (["ropa", "textile", "confeccion"], "6114200000", 75, 12, "Ropa en general"),
            (["algodon", "cotton"], "6109100000", 70, 12, "Articulos de algodon"),

            # Muebles
            (["mueble", "furniture", "mesa", "table", "silla", "chair"], "9403600000", 80, 0, "Muebles de madera"),
            (["sofa", "couch", "sillon"], "9401610000", 80, 0, "Asientos tapizados"),
            (["colchon", "mattress"], "9404210000", 80, 0, "Colchones"),

            # Alimentos
            (["fruta", "fruit", "pina", "pineapple", "naranja", "manzana", "platano"], "0804300000", 75, 5.8, "Frutas"),
            (["vino", "wine"], "2204210000", 80, 32, "Vino"),
            (["aceite", "oliva", "oil"], "1509100000", 80, 0, "Aceite de oliva"),
            (["cafe", "coffee"], "0901110000", 80, 0, "Cafe"),

            # Vehiculos
            (["coche", "carro", "auto", "vehiculo", "car"], "8703230000", 80, 10, "Vehiculos"),
            (["moto", "motocicleta", "motorcycle"], "8711200000", 80, 8, "Motocicletas"),
            (["bicicleta", "bicycle", "bike"], "8712000000", 80, 15, "Bicicletas"),

            # Medicamentos
            (["medicamento", "medicina", "farmaco", "pastilla", "farmaceutico"], "3004900000", 85, 0, "Medicamentos"),

            # Juguetes
            (["juguete", "toy", "muneco", "juego"], "9503000000", 80, 0, "Juguetes"),

            # Cosmeticos
            (["cosmetico", "crema", "perfume", "maquillaje", "belleza"], "3304990000", 80, 0, "Cosmeticos"),

            # Herramientas
            (["herramienta", "tool", "destornillador", "llave"], "8205590000", 80, 0, "Herramientas manuales"),
        ]

        suggestions = []
        combined_text = f"{description_lower} {material} {use}"
        seen_codes = set()  # Avoid duplicates

        for keywords, code, confidence, duty, desc in keyword_mappings:
            # Check if ALL keywords match (for combinations) or ANY keyword matches (for singles)
            if len(keywords) <= 2:
                # For combinations like ["funda", "movil"], ALL must match
                matches = [kw for kw in keywords if kw in combined_text]
                is_match = len(matches) == len(keywords)
            else:
                # For lists of alternatives, ANY can match
                matches = [kw for kw in keywords if kw in combined_text]
                is_match = len(matches) > 0

            if is_match and code not in seen_codes:
                seen_codes.add(code)
                suggestions.append({
                    "code": code,
                    "confidence": confidence,
                    "description": desc,
                    "duty_rate": duty,
                    "reasoning": f"Coincidencia por palabras clave: {', '.join(matches)}"
                })

        if not suggestions:
            # Check material for generic classification
            if "plastico" in material or "plastic" in material:
                suggestions.append({
                    "code": "3926909790",
                    "confidence": 70,
                    "description": "Otras manufacturas de plastico",
                    "duty_rate": 6.5,
                    "reasoning": "Clasificacion generica basada en material plastico"
                })
            else:
                suggestions.append({
                    "code": "0000000000",
                    "confidence": 30,
                    "description": "Clasificacion no determinada",
                    "duty_rate": 0,
                    "reasoning": "No se encontraron coincidencias. Se requiere revision manual."
                })

        # Sort by confidence
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)

        return {
            "suggestions": suggestions[:3],
            "warnings": self._get_classification_warnings(description),
            "additional_info_needed": self._get_needed_info(description, additional_info)
        }

    async def validate(
        self,
        taric_code: str,
        description: str,
        origin: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate if a TARIC code is appropriate for the product"""

        if self.client:
            try:
                prompt = f"""Valida si el codigo TARIC {taric_code} es correcto para:

Descripcion: {description}
Origen: {origin or 'No especificado'}

Responde en JSON:
{{"is_valid": true/false, "confidence": 0-100, "reasoning": "explicacion", "warnings": []}}"""

                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    system="Eres un experto en clasificacion arancelaria TARIC.",
                    messages=[{"role": "user", "content": prompt}]
                )

                content = response.content[0].text
                try:
                    return json.loads(content)
                except:
                    return {
                        "is_valid": True,
                        "confidence": 70,
                        "reasoning": content[:300],
                        "warnings": []
                    }
            except Exception as e:
                logger.error(f"Validation error: {e}")

        # Fallback validation
        return {
            "is_valid": len(taric_code) == 10 and taric_code.isdigit(),
            "confidence": 60,
            "reasoning": f"Validacion basica del codigo {taric_code}",
            "warnings": ["Validacion completa requiere revision manual"]
        }

    async def calculate_duties(
        self,
        taric_code: str,
        value: float,
        origin: str,
        preference: str = "100"
    ) -> Dict[str, Any]:
        """Calculate customs duties for a product"""

        # Get base duty rate from chapter
        chapter = taric_code[:2] if len(taric_code) >= 2 else "00"
        base_duty_rate = DUTY_RATES.get(chapter, 0)

        # Apply preference if applicable
        effective_duty_rate = base_duty_rate
        preference_applied = None

        if preference != "100":
            pref_config = PREFERENCE_AGREEMENTS.get(preference)
            if pref_config and origin in pref_config.get("countries", []):
                reduction = pref_config.get("reduction", 0)
                effective_duty_rate = base_duty_rate * (1 - reduction / 100)
                preference_applied = {
                    "code": preference,
                    "name": pref_config.get("name", "")
                }

        # Calculate amounts
        duty_amount = value * (effective_duty_rate / 100)
        vat_rate = 21  # Standard Spanish VAT
        vat_base = value + duty_amount
        vat_amount = vat_base * (vat_rate / 100)

        return {
            "taric_code": taric_code,
            "origin": origin,
            "customs_value": value,
            "base_duty_rate": base_duty_rate,
            "effective_duty_rate": effective_duty_rate,
            "preference_applied": preference_applied,
            "duty_amount": round(duty_amount, 2),
            "vat_rate": vat_rate,
            "vat_base": round(vat_base, 2),
            "vat_amount": round(vat_amount, 2),
            "total_taxes": round(duty_amount + vat_amount, 2),
            "total_to_pay": round(value + duty_amount + vat_amount, 2)
        }

    def _get_classification_warnings(self, description: str) -> List[str]:
        """Get warnings for classification"""
        warnings = []
        description_lower = description.lower()

        if len(description) < 15:
            warnings.append("Descripcion muy corta - proporcione mas detalles para mejor clasificacion")

        dual_use = ["laser", "quimico", "nuclear", "militar", "encriptacion", "drone"]
        if any(kw in description_lower for kw in dual_use):
            warnings.append("Producto potencialmente de doble uso - verificar requisitos de licencia de exportacion")

        controlled = ["arma", "municion", "explosivo", "precursor"]
        if any(kw in description_lower for kw in controlled):
            warnings.append("Producto controlado - requiere autorizaciones especiales")

        return warnings

    def _get_needed_info(self, description: str, additional_info: Optional[Dict] = None) -> List[str]:
        """Get additional information needed for better classification"""
        needed = []
        additional_info = additional_info or {}

        if not additional_info.get("material"):
            needed.append("Material principal del producto")

        if not additional_info.get("use"):
            needed.append("Uso o funcion del producto")

        if not additional_info.get("origin"):
            needed.append("Pais de origen/fabricacion")

        return needed

    def get_taric_info(self, code: str) -> Optional[Dict[str, Any]]:
        """Get TARIC information for a code"""
        chapter = code[:2] if len(code) >= 2 else "00"
        return {
            "code": code,
            "chapter": chapter,
            "duty_rate": DUTY_RATES.get(chapter, 0),
            "vat_rate": 21
        }

    def search_taric(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search TARIC codes by description"""
        # This would integrate with a proper TARIC database
        # For now, return empty as this requires backend DB
        return []
