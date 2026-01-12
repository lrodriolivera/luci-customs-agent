"""
Knowledge Base Service - FIGAD Documentation Processing
Extracts and indexes customs documentation for AI knowledge base
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Knowledge base structure
KNOWLEDGE_CATEGORIES = {
    "cau_general": {
        "name": "Codigo Aduanero de la Union (CAU)",
        "description": "Normativa general del codigo aduanero europeo",
        "keywords": ["CAU", "reglamento", "union aduanera", "952/2013"]
    },
    "classification": {
        "name": "Clasificacion Arancelaria",
        "description": "Sistema armonizado, TARIC, reglas de interpretacion",
        "keywords": ["TARIC", "clasificacion", "arancel", "nomenclatura", "partida"]
    },
    "origin": {
        "name": "Origen de Mercancias",
        "description": "Origen preferencial y no preferencial",
        "keywords": ["origen", "EUR.1", "ATR", "preferencial", "certificado"]
    },
    "customs_value": {
        "name": "Valor en Aduana",
        "description": "Determinacion del valor aduanero",
        "keywords": ["valor", "CIF", "FOB", "transaccion", "ajuste"]
    },
    "h1_import": {
        "name": "Sistema H1 Importacion",
        "description": "Nuevo sistema de declaracion de importacion H1",
        "keywords": ["H1", "importacion", "declaracion", "DUA", "libre practica"]
    },
    "aes_export": {
        "name": "AES Exportacion",
        "description": "Sistema automatizado de exportacion",
        "keywords": ["AES", "exportacion", "salida", "ECS"]
    },
    "transit": {
        "name": "Transito",
        "description": "Regimen de transito aduanero",
        "keywords": ["transito", "T1", "T2", "NCTS"]
    },
    "special_regimes": {
        "name": "Regimenes Especiales",
        "description": "Deposito, perfeccionamiento, uso final",
        "keywords": ["deposito", "perfeccionamiento", "destino final", "regimen"]
    },
    "controls": {
        "name": "Controles e Inspecciones",
        "description": "Controles sanitarios, fitosanitarios, SOIVRE",
        "keywords": ["control", "inspeccion", "MAPA", "SOIVRE", "sanitario"]
    },
    "customs_debt": {
        "name": "Deuda Aduanera",
        "description": "Nacimiento y extincion de la deuda aduanera",
        "keywords": ["deuda", "arancel", "garantia", "pago"]
    },
    "vat_taxes": {
        "name": "IVA e Impuestos",
        "description": "IVA importacion, impuestos especiales",
        "keywords": ["IVA", "impuesto", "IIEE", "fiscal"]
    },
    "representation": {
        "name": "Representacion Aduanera",
        "description": "Representacion directa e indirecta",
        "keywords": ["representacion", "directa", "indirecta", "representante"]
    },
    "free_zones": {
        "name": "Areas Exentas",
        "description": "Zonas francas y depositos francos",
        "keywords": ["zona franca", "deposito franco", "exento"]
    }
}

# Document mappings to knowledge categories
DOCUMENT_MAPPINGS = {
    "01. Ponencia_IntroCAU.pdf": ["cau_general"],
    "02. DocApoyo_Clasif_Reglas de interpretacion.pdf": ["classification"],
    "02. Ponencia_Clasificación.pdf": ["classification"],
    "03. Ponencia_FIGAD PEN 13_AAC.pdf": ["cau_general", "h1_import"],
    "04. Ponencia_Origen de las mercancias_Preferencial.pdf": ["origin"],
    "04. Ponencias_ Origen de las mercancías_No preferencial": ["origin"],
    "06. Controles MAPA Parte 2": ["controls"],
    "06. Controles MITERD Parte 3.pdf": ["controls"],
    "06. Introducción y controles Sanidad": ["controls"],
    "06. Valor Aduana FIGAD": ["customs_value"],
    "07. Proced Aduaneros Internet": ["h1_import", "aes_export"],
    "08. VUA SOIVRE.pdf": ["controls"],
    "09. Introducción de mercancía y depósito temporal": ["transit", "special_regimes"],
    "09. Tránsito 2025": ["transit"],
    "10. 1-FORMALIDADES DE SALIDA.pdf": ["aes_export"],
    "10. 1-INCLUSIÓN DE MERCANCÍA A UN RÉGIMEN": ["special_regimes"],
    "10. 2-DECLARACIÓN SIMPLIIFICADA.pdf": ["h1_import"],
    "10. 3-DESPACHO CENTRALIZADO.pdf": ["h1_import"],
    "10. 3-EXPORTACIÓN Y REEXPORTACIÓN": ["aes_export"],
    "10. 4-INSCRIPCIÓN EN LOS REGISTROS": ["h1_import"],
    "10. 5 DECLARACIÓN SUMARIA": ["aes_export"],
    "11. Ponencia_Taric Libre Práctica": ["h1_import", "classification"],
    "12. Ponencia_Representacion_Aduanera.pdf": ["representation"],
    "13. Ponencia_Areas Exentas": ["free_zones"],
    "16. Ponencia_PENINSULA": ["h1_import"],
    "17. Ponencia_FIGADPEN13_IVA.pdf": ["vat_taxes"],
    "18. Ponencia_Presentación IIEE": ["vat_taxes"],
    "19. Ponencia_FIGADPEN13_Fiscalidad": ["vat_taxes"],
    "21. Ponencia_DEUDA ADUANERA": ["customs_debt"],
    "22. Ponencia_Taric Contrabando": ["controls", "classification"],
    "H1DAIE.pdf": ["h1_import"],
    "H1DIT_2025.pdf": ["h1_import"],
    "InfCAUGENERAL.pdf": ["cau_general"],
    "Nue_sist_impH1.pdf": ["h1_import"]
}


class KnowledgeService:
    """Service for managing customs knowledge base"""

    def __init__(self):
        self.knowledge_base_path = os.getenv(
            "KNOWLEDGE_BASE_PATH",
            "/home/rypcloud/Documentos/Logistic/POC/Aduanas/drive-download-20251209T114959Z-1-001"
        )
        self.index: Dict[str, List[Dict[str, Any]]] = {cat: [] for cat in KNOWLEDGE_CATEGORIES}
        self.documents: List[Dict[str, Any]] = []
        logger.info("Knowledge service initialized")

    def get_categories(self) -> Dict[str, Any]:
        """Get all knowledge categories"""
        return KNOWLEDGE_CATEGORIES

    def search(
        self,
        query: str,
        categories: Optional[List[str]] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """
        Search the knowledge base
        In production, this would use embeddings and vector search
        """
        query_lower = query.lower()
        results = []

        # Search by keywords in categories
        matching_categories = []
        for cat_id, cat_info in KNOWLEDGE_CATEGORIES.items():
            if categories and cat_id not in categories:
                continue
            for keyword in cat_info["keywords"]:
                if keyword.lower() in query_lower:
                    matching_categories.append(cat_id)
                    break

        # Get sample results based on matching categories
        for cat_id in matching_categories[:limit]:
            cat_info = KNOWLEDGE_CATEGORIES[cat_id]
            results.append({
                "category": cat_id,
                "title": cat_info["name"],
                "description": cat_info["description"],
                "relevance": 0.85,
                "source": f"FIGAD Training - {cat_info['name']}"
            })

        return {
            "query": query,
            "results": results,
            "total_found": len(results),
            "categories_searched": categories or list(KNOWLEDGE_CATEGORIES.keys())
        }

    def get_h1_guidance(self, field: str) -> Dict[str, Any]:
        """
        Get specific guidance for H1 field completion
        """
        h1_field_guidance = {
            "regime": {
                "field": "Regimen Aduanero (D/E 1/10)",
                "description": "Codigo de regimen solicitado",
                "common_values": [
                    {"code": "40", "description": "Despacho a libre practica"},
                    {"code": "42", "description": "Libre practica con entrega intracomunitaria exenta"},
                    {"code": "44", "description": "Libre practica con destino final"},
                    {"code": "51", "description": "Perfeccionamiento activo"},
                    {"code": "53", "description": "Importacion temporal"},
                    {"code": "61", "description": "Reimportacion"},
                    {"code": "71", "description": "Deposito aduanero"}
                ],
                "rules": [
                    "Regimen 40: Uso general para importaciones definitivas",
                    "Regimen 42: Requiere EORI valido del destinatario intracomunitario",
                    "Regimen 44: Requiere autorizacion de destino final",
                    "Regimen 51: Requiere autorizacion previa de perfeccionamiento"
                ]
            },
            "preference": {
                "field": "Preferencia (D/E 4/17)",
                "description": "Codigo de tratamiento preferencial arancelario",
                "common_values": [
                    {"code": "100", "description": "Arancel normal (MFN)"},
                    {"code": "200", "description": "SPG (Sistema de Preferencias Generalizadas)"},
                    {"code": "300", "description": "Origen preferencial (acuerdos bilaterales)"},
                    {"code": "400", "description": "Union aduanera (ATR Turquia)"}
                ],
                "rules": [
                    "Preferencia 100: Sin reduccion arancelaria",
                    "Preferencia 200: Requiere certificado de origen Form A o REX",
                    "Preferencia 300: Requiere EUR.1 o declaracion en factura",
                    "Preferencia 400: Requiere ATR para productos industriales de Turquia"
                ]
            },
            "taric_code": {
                "field": "Codigo TARIC (D/E 6/14, 6/15, 6/16)",
                "description": "Clasificacion arancelaria de la mercancia",
                "structure": [
                    "Capitulo: 2 digitos",
                    "Partida: 4 digitos",
                    "Subpartida SA: 6 digitos",
                    "Subpartida NC: 8 digitos",
                    "TARIC: 10 digitos",
                    "Codigo adicional: +4 digitos opcionales"
                ],
                "rules": [
                    "Debe corresponder exactamente a la mercancia declarada",
                    "Verificar notas de seccion y capitulo",
                    "Aplicar Reglas Generales de Interpretacion (RGI)",
                    "Consultar ITV vinculantes si hay dudas"
                ]
            },
            "customs_value": {
                "field": "Valor en Aduana (D/E 4/14)",
                "description": "Base imponible para derechos de aduana",
                "calculation": [
                    "Metodo 1: Valor de transaccion (precio pagado o por pagar)",
                    "Ajustes: + transporte hasta frontera UE",
                    "Ajustes: + seguro hasta frontera UE",
                    "Ajustes: + comisiones de compra",
                    "Ajustes: + canones y licencias",
                    "Ajustes: - descuentos (si documentados)"
                ],
                "rules": [
                    "Debe expresarse en EUR",
                    "Usar tipo de cambio del mes anterior si moneda extranjera",
                    "Incoterm determina que ajustes aplicar",
                    "CIF ya incluye transporte y seguro"
                ]
            },
            "origin_country": {
                "field": "Pais de Origen (D/E 5/15, 5/16)",
                "description": "Pais donde la mercancia fue producida u obtuvo origen",
                "rules": [
                    "Producto totalmente obtenido: pais de produccion",
                    "Producto transformado: pais de ultima transformacion sustancial",
                    "Verificar reglas de origen especificas por producto",
                    "Debe coincidir con certificado de origen"
                ]
            },
            "consignment_country": {
                "field": "Pais de Procedencia (D/E 5/14)",
                "description": "Pais desde donde se expide la mercancia",
                "rules": [
                    "Puede diferir del pais de origen",
                    "Ultimo pais de expedicion antes de entrar en UE",
                    "Relevante para transbordes y consolidaciones"
                ]
            },
            "importer_eori": {
                "field": "EORI Importador (D/E 3/15, 3/16)",
                "description": "Numero de identificacion del operador economico",
                "rules": [
                    "Obligatorio para todas las operaciones aduaneras",
                    "Formato ES + NIF/CIF (ej: ESB12345678)",
                    "Debe estar activo y registrado en censo VIES",
                    "Representante tambien necesita EORI propio"
                ]
            },
            "transport_mode": {
                "field": "Modo de Transporte (D/E 7/4, 7/5)",
                "description": "Medio de transporte en la frontera",
                "common_values": [
                    {"code": "1", "description": "Maritimo"},
                    {"code": "2", "description": "Ferrocarril"},
                    {"code": "3", "description": "Carretera"},
                    {"code": "4", "description": "Aereo"},
                    {"code": "5", "description": "Envios postales"},
                    {"code": "7", "description": "Instalaciones fijas"},
                    {"code": "8", "description": "Navegacion interior"},
                    {"code": "9", "description": "Propulsion propia"}
                ]
            },
            "documents": {
                "field": "Documentos (D/E 2/3)",
                "description": "Documentos de soporte de la declaracion",
                "required_types": [
                    {"code": "N380", "description": "Factura comercial"},
                    {"code": "N714", "description": "BL (maritimo)"},
                    {"code": "N740", "description": "AWB (aereo)"},
                    {"code": "N730", "description": "CMR (carretera)"},
                    {"code": "N861", "description": "EUR.1"},
                    {"code": "N954", "description": "Packing list"},
                    {"code": "C014", "description": "Certificado sanitario"},
                    {"code": "C015", "description": "Certificado fitosanitario"}
                ]
            }
        }

        if field in h1_field_guidance:
            return h1_field_guidance[field]

        return {
            "error": f"Campo '{field}' no encontrado",
            "available_fields": list(h1_field_guidance.keys())
        }

    def get_document_requirements(
        self,
        operation_type: str,
        transport_mode: str,
        origin_country: str,
        product_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get document requirements for an operation
        """
        requirements = {
            "mandatory": [],
            "conditional": [],
            "recommended": []
        }

        # Base mandatory documents
        if operation_type in ["IMPORT", "IMPORT_H1"]:
            requirements["mandatory"].extend([
                {
                    "type": "commercial_invoice",
                    "name": "Factura Comercial",
                    "description": "Documento que acredita la transaccion comercial",
                    "validation_rules": [
                        "Debe incluir valor unitario y total",
                        "Moneda claramente indicada",
                        "Incoterm especificado",
                        "Descripcion detallada de mercancias"
                    ]
                },
                {
                    "type": "packing_list",
                    "name": "Packing List",
                    "description": "Detalle de bultos, pesos y contenido",
                    "validation_rules": [
                        "Peso bruto y neto",
                        "Numero y tipo de bultos",
                        "Marcas de envio"
                    ]
                }
            ])

            # Transport document based on mode
            transport_docs = {
                "SEA": {"type": "bill_of_lading", "name": "Bill of Lading (B/L)", "code": "N714"},
                "AIR": {"type": "air_waybill", "name": "Air Waybill (AWB)", "code": "N740"},
                "ROAD": {"type": "cmr", "name": "CMR", "code": "N730"},
                "RAIL": {"type": "cim", "name": "CIM", "code": "N720"}
            }
            if transport_mode in transport_docs:
                requirements["mandatory"].append({
                    **transport_docs[transport_mode],
                    "description": f"Documento de transporte {transport_mode}"
                })

        # Origin certificate requirements
        preferential_countries = ["JP", "KR", "MX", "CA", "SG", "VN", "CL", "PE", "CO"]
        spg_countries = ["BD", "KH", "LA", "MM", "NP", "AF", "HT"]
        turkey = ["TR"]

        if origin_country in preferential_countries:
            requirements["conditional"].append({
                "type": "certificate_origin",
                "name": "Certificado de Origen / EUR.1",
                "description": "Para aplicar arancel preferencial",
                "condition": "Si se solicita preferencia 300"
            })
        elif origin_country in spg_countries:
            requirements["conditional"].append({
                "type": "form_a",
                "name": "Form A / REX",
                "description": "Para SPG",
                "condition": "Si se solicita preferencia 200"
            })
        elif origin_country in turkey:
            requirements["conditional"].append({
                "type": "atr",
                "name": "ATR",
                "description": "Certificado de circulacion UE-Turquia",
                "condition": "Productos industriales con preferencia 400"
            })

        # Product-specific requirements
        if product_type:
            product_lower = product_type.lower()
            if any(kw in product_lower for kw in ["alimento", "comida", "food", "fruta", "vegetal"]):
                requirements["conditional"].extend([
                    {
                        "type": "sanitary_certificate",
                        "name": "Certificado Sanitario",
                        "description": "Productos de origen animal",
                        "condition": "Si producto es de origen animal"
                    },
                    {
                        "type": "phytosanitary_certificate",
                        "name": "Certificado Fitosanitario",
                        "description": "Productos vegetales",
                        "condition": "Si producto es de origen vegetal"
                    }
                ])
            if any(kw in product_lower for kw in ["quimico", "chemical", "peligroso"]):
                requirements["conditional"].append({
                    "type": "msds",
                    "name": "Ficha de Seguridad (MSDS)",
                    "description": "Productos quimicos",
                    "condition": "Obligatorio para mercancias peligrosas"
                })
            if any(kw in product_lower for kw in ["electronico", "electronic", "ce"]):
                requirements["conditional"].append({
                    "type": "ce_certificate",
                    "name": "Certificado CE",
                    "description": "Conformidad europea",
                    "condition": "Productos que requieren marcado CE"
                })

        # Recommended documents
        requirements["recommended"] = [
            {
                "type": "insurance_certificate",
                "name": "Certificado de Seguro",
                "description": "Poliza de seguro de transporte"
            },
            {
                "type": "proforma_invoice",
                "name": "Factura Proforma",
                "description": "Si la comercial no esta disponible"
            }
        ]

        return requirements

    def get_regime_info(self, regime_code: str) -> Dict[str, Any]:
        """
        Get detailed information about a customs regime
        """
        regimes = {
            "40": {
                "code": "40",
                "name": "Despacho a Libre Practica",
                "description": "Mercancia de terceros paises adquiere estatuto aduanero de mercancia de la Union",
                "requirements": [
                    "Pago de derechos de importacion",
                    "Pago de IVA (salvo regimen 42)",
                    "Cumplimiento de medidas de politica comercial",
                    "Aplicacion de prohibiciones y restricciones"
                ],
                "documents": ["Factura", "Packing List", "Transporte", "Origen si preferencia"],
                "vat": "21% (10% productos reducido, 4% superreducido)",
                "typical_use": "Importaciones definitivas para consumo en Espana"
            },
            "42": {
                "code": "42",
                "name": "Libre Practica con Entrega Intracomunitaria Exenta",
                "description": "Importacion con posterior expedicion a otro Estado miembro",
                "requirements": [
                    "Destinatario en otro Estado miembro con EORI valido",
                    "Transporte efectivo a destino",
                    "DEB/Intrastat obligatorio",
                    "IVA se paga en destino"
                ],
                "documents": ["Factura", "Transporte", "EORI destinatario", "CMR/transporte intraUE"],
                "vat": "Exento en origen, tributa en destino",
                "typical_use": "Importador Espanol que vende inmediatamente a cliente UE"
            },
            "44": {
                "code": "44",
                "name": "Libre Practica con Destino Final",
                "description": "Aplicacion de derechos reducidos condicionados a uso especifico",
                "requirements": [
                    "Autorizacion de destino final previa",
                    "Garantia durante periodo de vigilancia",
                    "Control aduanero del uso",
                    "Contabilidad de existencias"
                ],
                "documents": ["Autorizacion destino final", "Factura", "Compromiso de uso"],
                "vat": "Segun tipo de producto",
                "typical_use": "Aeronaves, buques, plataformas con arancel reducido"
            },
            "51": {
                "code": "51",
                "name": "Perfeccionamiento Activo",
                "description": "Importacion temporal para transformacion y reexportacion",
                "requirements": [
                    "Autorizacion de perfeccionamiento",
                    "Garantia de la deuda potencial",
                    "Coeficiente de rendimiento",
                    "Plazo de ultimacion"
                ],
                "documents": ["Autorizacion PA", "Factura", "Descripcion proceso"],
                "vat": "Suspendido durante regimen",
                "typical_use": "Industria de transformacion para exportacion"
            },
            "53": {
                "code": "53",
                "name": "Importacion Temporal",
                "description": "Uso temporal de mercancias con reexportacion identicas",
                "requirements": [
                    "Reexportacion de mercancias identicas",
                    "Plazo maximo 24 meses (prorrogable)",
                    "Garantia si exencion total",
                    "No pueden ser consumidas ni transformadas"
                ],
                "documents": ["Cuaderno ATA o declaracion", "Justificacion uso temporal"],
                "vat": "Exento o 3% mensual si exencion parcial",
                "typical_use": "Ferias, muestras, equipos profesionales"
            },
            "61": {
                "code": "61",
                "name": "Reimportacion con Exencion Total",
                "description": "Retorno de mercancias de la Union previamente exportadas",
                "requirements": [
                    "Mercancias originalmente de la Union",
                    "Plazo 3 anos desde exportacion",
                    "Sin transformacion sustancial",
                    "Identificacion con exportacion previa"
                ],
                "documents": ["DUA exportacion original", "Factura", "Prueba identidad"],
                "vat": "Exento si fue pagado originalmente",
                "typical_use": "Devolucion de mercancias no vendidas"
            },
            "71": {
                "code": "71",
                "name": "Deposito Aduanero",
                "description": "Almacenamiento sin pago de derechos",
                "requirements": [
                    "Deposito autorizado (publico/privado)",
                    "Contabilidad de existencias",
                    "Plazo ilimitado",
                    "Operaciones autorizadas"
                ],
                "documents": ["Inventario", "Factura", "Transporte"],
                "vat": "Suspendido",
                "typical_use": "Stock de importacion para distribucion progresiva"
            }
        }

        if regime_code in regimes:
            return regimes[regime_code]

        return {
            "error": f"Regimen '{regime_code}' no encontrado",
            "available_regimes": list(regimes.keys())
        }

    def get_incoterm_info(self, incoterm: str) -> Dict[str, Any]:
        """
        Get information about Incoterms and their impact on customs value
        """
        incoterms = {
            "EXW": {
                "name": "Ex Works",
                "group": "E",
                "delivery_point": "Instalaciones del vendedor",
                "customs_value_adjustments": [
                    "+ Transporte hasta frontera UE",
                    "+ Seguro hasta frontera UE",
                    "+ Carga en origen"
                ],
                "risk_transfer": "En instalaciones vendedor",
                "common_modes": ["Cualquiera"]
            },
            "FCA": {
                "name": "Free Carrier",
                "group": "F",
                "delivery_point": "Transportista designado",
                "customs_value_adjustments": [
                    "+ Transporte hasta frontera UE",
                    "+ Seguro hasta frontera UE"
                ],
                "risk_transfer": "Al entregar al transportista",
                "common_modes": ["Cualquiera"]
            },
            "FOB": {
                "name": "Free On Board",
                "group": "F",
                "delivery_point": "A bordo del buque",
                "customs_value_adjustments": [
                    "+ Flete maritimo hasta puerto UE",
                    "+ Seguro maritimo"
                ],
                "risk_transfer": "A bordo del buque",
                "common_modes": ["Maritimo"]
            },
            "CFR": {
                "name": "Cost and Freight",
                "group": "C",
                "delivery_point": "Puerto de destino",
                "customs_value_adjustments": [
                    "+ Seguro maritimo (si no incluido)"
                ],
                "risk_transfer": "A bordo del buque en origen",
                "common_modes": ["Maritimo"]
            },
            "CIF": {
                "name": "Cost, Insurance and Freight",
                "group": "C",
                "delivery_point": "Puerto de destino",
                "customs_value_adjustments": [
                    "Valor ya incluye transporte y seguro",
                    "Base directa para valor en aduana"
                ],
                "risk_transfer": "A bordo del buque en origen",
                "common_modes": ["Maritimo"]
            },
            "CPT": {
                "name": "Carriage Paid To",
                "group": "C",
                "delivery_point": "Lugar de destino acordado",
                "customs_value_adjustments": [
                    "+ Seguro hasta frontera UE (si no incluido)"
                ],
                "risk_transfer": "Al primer transportista",
                "common_modes": ["Cualquiera"]
            },
            "CIP": {
                "name": "Carriage and Insurance Paid To",
                "group": "C",
                "delivery_point": "Lugar de destino acordado",
                "customs_value_adjustments": [
                    "Valor incluye transporte y seguro",
                    "Verificar que seguro cubra hasta frontera UE"
                ],
                "risk_transfer": "Al primer transportista",
                "common_modes": ["Cualquiera"]
            },
            "DAP": {
                "name": "Delivered at Place",
                "group": "D",
                "delivery_point": "Lugar de destino convenido",
                "customs_value_adjustments": [
                    "- Transporte dentro de UE",
                    "- Descarga en destino"
                ],
                "risk_transfer": "En punto de destino antes de descarga",
                "common_modes": ["Cualquiera"]
            },
            "DPU": {
                "name": "Delivered at Place Unloaded",
                "group": "D",
                "delivery_point": "Lugar de destino descargado",
                "customs_value_adjustments": [
                    "- Transporte dentro de UE",
                    "- Descarga"
                ],
                "risk_transfer": "Despues de descarga en destino",
                "common_modes": ["Cualquiera"]
            },
            "DDP": {
                "name": "Delivered Duty Paid",
                "group": "D",
                "delivery_point": "Destino final despachado",
                "customs_value_adjustments": [
                    "- Transporte dentro de UE",
                    "- Derechos e impuestos ya incluidos",
                    "Calcular valor ex-duty"
                ],
                "risk_transfer": "En destino final",
                "common_modes": ["Cualquiera"]
            }
        }

        incoterm_upper = incoterm.upper().split()[0]  # Handle "CIF Barcelona" -> "CIF"

        if incoterm_upper in incoterms:
            return incoterms[incoterm_upper]

        return {
            "error": f"Incoterm '{incoterm}' no reconocido",
            "available_incoterms": list(incoterms.keys())
        }

    async def extract_pdf_content(self, file_path: str) -> Dict[str, Any]:
        """
        Extract text content from PDF
        Uses PyPDF2 for text extraction
        """
        try:
            from PyPDF2 import PdfReader

            reader = PdfReader(file_path)
            text_content = []

            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_content.append({
                        "page": page_num + 1,
                        "content": page_text
                    })

            return {
                "file_path": file_path,
                "status": "success",
                "total_pages": len(reader.pages),
                "pages_with_text": len(text_content),
                "content": text_content
            }
        except ImportError:
            logger.warning("PyPDF2 not installed, PDF extraction unavailable")
            return {
                "file_path": file_path,
                "status": "error",
                "message": "PyPDF2 not installed"
            }
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            return {
                "file_path": file_path,
                "status": "error",
                "message": str(e)
            }

    def list_available_documents(self) -> Dict[str, Any]:
        """
        List available training documents
        """
        figad_path = os.path.join(
            self.knowledge_base_path,
            "FIGAD REPRESENTANTE ADUANERO"
        )

        # Try alternate path if first doesn't exist
        if not os.path.exists(figad_path):
            figad_path = self.knowledge_base_path

        documents = []
        try:
            for filename in os.listdir(figad_path):
                if filename.endswith('.pdf'):
                    categories = []
                    for doc_pattern, cats in DOCUMENT_MAPPINGS.items():
                        if doc_pattern in filename:
                            categories = cats
                            break

                    documents.append({
                        "filename": filename,
                        "categories": categories,
                        "path": os.path.join(figad_path, filename)
                    })
        except Exception as e:
            logger.error(f"Error listing documents: {e}")

        return {
            "total_documents": len(documents),
            "documents": documents
        }
