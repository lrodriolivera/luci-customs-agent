"""
Document Service - Document validation and data extraction
Uses OCR (Tesseract) + Claude Vision for document understanding
"""

import os
import logging
import base64
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Document type configurations
DOCUMENT_CONFIGS = {
    "commercial_invoice": {
        "name": "Factura Comercial",
        "required_fields": ["invoice_number", "date", "seller", "buyer", "items", "total_value", "currency", "incoterm"],
        "extraction_prompt": """Extrae los siguientes datos de esta factura comercial:
- Numero de factura
- Fecha
- Vendedor (nombre, direccion, pais)
- Comprador (nombre, direccion, NIF)
- Items (descripcion, cantidad, precio unitario, total)
- Valor total
- Moneda
- Incoterm y lugar
- Condiciones de pago"""
    },
    "packing_list": {
        "name": "Packing List",
        "required_fields": ["reference", "packages", "gross_weight", "net_weight", "marks"],
        "extraction_prompt": """Extrae los siguientes datos de este packing list:
- Referencia
- Numero de bultos por tipo (cajas, pallets, etc.)
- Peso bruto total (kg)
- Peso neto total (kg)
- Marcas de envio
- Detalle por item (descripcion, bultos, pesos)"""
    },
    "bill_of_lading": {
        "name": "Bill of Lading",
        "required_fields": ["bl_number", "shipper", "consignee", "vessel", "port_loading", "port_discharge", "containers"],
        "extraction_prompt": """Extrae los siguientes datos de este conocimiento de embarque (BL):
- Numero de BL
- Shipper/Embarcador
- Consignatario
- Notify party
- Buque y viaje
- Puerto de carga
- Puerto de descarga
- Contenedores (numero, tipo, peso, precintos)
- Descripcion de mercancia
- Fecha de embarque"""
    },
    "air_waybill": {
        "name": "Air Waybill",
        "required_fields": ["awb_number", "shipper", "consignee", "flight", "origin", "destination", "pieces", "weight"],
        "extraction_prompt": """Extrae los siguientes datos de esta carta de porte aereo (AWB):
- Numero AWB
- Shipper
- Consignatario
- Vuelo
- Aeropuerto origen
- Aeropuerto destino
- Numero de bultos
- Peso total
- Descripcion mercancia"""
    },
    "cmr": {
        "name": "CMR",
        "required_fields": ["cmr_number", "sender", "carrier", "consignee", "loading_place", "delivery_place"],
        "extraction_prompt": """Extrae los siguientes datos de este CMR:
- Numero CMR
- Remitente
- Transportista
- Destinatario
- Lugar de carga
- Lugar de entrega
- Matricula vehiculo
- Descripcion mercancia
- Peso"""
    },
    "certificate_origin": {
        "name": "Certificado de Origen",
        "required_fields": ["certificate_number", "exporter", "consignee", "country_origin", "goods_description"],
        "extraction_prompt": """Extrae los siguientes datos de este certificado de origen:
- Numero de certificado
- Exportador
- Destinatario
- Pais de origen
- Descripcion de mercancias
- Criterio de origen
- Fecha de emision
- Autoridad emisora"""
    },
    "eur1": {
        "name": "EUR.1",
        "required_fields": ["certificate_number", "exporter", "consignee", "origin_country", "destination_country"],
        "extraction_prompt": """Extrae los siguientes datos de este certificado EUR.1:
- Numero de certificado
- Exportador
- Destinatario
- Pais de origen
- Pais de destino
- Descripcion de mercancias
- Peso bruto
- Numero factura
- Fecha y firma"""
    }
}


class DocumentService:
    """Service for document validation and data extraction"""

    def __init__(self):
        self.tesseract_cmd = os.getenv("TESSERACT_CMD", "/usr/bin/tesseract")
        logger.info("Document service initialized")

    async def validate(
        self,
        document_type: str,
        document_content: Optional[str] = None,
        file_path: Optional[str] = None,
        expedition_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Validate a document and extract relevant data
        """
        config = DOCUMENT_CONFIGS.get(document_type)
        if not config:
            return {
                "is_valid": False,
                "confidence": 0,
                "extracted_data": {},
                "issues": [f"Tipo de documento no soportado: {document_type}"],
                "warnings": [],
                "auto_fill_suggestions": {}
            }

        # In production, this would:
        # 1. Read the file (PDF/image)
        # 2. Apply OCR if needed
        # 3. Send to Claude Vision for extraction
        # 4. Validate extracted data

        # For now, return a simulated validation
        return self._simulate_validation(document_type, config, expedition_context)

    async def extract(
        self,
        document_type: str,
        file_path: Optional[str] = None,
        content: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extract structured data from a document
        """
        config = DOCUMENT_CONFIGS.get(document_type)
        if not config:
            return {
                "success": False,
                "error": f"Tipo de documento no soportado: {document_type}"
            }

        # Simulated extraction
        return self._simulate_extraction(document_type, config)

    def _simulate_validation(
        self,
        document_type: str,
        config: Dict[str, Any],
        expedition_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Simulate document validation for demo purposes
        """
        # Generate sample extracted data based on document type
        extracted_data = self._generate_sample_data(document_type)

        # Validate against expedition context if provided
        issues = []
        warnings = []
        auto_fill = {}

        if expedition_context:
            # Check for consistency
            client = expedition_context.get("client", {})

            if document_type == "commercial_invoice":
                if extracted_data.get("buyer", {}).get("name") != client.get("companyName"):
                    warnings.append("El comprador en la factura no coincide con el cliente del expediente")

                auto_fill = {
                    "goods": extracted_data.get("items", []),
                    "incoterm": extracted_data.get("incoterm"),
                    "totalValue": extracted_data.get("total_value")
                }

            elif document_type == "packing_list":
                auto_fill = {
                    "totalPackages": extracted_data.get("total_packages"),
                    "totalGrossWeight": extracted_data.get("gross_weight"),
                    "totalNetWeight": extracted_data.get("net_weight")
                }

        # Check required fields
        missing_fields = []
        for field in config.get("required_fields", []):
            if field not in extracted_data or not extracted_data[field]:
                missing_fields.append(field)

        if missing_fields:
            issues.append(f"Campos faltantes: {', '.join(missing_fields)}")

        is_valid = len(issues) == 0
        confidence = 85 if is_valid else 60

        return {
            "is_valid": is_valid,
            "confidence": confidence,
            "extracted_data": extracted_data,
            "issues": issues,
            "warnings": warnings,
            "auto_fill_suggestions": auto_fill
        }

    def _simulate_extraction(
        self,
        document_type: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Simulate data extraction for demo purposes
        """
        return {
            "success": True,
            "document_type": document_type,
            "document_name": config["name"],
            "extracted_data": self._generate_sample_data(document_type),
            "confidence": 85
        }

    def _generate_sample_data(self, document_type: str) -> Dict[str, Any]:
        """
        Generate sample extracted data based on document type
        """
        samples = {
            "commercial_invoice": {
                "invoice_number": "INV-2025-001234",
                "date": "2025-01-15",
                "seller": {
                    "name": "China Export Co., Ltd.",
                    "address": "123 Trade Street, Shanghai",
                    "country": "CN"
                },
                "buyer": {
                    "name": "Importador Espanol S.L.",
                    "address": "Calle Mayor 1, Barcelona",
                    "nif": "B12345678"
                },
                "items": [
                    {
                        "description": "Electronic components",
                        "quantity": 1000,
                        "unit": "pcs",
                        "unit_price": 5.00,
                        "total": 5000.00
                    }
                ],
                "total_value": 5000.00,
                "currency": "EUR",
                "incoterm": "CIF Barcelona",
                "payment_terms": "30 days"
            },
            "packing_list": {
                "reference": "PL-2025-001234",
                "total_packages": 10,
                "package_type": "CTN",
                "gross_weight": 500.0,
                "net_weight": 450.0,
                "marks": "MADE IN CHINA",
                "items": [
                    {
                        "description": "Electronic components",
                        "packages": 10,
                        "gross_weight": 500.0,
                        "net_weight": 450.0
                    }
                ]
            },
            "bill_of_lading": {
                "bl_number": "HLCUSHA250100001",
                "shipper": "China Export Co., Ltd.",
                "consignee": "Importador Espanol S.L.",
                "notify": "Same as consignee",
                "vessel": "MSC OSCAR",
                "voyage": "025E",
                "port_loading": "CNSHA (Shanghai)",
                "port_discharge": "ESBCN (Barcelona)",
                "containers": [
                    {
                        "number": "HLCU1234567",
                        "type": "20GP",
                        "seal": "AB123456",
                        "weight": 15000
                    }
                ],
                "date_shipped": "2025-01-10"
            },
            "air_waybill": {
                "awb_number": "020-12345678",
                "shipper": "China Export Co., Ltd.",
                "consignee": "Importador Espanol S.L.",
                "flight": "IB6888",
                "origin": "ZSPD (Shanghai Pudong)",
                "destination": "LEBL (Barcelona)",
                "pieces": 5,
                "weight": 100.0,
                "description": "Electronic components"
            },
            "cmr": {
                "cmr_number": "CMR-2025-001",
                "sender": "European Supplier GmbH",
                "carrier": "Transportes Garcia S.L.",
                "consignee": "Importador Espanol S.L.",
                "loading_place": "Berlin, Germany",
                "delivery_place": "Barcelona, Spain",
                "vehicle": "1234 ABC",
                "description": "Industrial machinery",
                "weight": 2000.0
            },
            "certificate_origin": {
                "certificate_number": "CO-2025-00123",
                "exporter": "China Export Co., Ltd.",
                "consignee": "Importador Espanol S.L.",
                "country_origin": "CN",
                "goods_description": "Electronic components",
                "issuing_authority": "China Council for Promotion of Int'l Trade",
                "issue_date": "2025-01-08"
            },
            "eur1": {
                "certificate_number": "EUR1-2025-00456",
                "exporter": "European Supplier GmbH",
                "consignee": "Importador Espanol S.L.",
                "origin_country": "DE",
                "destination_country": "ES",
                "goods_description": "Industrial machinery",
                "gross_weight": 2000.0,
                "invoice_number": "INV-DE-2025-001",
                "issue_date": "2025-01-12"
            }
        }

        return samples.get(document_type, {})

    async def ocr_document(self, file_path: str) -> str:
        """
        Apply OCR to extract text from document
        In production, this would use Tesseract or similar
        """
        # Placeholder for OCR implementation
        return "[OCR text would be extracted here]"

    def validate_file_type(self, filename: str) -> bool:
        """
        Validate that the file type is supported
        """
        allowed_extensions = {'.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.doc', '.docx'}
        ext = os.path.splitext(filename)[1].lower()
        return ext in allowed_extensions
